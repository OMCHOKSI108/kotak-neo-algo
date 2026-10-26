# ==========================================
# Stage 1: Build the React + Vite frontend
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors first to maximize Docker layer cache
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files and build static bundle
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# ==========================================
# Stage 2: Serve via Nginx
# ==========================================
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
