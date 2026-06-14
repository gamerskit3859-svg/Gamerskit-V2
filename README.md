# GamersKit — Next.js + Node.js storefront & admin

Apple-inspired e-commerce app for [gamerskitbd.com](https://gamerskitbd.com/).
Storefront built on **Next.js 16** App Router + React 19 + Tailwind CSS v4 with
framer-motion animations and translucent glass surfaces. Backend is **Node.js
22** + Express 5 + Mongoose 9 against MongoDB.

Includes:

- Full-screen cinematic landing page with rotating hero
- Product catalog seeded from the live `gamerskitbd.com` API
- Cart, 3-step checkout (info → payment → review), public order tracking
- Admin dashboard with **date-range filtering** (Today, 7d, 30d, custom)
- **Custom order creation** — search products, override unit prices, add ad-hoc
  line items, custom shipping/discount/advance, manual payment methods
- **Facebook Pixel + Conversions API** with deduplicated `event_id`,
  SHA-256-hashed user data (email/phone/name/city), `_fbp`/`_fbc` cookie capture,
  and a server-side proxy at `/api/fb/event`
- Rich GA4-style data layer (`view_item`, `add_to_cart`, `begin_checkout`,
  `purchase`) so any tag manager can listen
- Restricted white / grey / black palette with accent reserved for focus rings
- Per-page TypeScript-typed REST contracts via the shared `@gamerskit/shared`
  workspace package

## Repo layout

```
.
├── apps/
│   ├── api/    Express 5 + Mongoose 9 + JWT auth + FB CAPI
│   └── web/    Next.js 16 App Router (storefront + admin)
└── packages/
    └── shared/ Shared TypeScript types & constants
```

## Quickstart

Requires Node 22+ and a running MongoDB instance (local or Atlas).

```bash
# from repo root
npm install

# wire up env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# (one-time) seed 34 real products from the live gamerskitbd.com API
npm run seed

# in two terminals
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

The first time the API starts it bootstraps an admin account using
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@gamerskit.local` /
`admin123` — change these). Sign in at <http://localhost:3000/admin>.

## Custom orders

Admins can build manual orders at `/admin/orders/new` with:

- Inline product search (autocomplete on title/category)
- Editable **per-line unit price** (override default), with original price shown struck-through
- Editable quantity per line
- "Add custom item" rows for products not in inventory
- Editable shipping fee, discount, advance, payment method
- Internal notes
- On save, fires a Pixel `Purchase` event with the overridden value and
  decrements stock only for real products (not ad-hoc lines)

## Date-range filtering

The admin dashboard, orders list, and reports all respect a shared
`DateRangePicker` with presets (Today, Yesterday, 7d, 30d, This/Last month) and
a custom range. The query is forwarded as `?from=YYYY-MM-DD&to=YYYY-MM-DD` to
the backend, which uses Mongo `$match` on `createdAt` for stats aggregations.

## Facebook Pixel + Conversions API

| Layer | Where | What it does |
|---|---|---|
| Browser Pixel | `apps/web/src/lib/fb-pixel.ts` | Fires `fbq()` events with a generated `eventID` |
| GA4-style data layer | same file | Pushes `view_item` / `add_to_cart` / `begin_checkout` / `purchase` to `window.dataLayer` |
| Server CAPI | `apps/api/src/lib/fb.ts` | POSTs the same `event_id` to Meta's `/events` endpoint with hashed user data |
| Browser → Server proxy | `/api/fb/event` (Next route) | Forwards browser events to the API so they can be hashed + IP/UA enriched |

Set `FB_PIXEL_ID` and `FB_CAPI_TOKEN` in `apps/api/.env` and
`NEXT_PUBLIC_FB_PIXEL_ID` in `apps/web/.env.local`. Use `FB_TEST_EVENT_CODE` for
end-to-end testing in Events Manager.

## Deployment

- **Web** — Vercel. Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FB_PIXEL_ID`, optional
  `NEXT_PUBLIC_GTM_ID` in the project's environment variables.
- **API** — Render or any Node host. Set the env vars listed in
  `apps/api/.env.example`. Use a long-lived MongoDB Atlas URI for
  `MONGODB_URI`.

## Scripts

```
npm run dev:web   # start Next.js
npm run dev:api   # start API
npm run build     # build all workspaces
npm run lint      # lint all workspaces
npm run seed      # import 34 products from gamerskitbd.com
```

## License

Private.
