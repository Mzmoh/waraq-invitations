FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY public ./public
COPY server ./server
RUN mkdir /app/var && chown -R node:node /app/var
USER node
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production DATABASE_PATH=/app/var/invitations.sqlite COOKIE_SECURE=true
EXPOSE 3000
VOLUME /app/var
CMD ["node","server/index.mjs"]

