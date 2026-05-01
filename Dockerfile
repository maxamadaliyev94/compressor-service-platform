FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN cd packages/db && npx prisma generate --schema=prisma/schema.prisma

RUN pnpm --filter @csp/web build

EXPOSE 3000

CMD cd packages/db && npx prisma migrate deploy --schema=prisma/schema.prisma && npx prisma db seed && cd /app && pnpm --filter @csp/web start
