import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Product Inventory Manager</h1>
        <p className={styles.text}>
          View products, update inventory and status, and track sync events from
          Shopify.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g. my-shop.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Products</strong> — browse, search, and edit variants
          </li>
          <li>
            <strong>Inventory & status</strong> — update quantities and Active /
            Draft / Archived
          </li>
          <li>
            <strong>Sync logs</strong> — app changes and Shopify webhooks
          </li>
        </ul>
      </div>
    </div>
  );
}
