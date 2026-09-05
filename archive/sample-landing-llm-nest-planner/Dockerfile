FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
EXPOSE 9998
CMD ["node", "dist/main.js"]
