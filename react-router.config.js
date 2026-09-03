/**
 * Allow action POSTs from Shopify Admin + tunnels (shopify app dev / Render).
 * @type {import("@react-router/dev/config").Config}
 */
export default {
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "**.myshopify.com",
    "*.trycloudflare.com",
    "**.trycloudflare.com",
    "*.onrender.com",
    "**.onrender.com",
  ],
};
