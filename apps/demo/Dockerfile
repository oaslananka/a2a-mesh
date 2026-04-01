FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/grpc/package.json ./packages/grpc/
COPY packages/registry/package.json ./packages/registry/
COPY cli/package.json ./cli/
COPY apps/demo/package.json ./apps/demo/

RUN npm install

COPY . .
RUN npm run build

WORKDIR /app/apps/demo
CMD ["node", "--import", "tsx", "run-demo.ts"]
