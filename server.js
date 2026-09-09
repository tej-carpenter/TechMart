import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { authenticator } from "otplib";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "techmart-lab-development-secret-change-this-in-production";

app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: "techmart.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

const products = [
  { id: 1, name: "TechBook Pro 14", category: "Laptops", price: 74999, description: "14-inch productivity laptop with a modern aluminium design.", badge: "Popular" },
  { id: 2, name: "TechBook Air 13", category: "Laptops", price: 62999, description: "Lightweight laptop for study, work and everyday use.", badge: "New" },
  { id: 3, name: "Nova X5", category: "Smartphones", price: 39999, description: "Fast 5G smartphone with a bright AMOLED display.", badge: "Best seller" },
  { id: 4, name: "Nova Lite", category: "Smartphones", price: 21999, description: "Balanced smartphone with a long-lasting battery.", badge: "Value" },
  { id: 5, name: "SoundCore Studio", category: "Audio", price: 8999, description: "Wireless over-ear headphones with active noise cancellation.", badge: "Featured" },
  { id: 6, name: "Pocket Buds", category: "Audio", price: 3499, description: "Compact wireless earbuds with a charging case.", badge: "Popular" },
  { id: 7, name: "KeyPro Mechanical", category: "Accessories", price: 4999, description: "Mechanical keyboard with hot-swappable switches.", badge: "New" },
  { id: 8, name: "Precision Mouse", category: "Accessories", price: 2299, description: "Ergonomic wireless mouse for work and gaming.", badge: "Value" },
  { id: 9, name: "GameBox S", category: "Gaming", price: 45999, description: "Compact gaming console for living-room entertainment.", badge: "Popular" },
  { id: 10, name: "UltraView 27", category: "Monitors", price: 24999, description: "27-inch QHD monitor with a fast refresh rate.", badge: "Featured" },
  { id: 11, name: "UltraView 24", category: "Monitors", price: 13999, description: "24-inch Full HD monitor for work and study.", badge: "Value" },
  { id: 12, name: "GamePad Pro", category: "Gaming", price: 5999, description: "Wireless controller with precise analogue controls.", badge: "New" }
];

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mfaEnabled: Boolean(user.mfa_enabled)
  };
}

function currentUser(req) {
  if (!req.session.userId) return null;
  return db
    .prepare("SELECT id, name, email, mfa_enabled FROM users WHERE id = ?")
    .get(req.session.userId);
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }
  req.user = user;
  next();
}

