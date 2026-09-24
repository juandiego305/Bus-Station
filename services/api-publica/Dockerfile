FROM node:20-alpine
WORKDIR /app
COPY libs/shared ./libs/shared
RUN cd libs/shared && npm install --omit=dev
COPY services/api-publica ./services/api-publica
WORKDIR /app/services/api-publica
RUN npm install --omit=dev
CMD ["node", "src/index.js"]
