# ── stage 1: install deps ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

# ── stage 2: build Next.js (NEXT_PUBLIC_* must be present here) ───────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time public vars — baked into the client bundle by Next.js.
# Every NEXT_PUBLIC_* var used in the source must appear here.
ARG NEXT_PUBLIC_API_URL=http://localhost:4202
ARG NEXT_PUBLIC_SITE_URL=https://gamerskitbd.com
ARG NEXT_PUBLIC_FB_PIXEL_ID
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_REDIRECT_URI
ARG NEXT_PUBLIC_FACEBOOK_APP_ID
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_FB_PIXEL_ID=$NEXT_PUBLIC_FB_PIXEL_ID
ENV NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_REDIRECT_URI=$NEXT_PUBLIC_GOOGLE_REDIRECT_URI
ENV NEXT_PUBLIC_FACEBOOK_APP_ID=$NEXT_PUBLIC_FACEBOOK_APP_ID
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=$NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── stage 3: minimal runtime using Next.js standalone output ──────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Standalone server must bind to 0.0.0.0, not 127.0.0.1, to be reachable
# from other containers / the host.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone bundle (contains only the Node modules actually needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets (JS/CSS chunks) — must be served from .next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/static  ./.next/static
# Public directory (favicon, images, fonts)
COPY --from=builder --chown=nextjs:nodejs /app/public        ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
