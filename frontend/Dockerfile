FROM node:22-alpine
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG API_URL=http://api:8000
ENV API_URL=$API_URL
RUN npm run build
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
