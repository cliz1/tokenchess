# ---------- Builder ----------
FROM node:20 AS builder
WORKDIR /app

# Copy root package and server package for dependencies
COPY package*.json tsconfig*.json vite.config.ts ./
COPY server/package*.json ./server/

RUN npm install
RUN cd server && npm install

# Install libssl-dev temporarily for Prisma client
RUN apt-get update -y && apt-get install -y libssl-dev

# Copy server source only (frontend not needed)
COPY server/ ./server/
# Generate Prisma client
RUN cd server && npx prisma generate
# Build server (dist folder)
RUN cd server && npm run build

# ---------- Runtime ----------
FROM node:20-bullseye AS runtime
WORKDIR /app

# Minimal runtime deps
RUN apt-get update -y && apt-get install -y libssl1.1 ca-certificates wget && rm -rf /var/lib/apt/lists/*

# Copy only server artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/package*.json ./server/

ENV NODE_ENV=production
EXPOSE 4000

WORKDIR /app/server
CMD ["node", "dist/index.js"]


