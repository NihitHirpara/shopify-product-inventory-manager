import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductDetail } from "../services/products.server";
import { toProductGid } from "../utils/helpers";
import ProductEditor from "../components/products/ProductEditor";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const data = await fetchProductDetail(admin, toProductGid(params.id));
    if (!data.product) {
      return { product: null, locations: [], error: "Product not found" };
    }
    return { ...data, error: null };
  } catch (error) {
    return {
      product: null,
      locations: [],
      error: error.message || "Failed to load product",
    };
  }
};

async function postForm(shopify, url, fields) {
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    if (typeof shopify?.idToken === "function") {
      headers.Authorization = `Bearer ${await shopify.idToken()}`;
    }
  } catch {
    // cookie session is enough when available
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function qtyAtLocation(variant, locationId) {
  if (locationId && variant.inventoryByLocation?.[locationId] != null) {
    return variant.inventoryByLocation[locationId];
  }
  return variant.inventoryQuantity ?? 0;
}

export default function ProductDetailPage() {
  const { product, locations, error } = useLoaderData();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [draftQty, setDraftQty] = useState({});
  const [draftStatus, setDraftStatus] = useState(product?.status || "ACTIVE");
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyInventory, setBusyInventory] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (product?.status) setDraftStatus(product.status);
  }, [product?.status]);

  useEffect(() => {
    if (!product) return;
    const next = {};
    for (const variant of product.variants) {
      next[variant.id] = String(qtyAtLocation(variant, locationId));
    }
    setDraftQty(next);
  }, [product, locationId]);

  useEffect(() => {
    const stillValid = locations.some((loc) => loc.id === locationId);
    if ((!locationId || !stillValid) && locations[0]?.id) {
      setLocationId(locations[0].id);
    }
  }, [locations, locationId]);

  async function postStatusIfChanged() {
    if (!product?.id || !draftStatus) return { skipped: true };
    if (draftStatus === product.status) return { skipped: true, unchanged: true };

    const { response, data } = await postForm(
      shopify,
      "/api/product-status",
      {
        productId: product.id,
        status: draftStatus,
        previousStatus: product.status || "",
        productTitle: product.title || "",
      },
    );

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Status update failed (${response.status})`);
    }
    return { skipped: false, data };
  }

  async function postInventoryIfChanged(variant) {
    if (!variant?.inventoryItemId || !locationId) {
      throw new Error("Missing inventory item or location");
    }

    const quantity = Number(draftQty[variant.id]);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Quantity must be a non-negative whole number");
    }

    const previous = qtyAtLocation(variant, locationId);
    if (quantity === previous) {
      return { skipped: true, unchanged: true };
    }

    const locationName =
      locations.find((l) => l.id === locationId)?.name || "";

    const { response, data } = await postForm(shopify, "/api/inventory", {
      inventoryItemId: variant.inventoryItemId,
      locationId,
      quantity: String(quantity),
      previousQuantity: String(previous),
      productTitle: product.title || "",
      variantTitle: variant.title || "",
      sku: variant.sku || "",
      locationName,
    });

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || `Inventory update failed (${response.status})`,
      );
    }
    return { skipped: false, data };
  }

  /**
   * Save any pending status change AND (optionally) one variant's inventory.
   * Both Save buttons use this so changing Draft + qty then clicking either Save
   * applies both updates.
   */
  async function savePendingChanges({ variant = null, preferInventory = false } = {}) {
    const statusDirty = Boolean(
      product && draftStatus && draftStatus !== product.status,
    );
    const inventoryDirty = Boolean(
      variant &&
        locationId &&
        Number(draftQty[variant.id]) !== qtyAtLocation(variant, locationId),
    );

    if (!statusDirty && !inventoryDirty) {
      shopify.toast.show("Nothing to save");
      return;
    }

    setSaveError(null);
    if (statusDirty) setBusyStatus(true);
    if (inventoryDirty) setBusyInventory(true);

    const messages = [];

    try {
      // Order: status first, then inventory (independent Shopify APIs).
      if (statusDirty) {
        await postStatusIfChanged();
        messages.push("Status updated");
      }

      if (inventoryDirty && variant) {
        await postInventoryIfChanged(variant);
        messages.push("Inventory updated");
      }

      shopify.toast.show(messages.join(" · ") || "Saved");
      revalidator.revalidate();
    } catch (err) {
      const message = err.message || "Update failed";
      setSaveError(message);
      shopify.toast.show(message, { isError: true });
      // Still refresh if one of two succeeded
      if (messages.length) revalidator.revalidate();
    } finally {
      setBusyStatus(false);
      setBusyInventory(false);
    }
  }

  function saveStatus() {
    // Prefer saving status; also flush first dirty variant qty if any.
    const dirtyVariant =
      product?.variants?.find(
        (v) =>
          Number(draftQty[v.id]) !== qtyAtLocation(v, locationId),
      ) || null;

    return savePendingChanges({
      variant: dirtyVariant,
      preferInventory: false,
    });
  }

  function saveInventory(variant) {
    return savePendingChanges({
      variant,
      preferInventory: true,
    });
  }

  if (error || !product) {
    return (
      <s-page heading="Product details">
        <s-section>
          <s-banner tone="critical" heading="Unavailable">
            {error || "Product not found"}
          </s-banner>
          <s-button href="/app" variant="primary">
            Back to products
          </s-button>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={product.title}>
      <s-button
        slot="primary-action"
        href="/app"
        variant="secondary"
        icon="arrow-left"
      >
        Back to products
      </s-button>

      <ProductEditor
        product={product}
        locations={locations}
        locationId={locationId}
        setLocationId={setLocationId}
        draftQty={draftQty}
        setDraftQty={setDraftQty}
        draftStatus={draftStatus}
        setDraftStatus={setDraftStatus}
        busyStatus={busyStatus}
        busyInventory={busyInventory}
        error={saveError}
        onSaveInventory={saveInventory}
        onSaveStatus={saveStatus}
      />
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
