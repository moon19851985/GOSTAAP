$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$propsFile = Join-Path $root "keystore.properties"

if (-not (Test-Path $propsFile)) {
    Write-Host "لم يُعثر على keystore.properties — شغّل: npm run keystore:generate"
    exit 1
}

$props = @{}
Get-Content $propsFile | ForEach-Object {
    if ($_ -match "^\s*([^#=]+)=(.*)$") {
        $props[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$storeFile = Join-Path $root ($props["storeFile"] -replace "/", [IO.Path]::DirectorySeparatorChar)
$alias = $props["keyAlias"]
$storePass = $props["storePassword"]

if (-not (Test-Path $storeFile)) {
    Write-Host "لم يُعثر على: $storeFile"
    exit 1
}

Write-Host "بصمة SHA-256 — أضفها في AppGallery Connect → App information → SHA-256:"
keytool -list -v -keystore $storeFile -alias $alias -storepass $storePass | Select-String "SHA256:"
