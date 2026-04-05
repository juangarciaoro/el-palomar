# Deploy script para El Palomar Alexa Skill Lambda
# Ejecutar desde la raiz del proyecto: .\alexa-skill\deploy.ps1

$ErrorActionPreference = 'Stop'

$lambdaDir   = Join-Path $PSScriptRoot 'lambda'
$zipPath     = Join-Path $PSScriptRoot 'deployment.zip'
$functionName = 'el-palomar-alexa'

Write-Host "=== El Palomar — Lambda Deploy ===" -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "`n[1/3] Instalando dependencias npm..." -ForegroundColor Yellow
Push-Location $lambdaDir
npm install --omit=dev
Pop-Location

# 2. Create zip
Write-Host "`n[2/3] Creando deployment.zip..." -ForegroundColor Yellow
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Zip only the lambda/ folder contents (not the folder itself)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$files = Get-ChildItem -Path $lambdaDir -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\\.git\\' -and $_.Name -ne 'deploy.ps1'
}
foreach ($file in $files) {
  $entryName = $file.FullName.Substring($lambdaDir.Length + 1).Replace('\', '/')
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName) | Out-Null
}
$zip.Dispose()
Write-Host "  -> $zipPath ($('{0:N1}' -f ((Get-Item $zipPath).Length / 1MB)) MB)"

# 3. Upload to AWS Lambda (requires AWS CLI configured)
Write-Host "`n[3/3] Subiendo a AWS Lambda '$functionName'..." -ForegroundColor Yellow

$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if ($null -eq $awsCli) {
  Write-Host "  [AVISO] AWS CLI no encontrado." -ForegroundColor Red
  Write-Host "  Sube manualmente deployment.zip en AWS Console > Lambda > $functionName > Code > Upload from .zip" -ForegroundColor Yellow
  Write-Host "`nDeploy manual completado. Sube el zip manualmente." -ForegroundColor Green
  exit 0
}

aws lambda update-function-code `
  --function-name $functionName `
  --zip-file "fileb://$zipPath" `
  --no-cli-pager

Write-Host "`n=== Deploy completado ===" -ForegroundColor Green
Write-Host "Recuerda configurar las variables de entorno en Lambda si es la primera vez:"
Write-Host "  FIREBASE_SERVICE_ACCOUNT = <contenido JSON del service account>"
Write-Host "  FIREBASE_PROJECT_ID      = el-palomar-abed2"
