FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN cd packages/db && npx prisma generate --schema=prisma/schema.prisma

RUN pnpm --filter @csp/web build

EXPOSE 3000

CMD cd packages/db && npx prisma migrate deploy --schema=prisma/schema.prisma && cd /app && pnpm --filter @csp/web start
