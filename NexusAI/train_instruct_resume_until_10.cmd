@echo off
setlocal
cd /d "%~dp0"

if not exist "logs" mkdir "logs"

set "CONSOLE_LOG=logs\resume-to-10.console.log"

echo ============================================================>> "%CONSOLE_LOG%"
echo Starting instruct resume training at %DATE% %TIME%>> "%CONSOLE_LOG%"
echo Command: python train.py --config config.micro-instruct-fullstack.json --resume --epochs 999 --stop_at 10:00 --log_interval 20>> "%CONSOLE_LOG%"

python train.py --config "config.micro-instruct-fullstack.json" --resume --epochs 999 --stop_at 10:00 --log_interval 20 >> "%CONSOLE_LOG%" 2>&1

echo Finished at %DATE% %TIME% with exit code %ERRORLEVEL%>> "%CONSOLE_LOG%"
endlocal
