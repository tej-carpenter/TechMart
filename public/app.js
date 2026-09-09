let products = [];
let cart = [];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});


/*
|--------------------------------------------------------------------------
| Utility
|--------------------------------------------------------------------------
*/

function formatPrice(price) {
  return currency.format(price);
}


function showToast(message) {

  const toast = document.getElementById("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


function showMessage(element, message, type = "error") {

  if (!element) return;

  element.textContent = message;

  element.classList.remove(
    "hidden",
    "error-message",
    "success-message"
  );

  element.classList.add(
    type === "success"
      ? "success-message"
      : "error-message"
  );
}


function hideElement(element) {

  if (element) {
    element.classList.add("hidden");
  }

}


/*
|--------------------------------------------------------------------------
| Authentication state
|--------------------------------------------------------------------------
*/

async function loadCurrentUser() {

  try {

    const response =
      await fetch("/api/me");

    const data =
      await response.json();

    updateNavbar(data);

    return data;

  } catch (error) {

    return {
      authenticated: false
    };

  }

}


function updateNavbar(data) {

  const accountLink =
    document.getElementById("accountLink");

  const logoutButton =
    document.getElementById("logoutButton");

  const securityStatus =
    document.getElementById("securityStatus");


  if (!data.authenticated) {

    if (accountLink) {

      accountLink.textContent = "Login";
      accountLink.href = "/login.html";
      accountLink.classList.remove("hidden");

    }

    if (logoutButton) {
      logoutButton.classList.add("hidden");
    }

    if (securityStatus) {
      securityStatus.classList.add("hidden");
    }

    return;
  }


  if (accountLink) {

    accountLink.textContent = "Account";
    accountLink.href = "/settings.html";
    accountLink.classList.remove("hidden");

  }


  if (logoutButton) {
    logoutButton.classList.remove("hidden");
  }


  if (securityStatus) {

    securityStatus.classList.remove("hidden");

    if (data.user.mfaEnabled) {

      securityStatus.textContent =
        "Account secured";

      securityStatus.classList.remove(
        "not-secured"
      );

      securityStatus.classList.add(
        "secured"
      );

    } else {

      securityStatus.textContent =
        "Account not secured";

      securityStatus.classList.remove(
        "secured"
      );

      securityStatus.classList.add(
        "not-secured"
      );

    }

  }

}


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

async function logout() {

  try {

    await fetch("/api/logout", {
      method: "POST"
    });

    window.location.href = "/";

  } catch (error) {

    showToast("Unable to log out.");

  }

}


const logoutButton =
  document.getElementById("logoutButton");


if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    logout
  );

}


/*
|--------------------------------------------------------------------------
| Products
|--------------------------------------------------------------------------
*/

async function loadProducts() {

  const productGrid =
    document.getElementById("productGrid");

  if (!productGrid) return;


  try {

    const response =
      await fetch("/api/products");

    const data =
      await response.json();

    products = data.products;

    renderProducts(products);

  } catch (error) {

    productGrid.innerHTML = `
      <div class="empty-state">
        Unable to load products.
      </div>
    `;

  }

}


function renderProducts(items) {

  const productGrid =
    document.getElementById("productGrid");

  if (!productGrid) return;


  if (items.length === 0) {

    productGrid.innerHTML = `
      <div class="empty-state">
        No products found.
      </div>
    `;

    return;
  }


  productGrid.innerHTML =
    items.map(product => `

      <article
        class="product-card"
        data-product-id="${product.id}"
      >

        <div class="product-image-wrapper">

          <img
            class="product-image"
            src="${escapeHtml(product.image)}"
            alt="${escapeHtml(product.name)}"
            loading="lazy"
          >

          <span class="product-category">
            ${escapeHtml(product.category)}
          </span>

        </div>


        <div class="product-content">

          <h3>
            ${escapeHtml(product.name)}
          </h3>

          <p>
            ${escapeHtml(product.description)}
          </p>


          <div class="product-bottom">

            <strong>
              ${formatPrice(product.price)}
            </strong>

            <button
              class="add-cart-button"
              type="button"
              data-product-id="${product.id}"
              ${product.stock <= 0 ? "disabled" : ""}
            >
              ${product.stock <= 0
                ? "Out of stock"
                : "Add to cart"}
            </button>

          </div>

        </div>

      </article>

    `).join("");


  productGrid
    .querySelectorAll(".add-cart-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const productId =
            Number(button.dataset.productId);

          addToCart(productId);

        }
      );

    });

}


