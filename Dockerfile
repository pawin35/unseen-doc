# Playwright base ships Node + Chromium + fonts/deps.
# IMPORTANT: the tag version must match the `playwright` version in package.json.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV NODE_ENV=production \
    TZ=Asia/Bangkok \
    DATA_DIR=/data \
    DATABASE_URL=file:/data/app.db \
    NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate && npm run build

VOLUME /data
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
