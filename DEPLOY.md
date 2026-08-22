# Deploy Synentrix Flow on VPS — synentrixflow.com

## Architecture

| Service | Port (internal) | Public URL |
|---------|-----------------|------------|
| Next.js frontend | 3000 | https://synentrixflow.com (+ subdomains) |
| Express API | 4001 | Proxied via Next.js `/api/*` (not public) |
| MySQL | 3306 | Localhost only |

**Company portals** use subdomains:

- Main site: `https://synentrixflow.com`
- Demo workspace: `https://synentrix-demo.synentrixflow.com/login`
- Any company: `https://{workspace-slug}.synentrixflow.com/login`

---

## 1. DNS (at your domain registrar)

| Type | Name | Value |
|------|------|-------|
| A | `@` | Your VPS IP |
| A | `www` | Your VPS IP |
| A | `*` | Your VPS IP (wildcard for company subdomains) |

Wait for DNS propagation (often 5–30 minutes).

---

## 2. VPS prerequisites

Ubuntu 22.04+ recommended:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx git curl

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL 8
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

Create database:

```bash
sudo mysql -e "
CREATE DATABASE leadflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'leadflow'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON leadflow.* TO 'leadflow'@'localhost';
FLUSH PRIVILEGES;
"
```

---

## 3. Deploy application

```bash
sudo mkdir -p /var/www/synentrixflow
sudo chown $USER:$USER /var/www/synentrixflow
cd /var/www/synentrixflow

# Clone or upload your project
git clone YOUR_REPO_URL .
npm ci

# Backend env
cp deploy/env.production.example /tmp/env-ref.txt
nano backend/.env   # see deploy/env.production.example

# Frontend env
nano frontend/.env.local
# NEXT_PUBLIC_APP_DOMAIN=synentrixflow.com
# API_URL=http://127.0.0.1:4001

# Database
npm run db:migrate:deploy -w backend
npm run db:seed -w backend   # optional demo data

# Production build
npm run build
```

---

## 4. systemd services

```bash
sudo cp deploy/synentrixflow-backend.service /etc/systemd/system/
sudo cp deploy/synentrixflow-frontend.service /etc/systemd/system/

sudo chown -R www-data:www-data /var/www/synentrixflow
sudo mkdir -p /var/www/synentrixflow/backend/uploads
sudo chown -R www-data:www-data /var/www/synentrixflow/backend/uploads

sudo systemctl daemon-reload
sudo systemctl enable synentrixflow-backend synentrixflow-frontend
sudo systemctl start synentrixflow-backend synentrixflow-frontend
sudo systemctl status synentrixflow-backend synentrixflow-frontend
```

---

## 5. nginx + SSL

```bash
sudo cp deploy/nginx-synentrixflow.conf /etc/nginx/sites-available/synentrixflow
sudo ln -sf /etc/nginx/sites-available/synentrixflow /etc/nginx/sites-enabled/
sudo nginx -t
```

**SSL with wildcard** (required for `*.synentrixflow.com` company portals):

```bash
# DNS challenge — add the TXT record Certbot shows
sudo certbot certonly --manual --preferred-challenges dns \
  -d synentrixflow.com -d '*.synentrixflow.com'

sudo systemctl reload nginx
```

Or use Cloudflare proxy + SSL (Full strict) if DNS is on Cloudflare.

---

## 6. Verify

```bash
curl https://synentrixflow.com/health
# {"status":"ok","product":"Synentrix Flow","database":"mysql"}

curl -I https://synentrix-demo.synentrixflow.com/login
# HTTP/2 200
```

**Demo login** (after seed):

- URL: `https://synentrix-demo.synentrixflow.com/login`
- Email: `demo@leadflow.app`
- Password: `demo1234`

**Platform admin** (apex only):

- URL: `https://synentrixflow.com/synentrix-cp-x9k7m2q4p8`
- Email: `platform@synentrix.com`
- Password: `Synentrix@2026`

---

## 7. Production checklist

- [ ] Change `JWT_SECRET` to a long random value
- [ ] Change all default passwords after first login
- [ ] Set strong MySQL passwords
- [ ] `NODE_ENV=production` in backend `.env`
- [ ] Firewall: allow 80, 443 — block 3000, 4001, 3306 from public
- [ ] Back up MySQL daily (`mysqldump leadflow`)
- [ ] Back up `backend/uploads/` (attachments, logos)

---

## 8. Updates (redeploy)

```bash
cd /var/www/synentrixflow
git pull
npm ci
npm run db:migrate:deploy -w backend
npm run build
sudo systemctl restart synentrixflow-backend synentrixflow-frontend
```

---

## Environment reference

| Variable | Where | Example |
|----------|-------|---------|
| `APP_DOMAIN` | backend | `synentrixflow.com` |
| `FRONTEND_URL` | backend | `https://synentrixflow.com` |
| `NEXT_PUBLIC_APP_DOMAIN` | frontend | `synentrixflow.com` |
| `API_URL` | frontend | `http://127.0.0.1:4001` |
| `JWT_SECRET` | backend | long random string |
| `DATABASE_URL` | backend | `mysql://leadflow:pass@127.0.0.1:3306/leadflow` |
