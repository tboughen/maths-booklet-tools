<#
.SYNOPSIS
  Real-Word check for MathsDock Word worksheets (A3 Word worksheets plan, option 4).

.DESCRIPTION
  Opens each .docx in a folder with desktop Word, read-only, saves a PDF beside it exactly as Word
  lays it out, and writes word-check.json with Word's own page count for every file. A worksheet
  must be exactly 2 pages. Nothing is edited, uploaded or deleted. It does what the Python package
  docx2pdf does on Windows, without installing anything.

  Run it only when Tim agrees, on a Windows computer with Microsoft Word:
    powershell -ExecutionPolicy Bypass -File word-to-pdf.ps1 -Folder "C:\path\to\word-files"

  Then upload the PDFs and word-check.json to the project, so they can be compared with the
  LibreOffice preview and the layout prediction.

.PARAMETER Folder
  The folder holding the .docx files (for example the output of scripts/resource/word.mjs).
#>
param([Parameter(Mandatory = $true)][string]$Folder)

$ErrorActionPreference = "Stop"
$files = Get-ChildItem -Path $Folder -Filter *.docx | Where-Object { -not $_.Name.StartsWith("~$") }
if (-not $files) { Write-Host "No .docx files in $Folder"; exit 1 }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$version = $word.Version
Add-Type -AssemblyName System.Drawing
$installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
$results = @()
try {
  foreach ($f in $files) {
    # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
    $doc = $word.Documents.Open($f.FullName, $false, $true, $false)
    try {
      $doc.Repaginate()
      $pages = $doc.ComputeStatistics(2)   # wdStatisticPages
      $pdf = [System.IO.Path]::ChangeExtension($f.FullName, ".word.pdf")
      $doc.SaveAs2([ref]$pdf, [ref]17)     # wdFormatPDF
      $results += [pscustomobject]@{ file = $f.Name; pages = $pages; twoSides = ($pages -eq 2); pdf = [System.IO.Path]::GetFileName($pdf) }
      Write-Host ("{0}: {1} pages{2}" -f $f.Name, $pages, $(if ($pages -eq 2) { "" } else { "  <-- should be 2" }))
    } finally {
      $doc.Close([ref]0)                    # wdDoNotSaveChanges
    }
  }
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

$report = [pscustomobject]@{
  word = $version
  checkedAt = (Get-Date).ToString("s")
  # If Inter is installed, Word uses it instead of the embedded copy; say so in the comparison.
  interInstalled = [bool]($installed -contains "Inter")
  files = $results
}
$report | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $Folder "word-check.json")
Write-Host "Wrote word-check.json"
