import { useEffect, useState } from "react";
import {
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductsPage } from "../services/products.server";
import ProductSearchBar from "../components/products/ProductSearchBar";
import ProductTable from "../components/products/ProductTable";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const after = url.searchParams.get("after") || null;
  const before = url.searchParams.get("before") || null;

  try {
    const data = await fetchProductsPage(admin, { search, after, before });
    return { ...data, search, error: null };
  } catch (error) {
    return {
      products: [],
      search,
      pageInfo: null,
      error: error.message || "Failed to load products",
    };
  }
};

function pageHref({ search, after, before }) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (after) params.set("after", after);
  if (before) params.set("before", before);
  const qs = params.toString();
  return qs ? `/app?${qs}` : "/app";
}

export default function ProductsIndex() {
  const { products, search, pageInfo, error } = useLoaderData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(search || "");

  // Don't flash list loading when navigating to product edit
  const nextPath = navigation.location?.pathname || "";
  const listBusy =
    navigation.state !== "idle" && !nextPath.startsWith("/app/products/");

  useEffect(() => {
    setSearchInput(search || "");
  }, [search]);

  function onSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams);
    const value = searchInput.trim();
    if (value) params.set("search", value);
    else params.delete("search");
    params.delete("after");
    params.delete("before");
    submit(params, { method: "get" });
  }

  const prevHref =
    pageInfo?.hasPreviousPage && pageInfo?.startCursor
      ? pageHref({ search, before: pageInfo.startCursor })
      : null;

  const nextHref =
    pageInfo?.hasNextPage && pageInfo?.endCursor
      ? pageHref({ search, after: pageInfo.endCursor })
      : null;

  return (
    <s-page heading="Product Inventory Manager">
      <s-section heading="Store products">
        <s-paragraph color="subdued">
          Search by title or SKU, then open a product to update status or
          inventory.
        </s-paragraph>

        {error ? (
          <s-banner tone="critical" heading="Could not load products">
            {error}
          </s-banner>
        ) : null}

        <ProductSearchBar
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          search={search}
          busy={listBusy}
          onSearch={onSearch}
        />
      </s-section>

      <s-section heading={search ? `Results for “${search}”` : "All products"}>
        <ProductTable
          products={products}
          search={search}
          pageInfo={pageInfo}
          busy={listBusy}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
