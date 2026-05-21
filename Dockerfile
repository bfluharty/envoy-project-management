# ----------- Build Stage -----------
FROM node:22 AS builder
WORKDIR /usr/src/app

# Accept git SHA + build timestamp so they're baked into the image
ARG GIT_SHA=unknown
ARG BUILD_TIMESTAMP=unknown

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build -- --ignore-ts-errors

# ----------- Production Stage -----------
FROM node:22-bookworm-slim AS production
WORKDIR /usr/src/app

# Copy pruned node_modules and built output from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/bin ./bin
COPY package*.json ./

# Use a non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser

EXPOSE 8080
ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# AdonisJS expects to run from inside the build directory
WORKDIR /usr/src/app/build
CMD ["node", "bin/server.js"]
