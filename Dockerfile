# ----------- Build Stage -----------
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ----------- Production Stage -----------
FROM node:22-alpine AS production
WORKDIR /usr/src/app
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production --ignore-scripts
# Copy built files and necessary assets from builder stage
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/bin ./bin
# Add other necessary production assets as needed

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
ENV NODE_ENV=production

CMD ["node", "build/bin/server.js"]