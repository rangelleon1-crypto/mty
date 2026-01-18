FROM node:18-slim

# Instalar dependencias necesarias para Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json primero para mejor caching
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Instalar Playwright y Chromium
RUN npx playwright install chromium

# Copiar el resto de la aplicación
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
