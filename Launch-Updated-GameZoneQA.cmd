@echo off
setlocal
pushd "%~dp0"
"%~dp0node_modules\electron\dist\electron.exe" .
set "appExitCode=%ERRORLEVEL%"
popd
exit /b %appExitCode%
