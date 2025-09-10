# 🚀 CoFi – Your Intelligent DeFi Copilot

**CoFi** is your AI-powered guide to the world of decentralized finance (DeFi). From swapping tokens, staking, bridging assets, to tracking your portfolio — CoFi makes it as simple as having a conversation.

> Just type what you want, and CoFi handles the rest.


---

## 🧠 What is CoFi?

CoFi is a **conversational AI assistant** that brings the power of DeFi to your fingertips. Whether you're a seasoned degen or a curious newcomer, CoFi helps you:

- 🔁 Swap tokens across chains  
- 📈 Track and manage your DeFi portfolio  
- 🧩 Stake, farm, and earn yields  
- 🌉 Bridge assets seamlessly  
- 🔒 Stay safe with on-chain validation and execution  

All through a natural language interface.

---

## ✨ Features

- 💬 **AI Chat Interface** – Ask anything in plain English  
- 🔗 **On-Chain Execution** – Powered by real transactions, not mockups  
- 🧠 **Context-Aware Commands** – CoFi understands DeFi jargon and adapts  
- 🛡️ **Secure & Non-Custodial** – You stay in control of your wallet  
- 🌍 **Multi-Chain Support** – Interact across popular EVM chains  
- 🧱 **Modular Architecture** – Easy to extend with new DeFi protocols  

---

# Development Setup

## Local Installation

1. Install dependencies:
```bash
npm install
# or
yarn instal l
# or
pnpm install
```

2. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Hot Reload
The development server includes hot reload, so your changes will be reflected immediately in the browser.

# Local Deployment Guide

## Prerequisites
- Docker
- Docker Compose

## Steps to Deploy

1. Clone the repository
```bash
git clone https://github.com/your-username/copilot-finance.git
cd copilot-finance
```

2. Start the application
```bash
docker-compose up -d
```

3. Access the application at `http://localhost:3000`

## Stopping the Application
```bash
docker-compose down
```

<!-- New: Frontend local instructions -->
## Frontend — Ejecutar en local (recomendado para desarrollo)

1. Ir al directorio del proyecto:
```bash
cd /home/yamil/proyH/copilot-finance
```

2. (Opcional) Asegúrate de usar una versión de Node >= 16/18. Recomendado usar nvm:
```bash
nvm install 18
nvm use 18
```

3. Instalar dependencias:
```bash
npm ci        # instalación reproducible (usa package-lock.json)
# o
npm install   # si no tienes package-lock.json o prefieres instalar normalmente
# alternativas:
# yarn install
# pnpm install
```

4. Crear el archivo de entorno si existe uno de ejemplo:
```bash
cp .env.example .env || true
# Edita .env según sea necesario
```

5. Iniciar el servidor de desarrollo (hot reload):
```bash
npm run dev
# o
yarn dev
# o
pnpm dev
```

6. Abrir en el navegador:
http://localhost:3000

Opcional — Con Docker (si prefieres contenerizar):
```bash
docker-compose up --build
# detén con:
docker-compose down
```

Problemas comunes:
- Puerto ocupado: cambia el puerto en la variable de entorno (PORT) o cierra la otra app.
- Errores de dependencias nativas: instala build-essential / python si usas módulos nativos.
- Si no se inician los scripts, revisa package.json para los scripts disponibles.
