FROM node:22-alpine

WORKDIR /app
COPY package.json server.js index.html ./

ENV NODE_ENV=production
ENV DATA_DIR=/data/cslb-progress

EXPOSE 3000
CMD ["node", "server.js"]
