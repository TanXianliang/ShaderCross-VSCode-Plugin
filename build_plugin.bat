@echo on

REM Very simple build script for ShaderCross VSCode plugin
SET PLUGIN_DIR=f:\Workspace\ShaderCross-VSCode-Plugin\shadercross
SET OUTPUT_DIR=f:\Workspace\ShaderCross-VSCode-Plugin\build_output

REM Create output directory
mkdir "%OUTPUT_DIR%" 2>nul

echo "Building plugin..."
cd "%PLUGIN_DIR%"

REM Run packaging command using npx since vsce is a dev dependency
echo "Running packaging command..."
echo y | npx vsce package

REM Check if VSIX file exists
echo "Checking for VSIX files in %PLUGIN_DIR%..."
dir "*.vsix" /b 2>nul

REM If VSIX exists, copy it
if exist "*.vsix" (
    echo "Moving VSIX file to %OUTPUT_DIR%..."
    move "*.vsix" "%OUTPUT_DIR%\"
    echo "Checking output directory..."
    dir "%OUTPUT_DIR%" /b
) else (
    echo "ERROR: No VSIX files found!"
)

echo "Done!"
pause