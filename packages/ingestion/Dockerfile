FROM node:25-alpine
RUN npm install -g yarn --force 2>/dev/null || true
WORKDIR /app
COPY packages/ingestion/package.json packages/ingestion/yarn.lock* ./
RUN yarn install --frozen-lockfile
COPY packages/ingestion/ ./
CMD ["yarn", "start"]
