param(
  [ValidateSet('Configure','Upload','VerifyAssets','Preview','Publish','VerifySite','AuditInventory')]
  [string]$Action = 'Configure',
  [string]$Site = '',
  [switch]$Full,
  [string]$ReleaseId = '',
  [string]$QualificationRun = '',
  [string]$ExpectedVersion = '',
  [string]$BaselineRun = '',
  [string]$Package = 'cloudflare-release/package',
  [string]$Output = 'cloudflare-release/publication'
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$credentialDirectory = Join-Path $env:LOCALAPPDATA 'MathsDock'
$credentialFile = Join-Path $credentialDirectory 'r2-credentials.xml'
if ($Action -eq 'Configure') {
  $account = Read-Host 'Cloudflare Account ID (from R2 Account Details)'
  if ($account -notmatch '^[a-f0-9]{32}$') { throw 'Account ID must be 32 lowercase hexadecimal characters.' }
  $accessKey = Read-Host 'R2 Access Key ID (hidden)' -AsSecureString
  $secretKey = Read-Host 'R2 Secret Access Key (hidden)' -AsSecureString
  if ($accessKey.Length -eq 0 -or $secretKey.Length -eq 0) { throw 'Both keys are required.' }
  New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
  [pscustomobject]@{ AccountID=$account; AccessKey=$accessKey; SecretKey=$secretKey } | Export-Clixml -LiteralPath $credentialFile
  Write-Host "Saved Windows-encrypted credentials outside the repository at $credentialFile"
  Write-Host 'Only your Windows user on this computer can decrypt these keys.'
  exit 0
}
if ($Action -eq 'Publish') {
  if ($QualificationRun -notmatch '^\d+$' -or $ReleaseId -notmatch '^[a-f0-9]{64}$' -or $ExpectedVersion -notmatch '^[a-f0-9-]{36}$') { throw 'Publish requires -QualificationRun, exact -ReleaseId and -ExpectedVersion.' }
  if ($Site -and $Site -ne 'https://mathsdock.co.uk') { throw 'Publish targets only https://mathsdock.co.uk.' }
  if ($Full) { throw 'Run an explicit full audit first; Publish never changes qualification or verification flags implicitly.' }
  $dispatch = @('workflow','run','cloudflare.yml','--repo','tboughen/maths-booklet-tools','--ref','main','-f','target=production','-f',"qualification_run=$QualificationRun",'-f',"release_id=$ReleaseId",'-f',"expected_version=$ExpectedVersion",'-f','site_url=https://mathsdock.co.uk')
  if ($BaselineRun) { if ($BaselineRun -notmatch '^\d+$') { throw 'Invalid baseline run ID.' }; $dispatch += @('-f',"baseline_run=$BaselineRun") }
  & gh @dispatch
  if ($LASTEXITCODE -ne 0) { throw 'Publication workflow dispatch failed; no deployment success is claimed.' }
  Write-Host 'Publication requested through the main workflow. Check its live-verification result before reporting success.'
  exit 0
}
if (-not (Test-Path -LiteralPath $credentialFile)) { throw 'Run this script with -Action Configure first.' }
$stored = Import-Clixml -LiteralPath $credentialFile
$names = @('CLOUDFLARE_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  $env:CLOUDFLARE_ACCOUNT_ID = $stored.AccountID
  $env:R2_ACCESS_KEY_ID = [System.Net.NetworkCredential]::new('', $stored.AccessKey).Password
  $env:R2_SECRET_ACCESS_KEY = [System.Net.NetworkCredential]::new('', $stored.SecretKey).Password
  $arguments = @((Join-Path $PSScriptRoot 'publish.mjs'))
  switch ($Action) {
    'Upload' { $arguments += 'upload' }
    'VerifyAssets' { $arguments += 'verify-assets' }
    'Preview' {
      if (-not $Site -or -not $ReleaseId -or -not $ExpectedVersion) { throw 'Preview requires -Site, -ReleaseId and -ExpectedVersion for the qualified package.' }
      $arguments = @((Join-Path $PSScriptRoot 'promote.mjs'),'promote','--preview',"--package=$Package", "--release-id=$ReleaseId", "--expected-version=$ExpectedVersion", "--output=$Output")
    }
    'AuditInventory' { $arguments = @((Join-Path $PSScriptRoot 'promote.mjs'),'audit','--audit-inventory',"--package=$Package", "--output=$Output") }
    'VerifySite' { $arguments += 'verify-site' }
  }
  if ($Site) { $arguments += "--site=$Site" }
  if ($Full) { $arguments += '--full' }
  Push-Location $repoRoot
  try { & node @arguments; $result = $LASTEXITCODE } finally { Pop-Location }
  if ($result -ne 0) { throw 'Publishing stopped. See the check result above.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
  $stored = $null
}
