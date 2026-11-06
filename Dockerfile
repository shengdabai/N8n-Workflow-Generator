FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_BASE_URL=""
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/package.json ./
RUN npm install -g serve@14.2.6

ENV PORT=3000
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
