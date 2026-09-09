import "dotenv/config";

import express from "express";
import helmet from "helmet";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "development-only-secret-change-this";

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

app.use(
  cookieSession({
    name: "techmart_session",
    keys: [SESSION_SECRET],
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 4
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Please try again later."
  }
});

const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many verification attempts. Please try again later."
  }
});

app.use(express.static(path.join(__dirname, "public")));

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function logAttempt({
  userId = null,
  email = null,
  success = false,
  req,
  attemptType
}) {
  db.prepare(`
    INSERT INTO login_attempts
    (user_id, email, success, ip_address, attempt_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    userId,
    email,
    success ? 1 : 0,
    clientIp(req),
    attemptType
  );
}

function getUserById(id) {
  return db
    .prepare(`
      SELECT
        id,
        name,
        email,
        mfa_enabled,
        created_at
      FROM users
      WHERE id = ?
    `)
    .get(id);
}

function getUserWithSecretById(id) {
  return db
    .prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `)
    .get(id);
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  const user = getUserById(req.session.userId);

  if (!user) {
    req.session = null;

    return res.status(401).json({
      error: "Authentication required."
    });
  }

  req.user = user;
  next();
}

function requireRecentMfa(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  if (!req.session.mfaVerified) {
    return res.status(403).json({
      error: "Additional verification required."
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| General routes
|--------------------------------------------------------------------------
*/

app.get("/api/products", (req, res) => {
  const products = db
    .prepare(`
      SELECT
        id,
        name,
        description,
        price,
        category,
        image,
        stock
      FROM products
      ORDER BY id
    `)
    .all();

  res.json({ products });
});

app.get("/api/me", (req, res) => {
  if (!req.session?.userId) {
    return res.json({
      authenticated: false
    });
  }

  const user = getUserById(req.session.userId);

  if (!user) {
    req.session = null;

    return res.json({
      authenticated: false
    });
  }

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mfaEnabled: Boolean(user.mfa_enabled),
      createdAt: user.created_at
    }
  });
});

/*
|--------------------------------------------------------------------------
| Registration
|--------------------------------------------------------------------------
*/

app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        error: "Please enter a valid name."
      });
    }

    if (!validEmail(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must contain at least 8 characters."
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        error: "Password is too long."
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db
      .prepare(`
        INSERT INTO users
        (name, email, password_hash)
        VALUES (?, ?, ?)
      `)
      .run(name, email, passwordHash);

    db.prepare(`
      INSERT INTO privacy_settings
      (user_id)
      VALUES (?)
    `).run(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: "Account created successfully."
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      error: "Unable to create the account."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!validEmail(email) || !password) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email);

    if (!user) {
      logAttempt({
        email,
        success: false,
        req,
        attemptType: "password"
      });

      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordCorrect) {
      logAttempt({
        userId: user.id,
        email,
        success: false,
        req,
        attemptType: "password"
      });

      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    logAttempt({
      userId: user.id,
      email,
      success: true,
      req,
      attemptType: "password"
    });

    /*
     * If MFA is enabled, create only a temporary
     * authentication state.
     */
    if (user.mfa_enabled) {
      const challengeId = crypto.randomBytes(32).toString("hex");

      req.session = {
        mfaPendingUserId: user.id,
        mfaChallengeId: challengeId,
        mfaChallengeCreatedAt: Date.now()
      };

      return res.json({
        success: true,
        requiresMfa: true
      });
    }

    /*
     * MFA disabled:
     * create normal authenticated session.
     */
    req.session = {
      userId: user.id,
      mfaVerified: false
    };

    res.json({
      success: true,
      requiresMfa: false
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Unable to complete login."
    });
  }
});

/*
|--------------------------------------------------------------------------
| MFA login verification
|--------------------------------------------------------------------------
*/

