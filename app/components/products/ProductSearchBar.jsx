import { fieldValue } from "../../utils/helpers";

export default function ProductSearchBar({
  searchInput,
  setSearchInput,
  search,
  busy,
  onSearch,
}) {
  return (
    <form onSubmit={onSearch}>
      <s-grid gridTemplateColumns="1fr auto auto" gap="base" alignItems="end">
        <s-search-field
          label="Search products"
          labelAccessibilityVisibility="exclusive"
          value={searchInput}
          placeholder="Search by product title or SKU"
          onInput={(event) => setSearchInput(fieldValue(event))}
          onChange={(event) => setSearchInput(fieldValue(event))}
        />
        <s-button
          type="submit"
          variant="primary"
          icon="search"
          {...(busy ? { loading: true } : {})}
        >
          Search
        </s-button>
        {search ? (
          <s-button href="/app" variant="tertiary">
            Clear
          </s-button>
        ) : (
          <span />
        )}
      </s-grid>
    </form>
  );
}
