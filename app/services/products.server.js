const PAGE_SIZE = 10;
const PRODUCT_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"];

const PRODUCTS_LIST_QUERY = `#graphql
  query ProductsList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $query: String
  ) {
    products(
      first: $first
      after: $after
      last: $last
      before: $before
      query: $query
    ) {
      edges {
        cursor
        node {
          id
          title
          status
          totalInventory
          featuredImage {
            url
            altText
          }
          variants(first: 25) {
            edges {
              node {
                sku
              }
            }
          }
          variantsCount {
            count
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const PRODUCT_DETAIL_QUERY = `#graphql
  query ProductDetail($id: ID!) {
    product(id: $id) {
      id
      title
      status
      description
      totalInventory
      featuredImage {
        url
        altText
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            sku
            inventoryQuantity
            inventoryItem {
              id
              inventoryLevels(first: 25) {
                edges {
                  node {
                    location {
                      id
                    }
                    quantities(names: ["available"]) {
                      name
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    locations(first: 10) {
      edges {
        node {
          id
          name
          isActive
        }
      }
    }
  }
`;

const SET_QTY_MUTATION = `#graphql
  mutation InventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRODUCT_UPDATE_STATUS_MUTATION = `#graphql
  mutation ProductUpdateStatus($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function graphqlError(json, userErrors, fallback) {
  const fromUser = (userErrors || []).map((e) => e.message).filter(Boolean);
  const fromGraphql = (json.errors || []).map((e) => e.message).filter(Boolean);
  return [...fromUser, ...fromGraphql].join("; ") || fallback;
}

export async function fetchProductsPage(admin, { search, after, before }) {
  const query = search ? `title:*${search}* OR sku:${search}` : null;
  const variables = { query };

  if (before) {
    variables.last = PAGE_SIZE;
    variables.before = before;
  } else {
    variables.first = PAGE_SIZE;
    if (after) variables.after = after;
  }

  const response = await admin.graphql(PRODUCTS_LIST_QUERY, { variables });
  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(graphqlError(json, [], "Failed to load products"));
  }

  const connection = json.data?.products;
  const products = (connection?.edges || []).map(({ node }) => {
    const skus = (node.variants?.edges || [])
      .map(({ node: v }) => v.sku)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    return {
      id: node.id,
      title: node.title,
      status: node.status,
      totalInventory: node.totalInventory ?? 0,
      imageUrl: node.featuredImage?.url || null,
      imageAlt: node.featuredImage?.altText || node.title,
      variantCount:
        node.variantsCount?.count ?? node.variants?.edges?.length ?? 0,
      skus,
    };
  });

  return {
    products,
    pageInfo: connection?.pageInfo || null,
  };
}

export async function fetchProductDetail(admin, productGid) {
  const response = await admin.graphql(PRODUCT_DETAIL_QUERY, {
    variables: { id: productGid },
  });
  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(graphqlError(json, [], "Failed to load product"));
  }

  const node = json.data?.product;
  if (!node) return { product: null, locations: [] };

  const product = {
    id: node.id,
    title: node.title,
    status: node.status,
    description: node.description || "",
    totalInventory: node.totalInventory ?? 0,
    imageUrl: node.featuredImage?.url || null,
    imageAlt: node.featuredImage?.altText || node.title,
    variants: (node.variants?.edges || []).map(({ node: v }) => {
      const inventoryByLocation = {};
      for (const { node: level } of v.inventoryItem?.inventoryLevels?.edges ||
        []) {
        const locId = level.location?.id;
        if (!locId) continue;
        const available = (level.quantities || []).find(
          (q) => q.name === "available",
        );
        inventoryByLocation[locId] = available?.quantity ?? 0;
      }

      return {
        id: v.id,
        title: v.title,
        sku: v.sku || "",
        inventoryQuantity: v.inventoryQuantity ?? 0,
        inventoryByLocation,
        inventoryItemId: v.inventoryItem?.id || null,
      };
    }),
  };

  const locations = (json.data?.locations?.edges || [])
    .map(({ node: loc }) => ({
      id: loc.id,
      name: loc.name,
      isActive: loc.isActive,
    }))
    .filter((l) => l.isActive);

  return { product, locations };
}

export async function setInventoryQuantity(
  admin,
  { inventoryItemId, locationId, quantity },
) {
  const response = await admin.graphql(SET_QTY_MUTATION, {
    variables: {
      input: {
        name: "available",
        reason: "correction",
        ignoreCompareQuantity: true,
        quantities: [{ inventoryItemId, locationId, quantity }],
      },
    },
  });
  const json = await response.json();
  const userErrors = json.data?.inventorySetQuantities?.userErrors || [];

  if (json.errors?.length || userErrors.length) {
    throw new Error(
      graphqlError(json, userErrors, "Failed to update inventory"),
    );
  }

  return json.data?.inventorySetQuantities;
}

export async function setProductStatus(admin, { productId, status }) {
  const response = await admin.graphql(PRODUCT_UPDATE_STATUS_MUTATION, {
    variables: {
      product: { id: productId, status },
    },
  });
  const json = await response.json();
  const userErrors = json.data?.productUpdate?.userErrors || [];

  if (json.errors?.length || userErrors.length) {
    throw new Error(
      graphqlError(json, userErrors, "Failed to update product status"),
    );
  }

  return json.data?.productUpdate?.product;
}

export function parseInventoryForm(formData) {
  const inventoryItemId = String(formData.get("inventoryItemId") || "");
  const locationId = String(formData.get("locationId") || "");
  const quantity = Number(formData.get("quantity"));
  const previousRaw = formData.get("previousQuantity");
  const previousQuantity =
    previousRaw === null || previousRaw === "" ? null : Number(previousRaw);

  if (!inventoryItemId || !locationId) {
    return { error: "Missing inventory item or location" };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: "Quantity must be a non-negative whole number" };
  }

  return {
    inventoryItemId,
    locationId,
    quantity,
    previousQuantity: Number.isFinite(previousQuantity)
      ? previousQuantity
      : null,
    productTitle: String(formData.get("productTitle") || ""),
    variantTitle: String(formData.get("variantTitle") || ""),
    sku: String(formData.get("sku") || ""),
    locationName: String(formData.get("locationName") || ""),
  };
}

export function parseProductStatusForm(formData) {
  const productId = String(formData.get("productId") || "");
  const status = String(formData.get("status") || "").toUpperCase();
  const previousStatus = String(
    formData.get("previousStatus") || "",
  ).toUpperCase();

  if (!productId) return { error: "Missing product id" };
  if (!PRODUCT_STATUSES.includes(status)) {
    return { error: "Status must be ACTIVE, DRAFT, or ARCHIVED" };
  }

  return {
    productId,
    status,
    previousStatus: PRODUCT_STATUSES.includes(previousStatus)
      ? previousStatus
      : null,
    productTitle: String(formData.get("productTitle") || ""),
  };
}
