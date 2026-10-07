FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /workspace
COPY package.json package-lock.json* .npmrc ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
WORKDIR /workspace
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
CMD npx prisma generate --schema packages/db/prisma/schema.prisma && npm run dev --workspace apps/bot
