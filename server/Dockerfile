# ---- deps stage: install dependencies (this is the only stage with build tools) ----
FROM node:20-alpine AS deps
WORKDIR /app

# bcrypt ships a native addon. If no prebuilt binary matches this exact Node+Alpine(musl)
# combination, npm falls back to compiling it from source via node-gyp — these are the
# tools that needs. They never make it into the final image below.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime stage: just the compiled node_modules + app source, nothing to build with ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The official image ships a non-root "node" user — don't run the process as root inside
# the container just because that's the default.
USER node

EXPOSE 4000

# Reuses the exact /readyz-adjacent endpoint built on Day 20 — Docker's own health check
# is asking the same question an orchestrator's liveness probe would.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
