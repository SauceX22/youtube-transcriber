# ponytail: single stage. `output: 'standalone'` isn't set upstream and better-sqlite3
# is a native module — tracing it is more work than shipping node_modules.
FROM node:24-slim

RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl wget python3 debianutils \
 && rm -rf /var/lib/apt/lists/* \
 # distro yt-dlp is months stale and breaks YouTube extraction — use the release binary
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
RUN npm run build

# health route checks <cwd>/tmp is writable, else /api/health 503s
RUN mkdir -p /app/tmp /data

ENV NODE_ENV=production \
    DATABASE_URL="file:/data/dev.db" \
    HOSTNAME=0.0.0.0 \
    PORT=19720

VOLUME ["/data"]
EXPOSE 19720

# db push, not migrate deploy — prisma/migrations is stale upstream and yields a broken schema
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx next start -p 19720 -H 0.0.0.0"]
