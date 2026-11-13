# Prüft Authenticode-Signaturen mit signtool (Richtlinie für Programme, /pa) und optional den Fingerabdruck des Signierers.
param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Dateien, [string]$Fingerabdruck)
$ErrorActionPreference = 'Stop'
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
  Sort-Object { [version]$_.Directory.Parent.Name } -Descending | Select-Object -First 1
foreach ($d in $Dateien) {
  & $signtool.FullName verify /pa /tw $d
  if ($LASTEXITCODE -ne 0) { throw "Signatur ungültig: $d" }
  $sig = Get-AuthenticodeSignature -LiteralPath $d
  if ($Fingerabdruck -and $sig.SignerCertificate.Thumbprint -ne $Fingerabdruck) { throw "Falscher Signierer in $d" }
  if (-not $sig.TimeStamperCertificate) { throw "Kein Zeitstempel in $d" }
  Write-Host "Signatur gültig: $d ($($sig.SignerCertificate.Subject))"
}
