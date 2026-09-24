FROM node:20-alpine
WORKDIR /app
COPY libs/shared ./libs/shared
RUN cd libs/shared && npm install --omit=dev
COPY services/gateway-ingesta ./services/gateway-ingesta
WORKDIR /app/services/gateway-ingesta
RUN npm install --omit=dev
CMD ["node", "src/index.js"]
