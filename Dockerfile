# ==============================================================================
# CloudPrint Pro - Hardened Production Multi-Stage Dockerfile
# ==============================================================================
# 1. Non-root user execution
# 2. Minimal attack surface (Node Alpine Linux)
# 3. Read-only filesystem friendly with dedicated storage mount
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies needed for native modules (if any)
RUN apk add --no-cache tzdata dumb-init

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy application source code
COPY . .

# Create unprivileged application user
RUN addgroup -g 1001 -S cloudprint && \
    adduser -u 1001 -S cloudprint -G cloudprint

# Ensure writable data & storage directories with proper ownership
RUN mkdir -p /app/data /app/storage/vault && \
    chown -R cloudprint:cloudprint /app

# Switch to non-root user
USER cloudprint

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose internal application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

# Process init wrapper prevents zombie processes
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
