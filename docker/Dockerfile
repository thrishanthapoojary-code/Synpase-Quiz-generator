FROM node:20-alpine
WORKDIR /app

# Copy application files
COPY package*.json ./
COPY . .

# Set environment
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server/server.js"]
