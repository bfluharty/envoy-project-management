# ----------- Build Stage -----------
FROM node:22 AS builder
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build -- --ignore-ts-errors

# ----------- Production Deps Stage -----------
FROM node:22 AS prod-deps
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ----------- Production Stage -----------
FROM node:22-bookworm-slim AS production
WORKDIR /usr/src/app

# Use a non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser

# Copy production node_modules and built output
COPY --chown=appuser:appgroup --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=builder /usr/src/app/build ./build
COPY --chown=appuser:appgroup --from=builder /usr/src/app/bin ./bin
COPY --chown=appuser:appgroup package.json package-lock.json ./

# Accept git SHA + build timestamp so they're baked into the image
ARG GIT_SHA=unknown
ARG BUILD_TIMESTAMP=unknown

EXPOSE 8080
ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# AdonisJS expects to run from inside the build directory
WORKDIR /usr/src/app/build
CMD ["node", "bin/server.js"]
