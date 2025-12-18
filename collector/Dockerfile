# syntax=docker/dockerfile:1

FROM node:22-alpine3.19
WORKDIR /app
COPY . .
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    npm ci --omit=dev && \
    rm -rf ~/.npm /tmp/* && \
    chown -R appuser:appgroup /app
USER appuser
ENV NODE_ENV=production
CMD ["node", "index.js"]