/*
|--------------------------------------------------------------------------
| Simple HTML escaping
|--------------------------------------------------------------------------
*/

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/*
|--------------------------------------------------------------------------
| Category filtering
|--------------------------------------------------------------------------
*/

document
  .querySelectorAll(".category-card")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const category =
          button.dataset.category;

        const filtered =
          products.filter(
            product =>
              product.category === category
          );

        renderProducts(filtered);

        document
          .getElementById("products")
          ?.scrollIntoView({
            behavior: "smooth"
          });

      }
    );

  });


document
  .getElementById("showAllProducts")
  ?.addEventListener(
    "click",
    () => renderProducts(products)
  );


/*
|--------------------------------------------------------------------------
| Cart
|--------------------------------------------------------------------------
*/

function loadCart() {

  try {

    const saved =
      localStorage.getItem("techmart_cart");

    cart = saved
      ? JSON.parse(saved)
      : [];

  } catch {

    cart = [];

  }

  updateCartUI();

}


function saveCart() {

  localStorage.setItem(
    "techmart_cart",
    JSON.stringify(cart)
  );

}


function addToCart(productId) {

  const product =
    products.find(
      item => item.id === productId
    );

  if (!product) return;


  const existing =
    cart.find(
      item => item.productId === productId
    );


  if (existing) {

    if (existing.quantity >= product.stock) {

      showToast(
        "Maximum available quantity reached."
      );

      return;

    }

    existing.quantity += 1;

  } else {

    cart.push({
      productId,
      quantity: 1
    });

  }


  saveCart();
  updateCartUI();

  showToast("Added to cart.");

}


function removeFromCart(productId) {

  cart =
    cart.filter(
      item => item.productId !== productId
    );

  saveCart();
  updateCartUI();

}


function changeCartQuantity(productId, amount) {

  const item =
    cart.find(
      item => item.productId === productId
    );

  const product =
    products.find(
      product => product.id === productId
    );

  if (!item || !product) return;


  item.quantity += amount;


  if (item.quantity <= 0) {

    removeFromCart(productId);

    return;

  }


  if (item.quantity > product.stock) {

    item.quantity = product.stock;

    showToast(
      "Maximum available quantity reached."
    );

  }


  saveCart();
  updateCartUI();

}