app.post("/api/login/mfa", mfaLimiter, (req, res) => {
  try {
    const code = String(req.body.code || "").replace(/\s/g, "");

    if (!/^\d{6}$/.test(code)) {
      return res.status(401).json({
        error: "Invalid verification code."
      });
    }

    const pendingUserId = req.session?.mfaPendingUserId;
    const challengeId = req.session?.mfaChallengeId;
    const createdAt = req.session?.mfaChallengeCreatedAt;

    if (!pendingUserId || !challengeId || !createdAt) {
      return res.status(401).json({
        error: "Verification session expired."
      });
    }

    /*
     * MFA challenge lifetime: 5 minutes.
     */
    if (Date.now() - createdAt > 5 * 60 * 1000) {
      req.session = null;

      return res.status(401).json({
        error: "Verification session expired."
      });
    }

    const user = getUserWithSecretById(pendingUserId);

    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      req.session = null;

      return res.status(401).json({
        error: "Unable to verify the account."
      });
    }

    const valid = authenticator.check(
      code,
      user.mfa_secret
    );

    logAttempt({
      userId: user.id,
      email: user.email,
      success: valid,
      req,
      attemptType: "mfa"
    });

    if (!valid) {
      return res.status(401).json({
        error: "Invalid verification code."
      });
    }

    /*
     * Convert temporary session into authenticated session.
     */
    req.session = {
      userId: user.id,
      mfaVerified: true,
      authenticatedAt: Date.now()
    };

    res.json({
      success: true
    });
  } catch (error) {
    console.error("MFA verification error:", error);

    res.status(500).json({
      error: "Unable to verify the code."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

app.post("/api/logout", (req, res) => {
  req.session = null;

  res.json({
    success: true
  });
});

/*
|--------------------------------------------------------------------------
| MFA enrollment
|--------------------------------------------------------------------------
*/

app.post("/api/mfa/setup", requireAuth, (req, res) => {
  try {
    if (req.user.mfa_enabled) {
      return res.status(400).json({
        error: "Two-step verification is already enabled."
      });
    }

    const secret = authenticator.generateSecret();

    const issuer = "TechMart";
    const accountName = req.user.email;

    const otpauthUrl = authenticator.keyuri(
      accountName,
      issuer,
      secret
    );

    QRCode.toDataURL(otpauthUrl, {
      width: 280,
      margin: 2
    })
      .then((qrCode) => {
        /*
         * Store the secret temporarily in the session.
         * It is not enabled until the user proves possession
         * by entering a valid TOTP code.
         */
        req.session.mfaSetupSecret = secret;
        req.session.mfaSetupCreatedAt = Date.now();

        res.json({
          success: true,
          qrCode,
          manualKey: secret
        });
      })
      .catch((error) => {
        console.error("QR generation error:", error);

        res.status(500).json({
          error: "Unable to generate the setup code."
        });
      });
  } catch (error) {
    console.error("MFA setup error:", error);

    res.status(500).json({
      error: "Unable to start MFA setup."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Confirm MFA enrollment
|--------------------------------------------------------------------------
*/

app.post("/api/mfa/confirm", mfaLimiter, requireAuth, (req, res) => {
  try {
    const code = String(req.body.code || "").replace(/\s/g, "");

    const secret = req.session?.mfaSetupSecret;
    const createdAt = req.session?.mfaSetupCreatedAt;

    if (!secret || !createdAt) {
      return res.status(400).json({
        error: "Please start MFA setup again."
      });
    }

    if (Date.now() - createdAt > 10 * 60 * 1000) {
      delete req.session.mfaSetupSecret;
      delete req.session.mfaSetupCreatedAt;

      return res.status(400).json({
        error: "MFA setup has expired. Please start again."
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: "Enter the 6-digit verification code."
      });
    }

    const valid = authenticator.check(code, secret);

    if (!valid) {
      return res.status(400).json({
        error: "Invalid verification code."
      });
    }

    db.prepare(`
      UPDATE users
      SET mfa_enabled = 1,
          mfa_secret = ?
      WHERE id = ?
    `).run(secret, req.user.id);

    delete req.session.mfaSetupSecret;
    delete req.session.mfaSetupCreatedAt;

    /*
     * MFA has now been successfully enabled.
     */
    req.session.mfaVerified = true;

    res.json({
      success: true,
      message: "Two-step verification has been enabled."
    });
  } catch (error) {
    console.error("MFA confirmation error:", error);

    res.status(500).json({
      error: "Unable to enable two-step verification."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Disable MFA
|--------------------------------------------------------------------------
*/

app.post("/api/mfa/disable", mfaLimiter, requireAuth, (req, res) => {
  try {
    const code = String(req.body.code || "").replace(/\s/g, "");

    const user = getUserWithSecretById(req.user.id);

    if (!user.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({
        error: "Two-step verification is not enabled."
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: "Enter your current verification code."
      });
    }

    const valid = authenticator.check(
      code,
      user.mfa_secret
    );

    if (!valid) {
      return res.status(400).json({
        error: "Invalid verification code."
      });
    }

    db.prepare(`
      UPDATE users
      SET mfa_enabled = 0,
          mfa_secret = NULL
      WHERE id = ?
    `).run(user.id);

    req.session.mfaVerified = false;

    res.json({
      success: true,
      message: "Two-step verification has been disabled."
    });
  } catch (error) {
    console.error("MFA disable error:", error);

    res.status(500).json({
      error: "Unable to disable two-step verification."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Change password
|--------------------------------------------------------------------------
*/

app.post(
  "/api/account/password",
  mfaLimiter,
  requireAuth,
  (req, res) => {
    try {
      const currentPassword = String(
        req.body.currentPassword || ""
      );

      const newPassword = String(
        req.body.newPassword || ""
      );

      if (!currentPassword || newPassword.length < 8) {
        return res.status(400).json({
          error: "Please provide valid password information."
        });
      }

      const user = getUserWithSecretById(req.user.id);

      const currentCorrect = bcrypt.compareSync(
        currentPassword,
        user.password_hash
      );

      if (!currentCorrect) {
        return res.status(400).json({
          error: "Current password is incorrect."
        });
      }

      const newHash = bcrypt.hashSync(
        newPassword,
        12
      );

      db.prepare(`
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `).run(newHash, user.id);

      res.json({
        success: true,
        message: "Password changed successfully."
      });
    } catch (error) {
      console.error("Password change error:", error);

      res.status(500).json({
        error: "Unable to change password."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Privacy settings
|--------------------------------------------------------------------------
*/

app.get("/api/settings/privacy", requireAuth, (req, res) => {
  let settings = db
    .prepare(`
      SELECT
        marketing_emails,
        personalized_recommendations,
        profile_visibility
      FROM privacy_settings
      WHERE user_id = ?
    `)
    .get(req.user.id);

  if (!settings) {
    db.prepare(`
      INSERT INTO privacy_settings
      (user_id)
      VALUES (?)
    `).run(req.user.id);

    settings = db
      .prepare(`
        SELECT
          marketing_emails,
          personalized_recommendations,
          profile_visibility
        FROM privacy_settings
        WHERE user_id = ?
      `)
      .get(req.user.id);
  }

  res.json({
    marketingEmails: Boolean(settings.marketing_emails),
    personalizedRecommendations: Boolean(
      settings.personalized_recommendations
    ),
    profileVisibility: Boolean(settings.profile_visibility)
  });
});

app.put(
  "/api/settings/privacy",
  requireAuth,
  (req, res) => {
    try {
      const marketingEmails =
        Boolean(req.body.marketingEmails);

      const personalizedRecommendations =
        Boolean(req.body.personalizedRecommendations);

      const profileVisibility =
        Boolean(req.body.profileVisibility);

      db.prepare(`
        INSERT INTO privacy_settings
        (
          user_id,
          marketing_emails,
          personalized_recommendations,
          profile_visibility
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET
          marketing_emails = excluded.marketing_emails,
          personalized_recommendations =
            excluded.personalized_recommendations,
          profile_visibility =
            excluded.profile_visibility
      `).run(
        req.user.id,
        marketingEmails ? 1 : 0,
        personalizedRecommendations ? 1 : 0,
        profileVisibility ? 1 : 0
      );

      res.json({
        success: true
      });
    } catch (error) {
      console.error("Privacy settings error:", error);

      res.status(500).json({
        error: "Unable to update privacy settings."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

app.post("/api/orders", requireAuth, (req, res) => {
  try {
    const items = Array.isArray(req.body.items)
      ? req.body.items
      : [];

    if (items.length === 0) {
      return res.status(400).json({
        error: "Your cart is empty."
      });
    }

    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      if (
        !Number.isInteger(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return res.status(400).json({
          error: "Invalid cart."
        });
      }

      const product = db
        .prepare(`
          SELECT id, name, price, stock
          FROM products
          WHERE id = ?
        `)
        .get(productId);

      if (!product || product.stock < quantity) {
        return res.status(400).json({
          error: `Product is unavailable: ${
            product?.name || "Unknown"
          }`
        });
      }

      total += product.price * quantity;

      validatedItems.push({
        product,
        quantity
      });
    }

    const createOrder = db.transaction(() => {
      const order = db
        .prepare(`
          INSERT INTO orders
          (user_id, total_amount, status)
          VALUES (?, ?, 'Confirmed')
        `)
        .run(req.user.id, total);

      const orderId = order.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO order_items
        (order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `);

      const reduceStock = db.prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ?
      `);

      for (const item of validatedItems) {
        insertItem.run(
          orderId,
          item.product.id,
          item.quantity,
          item.product.price
        );

        reduceStock.run(
          item.quantity,
          item.product.id
        );
      }

      return orderId;
    });

    const orderId = createOrder();

    res.status(201).json({
      success: true,
      orderId,
      total
    });
  } catch (error) {
    console.error("Order error:", error);

    res.status(500).json({
      error: "Unable to create the order."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Recent orders
|--------------------------------------------------------------------------
*/

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = db
    .prepare(`
      SELECT
        id,
        total_amount,
        status,
        created_at
      FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `)
    .all(req.user.id);

  res.json({
    orders
  });
});

/*
|--------------------------------------------------------------------------
| Fallback
|--------------------------------------------------------------------------
*/

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log("        TECHMART IS RUNNING");
  console.log("========================================");
  console.log(`http://localhost:${PORT}`);
  console.log("");
});