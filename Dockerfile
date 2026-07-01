FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --production

COPY server-final.js .

CMD ["node", "server-final.js"]