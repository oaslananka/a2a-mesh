FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS builder
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
RUN npm ci --workspace packages/core

COPY . .
RUN npm run build --workspace packages/core

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/core/dist ./dist
COPY --from=builder /app/packages/core/package.json ./package.json
COPY --from=builder /app/packages/core/LICENSE ./LICENSE
COPY --from=builder /app/packages/core/README.md ./README.md

RUN npm install --omit=dev

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.cjs"]
