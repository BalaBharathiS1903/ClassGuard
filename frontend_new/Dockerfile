# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production web server (Nginx non-root)
FROM nginxinc/nginx-unprivileged:alpine

# Copy compiled static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Support Single Page App (SPA) client-side routing and asset caching
RUN printf 'server {\n\
    listen 8080;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    location /assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, max-age=31536000, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
