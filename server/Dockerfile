# Konsollens signalserver (signal.mjs + ws.mjs, kun Node-builtins): intet npm install, ingen data, intet at skrive.
FROM node:22-alpine
WORKDIR /app
COPY signal.mjs ws.mjs ./
ENV PORT=3260 HOST=0.0.0.0
EXPOSE 3260
USER node
CMD ["node", "signal.mjs"]
