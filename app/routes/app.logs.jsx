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
  const topic = (new URL(request.url).searchParams.get("topic") || "").trim();
  const events = await listWebhookEvents(session.shop, { topic });
  return { events, topic };
};

export default function LogsPage() {
  const { events, topic } = useLoaderData();
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
    const params = new URLSearchParams(searchParams);
    const value = topicInput.trim();
    if (value) params.set("topic", value);
    else params.delete("topic");
    submit(params, { method: "get" });
  }

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
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
