# Signiert eine Datei mit signtool. Tauri ruft das Skript als signCommand für die App-EXE und die Installer auf, aber nur,
# wenn die GitHub Action die Secrets WINDOWS_PFX_BASE64 und WINDOWS_PFX_PASSWORT hat (sonst baut sie unsigniert).
# Zertifikat und Passwort kommen nur aus Umgebungsvariablen, nie aus dem Repo.
param([Parameter(Mandatory = $true)][string]$Datei)
$ErrorActionPreference = 'Stop'

if (-not $env:WINDOWS_PFX_BASE64 -or -not $env:WINDOWS_PFX_PASSWORT) { throw 'WINDOWS_PFX_BASE64 oder WINDOWS_PFX_PASSWORT fehlt' }
if (-not (Test-Path -LiteralPath $Datei)) { throw "Zu signierende Datei fehlt: $Datei" }

# signtool aus dem neuesten Windows SDK des Runners
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
  Sort-Object { [version]$_.Directory.Parent.Name } -Descending | Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe nicht gefunden (Windows SDK fehlt)' }

$tmp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$pfx = Join-Path $tmp ("signatur-" + [guid]::NewGuid() + ".pfx")
$zeitstempel = if ($env:WINDOWS_ZEITSTEMPEL) { $env:WINDOWS_ZEITSTEMPEL } else { 'http://timestamp.digicert.com' }
try {
  [IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:WINDOWS_PFX_BASE64))
  # Zeitstempeldienste sind manchmal kurz weg: dreimal versuchen
  for ($versuch = 1; $versuch -le 3; $versuch++) {
    & $signtool.FullName sign /fd SHA256 /td SHA256 /tr $zeitstempel /f $pfx /p $env:WINDOWS_PFX_PASSWORT /d RespawnedLearn $Datei
    if ($LASTEXITCODE -eq 0) { break }
    if ($versuch -eq 3) { throw "signtool scheiterte an $Datei (Code $LASTEXITCODE)" }
    Start-Sleep -Seconds (5 * $versuch)
  }
} finally {
  Remove-Item -LiteralPath $pfx -Force -ErrorAction SilentlyContinue
}
Write-Host "Signiert: $Datei"
