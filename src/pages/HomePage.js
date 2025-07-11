import { DefaultHeader } from "../components/common/Header.js";
import { Footer } from "../components/common/Footer.js";
import { ProductSkeletonCard } from "../components/product/ProductSkeletonCard.js";
import { ProductCard } from "../components/product/ProductCard.js";
import { ProductFilterPanel } from "../components/product/ProductFilterPanel.js";
import { LoadingIndicator } from "../components/common/LoadingIndicator.js";
import { productStore, productState } from "../core/productState.js";
import { productFilterStore, productFilterState } from "../core/productFilterState.js";
import { normalizeCategories } from "../utils/normalizeCategories.js";
import { createComponent } from "../core/createComponent.js";
import { useInfiniteScroll } from "../utils/useInfiniteScroll.js";
import { navigate } from "../router.js";

let subscriptions = [];
let unsubscribeScroll;
export const HomePage = createComponent({
  setup() {
    function bindFilterEvents() {
      const panel = document.getElementById("filter-panel");

      panel?.addEventListener("click", (e) => {
        const t = e.target;
        if (t.classList.contains("category1-filter-btn")) {
          productFilterStore.setState({ filters: { page: 1, category1: t.dataset.category1, category2: "" } });
          loadProducts();
        }
        if (t.classList.contains("category2-filter-btn")) {
          productFilterStore.setState({
            filters: { page: 1, category1: t.dataset.category1, category2: t.dataset.category2 },
          });
          loadProducts();
        }
      });

      panel?.addEventListener("change", (e) => {
        const t = e.target;
        if (t.id === "limit-select") {
          productFilterStore.setState({ filters: { page: 1, limit: +t.value } });
          loadProducts();
        }
        if (t.id === "sort-select") {
          productFilterStore.setState({ filters: { page: 1, sort: t.value } });
          loadProducts();
        }
      });

      panel?.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t.id === "search-input" && e.key === "Enter") {
          productFilterStore.setState({ filters: { page: 1, search: t.value.trim() } });
          loadProducts();
        }
      });
    }

    function bindProductCardClickEvents() {
      const grid = document.getElementById("products-grid");

      if (!grid) return;

      grid.addEventListener("click", (e) => {
        const productCard = e.target.closest(".product-card");
        if (!productCard) return;

        const productId = productCard.dataset.productId;
        if (productId) {
          navigate(`/products/${productId}`);
        }
      });
    }

    async function loadCategories() {
      const res = await fetch("/api/categories");
      const raw = await res.json();
      productFilterStore.setState({
        categories: normalizeCategories(raw),
        loadingCategories: false,
      });
    }

    async function loadProducts(page = 1, append = false) {
      const loadingEl = document.getElementById("loading-indicator");
      if (loadingEl) loadingEl.style.display = "block";

      const filters = productFilterState.filters;
      const qs = new URLSearchParams({
        page,
        limit: filters.limit,
        search: filters.search,
        category1: filters.category1,
        category2: filters.category2,
        sort: filters.sort,
      });
      const res = await fetch(`/api/products?${qs.toString()}`);
      const data = await res.json();

      productStore.setState({
        products: append ? [...productState.products, ...data.products] : data.products,
        total: data.pagination.total,
      });

      if (loadingEl) loadingEl.style.display = "none";
    }

    function renderProducts() {
      const grid = document.getElementById("products-grid");
      grid.innerHTML = productState.products.map(ProductCard).join("");

      const infoEl = document.getElementById("total-info");
      infoEl.innerHTML = `총 <span class="font-medium text-gray-900">${productState.total}개</span>의 상품`;
      infoEl.style.display = "block";
    }

    function renderFilter() {
      document.getElementById("filter-panel").innerHTML = ProductFilterPanel();
    }

    return {
      bindFilterEvents,
      bindProductCardClickEvents,
      loadCategories,
      loadProducts,
      renderProducts,
      renderFilter,
    };
  },
  render() {
    return /*html*/ `
      <div class="min-h-screen bg-gray-50">
        ${DefaultHeader()}
        <main class="max-w-md mx-auto px-4 py-4">
          <div id="filter-panel">${ProductFilterPanel()}</div>
          <div class="mb-6">
            <div class="mb-4 text-sm text-gray-600" id="total-info" style="display:none"></div>
            <div class="grid grid-cols-2 gap-4 mb-6" id="products-grid">
              ${Array(4)
                .fill(null)
                .map(() => ProductSkeletonCard())
                .join("")}
            </div>
            <div id="loading-indicator" style="display:none">
              ${LoadingIndicator("상품을 불러오는 중...")}
            </div>
          </div>
        </main>
        ${Footer()}
      </div>
    `;
  },
  async onMount(ctx) {
    console.log("홈페이지 컴포넌트가 마운트되었습니다.");
    setTimeout(async () => {
      // 초기 상태 설정
      productFilterStore.setState({
        filters: {
          page: 1,
          limit: 20,
          search: "",
          category1: "",
          category2: "",
          sort: "price_asc",
        },
        categories: [],
        loadingCategories: true,
      });
      productStore.setState({
        products: [],
        total: 0,
      });

      ctx.bindFilterEvents();
      ctx.bindProductCardClickEvents();

      subscriptions.push(productFilterStore.subscribe(ctx.renderFilter));
      await ctx.loadCategories();

      subscriptions.push(productStore.subscribe(ctx.renderProducts));
      await ctx.loadProducts();

      let isLoading = false;

      unsubscribeScroll = useInfiniteScroll(async () => {
        if (isLoading) return;

        if (productState.products.length >= productState.total) return;

        isLoading = true;
        const next = productFilterState.filters.page + 1;
        productFilterStore.setState({ filters: { page: next } });
        await ctx.loadProducts(next, true);

        isLoading = false;
      });
    }, 0);
  },
  onUnmount() {
    console.log("홈페이지 컴포넌트가 언마운트되었습니다.");
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions = [];
    unsubscribeScroll?.();
  },
});
