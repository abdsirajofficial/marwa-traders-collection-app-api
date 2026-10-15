# Marwa Traders — Backend Service

Modular monolith REST API for Marwa Traders Collection Management System.

## Architecture
- Node.js & Express.js
- MongoDB & Mongoose
- Zod validation schemas
- Append-only financial transactions
- Optional Redis + BullMQ (operates 100% without Redis)
- Google Cloud Run ready (`process.env.PORT || 8080`, health check `/health`)

## Installation & Setup
```bash
npm install
```

## Configure Environment
Copy `.env.example` to `.env` and fill in:
```bash
cp .env.example .env
```

## Seed Master Data
Seeds Owner (`1001`), Admin (`2001`), Staff (`3001`), Collectors (`4001`, `4002`), plus initial shops and sample invoices:
```bash
npm run seed
```

## Run Development Server
```bash
npm run dev
```
Starts at `http://localhost:8080`.
Health endpoint: `http://localhost:8080/health`.

## Run Automated Test Suite
```bash
npm test
```

## Docker & Google Cloud Run
Build and run locally:
```bash
docker compose up -d
```

Build container for Cloud Run:
```bash
docker build -t marwa-backend .
```
