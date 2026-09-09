document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("featuredProducts");
  if (!container) return;

  try {
    const response = await fetch("/api/products");
    const products = await response.json();

    container.innerHTML = products.slice(0, 4).map(productCard).join("");

    container.querySelectorAll("[data-add-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = products.find((item) => item.id === Number(button.dataset.addProduct));
        if (product) TechMart.addToCart(product);
      });
    });
  } catch {
    container.innerHTML = `<div class="loading">Products could not be loaded.</div>`;
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
