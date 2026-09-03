import { useEffect, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
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

export default function ProductDetailPage() {
  const { product, locations, error } = useLoaderData();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [draftQty, setDraftQty] = useState({});
  const [draftStatus, setDraftStatus] = useState(product?.status || "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (product?.status) setDraftStatus(product.status);
  }, [product?.status]);

  useEffect(() => {
    if (!product) return;
    const next = {};
    for (const variant of product.variants) {
      const atLoc =
        locationId && variant.inventoryByLocation?.[locationId] != null
          ? variant.inventoryByLocation[locationId]
          : (variant.inventoryQuantity ?? 0);
      next[variant.id] = String(atLoc);
    }
    setDraftQty(next);
  }, [product, locationId]);

  useEffect(() => {
    if (!locationId && locations[0]?.id) {
      setLocationId(locations[0].id);
    }
  }, [locations, locationId]);

  async function runSave(requestFn, successMessage) {
    setBusy(true);
    setSaveError(null);
    try {
      const { response, data } = await requestFn();
      if (!response.ok || !data.ok) {
        const message = data.error || `Update failed (${response.status})`;
        setSaveError(message);
        shopify.toast.show(message, { isError: true });
        return;
      }
      shopify.toast.show(successMessage);
      navigate("/app");
    } catch (err) {
      const message = err.message || "Update failed";
      setSaveError(message);
      shopify.toast.show(message, { isError: true });
    } finally {
      setBusy(false);
    }
  }

  function saveStatus() {
    if (!product?.id || !draftStatus) {
      shopify.toast.show("Missing product or status", { isError: true });
      return;
    }
    if (draftStatus === product.status) {
      shopify.toast.show("Status is unchanged");
      return;
    }

    return runSave(
      () =>
        postForm(shopify, "/api/product-status", {
          productId: product.id,
          status: draftStatus,
          previousStatus: product.status || "",
          productTitle: product.title || "",
        }),
      "Status updated",
    );
  }

  function saveInventory(variant) {
    if (!variant.inventoryItemId || !locationId) {
      shopify.toast.show("Missing inventory item or location", {
        isError: true,
      });
      return;
    }

    const quantity = Number(draftQty[variant.id]);
    if (!Number.isInteger(quantity) || quantity < 0) {
      shopify.toast.show("Quantity must be a non-negative whole number", {
        isError: true,
      });
      return;
    }

    const locationName =
      locations.find((l) => l.id === locationId)?.name || "";

    return runSave(
      () =>
        postForm(shopify, "/api/inventory", {
          inventoryItemId: variant.inventoryItemId,
          locationId,
          quantity: String(quantity),
          previousQuantity: String(variant.inventoryQuantity ?? 0),
          productTitle: product.title || "",
          variantTitle: variant.title || "",
          sku: variant.sku || "",
          locationName,
        }),
      "Inventory updated",
    );
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
        busy={busy}
        error={saveError}
        onSaveInventory={saveInventory}
        onSaveStatus={saveStatus}
      />
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
