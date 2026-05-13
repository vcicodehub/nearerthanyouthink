# Nearer Than You Think

A static website for [nearerthanyouthink.com](https://nearerthanyouthink.com) — a quiet space for the spiritually curious, the hurting, and the searching to encounter Jesus without pretense.

---

## Project Structure

```
NearerThanYouThink/
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD: builds image, pushes to GHCR, deploys to VPS
├── Dockerfile               # nginx:alpine serving index.html
├── docker-compose.yml       # VPS services: site container + public nginx reverse proxy
├── index.html               # The full site (single-file)
├── nginx.conf               # VPS nginx config for HTTPS proxying
└── README.md
```

---

## How Deployment Works

Every push to `main`:
1. GitHub Actions builds a Docker image and pushes it to GitHub Container Registry (GHCR)
2. Actions uploads `docker-compose.yml` and `nginx.conf` to the VPS
3. Actions SSHes into the VPS and restarts the site container
4. If the Let's Encrypt certificate exists, Actions also starts/reloads nginx

---

## First-Time Setup

### 1. Add GitHub Actions secrets

In your GitHub repo go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth client ID with device write access |
| `TAILSCALE_OAUTH_SECRET` | Tailscale OAuth client secret |
| `VPS_HOST` | Your VPS Tailscale IP address or MagicDNS hostname |
| `VPS_USER` | SSH username (e.g. `root`) |
| `VPS_PORT` | Optional SSH port if your VPS does not use `22` |
| `VPS_SSH_KEY` | Your full private SSH key (`-----BEGIN OPENSSH PRIVATE KEY-----` block) |
| `DEPLOY_PATH` | Absolute path to the folder containing `docker-compose.yml` on the VPS |

The deploy job joins your Tailnet as `tag:ci` before copying files or opening the SSH connection, so the VPS does not need to expose SSH to the public internet. Make sure your Tailscale ACL allows the OAuth client to create devices with `tag:ci`.

### 2. Create the VPS deploy folder

Run this once on the VPS:

```bash
mkdir -p /opt/noor-luca
```

Set `DEPLOY_PATH` to the same path.

### 3. Push to main

Push to `main` once so GitHub Actions can upload the Compose and nginx config files and start the site container.

### 4. Provision the SSL certificate on the VPS

The nginx config expects a Let's Encrypt cert for `nearerthanyouthink.com`. Run this on the VPS:

```bash
# Temporarily stop nginx so certbot can bind port 80
docker compose stop nginx

certbot certonly --standalone \
  -d nearerthanyouthink.com \
  -d www.nearerthanyouthink.com

# Restart nginx
docker compose start nginx
```

You can use the nginx webroot for future certificate renewals:

```bash
certbot certonly --webroot \
  -w /var/www/certbot \
  -d nearerthanyouthink.com \
  -d www.nearerthanyouthink.com
```

### 5. Push to main

From this point forward, any push to `main` triggers a full automated redeploy, including nginx reloads. To verify the workflow ran, check the **Actions** tab in your GitHub repo.

---

## Local Development

Open `index.html` directly in a browser — no build step or local server required.

To test the Docker image locally:

```bash
docker build -t nearerthanyouthink .
docker run -p 8080:80 nearerthanyouthink
# Visit http://localhost:8080
```

---

## DNS

Point these records at your VPS IP before provisioning the SSL cert:

| Type | Name | Value |
|---|---|---|
| `A` | `nearerthanyouthink.com` | Your VPS IP |
| `A` | `www.nearerthanyouthink.com` | Your VPS IP |
