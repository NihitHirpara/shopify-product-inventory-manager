import { authenticate } from "../shopify.server";
import { logIncomingWebhook } from "../services/shop.server";

export const action = async ({ request }) => {
  const { shop, topic, payload, webhookId } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  await logIncomingWebhook(shop, topic, payload, webhookId);
  return new Response();
};
