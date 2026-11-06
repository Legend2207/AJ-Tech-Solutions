FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev \
    && mkdir -p /app/data \
    && chown -R node:node /app
COPY --chown=node:node server.js index.html script.js style.css ./
COPY --chown=node:node img ./img
COPY --chown=node:node scripts/setup-admin.js ./scripts/setup-admin.js
ENV NODE_ENV=production
ENV DB_PATH=/app/data/auth.db
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O - http://127.0.0.1:3000/healthz || exit 1
CMD ["node","server.js"]
