# Nearer Than You Think

A static website for [nearerthanyouthink.com](https://nearerthanyouthink.com) — a quiet space for the spiritually curious, the hurting, and the searching to encounter Jesus without pretense.

---

## Project Structure

```
.github/workflows/deploy.yml  # CI/CD: builds image, pushes to GHCR, redeploys on the VPS
Dockerfile                    # nginx:alpine serving index.html + icons/ (site.conf, gzip.conf)
site.conf                     # nginx server block; proxies /api/ to the API container
api/                          # Prayer-request API (Node, no deps): POST /api/prayer -> Brevo email
index.html                    # The full site (single-file)
icons/                        # Line-art icons (256px WebP, transparent), named by topic id
logo-dark.svg, logo-light.svg
```

---

## How Deployment Works

Every push to `main`:
1. GitHub Actions builds two images and pushes them to GHCR: `ghcr.io/vcicodehub/nearerthanyouthink:latest`
   (site) and `ghcr.io/vcicodehub/nearerthanyouthink-api:latest` (prayer API)
2. Actions joins the tailnet and SSHes to the VPS, running `/opt/noor-luca/scripts/deploy-app.sh nearerthanyouthink`

On the VPS the stack lives in `/opt/noor-luca/apps/nearerthanyouthink`. TLS and routing are handled
by the shared edge nginx (`/opt/noor-luca/edge/nginx/conf.d/nearerthanyouthink.com.conf`), not this repo.

The API container needs `BREVO_API_KEY` (from `/opt/noor-luca/.env`) and `PRAYER_TO_EMAIL`, set in that
compose file. Emails are sent from `hello@noorandluca.com` (the only Brevo-verified sender) with the visitor's
email as Reply-To. Spam protection: hidden `website` honeypot field + 5 requests/IP/hour.

Secrets used: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `TAILSCALE_OAUTH_CLIENT_ID`, `TAILSCALE_OAUTH_SECRET`.

---

## Icons

Topic icons are loaded as `icons/<id>.webp`, where `<id>` is the topic's `id` in the `DATA` array, so a
new topic just needs a matching file. Path-card icons: `follow`, `curious`, `prayer`, `struggling`.
