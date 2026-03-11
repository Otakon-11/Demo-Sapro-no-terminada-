@echo off
title SAPRO Dashboard Launcher - CITS
cd /d "%~dp0"

echo ==========================================
echo    Lanzador de SAPRO Dashboard (CITS)
echo ==========================================
echo.

echo [1] Iniciando Servidor Backend...
if not exist "%~dp0server\node_modules" (
  echo Instalando dependencias del servidor...
  cd /d "%~dp0server" && npm install && cd /d "%~dp0"
)
start "SAPRO Backend" cmd /k "cd /d "%~dp0server" && npm start"

echo [2] Iniciando Cliente Vite...
if not exist "%~dp0client\node_modules" (
  echo Instalando dependencias del cliente...
  cd /d "%~dp0client" && npm install && cd /d "%~dp0"
)
start "SAPRO Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo Esperando a que los servicios inicien...
timeout /t 6 /nobreak > nul

echo [3] Abriendo navegador en http://localhost:5173
start http://localhost:5173

echo.
echo ==========================================
echo    Todo listo! SAPRO esta en marcha.
echo ==========================================
pause
