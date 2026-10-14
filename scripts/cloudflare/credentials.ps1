param(
  [ValidateSet('Configure','Upload','VerifyAssets','Preview','Publish','VerifySite')]
  [string]$Action = 'Configure',
  [string]$Site = '',
  [switch]$Full
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
    'Preview' { $arguments += @('deploy','--preview'); if (-not $Site) { throw 'Preview needs -Site with the Workers preview URL.' } }
    'Publish' { $arguments += 'deploy' }
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
