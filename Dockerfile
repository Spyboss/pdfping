FROM node:22-slim

RUN apt-get update && apt-get install -y \
  chromium \
  fonts-noto-color-emoji \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY api/package*.json ./
RUN npm ci --include=dev
COPY api/ ./
RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production

COPY landing/ /landing/
COPY demo-invoice.html /demo-invoice.html

EXPOSE 3000
CMD ["node", "dist/server.js"]
