FROM node:20-alpine
WORKDIR /app
COPY libs/shared ./libs/shared
RUN cd libs/shared && npm install --omit=dev
COPY services/alertas ./services/alertas
WORKDIR /app/services/alertas
RUN npm install --omit=dev
CMD ["node", "src/index.js"]
