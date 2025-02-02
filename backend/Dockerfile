FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

ENV PORT=3001
ENV NODE_ENV=production
ENV DEBUG=express:*

EXPOSE 3001

CMD ["sh", "-c", "echo 'Starting server...' && node server.js"] 