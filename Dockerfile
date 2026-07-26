FROM node:22-slim

RUN apt-get update && apt-get install -y \
  chromium \
  fonts-noto-color-emoji \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app
COPY api/package*.json ./
RUN npm install
COPY api/ ./
RUN npx tsc
RUN npm prune --omit=dev
COPY landing/ /landing/
COPY demo-invoice.html /demo-invoice.html

EXPOSE 3000
CMD ["node", "dist/server.js"]
