FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4173

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

RUN mkdir -p /app/data /app/exports

EXPOSE 4173

CMD ["node", "server.js"]
