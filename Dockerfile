FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies if needed
RUN if [ -f package-lock.json ] || [ -f package.json ]; then npm install --omit=dev --no-audit --no-fund || true; fi

# Copy all application files
COPY . .

# Set default container environment variables
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Explicit entrypoint & execution command for container runtimes (Koyeb, Render, Cloud Run, Docker)
CMD ["node", "server/server.js"]
