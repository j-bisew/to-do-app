FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN rm -f package-lock.json && npm install

COPY . .

ENV REACT_APP_API_URL=http://localhost:5000
ENV NODE_ENV=development

EXPOSE 3000

ENV BROWSER=none
ENV CI=true

CMD ["npm", "start"]
