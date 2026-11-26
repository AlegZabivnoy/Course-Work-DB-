FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL=postgresql://coursework:change_me@db:5432/coursework npm run db:generate

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && exec npm start"]