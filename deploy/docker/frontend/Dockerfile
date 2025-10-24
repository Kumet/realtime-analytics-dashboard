# syntax=docker/dockerfile:1.7-labs
FROM node:20-alpine AS deps

WORKDIR /app
COPY src/frontend/package.json src/frontend/pnpm-lock.yaml* ./
RUN corepack enable pnpm \
    && pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/frontend .
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN corepack enable pnpm \
    && pnpm build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