function updateCartUI() {

  const cartItems =
    document.getElementById("cartItems");

  const cartCount =
    document.getElementById("cartCount");

  const cartTotal =
    document.getElementById("cartTotal");


  const totalQuantity =
    cart.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );


  if (cartCount) {
    cartCount.textContent =
      totalQuantity;
  }


  let total = 0;


  if (cartItems) {

    if (cart.length === 0) {

      cartItems.innerHTML = `
        <div class="empty-cart">
          <div class="empty-cart-icon">
            0
          </div>

          <h3>
            Your cart is empty
          </h3>

          <p>
            Add something you like to get started.
          </p>
        </div>
      `;

    } else {

      cartItems.innerHTML =
        cart.map(item => {

          const product =
            products.find(
              product =>
                product.id === item.productId
            );

          if (!product) return "";

          const itemTotal =
            product.price * item.quantity;

          total += itemTotal;


          return `

            <div class="cart-item">

              <img
                src="${escapeHtml(product.image)}"
                alt="${escapeHtml(product.name)}"
              >

              <div class="cart-item-info">

                <h3>
                  ${escapeHtml(product.name)}
                </h3>

                <strong>
                  ${formatPrice(itemTotal)}
                </strong>


                <div class="quantity-controls">

                  <button
                    type="button"
                    data-action="decrease"
                    data-id="${product.id}"
                  >
                    −
                  </button>

                  <span>
                    ${item.quantity}
                  </span>

                  <button
                    type="button"
                    data-action="increase"
                    data-id="${product.id}"
                  >
                    +
                  </button>

                </div>


                <button
                  class="remove-item"
                  type="button"
                  data-action="remove"
                  data-id="${product.id}"
                >
                  Remove
                </button>

              </div>

            </div>

          `;

        }).join("");


      cartItems
        .querySelectorAll("[data-action]")
        .forEach(button => {

          const action =
            button.dataset.action;

          const productId =
            Number(button.dataset.id);


          button.addEventListener(
            "click",
            () => {

              if (action === "remove") {
                removeFromCart(productId);
              }

              if (action === "increase") {
                changeCartQuantity(
                  productId,
                  1
                );
              }

              if (action === "decrease") {
                changeCartQuantity(
                  productId,
                  -1
                );
              }

            }
          );

        });

    }

  }


  if (cartTotal) {
    cartTotal.textContent =
      formatPrice(total);
  }

}


/*
|--------------------------------------------------------------------------
| Cart drawer
|--------------------------------------------------------------------------
*/

const cartButton =
  document.getElementById("cartButton");

const cartDrawer =
  document.getElementById("cartDrawer");

const cartOverlay =
  document.getElementById("cartOverlay");

const closeCart =
  document.getElementById("closeCart");


function openCart() {

  cartDrawer?.classList.add("open");
  cartOverlay?.classList.remove("hidden");

}


function closeCartDrawer() {

  cartDrawer?.classList.remove("open");
  cartOverlay?.classList.add("hidden");

}


cartButton?.addEventListener(
  "click",
  openCart
);


closeCart?.addEventListener(
  "click",
  closeCartDrawer
);


cartOverlay?.addEventListener(
  "click",
  closeCartDrawer
);


/*
|--------------------------------------------------------------------------
| Checkout
|--------------------------------------------------------------------------
*/

document
  .getElementById("checkoutButton")
  ?.addEventListener(
    "click",
    async () => {

      if (cart.length === 0) {

        showToast(
          "Your cart is empty."
        );

        return;

      }


      const user =
        await loadCurrentUser();


      if (!user.authenticated) {

        window.location.href =
          "/login.html";

        return;

      }


      const confirmed =
        window.confirm(
          "Place this order using Cash on Delivery?"
        );


      if (!confirmed) return;


      try {

        const response =
          await fetch("/api/orders", {

            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              items: cart
            })

          });


        const data =
          await response.json();


        if (!response.ok) {

          showToast(
            data.error ||
            "Unable to place the order."
          );

          return;

        }


        cart = [];

        saveCart();
        updateCartUI();
        closeCartDrawer();

        showToast(
          `Order #${data.orderId} confirmed.`
        );


        loadProducts();

      } catch (error) {

        showToast(
          "Unable to connect to the server."
        );

      }

    }
  );


/*
|--------------------------------------------------------------------------
| Settings page
|--------------------------------------------------------------------------
*/

async function initializeSettingsPage() {

  const startMfaButton =
    document.getElementById(
      "startMfaButton"
    );

  if (!startMfaButton) return;


  const user =
    await loadCurrentUser();


  if (!user.authenticated) {

    window.location.href =
      "/login.html";

    return;

  }


  updateMfaSettingsUI(
    user.user.mfaEnabled
  );


  await loadPrivacySettings();


  startMfaButton.addEventListener(
    "click",
    startMfaSetup
  );


  document
    .getElementById("confirmMfaButton")
    ?.addEventListener(
      "click",
      confirmMfaSetup
    );


  document
    .getElementById("cancelMfaButton")
    ?.addEventListener(
      "click",
      cancelMfaSetup
    );


  document
    .getElementById("disableMfaButton")
    ?.addEventListener(
      "click",
      openDisableModal
    );


  document
    .getElementById("closeDisableModal")
    ?.addEventListener(
      "click",
      closeDisableModal
    );


  document
    .getElementById("confirmDisableButton")
    ?.addEventListener(
      "click",
      disableMfa
    );


  document
    getElementByIdSafe("passwordForm")
    ?.addEventListener(
      "submit",
      changePassword
    );


  document
    getElementByIdSafe("savePrivacyButton")
    ?.addEventListener(
      "click",
      savePrivacySettings
    );

}


