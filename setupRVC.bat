@echo off
setlocal
title TheyCallMeMiku - RVC Setup

echo.
echo ==========================================
echo       TheyCallMeMiku - RVC Setup
echo ==========================================
echo.
echo This script MUST be executed using CMD.
echo Make sure Python 3.12, Git and FFmpeg are installed.
echo.
pause

REM ==========================================
REM CHECK PREREQUISITES
REM ==========================================

echo.
echo [1/7] Checking prerequisites...

where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git was not found in PATH.
    goto :error
)

py -3.12 --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3.12 was not found.
    goto :error
)

where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo ERROR: FFmpeg is not installed or not available in PATH.
    echo Please install FFmpeg before continuing.
    goto :error
)

ffmpeg -version
if errorlevel 1 goto :error

echo.
echo Git, Python 3.12 and FFmpeg are available!

REM ==========================================
REM CLONE RVC
REM ==========================================

echo.
echo [2/7] Downloading RVC...

if not exist "Retrieval-based-Voice-Conversion-WebUI" (
    git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git
    if errorlevel 1 goto :error
)

cd /d "Retrieval-based-Voice-Conversion-WebUI"
if errorlevel 1 goto :error

REM ==========================================
REM PYTHON ENVIRONMENT
REM ==========================================

echo.
echo [3/7] Setting up Python environment...

if not exist ".venv\Scripts\python.exe" (
    py -3.12 -m venv .venv
    if errorlevel 1 goto :error
)

call .venv\Scripts\activate.bat
if errorlevel 1 goto :error

python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :error

if not exist "requirments_cpu_py312.txt" (
    echo ERROR: requirments_cpu_py312.txt was not found.
    goto :error
)

python -m pip install -r requirments_cpu_py312.txt
if errorlevel 1 goto :error

REM ==========================================
REM CPU CONFIGURATION
REM ==========================================

echo.
echo [4/7] CPU configuration...
echo.
echo Open configs\config.py
echo Set line 177 to 'self.dml = False'
echo.
echo This disables DirectML and enables CPU inference.
echo If you use a compatible GPU configuration, you can keep your existing settings.
echo.
pause

REM ==========================================
REM DOWNLOAD HUBERT AND RMVPE
REM ==========================================

echo.
echo [5/7] Downloading HuBERT and RMVPE...

if not exist "assets\hubert_base" mkdir "assets\hubert_base"
if not exist "assets\rmvpe" mkdir "assets\rmvpe"

curl -fL "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/hubert_base/config.json?download=true" -o "assets\hubert_base\config.json"
if errorlevel 1 goto :error

curl -fL "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/hubert_base/preprocessor_config.json?download=true" -o "assets\hubert_base\preprocessor_config.json"
if errorlevel 1 goto :error

curl -fL "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/hubert_base/pytorch_model.bin?download=true" -o "assets\hubert_base\pytorch_model.bin"
if errorlevel 1 goto :error

curl -fL "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.pt?download=true" -o "assets\rmvpe\rmvpe.pt"
if errorlevel 1 goto :error

REM ==========================================
REM DOWNLOAD MIKU MODEL
REM ==========================================

echo.
echo [6/7] Downloading Miku RVC model...

cd /d ..

if not exist "miku" mkdir "miku"

curl -fL "https://huggingface.co/aple/HatsuneMikuRVC/resolve/main/miku_power_rvc.zip?download=true" -o "miku\miku_power_rvc.zip"
if errorlevel 1 goto :error

echo.
echo Extracting Miku model...

powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath 'miku\miku_power_rvc.zip' -DestinationPath 'miku\extracted' -Force"

if errorlevel 1 (
    echo ERROR: Failed to extract Miku model.
    goto :error
)

if not exist "miku\extracted\miku_power_rvc\weights\miku_power_rvc.pth" (
    echo ERROR: Model file was not found in the expected folder.
    goto :error
)

copy /Y "miku\extracted\miku_power_rvc\weights\miku_power_rvc.pth" "miku\miku_power_rvc.pth"

if errorlevel 1 goto :error

rmdir /S /Q "miku\extracted"

if not exist "miku\miku_power_rvc.pth" (
    echo ERROR: Final model file is missing.
    goto :error
)

echo Miku RVC model installed successfully!

REM ==========================================
REM FINISH
REM ==========================================

echo.
echo [7/7] Verifying installation...

if not exist "Retrieval-based-Voice-Conversion-WebUI\.venv\Scripts\python.exe" goto :error
if not exist "miku\miku_power_rvc.pth" goto :error
if not exist "Retrieval-based-Voice-Conversion-WebUI\assets\hubert_base\pytorch_model.bin" goto :error
if not exist "Retrieval-based-Voice-Conversion-WebUI\assets\rmvpe\rmvpe.pt" goto :error

echo.
echo ==========================================
echo          SETUP COMPLETED!
echo ==========================================
echo.
echo RVC is ready to be used with TheyCallMeMiku.
echo.
echo Remember to keep FFmpeg available in PATH
echo when running the Node.js server.
echo.
pause
exit /b 0

:error
echo.
echo ==========================================
echo             SETUP FAILED
echo ==========================================
echo.
echo Check the error messages above.
echo Fix the issue and run this script again.
echo.
pause
exit /b 1