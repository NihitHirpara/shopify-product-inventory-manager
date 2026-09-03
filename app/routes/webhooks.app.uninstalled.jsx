import { authenticate } from "../shopify.server";
import {
  deleteShopSessions,
  markShopUninstalled,
  saveWebhookEvent,
} from "../services/shop.server";

export const action = async ({ request }) => {
  const { shop, session, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    if (session) {
      await deleteShopSessions(shop);
    }
    await markShopUninstalled(shop);
    await saveWebhookEvent({
      shopDomain: shop,
      topic,
      payload: payload || {},
      status: "processed",
    });
  } catch (error) {
    console.error("APP_UNINSTALLED handler error:", error);
    await saveWebhookEvent({
      shopDomain: shop,
      topic,
      payload: payload || {},
      status: "failed",
      error: error.message,
    });
  }

  return new Response();
};
