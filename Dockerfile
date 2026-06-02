FROM node:22-alpine

WORKDIR /app

ARG VCS_REF=local
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="config-lab-app"
LABEL org.opencontainers.image.description="12-factor training application"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY config ./config
COPY scripts ./scripts
COPY README.md ./

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "src/cli.js", "server"]
