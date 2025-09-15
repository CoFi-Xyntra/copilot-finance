#!/bin/bash
# Script para desplegar el backend con variables de entorno

# Cargar variables desde .env si existe
if [ -f "frontend/.env" ]; then
    echo "🔒 Cargando variables de entorno desde frontend/.env"
    export $(grep -v '^#' frontend/.env | xargs)
fi

# Verificar que la API key esté configurada
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "❌ Error: DEEPSEEK_API_KEY no está configurada"
    echo "   Asegúrate de tener frontend/.env con:"
    echo "   DEEPSEEK_API_KEY=sk-tu-api-key-aqui"
    exit 1
fi

echo "✅ DEEPSEEK_API_KEY configurada: ${DEEPSEEK_API_KEY:0:10}..."

# Desplegar backend
echo "🚀 Desplegando backend..."
dfx deploy backend

echo "✅ Deploy completado!"