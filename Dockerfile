FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV APP_NAME="Config Lab App"
ENV APP_ENV=container
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATA_FILE=/app/data/tasks.runtime.json
ENV DB_CLIENT=sqlite
ENV SQLITE_FILE=/app/data/tasks.sqlite
ENV EXTERNAL_SERVICE_URL=https://api.example.local
ENV LOG_LEVEL=info

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY config ./config
COPY README.md ./

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["npm", "start"]
