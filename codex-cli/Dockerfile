###
# Build stage: installs dependencies and compiles source
###
FROM node:20-slim AS builder
WORKDIR /usr/src/app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build the project
COPY . .
RUN npm run build

###
# Production stage: only runtime dependencies and built assets
###
# Use the official MongoDB image as base so mongod is bundled
FROM mongo:6.0 AS runner
WORKDIR /usr/src/app
# Install Node.js runtime
RUN apt-get update \
    && apt-get install -y curl gnupg ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy only package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built code from builder
COPY --from=builder /usr/src/app/dist ./dist

# Expose server and MongoDB ports
EXPOSE 3000
EXPOSE 27017
ENV PORT=3000

# Copy startup script and make executable
COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

# Launch MongoDB and Codex server
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]