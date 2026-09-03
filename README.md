# Product Inventory Manager

Embedded Shopify app from the official React Router scaffold.

Merchants can:

- Install via Shopify OAuth (no hardcoded tokens)
- Browse / search products (SKU + inventory)
- Update inventory quantity and product status (Active / Draft / Archived)
- Receive HMAC-validated product + inventory webhooks
- View sync logs in MongoDB

## Stack

| Layer | Tech |
|-------|------|
| Framework | React Router (Shopify template) |
| UI | Polaris web components |
| API | Admin GraphQL |
| Auth | `@shopify/shopify-app-react-router` + Prisma sessions |
| Database | MongoDB Atlas (Prisma) |

## Project structure

```
app/
  components/
    products/   ProductSearchBar, ProductTable, ProductEditor
    logs/       WebhookLogsTable
  services/
    products.server.js   GraphQL list/detail/update
    shop.server.js       Shop + webhook/sync logs
  routes/
    app._index.jsx           Products list
    app.products.$id.jsx     Status + inventory
    app.logs.jsx             Sync logs
    api.inventory.jsx        Save inventory
    api.product-status.jsx   Save status
    webhooks.*.jsx           HMAC webhooks
prisma/schema.prisma
docs/schema.md
shopify.app.toml
```

## Setup

1. MongoDB Atlas → connection string as `DATABASE_URL`
2. Copy `.env` from `shopify app dev` and add `DATABASE_URL` (see `.env.example`)
3. `npx prisma generate && npx prisma db push`
4. `shopify app dev` — approve scopes if prompted

Scopes: `read_products,write_products,read_inventory,write_inventory,read_locations`  
Webhooks: `products/*`, `inventory_levels/update`, `app/uninstalled`, `app/scopes_update`

## Local development

```bash
shopify app dev
```

Press `p` to open the app.

## Features map

| Requirement | Where |
|-------------|--------|
| Auth / install | Scaffold OAuth + Shop upsert in `app.jsx` |
| List / search | `app._index.jsx` |
| Update inventory / status | `app.products.$id.jsx` → `api.inventory` / `api.product-status` |
| Webhooks | `webhooks.products.jsx`, `webhooks.inventory.jsx` |
| Sync logs | `app.logs.jsx` |

## Deploy on Render (so reviewers can install without `shopify app dev`)

Local `shopify app dev` is only for you. For others to install, host the app on a public HTTPS URL (Render) and point the Shopify Partner app at that URL.

### 1. MongoDB Atlas

- Network Access → allow `0.0.0.0/0` (Render IPs are dynamic)
- Use the same `DATABASE_URL` as local (Mongo Atlas)

### 2. Create a Render Web Service

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect GitHub repo `NihitHirpara/shopify-product-inventory-manager`
3. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install && npm run setup && npm run build`
   - **Start command:** `npm run start`
   - **Instance:** Free is OK (cold start ~30–60s)

### 3. Environment variables on Render

Get **API key** and **API secret** from [Shopify Partner Dashboard](https://partners.shopify.com) → Apps → **product-inventory-manager** → Settings.

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `20.19.0` |
| `SHOPIFY_API_KEY` | Partner app client ID (`76b4d62e79e0d09641bdb4d84fc3a070`) |
| `SHOPIFY_API_SECRET` | Partner app client secret |
| `SCOPES` | `read_products,write_products,read_inventory,write_inventory,read_locations` |
| `SHOPIFY_APP_URL` | `https://YOUR-SERVICE.onrender.com` (no trailing slash) |
| `DATABASE_URL` | MongoDB Atlas connection string |

After the first deploy, copy the Render URL into `SHOPIFY_APP_URL` and **redeploy** if needed.

### 4. Point Shopify at Render

In Partner Dashboard → Apps → **product-inventory-manager** → **App setup**:

- **App URL:** `https://YOUR-SERVICE.onrender.com`
- **Allowed redirection URL(s):** `https://YOUR-SERVICE.onrender.com/api/auth`

Then from this project folder:

```bash
shopify app deploy
```

That registers production webhooks (`products/*`, `inventory_levels/update`, uninstall).

You can also set the same URLs in `shopify.app.toml` (`application_url` + `auth.redirect_urls`) before deploy.

### 5. Share access (reviewers — no local run)

Shopify apps are not a public website. Reviewers install from Admin using a **custom distribution** link:

1. Partner Dashboard → App → **Distribution** → **Custom distribution**
2. Copy the install link and share it
3. Reviewer opens the link, picks their store, installs, and uses the app inside Shopify Admin

Also share:

- Store URL (your demo shop) + staff/collaborator login, **or**
- The custom install link so they install on their own development store

Do **not** share `.env` or API secrets in the ZIP.

## Submission checklist

- [ ] Store URL + access for reviewers
- [ ] Video: install → products → search → update qty/status → Admin edit → Sync logs
- [ ] ZIP without `node_modules` / `.env`
- [ ] README + `docs/schema.md`

## Security

- No access tokens in source
- Sessions in MongoDB via Prisma session storage
- Webhooks validated with `authenticate.webhook`
