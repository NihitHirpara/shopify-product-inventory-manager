import { authenticate } from "../shopify.server";
import {
  parseProductStatusForm,
  setProductStatus,
} from "../services/products.server";
import { saveWebhookEvent } from "../services/shop.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let shop = null;
  let parsed = null;

  try {
    const { admin, session } = await authenticate.admin(request);
    shop = session.shop;
    parsed = parseProductStatusForm(await request.formData());

    if (parsed.error) {
      await saveFailed(shop, parsed.error, parsed);
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    if (parsed.previousStatus === parsed.status) {
      return Response.json({ ok: true, unchanged: true, status: parsed.status });
    }

    const product = await setProductStatus(admin, parsed);

    await saveWebhookEvent({
      shopDomain: shop,
      topic: "APP_PRODUCT_STATUS_UPDATE",
      status: "processed",
      storeFull: true,
      payload: {
        source: "app",
        summary: `Updated “${parsed.productTitle || "product"}” status ${parsed.previousStatus ?? "?"} → ${parsed.status}`,
        productId: parsed.productId,
        productTitle: parsed.productTitle,
        previousStatus: parsed.previousStatus,
        newStatus: parsed.status,
      },
    });

    return Response.json({
      ok: true,
      status: product?.status || parsed.status,
      previousStatus: parsed.previousStatus,
    });
  } catch (error) {
    const message = error.message || "Failed to update product status";
    await saveFailed(shop, message, parsed);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
};

async function saveFailed(shop, message, parsed) {
  if (!shop) return;
  await saveWebhookEvent({
    shopDomain: shop,
    topic: "APP_PRODUCT_STATUS_UPDATE",
    status: "failed",
    error: message,
    storeFull: true,
    payload: {
      source: "app",
      summary: `Product status update failed: ${message}`,
      reason: message,
      productId: parsed?.productId || null,
      productTitle: parsed?.productTitle || null,
      previousStatus: parsed?.previousStatus ?? null,
      attemptedStatus: parsed?.status ?? null,
    },
  });
}
