@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
pushd "%~dp0"
"%~dp0node_modules\electron\dist\electron.exe" . --disable-gpu
set "appExitCode=%ERRORLEVEL%"
popd
exit /b %appExitCode%
