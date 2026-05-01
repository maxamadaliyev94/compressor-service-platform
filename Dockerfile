FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile

COPY . .

RUN cd packages/db && npx prisma generate --schema=prisma/schema.prisma

RUN pnpm --filter @csp/web build

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "-c", "cd /app/packages/db && npx prisma migrate deploy --schema=prisma/schema.prisma && npx prisma db seed && cd /app && pnpm --filter @csp/web start"]
