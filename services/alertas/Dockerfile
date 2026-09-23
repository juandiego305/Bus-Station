FROM node:20-alpine
WORKDIR /app
COPY ../../libs/shared ./libs/shared
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
CMD ["node", "src/index.js"]
