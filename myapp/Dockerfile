# ============================================
# Career Planning Agent - Frontend Dockerfile
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package and config files
COPY package.json tsconfig.json ./
COPY config/ config/
COPY scripts/ scripts/

# Install dependencies (skip husky/git hooks in Docker build)
RUN npm ci --ignore-scripts && \
    npx --yes max setup && \
    node scripts/patch-umi-tsconfig.cjs

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# ============================================
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
