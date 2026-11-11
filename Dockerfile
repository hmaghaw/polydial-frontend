# One Dockerfile, two images: build with --build-arg APP=admin or APP=restaurant.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
COPY apps/restaurant/package.json apps/restaurant/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
ARG APP=admin
RUN npm run typecheck -w @polydial/${APP} && npm run build -w @polydial/${APP}

# ---- serve ----
FROM nginx:1.27-alpine
ARG APP=admin
ENV API_BASE_URL=https://api.polydial.com \
    USE_MOCKS=false \
    APP_NAME=PolyDial
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-write-env.sh /docker-entrypoint.d/40-write-env.sh
RUN chmod +x /docker-entrypoint.d/40-write-env.sh
COPY --from=build /src/apps/${APP}/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
