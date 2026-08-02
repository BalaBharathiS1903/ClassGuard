# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with unprivileged Nginx (non-root)
FROM nginxinc/nginx-unprivileged:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Support client-side routing — redirect all requests to index.html
COPY --from=build /dev/null /tmp/placeholder
RUN echo 'server { \
    listen 8080; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Already runs as non-root user (uid 101) by default
CMD ["nginx", "-g", "daemon off;"]
