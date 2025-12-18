# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine3.19 AS builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci && cd server && npm ci
COPY . .
ARG VITE_BASE_PATH=/
ARG VITE_APP_VERSION=dev
RUN VITE_BASE_PATH=${VITE_BASE_PATH} VITE_APP_VERSION=${VITE_APP_VERSION} npm run build && \
    rm -rf node_modules server/node_modules && \
    mkdir -p /prod && \
    mv dist /prod/ && \
    mv server /prod/

# Production stage - 3 layers total (FROM + COPY + RUN)
FROM node:20-alpine3.19
COPY --from=builder /prod /app
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    cd /app/server && npm ci --omit=dev && \
    rm -rf ~/.npm /tmp/* && \
    chown -R appuser:appgroup /app
USER appuser
WORKDIR /app/server
ENV NODE_ENV=production \
    PORT=3000 \
    SERVE_STATIC=true \
    INFLUX_URL=http://localhost:8086 \
    INFLUX_DB=unpoller \
    INFLUX_USER=unpoller \
    INFLUX_PASS= \
    SITE_NAME="UniFi Network"
EXPOSE 3000
CMD ["node", "index.js"]
