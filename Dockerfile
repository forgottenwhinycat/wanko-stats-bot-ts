FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json config.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache fontconfig ttf-dejavu font-noto font-noto-emoji
COPY package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --omit=dev --frozen-lockfile
CMD ["node", "dist/index.js"]