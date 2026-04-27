#!/bin/bash

# Obtener la ruta del directorio actual donde está el script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "=========================================="
echo "   Lanzador de SAPRO Dashboard (CITS)"
echo "=========================================="
echo ""

# 1. Iniciar el Servidor Backend
echo "[1] Iniciando Servidor Backend..."
cd "$DIR/server" || exit
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias del servidor..."
    npm install
fi

# Iniciar servidor en segundo plano
npm start &
SERVER_PID=$!

# 2. Iniciar el Cliente Vite
echo "[2] Iniciando Cliente Vite..."
cd "$DIR/client" || exit
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias del cliente..."
    npm install
fi

# Iniciar cliente en segundo plano
npm run dev &
CLIENT_PID=$!

echo ""
echo "Esperando a que los servicios inicien..."
sleep 6

echo "[3] Abriendo navegador en http://localhost:5173"
# Intentar abrir el navegador en Linux
xdg-open "http://localhost:5173" 2>/dev/null || echo "Abre http://localhost:5173 en tu navegador"

echo ""
echo "=========================================="
echo "   Todo listo! SAPRO esta en marcha."
echo "   Presiona Ctrl+C para detener ambos."
echo "=========================================="

# Esperar para que los procesos no terminen inmediatamente si se corre sin terminal
wait $SERVER_PID $CLIENT_PID
