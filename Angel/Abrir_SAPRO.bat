@echo off
title SAPRO Dashboard Launcher - CITIS
echo ==========================================
echo    Lanzador de SAPRO Dashboard (CITIS)
echo ==========================================
echo.

echo [1] Iniciando Servidor Backend...
start "SAPRO Backend" cmd /c "cd server && npm start"

echo [2] Iniciando Cliente Vite...
start "SAPRO Frontend" cmd /c "cd client && npm run dev"

echo.
echo Esperando a que los servicios inicien...
timeout /t 5 /nobreak > nul

echo [3] Abriendo navegador en http://localhost:5173
start http://localhost:5173

echo.
echo ==========================================
echo    Todo listo! SAPRO esta en marcha.
echo ==========================================
pause