function logEvent(userId, event, success) {
  db.prepare(
    "INSERT INTO login_events (user_id, event, success) VALUES (?, ?, ?)"
  ).run(userId ?? null, event, success ? 1 : 0);
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

app.get("/api/products", (req, res) => {
  const category = String(req.query.category || "").trim();
  const result = category
    ? products.filter((p) => p.category.toLowerCase() === category.toLowerCase())
    : products;
  res.json(result);
});

app.get("/api/auth/me", (req, res) => {
  const user = currentUser(req);
  res.json({
    authenticated: Boolean(user),
    user: publicUser(user)
  });
});

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = cleanEmail(req.body.email);
  const password = req.body.password;

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: "Enter a valid name." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  if (!validPassword(password)) {
    return res.status(400).json({ error: "Password must contain at least 8 characters." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name, email, passwordHash);

  logEvent(result.lastInsertRowid, "registration", true);

  res.status(201).json({
    message: "Account created successfully.",
    redirect: "/login.html"
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = req.body.password;

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    logEvent(null, "login", false);
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const passwordMatches = await bcrypt.compare(password || "", user.password_hash);

  if (!passwordMatches) {
    logEvent(user.id, "login", false);
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (user.mfa_enabled) {
    req.session.pendingMfaUserId = user.id;
    delete req.session.userId;
    logEvent(user.id, "password-authentication", true);

    return res.json({
      mfaRequired: true,
      message: "Enter the code from your authenticator app."
    });
  }

  req.session.userId = user.id;
  delete req.session.pendingMfaUserId;
  logEvent(user.id, "login", true);

  res.json({
    mfaRequired: false,
    user: publicUser(user),
    redirect: "/"
  });
});

app.post("/api/auth/verify-mfa", (req, res) => {
  const pendingId = req.session.pendingMfaUserId;
  const token = String(req.body.code || "").replace(/\s/g, "");

  if (!pendingId) {
    return res.status(401).json({ error: "Your login session has expired. Log in again." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(pendingId);

  if (!user || !user.mfa_enabled || !user.mfa_secret) {
    delete req.session.pendingMfaUserId;
    return res.status(401).json({ error: "MFA verification is not available for this account." });
  }

  if (!/^\d{6}$/.test(token) || !authenticator.check(token, user.mfa_secret)) {
    logEvent(user.id, "mfa-verification", false);
    return res.status(401).json({ error: "Invalid or expired MFA code." });
  }

  req.session.userId = user.id;
  delete req.session.pendingMfaUserId;
  logEvent(user.id, "mfa-verification", true);

  res.json({
    message: "MFA verified.",
    user: publicUser(user),
    redirect: "/"
  });
});

app.post("/api/auth/logout", (req, res) => {
  const user = currentUser(req);
  if (user) logEvent(user.id, "logout", true);

  req.session.destroy(() => {
    res.clearCookie("techmart.sid");
    res.json({ message: "Logged out." });
  });
});

app.get("/api/settings", requireAuth, (req, res) => {
  res.json({
    user: publicUser(req.user),
    mfa: {
      enabled: Boolean(req.user.mfa_enabled)
    }
  });
});

app.post("/api/mfa/setup", requireAuth, async (req, res) => {
  if (req.user.mfa_enabled) {
    return res.status(400).json({ error: "MFA is already enabled." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const secret = authenticator.generateSecret();
  const issuer = "TechMart";
  const label = `${issuer}:${user.email}`;
  const otpauth = authenticator.keyuri(user.email, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, {
    width: 280,
    margin: 2
  });

  req.session.pendingMfaSecret = secret;

  res.json({
    qrDataUrl,
    manualKey: secret,
    label,
    issuer
  });
});

app.post("/api/mfa/enable", requireAuth, (req, res) => {
  if (req.user.mfa_enabled) {
    return res.status(400).json({ error: "MFA is already enabled." });
  }

  const secret = req.session.pendingMfaSecret;
  const code = String(req.body.code || "").replace(/\s/g, "");

  if (!secret) {
    return res.status(400).json({ error: "Start MFA setup first." });
  }

  if (!/^\d{6}$/.test(code) || !authenticator.check(code, secret)) {
    return res.status(400).json({ error: "The code is incorrect or expired." });
  }

  db.prepare(
    "UPDATE users SET mfa_enabled = 1, mfa_secret = ? WHERE id = ?"
  ).run(secret, req.user.id);

  delete req.session.pendingMfaSecret;
  logEvent(req.user.id, "mfa-enabled", true);

  const updated = db
    .prepare("SELECT id, name, email, mfa_enabled FROM users WHERE id = ?")
    .get(req.user.id);

  res.json({
    message: "MFA enabled successfully.",
    user: publicUser(updated)
  });
});

app.post("/api/mfa/disable", requireAuth, (req, res) => {
  const code = String(req.body.code || "").replace(/\s/g, "");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);

  if (!user.mfa_enabled || !user.mfa_secret) {
    return res.status(400).json({ error: "MFA is not enabled." });
  }

  if (!/^\d{6}$/.test(code) || !authenticator.check(code, user.mfa_secret)) {
    return res.status(400).json({ error: "Enter a valid current MFA code." });
  }

  db.prepare(
    "UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?"
  ).run(req.user.id);

  logEvent(req.user.id, "mfa-disabled", true);

  res.json({
    message: "MFA disabled.",
    user: {
      ...publicUser(user),
      mfaEnabled: false
    }
  });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TechMart running at http://localhost:${PORT}`);
});
