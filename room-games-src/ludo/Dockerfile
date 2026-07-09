# Use a small Node.js image for runtime
FROM node:20-alpine AS base

WORKDIR /app

# Install production dependencies separately to leverage Docker layer caching
FROM base AS deps
COPY package*.json ./
RUN npm install --production

# Final runtime image
FROM base AS runtime
ENV NODE_ENV=production

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application source
COPY . .

EXPOSE 8080

CMD ["node", "src/server/server.js"]
