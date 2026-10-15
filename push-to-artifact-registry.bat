@echo off
echo ========================================================
echo  Marwa Traders - Push Backend to Google Artifact Registry
echo  Project: hire-op-staging
echo  Region : asia-south1
echo  Repo   : collection-mt-api-01
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Authenticating with Google Cloud...
call gcloud auth login

echo.
echo [2/3] Setting project to hire-op-staging...
call gcloud config set project hire-op-staging

echo.
echo [3/3] Building and pushing container image to Artifact Registry...
call gcloud builds submit --tag asia-south1-docker.pkg.dev/hire-op-staging/collection-mt-api-01/marwa-api:latest .

echo.
echo ========================================================
echo  Image successfully pushed to:
echo  asia-south1-docker.pkg.dev/hire-op-staging/collection-mt-api-01/marwa-api:latest
echo ========================================================
pause
