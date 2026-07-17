FROM node:22-slim

RUN apt-get update && apt-get install -y \
  chromium \
  fonts-noto-color-emoji \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY api/package*.json ./
RUN npm install --omit=dev
COPY api/ ./
COPY landing/ ../landing/

EXPOSE 3000
CMD ["node", "server.js"]
