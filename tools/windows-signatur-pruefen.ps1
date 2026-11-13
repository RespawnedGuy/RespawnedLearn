# Prüft die Authenticode-Signatur der Installer UND der App-EXE darin (die ausgelieferte Datei, nicht die in target/,
# die Tauri je Paketart nachbearbeitet). MSI per Admin-Installation, NSIS per 7-Zip entpacken. Optional: Fingerabdruck.
param([Parameter(Mandatory = $true)][string[]]$Installer, [string]$Fingerabdruck)
$ErrorActionPreference = 'Stop'
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
  Sort-Object { [version]$_.Directory.Parent.Name } -Descending | Select-Object -First 1

function Pruefe([string]$d) {
  & $signtool.FullName verify /pa $d
  if ($LASTEXITCODE -ne 0) { throw "Signatur ungültig: $d" }
  $sig = Get-AuthenticodeSignature -LiteralPath $d
  if ($Fingerabdruck -and $sig.SignerCertificate.Thumbprint -ne $Fingerabdruck) { throw "Falscher Signierer in $d" }
  if (-not $sig.TimeStamperCertificate) { throw "Kein Zeitstempel in $d" }
  Write-Host "Signatur gültig: $d ($($sig.SignerCertificate.Subject))"
}

foreach ($i in $Installer) {
  $datei = (Resolve-Path -LiteralPath $i).Path
  Pruefe $datei
  $ziel = Join-Path $env:RUNNER_TEMP ('entpackt-' + [guid]::NewGuid())
  if ($datei -like '*.msi') {
    $p = Start-Process msiexec.exe -ArgumentList '/a', "`"$datei`"", '/qn', "TARGETDIR=`"$ziel`"" -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "MSI ließ sich nicht entpacken ($($p.ExitCode))" }
  } else {
    & 7z x $datei "-o$ziel" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "NSIS-Installer ließ sich nicht entpacken ($LASTEXITCODE)" }
  }
  $app = Get-ChildItem $ziel -Recurse -Filter respawnedlearn.exe | Select-Object -First 1
  if (-not $app) { throw "respawnedlearn.exe fehlt in $datei" }
  Pruefe $app.FullName
}
