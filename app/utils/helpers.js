export function toProductParam(gid) {
  if (!gid) return "";
  const match = String(gid).match(/Product\/(\d+)/);
  return match ? match[1] : encodeURIComponent(gid);
}

export function toProductGid(param) {
  if (!param) return "";
  const decoded = decodeURIComponent(param);
  if (decoded.startsWith("gid://")) return decoded;
  return `gid://shopify/Product/${decoded}`;
}

export function statusTone(status) {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "caution";
  return "neutral";
}

export function fieldValue(event) {
  return String(
    event.currentTarget?.value ??
      event.target?.value ??
      event.detail?.value ??
      "",
  );
}
