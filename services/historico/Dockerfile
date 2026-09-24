FROM node:20-alpine
WORKDIR /app
COPY libs/shared ./libs/shared
RUN cd libs/shared && npm install --omit=dev
COPY services/historico ./services/historico
WORKDIR /app/services/historico
RUN npm install --omit=dev
CMD ["node", "src/index.js"]
