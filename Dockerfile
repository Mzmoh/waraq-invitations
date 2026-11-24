FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY public ./public
COPY server ./server
COPY scripts/backup.mjs scripts/encrypted-backup.mjs ./scripts/
RUN mkdir /app/var && chown -R node:node /app/var
USER node
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production DATABASE_PATH=/app/var/invitations.sqlite COOKIE_SECURE=true
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
VOLUME /app/var
CMD ["node","server/index.mjs"]

