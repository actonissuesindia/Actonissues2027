FROM node:20-alpine
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm install

# Copy source and build the React SPA into dist/.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
