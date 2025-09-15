#!/bin/bash
# Script para desplegar el backend con variables de entorno

# Cargar variables desde .env si existe
if [ -f "frontend/.env" ]; then
    echo "🔒 Cargando variables de entorno desde frontend/.env"
    export $(grep -v '^#' frontend/.env | xargs)
fi

# Verificar que las API keys estén configuradas
missing_keys=()

if [ -z "$DEEPSEEK_API_KEY" ]; then
    missing_keys+=("DEEPSEEK_API_KEY")
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
    missing_keys+=("OPENROUTER_API_KEY")
fi

if [ ${#missing_keys[@]} -gt 0 ]; then
    echo "❌ Error: Las siguientes API keys no están configuradas:"
    for key in "${missing_keys[@]}"; do
        echo "   - $key"
    done
    echo ""
    echo "   Asegúrate de tener frontend/.env con:"
    echo "   DEEPSEEK_API_KEY=sk-tu-deepseek-api-key-aqui"
    echo "   OPENROUTER_API_KEY=sk-or-v1-tu-openrouter-api-key-aqui"
    exit 1
fi

echo "✅ DEEPSEEK_API_KEY configurada: ${DEEPSEEK_API_KEY:0:10}..."
echo "✅ OPENROUTER_API_KEY configurada: ${OPENROUTER_API_KEY:0:15}..."

# Desplegar backend
echo "🚀 Desplegando backend..."
dfx deploy backend

echo "✅ Deploy completado!"