function getElementByIdSafe(id) {

  return document.getElementById(id);

}


function updateMfaSettingsUI(enabled) {

  const status =
    document.getElementById(
      "mfaStatus"
    );

  const disabledPanel =
    document.getElementById(
      "mfaDisabledPanel"
    );

  const setupPanel =
    document.getElementById(
      "mfaSetupPanel"
    );

  const enabledPanel =
    document.getElementById(
      "mfaEnabledPanel"
    );


  if (enabled) {

    if (status) {

      status.textContent =
        "Enabled";

      status.classList.add(
        "status-enabled"
      );

    }

    disabledPanel?.classList.add(
      "hidden"
    );

    setupPanel?.classList.add(
      "hidden"
    );

    enabledPanel?.classList.remove(
      "hidden"
    );

  } else {

    if (status) {

      status.textContent =
        "Not enabled";

      status.classList.remove(
        "status-enabled"
      );

    }

    disabledPanel?.classList.remove(
      "hidden"
    );

    setupPanel?.classList.add(
      "hidden"
    );

    enabledPanel?.classList.add(
      "hidden"
    );

  }

}


async function startMfaSetup() {

  const message =
    document.getElementById(
      "mfaSetupMessage"
    );

  hideElement(message);


  try {

    const response =
      await fetch("/api/mfa/setup", {
        method: "POST"
      });


    const data =
      await response.json();


    if (!response.ok) {

      showMessage(
        message,
        data.error ||
        "Unable to start setup."
      );

      return;

    }


    document
      .getElementById("qrCode")
      .src = data.qrCode;


    document
      .getElementById("manualKey")
      .textContent = data.manualKey;


    document
      .getElementById("mfaDisabledPanel")
      .classList.add("hidden");


    document
      .getElementById("mfaSetupPanel")
      .classList.remove("hidden");


    document
      .getElementById("setupCode")
      .focus();


  } catch (error) {

    showMessage(
      message,
      "Unable to connect to the server."
    );

  }

}


async function confirmMfaSetup() {

  const code =
    document
      .getElementById("setupCode")
      .value
      .trim();


  const message =
    document.getElementById(
      "mfaSetupMessage"
    );


  hideElement(message);


  if (!/^\d{6}$/.test(code)) {

    showMessage(
      message,
      "Enter the 6-digit verification code."
    );

    return;

  }


  try {

    const response =
      await fetch("/api/mfa/confirm", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          code
        })

      });


    const data =
      await response.json();


    if (!response.ok) {

      showMessage(
        message,
        data.error ||
        "Unable to enable verification."
      );

      return;

    }


    showMessage(
      message,
      "Two-step verification has been enabled.",
      "success"
    );


    updateMfaSettingsUI(true);


    await loadCurrentUser();


  } catch (error) {

    showMessage(
      message,
      "Unable to connect to the server."
    );

  }

}


function cancelMfaSetup() {

  document
    .getElementById("mfaSetupPanel")
    ?.classList.add("hidden");


  document
    .getElementById("mfaDisabledPanel")
    ?.classList.remove("hidden");


  document
    .getElementById("setupCode")
    ?.value = "";

}


function openDisableModal() {

  const modal =
    document.getElementById(
      "disableModal"
    );

  modal?.classList.remove(
    "hidden"
  );


  document
    .getElementById("disableCode")
    ?.focus();

}


