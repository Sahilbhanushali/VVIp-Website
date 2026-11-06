# Deploying vapisvip.com on srv1376710

| | |
| --- | --- |
| App folder | `/var/www/projects/vvip/VVIp-Website` |
| Node process (PM2) | `vvip` → `127.0.0.1:4380` |
| Nginx site | `/etc/nginx/sites-available/vapisvip.com.conf` (copy of `deploy/nginx/vapisvip.com.conf`) |
| Uploaded media | `/var/www/projects/vvip/VVIp-Website/storage/uploads` (git-ignored) |
| App logs | `/var/www/projects/vvip/VVIp-Website/logs/` · Nginx: `/var/log/nginx/vapisvip.com.*.log` |
| Backups | `~/backups/vvip/` |

## 0. Check the port is free (other projects run on this server)

```bash
sudo ss -ltnp | grep -E ':4380\b' || echo "4380 is free"
```

If something already uses 4380, pick another free port (e.g. `4381`) and change it in **both**
`deploy/ecosystem.config.cjs` (`PORT`) and `deploy/nginx/vapisvip.com.conf` (`upstream`).

## 1. One-time setup

```bash
cd /var/www/projects/vvip/VVIp-Website            # the repository
node -v                               # needs Node 22.18+ (any project's Node ≥ 22 works)

# Database + least-privilege user
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS vvip_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'vvip_cms'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES, LOCK TABLES ON vvip_cms.* TO 'vvip_cms'@'localhost';
  FLUSH PRIVILEGES;"

# Configuration
cp .env.example .env
nano .env        # DATABASE_PASSWORD, APP_SECRET (openssl rand -hex 32), SMTP_* — keep PORT=4380
mkdir -p storage/uploads logs

# Build, create tables, import the website content, create your admin
npm ci
npm run build
npm run db:migrate
npm run db:seed
npm run admin:create

# Nginx (www-data must be able to read dist/ and storage/)
chmod o+rx /var/www/projects /var/www/projects/vvip /var/www/projects/vvip/VVIp-Website
chmod -R o+rX dist storage
sudo cp deploy/nginx/vapisvip.com.conf /etc/nginx/sites-available/vapisvip.com.conf
sudo ln -s /etc/nginx/sites-available/vapisvip.com.conf /etc/nginx/sites-enabled/vapisvip.com.conf
sudo nginx -t && sudo systemctl reload nginx

# Start the app (alongside the other PM2 apps) and keep it running after reboots
pm2 start deploy/ecosystem.config.cjs
pm2 save

# HTTPS (DNS for vapisvip.com and www must point to this server first)
sudo certbot --nginx -d vapisvip.com -d www.vapisvip.com
```

Optional: after certbot, uncomment the `www → vapisvip.com` redirect line in
`/etc/nginx/sites-available/vapisvip.com.conf`, then `sudo nginx -t && sudo systemctl reload nginx`.

## 2. Verify

```bash
pm2 status vvip                                   # online
curl -sI http://127.0.0.1:4380/ | head -1         # HTTP/1.1 200 OK
curl -sI https://vapisvip.com/ | head -1          # HTTP/2 200
curl -sI https://vapisvip.com/admin | grep -i location   # → /admin/login
```

Then sign in at **https://vapisvip.com/admin/login** and use *Settings → Forms & email →
Send test email* to confirm SMTP works.

## 3. Updating the site later

```bash
cd /var/www/projects/vvip/VVIp-Website
git pull
npm ci
npm run build
npm run db:migrate
chmod -R o+rX dist
pm2 reload vvip
```

`storage/uploads`, `.env` and `logs/` are untouched by updates.

## 4. Scheduled jobs (`crontab -e` as the deploy user)

```
15 2 * * *  /var/www/projects/vvip/VVIp-Website/deploy/backup.sh >> /var/www/projects/vvip/VVIp-Website/logs/backup.log 2>&1
30 3 * * *  cd /var/www/projects/vvip/VVIp-Website && node scripts/retention.ts >> logs/retention.log 2>&1
```

Restore: see the comments at the top of `deploy/backup.sh`.

## 5. Troubleshooting

| Symptom | Check |
| --- | --- |
| 502 Bad Gateway | `pm2 logs vvip --lines 50` — app not running or wrong port in the Nginx upstream |
| Images 403/404 under `/media/` | `chmod -R o+rX storage` and `UPLOAD_DIR` in `.env` = `/var/www/projects/vvip/VVIp-Website/storage/uploads` |
| Styles missing (`/_astro/` 404) | run `npm run build`, then `chmod -R o+rX dist` |
| Admin login says “Cross-site request blocked” | `PUBLIC_SITE_URL=https://vapisvip.com` in `.env`, then `pm2 reload vvip` |
| Upload fails for large files | `client_max_body_size 100m` present in the Nginx site file |
| Old `/mail.php` requests | intentionally answered with 410 Gone |
