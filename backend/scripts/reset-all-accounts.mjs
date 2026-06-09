import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

function count(table) {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

const before = {
  users: count("User"),
  restaurants: count("Restaurant"),
  captains: count("Captain"),
  products: count("Product"),
  promotions: count("Promotion"),
  orders: count('"Order"'),
  orderItems: count("OrderItem"),
  payments: count("Payment"),
  favorites: count("FavoriteRestaurant"),
  verifications: count("EmailVerification"),
};

console.log("Before reset:", before);

const resetAll = db.transaction(() => {
  db.prepare("DELETE FROM Payment").run();
  db.prepare('DELETE FROM OrderItem').run();
  db.prepare('DELETE FROM "Order"').run();
  db.prepare("DELETE FROM FavoriteRestaurant").run();
  db.prepare("DELETE FROM Promotion").run();
  db.prepare("DELETE FROM Product").run();
  db.prepare("DELETE FROM Restaurant").run();
  db.prepare("DELETE FROM Captain").run();
  db.prepare("DELETE FROM EmailVerification").run();
  db.prepare("DELETE FROM User").run();
});

resetAll();

const after = {
  users: count("User"),
  restaurants: count("Restaurant"),
  captains: count("Captain"),
  products: count("Product"),
  promotions: count("Promotion"),
  orders: count('"Order"'),
  orderItems: count("OrderItem"),
  payments: count("Payment"),
  favorites: count("FavoriteRestaurant"),
  verifications: count("EmailVerification"),
};

console.log("After reset:", after);
console.log("All accounts and related data cleared.");
