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
export async function logIncomingWebhook(shop, topic, payload, webhookId) {
  try {
    if (await isDuplicateWebhook(shop, topic, payload, webhookId)) {
      console.log(`Skipped duplicate ${topic} webhook for ${shop}`);
      return;
    }

    await saveWebhookEvent({
      shopDomain: shop,
      topic,
      webhookId: webhookId || null,
      payload: payload || {},
      status: "processed",
    });
  } catch (error) {
    console.error(`Webhook ${topic} failed:`, error);
    try {
      await saveWebhookEvent({
        shopDomain: shop,
        topic,
        webhookId: webhookId || null,
        payload: payload || {},
        status: "failed",
        error: error.message,
      });
    } catch (persistError) {
      console.error("Could not save failed webhook log:", persistError);
    }
  }
}

async function isDuplicateWebhook(shop, topic, payload, webhookId) {
  if (webhookId) {
    const sameDelivery = await prisma.webhookEvent.findFirst({
      where: { shopDomain: shop, webhookId },
    });
    if (sameDelivery) return true;
  }

  const fingerprint = webhookFingerprint(topic, payload || {});
  if (!fingerprint) return false;

  const recent = await prisma.webhookEvent.findMany({
    where: { shopDomain: shop, topic },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return recent.some((event) => event.payload?.fingerprint === fingerprint);
}

export async function listWebhookEvents(
  shopDomain,
  { topic = "", page = 1, pageSize = 10 } = {},
) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 5), 25);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safePageSize;
  const needle = String(topic || "").trim();

  // Fetch a window then filter when topic is set (works for Mongo + avoids provider filter quirks).
  if (!needle) {
    const [total, events] = await Promise.all([
      prisma.webhookEvent.count({ where: { shopDomain } }),
      prisma.webhookEvent.findMany({
        where: { shopDomain },
        orderBy: { createdAt: "desc" },
        skip,
        take: safePageSize,
      }),
    ]);

    return { events, total, page: safePage, pageSize: safePageSize };
  }

  const all = await prisma.webhookEvent.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "desc" },
  });
  const filtered = all.filter((e) =>
    e.topic.toLowerCase().includes(needle.toLowerCase()),
  );

  return {
    events: filtered.slice(skip, skip + safePageSize),
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
  };
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
  const fingerprint = webhookFingerprint(topic, payload);

  if (t.includes("INVENTORY")) {
    return {
      fingerprint,
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
      fingerprint,
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

  return { fingerprint, summary: `Webhook ${topic}`, raw: payload };
}

/** Ignore timestamps so Shopify's extra update pings don't create extra log rows. */
function webhookFingerprint(topic, payload) {
  const t = String(topic || "").toUpperCase();

  if (t.includes("INVENTORY")) {
    return JSON.stringify({
      t,
      item: payload.inventory_item_id,
      loc: payload.location_id,
      available: payload.available,
    });
  }

  if (t.includes("PRODUCT")) {
    const variants = Array.isArray(payload.variants)
      ? payload.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          qty: v.inventory_quantity,
        }))
      : [];

    return JSON.stringify({
      t,
      id: payload.id,
      title: payload.title,
      handle: payload.handle,
      status: payload.status,
      variants,
    });
  }

  return null;
}
