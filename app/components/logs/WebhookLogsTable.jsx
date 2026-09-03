import { useState } from "react";

function eventTone(status) {
  return status === "processed" ? "success" : "critical";
}

function shortSummary(event) {
  const p = event.payload || {};
  if (p.summary) return p.summary;
  if (p.previousStatus || p.newStatus) {
    return `Status ${p.previousStatus ?? "?"} → ${p.newStatus ?? p.attemptedStatus ?? "?"}`;
  }
  if (p.previousQuantity != null && p.newQuantity != null) {
    return `Qty ${p.previousQuantity} → ${p.newQuantity}`;
  }
  if (p.available != null) return `Available → ${p.available}`;
  if (p.title) return p.title;
  return "—";
}

export default function WebhookLogsTable({ events }) {
  const [selected, setSelected] = useState(null);

  if (events.length === 0) {
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-paragraph>
          No events yet. Update a product in this app, or edit products /
          inventory in Shopify Admin.
        </s-paragraph>
      </s-box>
    );
  }

  return (
    <>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Time</s-table-header>
          <s-table-header>Topic</s-table-header>
          <s-table-header>Status</s-table-header>
          <s-table-header>Summary</s-table-header>
          <s-table-header>Details</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {events.map((event) => (
            <s-table-row key={event.id}>
              <s-table-cell>
                {event.createdAt
                  ? new Date(event.createdAt).toLocaleString()
                  : "—"}
              </s-table-cell>
              <s-table-cell>
                <s-text type="strong">{event.topic}</s-text>
              </s-table-cell>
              <s-table-cell>
                <s-badge tone={eventTone(event.status)}>{event.status}</s-badge>
              </s-table-cell>
              <s-table-cell>
                <s-text color="subdued">{shortSummary(event)}</s-text>
                {event.error ? (
                  <div>
                    <s-text tone="critical">{event.error}</s-text>
                  </div>
                ) : null}
              </s-table-cell>
              <s-table-cell>
                <s-button
                  type="button"
                  variant="secondary"
                  commandFor="log-detail-modal"
                  command="--show"
                  onClick={() => setSelected(event)}
                >
                  View details
                </s-button>
              </s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>

      <s-modal
        id="log-detail-modal"
        heading={selected?.topic || "Event details"}
        size="large"
        onHide={() => setSelected(null)}
      >
        {selected ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              <s-text type="strong">Time: </s-text>
              {selected.createdAt
                ? new Date(selected.createdAt).toLocaleString()
                : "—"}
            </s-paragraph>

            <s-paragraph>
              <s-text type="strong">Status: </s-text>
              <s-badge tone={eventTone(selected.status)}>
                {selected.status}
              </s-badge>
            </s-paragraph>

            {selected.error ? (
              <s-banner tone="critical" heading="Failure reason">
                {selected.error}
              </s-banner>
            ) : (
              <s-banner tone="success" heading="Result">
                Processed successfully
              </s-banner>
            )}

            {(selected.payload?.previousStatus != null ||
              selected.payload?.newStatus != null ||
              selected.payload?.attemptedStatus != null) && (
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-paragraph>
                  <s-text type="strong">Previous status: </s-text>
                  {selected.payload.previousStatus ?? "—"}
                </s-paragraph>
                <s-paragraph>
                  <s-text type="strong">New status: </s-text>
                  {selected.payload.newStatus ??
                    selected.payload.attemptedStatus ??
                    "—"}
                </s-paragraph>
                {selected.payload.productTitle ? (
                  <s-paragraph>
                    <s-text type="strong">Product: </s-text>
                    {selected.payload.productTitle}
                  </s-paragraph>
                ) : null}
              </s-box>
            )}

            {(selected.payload?.previousQuantity != null ||
              selected.payload?.newQuantity != null) && (
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-paragraph>
                  <s-text type="strong">Previous qty: </s-text>
                  {selected.payload.previousQuantity ?? "—"}
                </s-paragraph>
                <s-paragraph>
                  <s-text type="strong">New qty: </s-text>
                  {selected.payload.newQuantity ??
                    selected.payload.attemptedQuantity ??
                    "—"}
                </s-paragraph>
                {selected.payload.locationName ? (
                  <s-paragraph>
                    <s-text type="strong">Location: </s-text>
                    {selected.payload.locationName}
                  </s-paragraph>
                ) : null}
                {selected.payload.productTitle ? (
                  <s-paragraph>
                    <s-text type="strong">Product: </s-text>
                    {selected.payload.productTitle}
                  </s-paragraph>
                ) : null}
                {selected.payload.variantTitle ? (
                  <s-paragraph>
                    <s-text type="strong">Variant: </s-text>
                    {selected.payload.variantTitle}
                  </s-paragraph>
                ) : null}
              </s-box>
            )}

            <s-heading>Full payload</s-heading>
            <s-box padding="base" background="subdued" borderRadius="base">
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: "12px",
                }}
              >
                {JSON.stringify(selected.payload || {}, null, 2)}
              </pre>
            </s-box>
          </s-stack>
        ) : (
          <s-paragraph>Select an event to view details.</s-paragraph>
        )}

        <s-button
          slot="secondary-actions"
          variant="secondary"
          commandFor="log-detail-modal"
          command="--hide"
          onClick={() => setSelected(null)}
        >
          Close
        </s-button>
      </s-modal>
    </>
  );
}
