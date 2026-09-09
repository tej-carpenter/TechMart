document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();

  if (!settings) {
    window.location.href = "/login.html";
    return;
  }

  renderSettings(settings);

  document.getElementById("startMfaButton")?.addEventListener("click", startMfa);
  document.getElementById("cancelMfaButton")?.addEventListener("click", cancelMfa);
  document.getElementById("enableMfaForm")?.addEventListener("submit", enableMfa);
  document.getElementById("disableMfaForm")?.addEventListener("submit", disableMfa);
});

async function loadSettings() {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function renderSettings(data) {
  const user = data.user;
  const enabled = data.mfa.enabled;

  document.getElementById("accountName").textContent = user.name;
  document.getElementById("detailName").textContent = user.name;
  document.getElementById("detailEmail").textContent = user.email;

  const accountStatus = document.getElementById("accountStatus");
  accountStatus.textContent = enabled ? "Secured" : "Not secured";
  accountStatus.className = `status-pill ${enabled ? "enabled" : "disabled"}`;

  const mfaStatus = document.getElementById("mfaStatus");
  mfaStatus.textContent = enabled ? "Enabled" : "Disabled";
  mfaStatus.className = `status-pill ${enabled ? "enabled" : "disabled"}`;

  document.getElementById("mfaDisabledPanel").classList.toggle("hidden", enabled);
  document.getElementById("mfaEnabledPanel").classList.toggle("hidden", !enabled);
  document.getElementById("mfaSetupPanel").classList.add("hidden");

  const big = document.getElementById("bigSecurityStatus");
  const desc = document.getElementById("bigSecurityDescription");
  big.textContent = enabled ? "Account secured" : "Account not secured";
  desc.textContent = enabled
    ? "Password authentication is followed by a TOTP authenticator code."
    : "Enable MFA to add a second authentication factor.";
}

async function startMfa() {
  const button = document.getElementById("startMfaButton");
  const message = document.getElementById("enableMfaMessage");
  button.disabled = true;
  button.textContent = "Preparing...";

  try {
    const response = await fetch("/api/mfa/setup", { method: "POST" });
    const result = await response.json();

    if (!response.ok) {
      message.textContent = result.error || "Could not start MFA setup.";
      button.disabled = false;
      button.textContent = "Set up MFA";
      return;
    }

    document.getElementById("qrImage").src = result.qrDataUrl;
    document.getElementById("manualKey").textContent = result.manualKey;
    document.getElementById("mfaSetupPanel").classList.remove("hidden");
    document.getElementById("mfaDisabledPanel").classList.add("hidden");
    document.getElementById("enableMfaCode").focus();

    button.disabled = false;
    button.textContent = "Set up MFA";
  } catch {
    message.textContent = "Could not connect to the server.";
    button.disabled = false;
    button.textContent = "Set up MFA";
  }
}

function cancelMfa() {
  document.getElementById("mfaSetupPanel").classList.add("hidden");
  document.getElementById("mfaDisabledPanel").classList.remove("hidden");
  document.getElementById("enableMfaForm").reset();
  document.getElementById("enableMfaMessage").textContent = "";
}

async function enableMfa(event) {
  event.preventDefault();
  const message = document.getElementById("enableMfaMessage");
  message.className = "form-message";
  message.textContent = "";

  const code = document.getElementById("enableMfaCode").value;

  try {
    const response = await fetch("/api/mfa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const result = await response.json();

    if (!response.ok) {
      message.textContent = result.error || "Could not enable MFA.";
      return;
    }

    message.className = "form-message success";
    message.textContent = "MFA enabled.";
    const fresh = await loadSettings();
    renderSettings(fresh);
    await TechMart.updateAuthState();
  } catch {
    message.textContent = "Could not connect to the server.";
  }
}

async function disableMfa(event) {
  event.preventDefault();
  const message = document.getElementById("disableMfaMessage");
  message.className = "form-message";
  message.textContent = "";

  const code = document.getElementById("disableMfaCode").value;

  try {
    const response = await fetch("/api/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const result = await response.json();

    if (!response.ok) {
      message.textContent = result.error || "Could not disable MFA.";
      return;
    }

    message.className = "form-message success";
    message.textContent = "MFA disabled.";
    document.getElementById("disableMfaForm").reset();

    const fresh = await loadSettings();
    renderSettings(fresh);
    await TechMart.updateAuthState();
  } catch {
    message.textContent = "Could not connect to the server.";
  }
}
