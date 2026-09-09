import Database from "better-sqlite3";

const db = new Database("techmart.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    mfa_secret TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    stock INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    attempt_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id INTEGER PRIMARY KEY,
    marketing_emails INTEGER NOT NULL DEFAULT 0,
    personalized_recommendations INTEGER NOT NULL DEFAULT 1,
    profile_visibility INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const productCount = db
  .prepare("SELECT COUNT(*) AS count FROM products")
  .get().count;

if (productCount === 0) {
  const products = [
    [
      "TechMart ProBook 14",
      "14-inch performance laptop with 16GB RAM and 512GB SSD.",
      65999,
      "Laptops",
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80",
      15
    ],
    [
      "TechMart AirPhone X",
      "Premium smartphone with a high-resolution display and fast processor.",
      42999,
      "Smartphones",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
      20
    ],
    [
      "TechMart Sonic Pro",
      "Wireless noise-cancelling headphones with 30-hour battery life.",
      7999,
      "Audio",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      35
    ],
    [
      "TechMart Mechanical K1",
      "RGB mechanical keyboard with tactile switches.",
      3499,
      "Accessories",
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
      40
    ],
    [
      "TechMart Precision Mouse",
      "Ergonomic wireless mouse designed for productivity and gaming.",
      1999,
      "Accessories",
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=800&q=80",
      50
    ],
    [
      "TechMart UltraView 27",
      "27-inch QHD monitor with a 144Hz refresh rate.",
      18999,
      "Monitors",
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
      12
    ],
    [
      "TechMart GamePad G2",
      "Wireless controller with precision analog sticks.",
      2999,
      "Gaming",
      "https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=800&q=80",
      25
    ],
    [
      "TechMart USB-C Hub",
      "7-in-1 USB-C hub with HDMI, USB 3.0 and card readers.",
      2499,
      "Accessories",
      "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=800&q=80",
      60
    ]
  ];

  const insert = db.prepare(`
    INSERT INTO products
    (name, description, price, category, image, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(...item);
    }
  });

  insertMany(products);
}

export default db;