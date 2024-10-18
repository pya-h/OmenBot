FROM node:latest

WORKDIR /usr/src/omenbot

COPY package*.json ./

RUN npm install

COPY . .

# EXPOSE 3000

CMD ["node", "app.js"]
