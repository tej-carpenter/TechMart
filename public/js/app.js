const TechMart = (() => {
  const CART_KEY = "techmart-cart";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }

  function formatINR(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  }

  function addToCart(product) {
    const cart = getCart();
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      });
    }
    saveCart(cart);
  }

  function removeFromCart(id) {
    saveCart(getCart().filter((item) => item.id !== id));
  }

  function renderCart() {
    const items = getCart();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const countEl = document.getElementById("cartCount");
    const itemsEl = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");

    if (countEl) countEl.textContent = count;
    if (totalEl) totalEl.textContent = formatINR(total);

    if (itemsEl) {
      itemsEl.innerHTML = items.length
        ? items.map((item) => `
          <div class="cart-item">
            <div>
              <div class="cart-item-name">${escapeHtml(item.name)} × ${item.quantity}</div>
              <div class="cart-item-price">${formatINR(item.price * item.quantity)}</div>
            </div>
            <button class="cart-remove" data-remove-cart="${item.id}">Remove</button>
          </div>
        `).join("")
        : `<div class="cart-empty">Your cart is empty.</div>`;

      itemsEl.querySelectorAll("[data-remove-cart]").forEach((button) => {
        button.addEventListener("click", () => removeFromCart(Number(button.dataset.removeCart)));
      });
    }
  }

  function openCart() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("drawerOverlay");
    if (drawer) drawer.classList.add("open");
    if (overlay) overlay.classList.add("open");
  }

  function closeCart() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("drawerOverlay");
    if (drawer) drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }

  async function getMe() {
    const response = await fetch("/api/auth/me");
    return response.json();
  }

  function updateNav(data) {
    const status = document.getElementById("securityStatus");
    const login = document.getElementById("loginLink");
    const logout = document.getElementById("logoutButton");

    if (data.authenticated && data.user) {
      if (login) login.classList.add("hidden");
      if (logout) logout.classList.remove("hidden");

      if (status) {
        status.classList.remove("hidden", "secured", "unsecured");
        status.classList.add(data.user.mfaEnabled ? "secured" : "unsecured");
        status.textContent = data.user.mfaEnabled ? "Account secured" : "Account not secured";
      }
    } else {
      if (login) login.classList.remove("hidden");
      if (logout) logout.classList.add("hidden");
      if (status) status.classList.add("hidden");
    }
  }

  async function updateAuthState() {
    try {
      const data = await getMe();
      updateNav(data);
      return data;
    } catch {
      return { authenticated: false };
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function wireGlobalUI() {
    document.getElementById("cartButton")?.addEventListener("click", openCart);
    document.getElementById("closeCart")?.addEventListener("click", closeCart);
    document.getElementById("drawerOverlay")?.addEventListener("click", closeCart);

    document.getElementById("checkoutButton")?.addEventListener("click", async () => {
      const data = await getMe();
      if (!data.authenticated) {
        window.location.href = "/login.html";
        return;
      }
      alert("Checkout is a demonstration feature for this lab project.");
    });

    document.getElementById("logoutButton")?.addEventListener("click", logout);
    renderCart();
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireGlobalUI();
    updateAuthState();
  });

  return {
    addToCart,
    formatINR,
    updateAuthState,
    escapeHtml
  };
})();
