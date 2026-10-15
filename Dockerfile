# Build and run stage for Marwa Traders Backend (Google Cloud Run optimized)
FROM node:20-alpine AS runner

WORKDIR /app

# Set node environment
ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose Cloud Run default port
EXPOSE 8080

# Health check matching GET /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start server listening on PORT
CMD ["node", "src/server.js"]
