FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# --- Production stage ---
FROM node:22-alpine

RUN addgroup -S mcp && adduser -S mcp -G mcp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist/ ./dist/

USER mcp

EXPOSE 3000

# Default to HTTP mode; override CMD for stdio mode
ENV NODE_ENV=production
CMD ["node", "dist/http.js"]