function closeDisableModal() {

  const modal =
    document.getElementById(
      "disableModal"
    );

  modal?.classList.add(
    "hidden"
  );


  document
    .getElementById("disableCode")
    ?.value = "";


  hideElement(
    document.getElementById(
      "disableMessage"
    )
  );

}


async function disableMfa() {

  const code =
    document
      .getElementById("disableCode")
      .value
      .trim();


  const message =
    document.getElementById(
      "disableMessage"
    );


  hideElement(message);


  if (!/^\d{6}$/.test(code)) {

    showMessage(
      message,
      "Enter the 6-digit verification code."
    );

    return;

  }


  try {

    const response =
      await fetch("/api/mfa/disable", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          code
        })

      });


    const data =
      await response.json();


    if (!response.ok) {

      showMessage(
        message,
        data.error ||
        "Unable to disable verification."
      );

      return;

    }


    closeDisableModal();

    updateMfaSettingsUI(false);

    await loadCurrentUser();

    showToast(
      "Two-step verification has been disabled."
    );


  } catch (error) {

    showMessage(
      message,
      "Unable to connect to the server."
    );

  }

}


/*
|--------------------------------------------------------------------------
| Password change
|--------------------------------------------------------------------------
*/

async function changePassword(event) {

  event.preventDefault();


  const currentPassword =
    document
      .getElementById("currentPassword")
      .value;


  const newPassword =
    document
      .getElementById("newPassword")
      .value;


  const confirmPassword =
    document
      .getElementById("confirmNewPassword")
      .value;


  const message =
    document.getElementById(
      "passwordMessage"
    );


  hideElement(message);


  if (newPassword.length < 8) {

    showMessage(
      message,
      "New password must contain at least 8 characters."
    );

    return;

  }


  if (newPassword !== confirmPassword) {

    showMessage(
      message,
      "Passwords do not match."
    );

    return;

  }


  try {

    const response =
      await fetch(
        "/api/account/password",
        {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            currentPassword,
            newPassword
          })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      showMessage(
        message,
        data.error ||
        "Unable to change password."
      );

      return;

    }


    showMessage(
      message,
      "Password changed successfully.",
      "success"
    );


    document
      .getElementById("passwordForm")
      .reset();


  } catch (error) {

    showMessage(
      message,
      "Unable to connect to the server."
    );

  }

}


/*
|--------------------------------------------------------------------------
| Privacy settings
|--------------------------------------------------------------------------
*/

async function loadPrivacySettings() {

  try {

    const response =
      await fetch(
        "/api/settings/privacy"
      );


    if (!response.ok) return;


    const data =
      await response.json();


    document
      .getElementById("marketingEmails")
      .checked =
        data.marketingEmails;


    document
      .getElementById(
        "personalizedRecommendations"
      )
      .checked =
        data.personalizedRecommendations;


    document
      .getElementById(
        "profileVisibility"
      )
      .checked =
        data.profileVisibility;


  } catch (error) {

    console.error(error);

  }

}


async function savePrivacySettings() {

  const message =
    document.getElementById(
      "privacyMessage"
    );


  hideElement(message);


  const payload = {

    marketingEmails:
      document.getElementById(
        "marketingEmails"
      ).checked,

    personalizedRecommendations:
      document.getElementById(
        "personalizedRecommendations"
      ).checked,

    profileVisibility:
      document.getElementById(
        "profileVisibility"
      ).checked

  };


  try {

    const response =
      await fetch(
        "/api/settings/privacy",
        {

          method: "PUT",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      showMessage(
        message,
        data.error ||
        "Unable to save preferences."
      );

      return;

    }


    showMessage(
      message,
      "Privacy preferences saved.",
      "success"
    );


  } catch (error) {

    showMessage(
      message,
      "Unable to connect to the server."
    );

  }

}


/*
|--------------------------------------------------------------------------
| Initialize
|--------------------------------------------------------------------------
*/

(async function initialize() {

  loadCart();

  await loadCurrentUser();

  await loadProducts();

  await initializeSettingsPage();

})();