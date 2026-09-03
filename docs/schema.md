# MongoDB schema (Prisma)

Database: MongoDB Atlas (set `DATABASE_URL` in `.env`)

Synced with: `npx prisma db push`

## Collections / models

### `Session`

OAuth sessions managed by `@shopify/shopify-app-session-storage-prisma`. Access tokens live here — never hardcode them.

| Field | Notes |
|-------|--------|
| `session_id` | Mongo `_id` (ObjectId) |
| `id` | Shopify session id (unique) |
| `shop`, `accessToken`, `scope`, … | Standard Shopify session fields |

### `Shop`

| Field | Notes |
|-------|--------|
| `shopDomain` | Unique shop hostname |
| `isActive` | `false` after uninstall |
| `installedAt` / `uninstalledAt` | Lifecycle timestamps |

### `WebhookEvent`

| Field | Notes |
|-------|--------|
| `shopDomain` | Shop that sent the event |
| `topic` | Shopify topic or app topic (`APP_INVENTORY_UPDATE`, `APP_PRODUCT_STATUS_UPDATE`) |
| `payload` | Summary + details JSON |
| `status` | `processed` \| `failed` |
| `error` | Failure reason if any |
| `createdAt` | When the event was stored |

Index: `{ shopDomain, createdAt }`
