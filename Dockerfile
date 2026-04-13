# ----------- Build Stage -----------
FROM node:22 AS builder
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build -- --ignore-ts-errors

# ----------- Production Stage -----------
FROM node:22-alpine AS production
WORKDIR /usr/src/app
# Copy pruned node_modules and built output from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/bin ./bin
COPY package*.json ./

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
ENV NODE_ENV=production

# AdonisJS expects to run from inside the build directory
WORKDIR /usr/src/app/build
CMD ["node", "bin/server.js"]
