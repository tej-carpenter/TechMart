document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const mfaForm = document.getElementById("mfaLoginForm");

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("registerMessage");
    message.className = "form-message";
    message.textContent = "";

    const data = Object.fromEntries(new FormData(registerForm));

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        message.textContent = result.error || "Registration failed.";
        return;
      }

      message.className = "form-message success";
      message.textContent = "Account created. Redirecting to login...";
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 700);
    } catch {
      message.textContent = "Could not connect to the server.";
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("loginMessage");
    message.className = "form-message";
    message.textContent = "";

    const data = Object.fromEntries(new FormData(loginForm));

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        message.textContent = result.error || "Login failed.";
        return;
      }

      if (result.mfaRequired) {
        document.getElementById("passwordStep").classList.add("hidden");
        document.getElementById("mfaStep").classList.remove("hidden");
        document.querySelector("#mfaStep input")?.focus();
        return;
      }

      window.location.href = result.redirect || "/";
    } catch {
      message.textContent = "Could not connect to the server.";
    }
  });

  mfaForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("mfaLoginMessage");
    message.className = "form-message";
    message.textContent = "";

    const code = new FormData(mfaForm).get("code");

    try {
      const response = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      const result = await response.json();

      if (!response.ok) {
        message.textContent = result.error || "MFA verification failed.";
        return;
      }

      window.location.href = result.redirect || "/";
    } catch {
      message.textContent = "Could not connect to the server.";
    }
  });

  document.getElementById("backToPassword")?.addEventListener("click", () => {
    document.getElementById("mfaStep").classList.add("hidden");
    document.getElementById("passwordStep").classList.remove("hidden");
    document.getElementById("mfaLoginForm").reset();
  });
});
