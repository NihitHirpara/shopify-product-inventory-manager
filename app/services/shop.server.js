import prisma from "../db.server";

export async function ensureShop(shopDomain) {
  if (!shopDomain) return null;

  return prisma.shop.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      isActive: true,
      installedAt: new Date(),
    },
    update: {
      isActive: true,
      uninstalledAt: null,
    },
  });
}

export async function saveWebhookEvent({
  shopDomain,
  topic,
  payload,
  status = "processed",
  error = null,
  webhookId = null,
  storeFull = false,
}) {
  return prisma.webhookEvent.create({
    data: {
      shopDomain,
      topic,
      webhookId,
      payload: storeFull ? payload : summarizeWebhook(topic, payload),
      status,
      error,
    },
  });
}

/** Used by products + inventory webhook routes */
export async function logIncomingWebhook(shop, topic, payload) {
  try {
    await saveWebhookEvent({
      shopDomain: shop,
      topic,
      payload: payload || {},
      status: "processed",
    });
  } catch (error) {
    console.error(`Webhook ${topic} failed:`, error);
    try {
      await saveWebhookEvent({
        shopDomain: shop,
        topic,
        payload: payload || {},
        status: "failed",
        error: error.message,
      });
    } catch (persistError) {
      console.error("Could not save failed webhook log:", persistError);
    }
  }
}

export async function listWebhookEvents(shopDomain, { topic = "" } = {}) {
  const events = await prisma.webhookEvent.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (!topic) return events;

  const needle = topic.toLowerCase();
  return events.filter((e) => e.topic.toLowerCase().includes(needle));
}

export async function markShopUninstalled(shopDomain) {
  return prisma.shop.updateMany({
    where: { shopDomain },
    data: {
      isActive: false,
      uninstalledAt: new Date(),
    },
  });
}

export async function deleteShopSessions(shopDomain) {
  return prisma.session.deleteMany({ where: { shop: shopDomain } });
}

function summarizeWebhook(topic, payload) {
  if (!payload || typeof payload !== "object") {
    return { summary: "Empty webhook payload" };
  }

  const t = String(topic || "").toUpperCase();

  if (t.includes("INVENTORY")) {
    return {
      summary: `Available → ${payload.available ?? "?"}`,
      inventory_item_id: payload.inventory_item_id,
      location_id: payload.location_id,
      available: payload.available,
      updated_at: payload.updated_at,
      raw: payload,
    };
  }

  if (t.includes("PRODUCT")) {
    return {
      summary: payload.title
        ? `Product “${payload.title}” (${t})`
        : `Product event (${t})`,
      id: payload.id,
      title: payload.title,
      handle: payload.handle,
      status: payload.status,
      updated_at: payload.updated_at,
      raw: payload,
    };
  }

  return { summary: `Webhook ${topic}`, raw: payload };
}
