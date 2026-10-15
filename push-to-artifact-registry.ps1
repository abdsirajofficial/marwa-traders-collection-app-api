Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Marwa Traders - Push Backend to Google Artifact Registry" -ForegroundColor Cyan
Write-Host " Project: hire-op-staging" -ForegroundColor Cyan
Write-Host " Region : asia-south1" -ForegroundColor Cyan
Write-Host " Repo   : collection-mt-api-01" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot

Write-Host "[1/3] Authenticating with Google Cloud..." -ForegroundColor Yellow
gcloud auth login

Write-Host "`n[2/3] Setting project to hire-op-staging..." -ForegroundColor Yellow
gcloud config set project hire-op-staging

Write-Host "`n[3/3] Building and pushing container image to Artifact Registry..." -ForegroundColor Yellow
gcloud builds submit --tag asia-south1-docker.pkg.dev/hire-op-staging/collection-mt-api-01/marwa-api:latest .

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " Image successfully pushed to:" -ForegroundColor Green
Write-Host " asia-south1-docker.pkg.dev/hire-op-staging/collection-mt-api-01/marwa-api:latest" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
