$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$credDir = Join-Path $root "credentials"
$keystore = Join-Path $credDir "gostasrv-release.jks"
$propsFile = Join-Path $root "keystore.properties"
$example = Join-Path $root "keystore.properties.example"

if (-not (Test-Path $credDir)) {
    New-Item -ItemType Directory -Path $credDir | Out-Null
}

if (Test-Path $keystore) {
    Write-Host "الملف موجود مسبقاً: $keystore"
    exit 0
}

$storePass = Read-Host "كلمة مرور الـ keystore (احفظها في مكان آمن)"
$keyPass = Read-Host "كلمة مرور المفتاح (Enter لنفس كلمة الـ keystore)"
if ([string]::IsNullOrWhiteSpace($keyPass)) { $keyPass = $storePass }

$dname = "CN=GOSTA, OU=Mobile, O=Gostasrv, L=Riyadh, ST=Riyadh, C=SA"

keytool -genkeypair -v `
    -storetype PKCS12 `
    -keystore $keystore `
    -alias gostasrv `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $storePass `
    -keypass $keyPass `
    -dname $dname

@"
storeFile=credentials/gostasrv-release.jks
storePassword=$storePass
keyAlias=gostasrv
keyPassword=$keyPass
"@ | Set-Content -Path $propsFile -Encoding UTF8

Write-Host ""
Write-Host "تم إنشاء:"
Write-Host "  $keystore"
Write-Host "  $propsFile"
Write-Host ""
Write-Host "SHA-256 لـ AppGallery:"
keytool -list -v -keystore $keystore -alias gostasrv -storepass $storePass | Select-String "SHA256:"
