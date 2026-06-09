$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$ok = $true

function Check($label, $pass, $hint) {
    if ($pass) { Write-Host "[OK] $label" -ForegroundColor Green }
    else { Write-Host "[!!] $label" -ForegroundColor Yellow; if ($hint) { Write-Host "     $hint" }; $script:ok = $false }
}

Write-Host "`n=== فحص الجاهزية لنشر AppGallery ===`n"

Check "keystore.properties" (Test-Path (Join-Path $root "keystore.properties")) "npm run keystore:generate"
Check "gostasrv-release.jks" (Test-Path (Join-Path $root "credentials\gostasrv-release.jks")) "npm run keystore:generate"

$envProd = Join-Path $root ".env.production"
Check ".env.production" (Test-Path $envProd) "انسخ .env.production.example وعدّل EXPO_PUBLIC_API_URL"

$icon = Join-Path $root "assets\icon.png"
Check "assets/icon.png" (Test-Path $icon) "أضف أيقونة 1024x1024 — راجع assets/README.md"

$agc = Join-Path $root "android\app\agconnect-services.json"
Check "agconnect-services.json" (Test-Path $agc) "حمّله من AppGallery Connect → android/app/"

if (Test-Path $envProd) {
    $api = Select-String -Path $envProd -Pattern "^EXPO_PUBLIC_API_URL=(.+)$" | ForEach-Object { $_.Matches[0].Groups[1].Value }
    Check "API إنتاج (https)" ($api -match "^https://") "استخدم https://api.yourdomain.com"
}

Write-Host ""
if ($ok) { Write-Host "جاهز للبناء: npm run build:release" -ForegroundColor Cyan }
else { Write-Host "أكمل العناصر أعلاه ثم أعد الفحص." -ForegroundColor Yellow }
Write-Host ""
