document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("productsGrid");
  const buttons = document.querySelectorAll(".filter-button");
  const params = new URLSearchParams(window.location.search);
  const initialCategory = params.get("category") || "";

  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === initialCategory);
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      loadProducts(button.dataset.category);
    });
  });

  loadProducts(initialCategory);

  async function loadProducts(category = "") {
    grid.innerHTML = `<div class="loading">Loading products...</div>`;

    try {
      const url = category
        ? `/api/products?category=${encodeURIComponent(category)}`
        : "/api/products";

      const response = await fetch(url);
      const products = await response.json();

      grid.innerHTML = products.length
        ? products.map(productCard).join("")
        : `<div class="loading">No products found.</div>`;

      grid.querySelectorAll("[data-add-product]").forEach((button) => {
        button.addEventListener("click", () => {
          const product = products.find((item) => item.id === Number(button.dataset.addProduct));
          if (product) TechMart.addToCart(product);
        });
      });
    } catch {
      grid.innerHTML = `<div class="loading">Products could not be loaded.</div>`;
    }
  }
});

function productCard(product) {
  return `
    <article class="product-card">
      <div class="product-visual">
        <span class="product-badge">${TechMart.escapeHtml(product.badge)}</span>
        <div class="product-shape"></div>
      </div>
      <div class="product-info">
        <div class="product-category">${TechMart.escapeHtml(product.category)}</div>
        <h3 class="product-name">${TechMart.escapeHtml(product.name)}</h3>
        <div class="product-description">${TechMart.escapeHtml(product.description)}</div>
        <div class="product-bottom">
          <strong class="product-price">${TechMart.formatINR(product.price)}</strong>
          <button class="add-button" data-add-product="${product.id}">Add to cart</button>
        </div>
      </div>
    </article>
  `;
}
