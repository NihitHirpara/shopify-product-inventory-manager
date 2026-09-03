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

## Deploy on Render

1. GitHub → Render Web Service  
   Build: `npm install && npm run setup && npm run build`  
   Start: `npm run start`
2. Env: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`, `DATABASE_URL`
3. Point Partner app URLs / `shopify.app.toml` at Render, then `shopify app deploy`

## Submission checklist

- [ ] Store URL + access for reviewers
- [ ] Video: install → products → search → update qty/status → Admin edit → Sync logs
- [ ] ZIP without `node_modules` / `.env`
- [ ] README + `docs/schema.md`

## Security

- No access tokens in source
- Sessions in MongoDB via Prisma session storage
- Webhooks validated with `authenticate.webhook`
