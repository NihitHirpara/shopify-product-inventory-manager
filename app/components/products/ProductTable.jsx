import { statusTone, toProductParam } from "../../utils/helpers";

export default function ProductTable({
  products,
  search,
  pageInfo,
  busy,
  prevHref,
  nextHref,
}) {
  const hasPrev = Boolean(pageInfo?.hasPreviousPage && prevHref);
  const hasNext = Boolean(pageInfo?.hasNextPage && nextHref);

  return (
    <>
      {products.length === 0 && !busy ? (
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-paragraph>
            {search
              ? "No products match your search."
              : "No products found in this store."}
          </s-paragraph>
        </s-box>
      ) : null}

      {products.length > 0 ? (
        <div style={{ opacity: busy ? 0.55 : 1 }}>
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Variants</s-table-header>
              <s-table-header>SKU(s)</s-table-header>
              <s-table-header>Total qty</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {products.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="base" alignItems="center">
                      <s-thumbnail
                        src={product.imageUrl || undefined}
                        alt={product.imageAlt}
                        size="small"
                      />
                      <s-text type="strong">{product.title}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(product.status)}>
                      {product.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{product.variantCount}</s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">{product.skus || "—"}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={
                        product.totalInventory > 0 ? "success" : "warning"
                      }
                    >
                      {product.totalInventory}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      href={`/app/products/${toProductParam(product.id)}`}
                      variant="secondary"
                      icon="edit"
                    >
                      Edit
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </div>
      ) : null}

      {busy && products.length === 0 ? (
        <s-box paddingBlock="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-spinner accessibilityLabel="Loading products" />
            <s-text color="subdued">Loading products…</s-text>
          </s-stack>
        </s-box>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginTop: "1rem",
        }}
      >
        <s-text color="subdued">
          Showing {products.length} product
          {products.length === 1 ? "" : "s"}
          {search ? ` for “${search}”` : ""}
          {hasNext ? " · more available" : ""}
        </s-text>

        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
          <s-button
            href={hasPrev ? prevHref : undefined}
            variant="secondary"
            icon="arrow-left"
            disabled={!hasPrev || undefined}
          >
            Previous
          </s-button>
          <s-button
            href={hasNext ? nextHref : undefined}
            variant="primary"
            icon="arrow-right"
            disabled={!hasNext || undefined}
          >
            Next
          </s-button>
        </div>
      </div>
    </>
  );
}
