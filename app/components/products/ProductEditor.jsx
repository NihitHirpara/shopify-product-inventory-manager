import { fieldValue, statusTone } from "../../utils/helpers";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

export default function ProductEditor({
  product,
  locations,
  locationId,
  setLocationId,
  draftQty,
  setDraftQty,
  draftStatus,
  setDraftStatus,
  busy,
  error,
  onSaveInventory,
  onSaveStatus,
}) {
  return (
    <>
      <s-section heading="Product details">
        <s-stack direction="inline" gap="large" alignItems="start">
          <s-thumbnail
            src={product.imageUrl || undefined}
            alt={product.imageAlt}
            size="large"
          />
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-text type="strong">Status</s-text>
              <s-badge tone={statusTone(product.status)}>
                {product.status}
              </s-badge>
            </s-stack>
            <s-paragraph>
              <s-text type="strong">Total inventory: </s-text>
              {product.totalInventory}
            </s-paragraph>
            <s-paragraph>
              <s-text type="strong">Variants: </s-text>
              {product.variants.length}
            </s-paragraph>
            {product.description ? (
              <s-paragraph color="subdued">
                {product.description.slice(0, 280)}
              </s-paragraph>
            ) : null}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Update product status">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
          <s-select
            label="Product status"
            value={draftStatus}
            onChange={(event) => setDraftStatus(fieldValue(event))}
          >
            {STATUS_OPTIONS.map((opt) => (
              <s-option key={opt.value} value={opt.value}>
                {opt.label}
              </s-option>
            ))}
          </s-select>
          <s-button
            type="button"
            variant="primary"
            icon="save"
            disabled={busy || draftStatus === product.status || undefined}
            {...(busy ? { loading: true } : {})}
            onClick={onSaveStatus}
          >
            Save status
          </s-button>
        </s-grid>
      </s-section>

      <s-section heading="Update inventory">
        <s-paragraph color="subdued">
          Set quantity for a variant at the selected location.
        </s-paragraph>

        {error ? (
          <s-banner tone="critical" heading="Update failed">
            {error}
          </s-banner>
        ) : null}

        {locations.length > 0 ? (
          <s-box paddingBlock="base">
            <s-select
              label="Inventory location"
              value={locationId}
              onChange={(event) => setLocationId(fieldValue(event))}
            >
              {locations.map((loc) => (
                <s-option key={loc.id} value={loc.id}>
                  {loc.name}
                </s-option>
              ))}
            </s-select>
          </s-box>
        ) : (
          <s-banner tone="warning" heading="No locations">
            No active inventory locations found on this shop.
          </s-banner>
        )}

        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Variant</s-table-header>
            <s-table-header>SKU</s-table-header>
            <s-table-header>Qty at location</s-table-header>
            <s-table-header>New qty</s-table-header>
            <s-table-header>Action</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {product.variants.map((variant) => {
              const qtyAtLocation =
                locationId && variant.inventoryByLocation?.[locationId] != null
                  ? variant.inventoryByLocation[locationId]
                  : (variant.inventoryQuantity ?? 0);

              return (
                <s-table-row key={variant.id}>
                  <s-table-cell>
                    <s-text type="strong">{variant.title}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">{variant.sku || "—"}</s-text>
                  </s-table-cell>
                  <s-table-cell>{qtyAtLocation}</s-table-cell>
                  <s-table-cell>
                    <s-number-field
                      label={`Quantity for ${variant.title}`}
                      labelAccessibilityVisibility="exclusive"
                      value={draftQty[variant.id] ?? "0"}
                      min={0}
                      step={1}
                      inputMode="numeric"
                      onInput={(event) =>
                        setDraftQty((prev) => ({
                          ...prev,
                          [variant.id]: fieldValue(event),
                        }))
                      }
                      onChange={(event) =>
                        setDraftQty((prev) => ({
                          ...prev,
                          [variant.id]: fieldValue(event),
                        }))
                      }
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      type="button"
                      variant="primary"
                      icon="save"
                      disabled={
                        !variant.inventoryItemId ||
                        !locationId ||
                        busy ||
                        undefined
                      }
                      {...(busy ? { loading: true } : {})}
                      onClick={() =>
                        onSaveInventory({
                          ...variant,
                          inventoryQuantity: qtyAtLocation,
                        })
                      }
                    >
                      Save
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
      </s-section>
    </>
  );
}
