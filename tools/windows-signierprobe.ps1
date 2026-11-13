# Probe für den Signierschalter, solange kein echtes Zertifikat hinterlegt ist: erzeugt auf dem Runner ein
# Wegwerf-Zertifikat, macht ihm vertraut und gibt es als PFX in die Umgebung der folgenden Schritte. Danach baut die
# Action noch einmal mit signCommand und prüft mit `signtool verify`. Die veröffentlichten Pakete stammen aus dem
# ersten, unsignierten Build; das Wegwerf-Zertifikat verlässt den Runner nie.
$ErrorActionPreference = 'Stop'
$zert = New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=RespawnedLearn Signierprobe' `
  -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddDays(2)
$passwort = [guid]::NewGuid().ToString('N')
$pfx = Join-Path $env:RUNNER_TEMP 'probe.pfx'
Export-PfxCertificate -Cert $zert -FilePath $pfx -Password (ConvertTo-SecureString $passwort -AsPlainText -Force) | Out-Null
$cer = Join-Path $env:RUNNER_TEMP 'probe.cer'
Export-Certificate -Cert $zert -FilePath $cer | Out-Null
Import-Certificate -FilePath $cer -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Import-Certificate -FilePath $cer -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null
Write-Host "::add-mask::$passwort"
"WINDOWS_PFX_BASE64=$([Convert]::ToBase64String([IO.File]::ReadAllBytes($pfx)))" | Out-File $env:GITHUB_ENV -Append -Encoding utf8
"WINDOWS_PFX_PASSWORT=$passwort" | Out-File $env:GITHUB_ENV -Append -Encoding utf8
"PROBE_FINGERABDRUCK=$($zert.Thumbprint)" | Out-File $env:GITHUB_ENV -Append -Encoding utf8
Remove-Item $pfx, $cer
