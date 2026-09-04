import { useEffect, useState } from "react";
import {
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listWebhookEvents } from "../services/shop.server";
import { fieldValue } from "../utils/helpers";
import WebhookLogsTable from "../components/logs/WebhookLogsTable";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const topic = (url.searchParams.get("topic") || "").trim();
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 10);

  const data = await listWebhookEvents(session.shop, {
    topic,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 10,
  });

  return { ...data, topic };
};

export default function LogsPage() {
  const { events, topic, page, pageSize, total } = useLoaderData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const [topicInput, setTopicInput] = useState(topic || "");
  const busy = navigation.state !== "idle";

  useEffect(() => {
    setTopicInput(topic || "");
  }, [topic]);

  function onFilter(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    const value = topicInput.trim();
    if (value) params.set("topic", value);
    params.set("page", "1");
    params.set("pageSize", String(pageSize || 10));
    submit(params, { method: "get" });
  }

  function hrefFor(targetPage) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(targetPage));
    params.set("pageSize", String(pageSize || 10));
    if (topicInput.trim()) params.set("topic", topicInput.trim());
    else if (topic) params.set("topic", topic);
    else params.delete("topic");
    return `/app/logs?${params.toString()}`;
  }

  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
  const current = Math.min(Math.max(page || 1, 1), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <s-page heading="Sync logs">
      <s-section heading="Recent events">
        <s-paragraph color="subdued">
          App updates and Shopify product/inventory webhooks are stored here.
        </s-paragraph>

        <form onSubmit={onFilter}>
          <s-grid
            gridTemplateColumns="1fr auto auto"
            gap="base"
            alignItems="end"
          >
            <s-search-field
              label="Filter by topic"
              labelAccessibilityVisibility="exclusive"
              value={topicInput}
              placeholder="APP_INVENTORY_UPDATE, PRODUCTS, INVENTORY…"
              onInput={(event) => setTopicInput(fieldValue(event))}
              onChange={(event) => setTopicInput(fieldValue(event))}
            />
            <s-button
              type="submit"
              variant="primary"
              {...(busy ? { loading: true } : {})}
            >
              Filter
            </s-button>
            <s-button href="/app/logs" variant="tertiary">
              Refresh
            </s-button>
          </s-grid>
        </form>
      </s-section>

      <s-section>
        <WebhookLogsTable events={events} />

        {total > 0 ? (
          <s-box paddingBlockStart="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-text color="subdued">
                Showing {from}-{to} of {total}
              </s-text>
              {current <= 1 ? (
                <s-button variant="secondary" icon="arrow-left" disabled>
                  Previous
                </s-button>
              ) : (
                <s-button
                  href={hrefFor(current - 1)}
                  variant="secondary"
                  icon="arrow-left"
                >
                  Previous
                </s-button>
              )}
              <s-text>
                Page {current} of {totalPages}
              </s-text>
              {current >= totalPages ? (
                <s-button variant="secondary" icon="arrow-right" disabled>
                  Next
                </s-button>
              ) : (
                <s-button
                  href={hrefFor(current + 1)}
                  variant="primary"
                  icon="arrow-right"
                >
                  Next
                </s-button>
              )}
            </s-stack>
          </s-box>
        ) : null}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
