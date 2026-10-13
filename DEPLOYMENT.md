# OrderUp - Production Deployment & Operations Guide

This guide details the step-by-step production deployment process for **OrderUp**.

---

## Prerequisites & Infrastructure Setup

1. **Linux Server**: Ubuntu 22.04 LTS or 24.04 LTS (min 2 vCPU, 4GB RAM).
2. **Domain & DNS**: Point `orderup.co.ke` and `*.orderup.co.ke` (A Records) to your server IP.
3. **Software Installed**:
   - Docker & Docker Compose
   - Certbot (`sudo apt install certbot`)

---

## Step 1: Clone Repository & Configure Environment

```bash
git clone https://github.com/your-org/orderup-kenya.git
cd orderup-kenya

# Copy production environment variables
cp .env.production.example .env
```

---

## Step 2: SSL Certificate Generation (Let's Encrypt)

```bash
sudo certbot certonly --standalone -d orderup.co.ke -d *.orderup.co.ke
```

Copy certificates into Nginx ssl volume directory:

```bash
mkdir -p docker/nginx/ssl/live/orderup.co.ke/
sudo cp /etc/letsencrypt/live/orderup.co.ke/fullchain.pem docker/nginx/ssl/live/orderup.co.ke/
sudo cp /etc/letsencrypt/live/orderup.co.ke/privkey.pem docker/nginx/ssl/live/orderup.co.ke/
```

---

## Step 3: Run Database Migrations & Seeds

```bash
# Start PostgreSQL & Redis services first
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Run Prisma 3NF database migrations
npx prisma migrate deploy --schema=apps/server/prisma/schema.prisma

# Seed initial venue data (The Alchemist, B-Club)
npx prisma db seed --schema=apps/server/prisma/schema.prisma
```

---

## Step 4: Launch Full Stack via Production Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

Verify running containers:

```bash
docker-compose -f docker-compose.prod.yml ps
```

---

## Step 5: Setup Automated Database Backups & Cron

Add cron job to run `./scripts/backup-db.sh` daily at midnight:

```bash
crontab -e
# Add:
0 0 * * * /bin/bash /path/to/orderup-kenya/scripts/backup-db.sh >> /var/log/orderup_backup.log 2>&1
```

---

## Production Health Checks & Monitoring

- **API Gateway Health**: `https://api.orderup.co.ke/health`
- **Swagger Documentation**: `https://api.orderup.co.ke/api-docs`
- **Client PWA**: `https://orderup.co.ke`
