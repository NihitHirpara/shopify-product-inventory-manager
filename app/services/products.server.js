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
          variants(first: 50) {
            edges {
              node {
                sku
                inventoryQuantity
                inventoryItem {
                  inventoryLevels(first: 25) {
                    edges {
                      node {
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
                      name
                      isActive
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
    locations(first: 50) {
      edges {
        node {
          id
          name
          isActive
          fulfillsOnlineOrders
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
    const variantEdges = node.variants?.edges || [];
    const skus = variantEdges
      .map(({ node: v }) => v.sku)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    // Shopify product.totalInventory can be 0 while location "available" has stock.
    // Prefer summing inventoryLevels available across variants/locations.
    const summedAvailable = variantEdges.reduce((sum, { node: v }) => {
      const levels = v.inventoryItem?.inventoryLevels?.edges || [];
      const levelSum = levels.reduce((levelTotal, { node: level }) => {
        const available = (level.quantities || []).find(
          (q) => q.name === "available",
        );
        return levelTotal + (available?.quantity ?? 0);
      }, 0);
      if (levels.length > 0) return sum + levelSum;
      return sum + (v.inventoryQuantity ?? 0);
    }, 0);

    const totalInventory =
      summedAvailable > 0 ? summedAvailable : (node.totalInventory ?? 0);

    return {
      id: node.id,
      title: node.title,
      status: node.status,
      totalInventory,
      imageUrl: node.featuredImage?.url || null,
      imageAlt: node.featuredImage?.altText || node.title,
      variantCount:
        node.variantsCount?.count ?? variantEdges.length ?? 0,
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

  const variants = (node.variants?.edges || []).map(({ node: v }) => {
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

    const locationSum = Object.values(inventoryByLocation).reduce(
      (sum, qty) => sum + (Number(qty) || 0),
      0,
    );

    return {
      id: v.id,
      title: v.title,
      sku: v.sku || "",
      inventoryQuantity:
        locationSum > 0 ? locationSum : (v.inventoryQuantity ?? 0),
      inventoryByLocation,
      inventoryItemId: v.inventoryItem?.id || null,
    };
  });

  const summedInventory = variants.reduce(
    (sum, v) => sum + (v.inventoryQuantity ?? 0),
    0,
  );

  const product = {
    id: node.id,
    title: node.title,
    status: node.status,
    description: node.description || "",
    totalInventory:
      summedInventory > 0 ? summedInventory : (node.totalInventory ?? 0),
    imageUrl: node.featuredImage?.url || null,
    imageAlt: node.featuredImage?.altText || node.title,
    variants,
  };

  // Only locations where THIS product is stocked (same as Shopify Admin product page).
  // Listing every active shop location caused "My Custom Location" to appear even when
  // the product has no inventory level there — and setQuantities then fails.
  const stockedLocationIds = new Set();
  for (const variant of variants) {
    for (const locId of Object.keys(variant.inventoryByLocation || {})) {
      stockedLocationIds.add(locId);
    }
  }

  const locationNameById = new Map();
  for (const { node: v } of node.variants?.edges || []) {
    for (const { node: level } of v.inventoryItem?.inventoryLevels?.edges ||
      []) {
      if (level.location?.id && level.location?.name) {
        locationNameById.set(level.location.id, {
          id: level.location.id,
          name: level.location.name,
          isActive: level.location.isActive !== false,
        });
      }
    }
  }

  let locations = [...stockedLocationIds]
    .map((id) => locationNameById.get(id))
    .filter(Boolean)
    .filter((l) => l.isActive);

  // Fallback: if levels had no names, resolve from shop locations list.
  if (locations.length === 0 && stockedLocationIds.size > 0) {
    locations = (json.data?.locations?.edges || [])
      .map(({ node: loc }) => ({
        id: loc.id,
        name: loc.name,
        isActive: loc.isActive,
      }))
      .filter((l) => l.isActive && stockedLocationIds.has(l.id));
  }

  // Last resort: single primary active location that fulfills online orders.
  if (locations.length === 0) {
    locations = (json.data?.locations?.edges || [])
      .map(({ node: loc }) => ({
        id: loc.id,
        name: loc.name,
        isActive: loc.isActive,
        fulfillsOnlineOrders: loc.fulfillsOnlineOrders,
      }))
      .filter((l) => l.isActive)
      .sort((a, b) => Number(b.fulfillsOnlineOrders) - Number(a.fulfillsOnlineOrders))
      .slice(0, 1)
      .map(({ id, name, isActive }) => ({ id, name, isActive }));
  }

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
