FROM node:20-alpine
WORKDIR /app
COPY libs/shared ./libs/shared
RUN cd libs/shared && npm install --omit=dev
COPY services/tiempo-real ./services/tiempo-real
WORKDIR /app/services/tiempo-real
RUN npm install --omit=dev
CMD ["node", "src/index.js"]
