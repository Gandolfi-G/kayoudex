@echo off
cd /d "%~dp0"
set "PYTHON=C:\Users\madsn\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "URL=http://127.0.0.1:8000/"

start "Kayoudex local" /min "%PYTHON%" -m http.server 8000 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" "%URL%"
