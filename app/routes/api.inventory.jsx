import { authenticate } from "../shopify.server";
import {
  parseInventoryForm,
  setInventoryQuantity,
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
    parsed = parseInventoryForm(await request.formData());

    if (parsed.error) {
      await saveFailed(shop, parsed.error, parsed);
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    await setInventoryQuantity(admin, parsed);

    const summary = `Updated “${parsed.variantTitle || "variant"}” ${parsed.previousQuantity ?? "?"} → ${parsed.quantity}${parsed.locationName ? ` at ${parsed.locationName}` : ""}`;

    await saveWebhookEvent({
      shopDomain: shop,
      topic: "APP_INVENTORY_UPDATE",
      status: "processed",
      storeFull: true,
      payload: {
        source: "app",
        summary,
        productTitle: parsed.productTitle,
        variantTitle: parsed.variantTitle,
        sku: parsed.sku || null,
        locationId: parsed.locationId,
        locationName: parsed.locationName || null,
        inventoryItemId: parsed.inventoryItemId,
        previousQuantity: parsed.previousQuantity,
        newQuantity: parsed.quantity,
        change:
          parsed.previousQuantity == null
            ? null
            : parsed.quantity - parsed.previousQuantity,
      },
    });

    return Response.json({
      ok: true,
      quantity: parsed.quantity,
      previousQuantity: parsed.previousQuantity,
    });
  } catch (error) {
    const message = error.message || "Failed to update inventory";
    await saveFailed(shop, message, parsed);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
};

async function saveFailed(shop, message, parsed) {
  if (!shop) return;
  await saveWebhookEvent({
    shopDomain: shop,
    topic: "APP_INVENTORY_UPDATE",
    status: "failed",
    error: message,
    storeFull: true,
    payload: {
      source: "app",
      summary: `Inventory update failed: ${message}`,
      reason: message,
      productTitle: parsed?.productTitle || null,
      variantTitle: parsed?.variantTitle || null,
      sku: parsed?.sku || null,
      locationId: parsed?.locationId || null,
      locationName: parsed?.locationName || null,
      previousQuantity: parsed?.previousQuantity ?? null,
      attemptedQuantity: parsed?.quantity ?? null,
    },
  });
}
