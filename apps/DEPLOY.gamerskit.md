# GamersKit — VPS Deployment Guide

## Architecture on the server

```
internet → nginx (port 80/443)
               ├─ /api/*  → apps-api  (Express, port 4000, internal)
               └─ /*      → apps-web  (Next.js, port 3000, internal)
```

MongoDB Atlas is external — no database container is needed.

---

## Prerequisites (one-time setup on the VPS)

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in after this
```

---

## Deploy

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git /opt/gamerskit
cd /opt/gamerskit/apps
```

### 2. Set secrets

```bash
cp .env.gamerskit.example .env.gamerskit
nano .env.gamerskit
```

Fill in at minimum:

| Variable | What to put |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your public domain, e.g. `https://gamerskitbd.com` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | Strong password for the bootstrap admin account |

`.env.gamerskit` is git-ignored and never committed — keep it only on the server.

### 3. Build and start

```bash
docker compose -f docker-compose.gamerskit.yml --env-file .env.gamerskit build --no-cache
docker compose -f docker-compose.gamerskit.yml --env-file .env.gamerskit up -d
```

> **Important:** `NEXT_PUBLIC_API_URL` is baked into the client bundle during `docker compose build`.
> If you change it (e.g. switch domains), you must rebuild the image.

### 4. Verify

```bash
# Site loads
curl -I http://localhost

# API is reachable through the proxy
curl http://localhost/api/health   # → { "ok": true, ... }

# Container status
docker compose -f docker-compose.gamerskit.yml ps
```

---

## Simplifying the command (optional)

If you only need the GamersKit stack on this server, rename the files:

```bash
cp .env.gamerskit .env
mv docker-compose.gamerskit.yml docker-compose.yml
# then just:
docker compose build && docker compose up -d
```

---

## Useful operations

| Task | Command |
|---|---|
| View live logs | `docker compose -f docker-compose.gamerskit.yml logs -f` |
| Tail a single service | `... logs -f web` or `... logs -f api` |
| Restart a service | `... restart api` |
| Pull updates + redeploy | `git pull && ... build && ... up -d` |
| Stop everything | `... down` |

---

## Firewall

```bash
# ufw (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Also open port 80/443 in your VPS provider's security-group panel if applicable.

---

## HTTPS with Let's Encrypt

**Approach A — Certbot on the host (simplest)**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d gamerskitbd.com -d www.gamerskitbd.com
```

Then change `HOST_PORT=443` in `.env.gamerskit` and update `nginx/gamerskit.conf`
to listen on 443 with the cert paths Let's Encrypt generates.

**Approach B — Traefik (Docker-native, recommended for multiple apps)**

Replace the `proxy` service with Traefik, add container labels, and let it manage
ACME automatically. This is cleaner if you run multiple services on the same host.

Either way: point a DNS A record at your VPS IP and wait for propagation before
running Certbot.

---

## Notes on things to do manually on the server

1. **Rotate secrets** — change `ADMIN_PASSWORD` and `JWT_SECRET` from any defaults before first start.
2. **Atlas whitelist** — add your VPS IP to the MongoDB Atlas IP access list, or use `0.0.0.0/0` temporarily.
3. **Rebuild on domain change** — `NEXT_PUBLIC_API_URL` is baked at build time. If you change the domain, run `docker compose build` again.
4. **Image rebuilds** — `docker compose pull` updates only base images (node, nginx). After a `git pull`, always run `docker compose build`.
5. **CORS** — set `CORS_ORIGIN` in `.env.gamerskit` to your production domain(s). The API rejects cross-origin requests that aren't listed.
