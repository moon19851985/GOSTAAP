import Database from "better-sqlite3";

const email = (process.argv[2] || "").toLowerCase().trim();
if (!email) {
  console.error("Usage: node scripts/reset-user-by-email.mjs <email>");
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
const db = new Database(dbPath);

const user = db.prepare("SELECT * FROM User WHERE lower(email) = ?").get(email);
if (!user) {
  console.log("No user found for:", email);
  process.exit(0);
}

console.log("Found user:", { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified });

const captain = db.prepare("SELECT * FROM Captain WHERE userId = ?").get(user.id);
const restaurant = db.prepare("SELECT * FROM Restaurant WHERE userId = ?").get(user.id);

const reset = db.transaction(() => {
  if (captain) {
    const captainOrders = db
      .prepare('SELECT id FROM "Order" WHERE captainId = ?')
      .all(captain.id)
      .map((r) => r.id);
    for (const orderId of captainOrders) {
      db.prepare("DELETE FROM Payment WHERE orderId = ?").run(orderId);
      db.prepare('DELETE FROM OrderItem WHERE orderId = ?').run(orderId);
      db.prepare('UPDATE "Order" SET captainId = NULL WHERE id = ?').run(orderId);
    }
    db.prepare("DELETE FROM Captain WHERE id = ?").run(captain.id);
  }

  const customerOrders = db
    .prepare('SELECT id FROM "Order" WHERE customerId = ?')
    .all(user.id)
    .map((r) => r.id);
  for (const orderId of customerOrders) {
    db.prepare("DELETE FROM Payment WHERE orderId = ?").run(orderId);
    db.prepare('DELETE FROM OrderItem WHERE orderId = ?').run(orderId);
    db.prepare('DELETE FROM "Order" WHERE id = ?').run(orderId);
  }

  try {
    db.prepare("DELETE FROM FavoriteRestaurant WHERE userId = ?").run(user.id);
  } catch {
    /* table may not exist */
  }

  try {
    db.prepare("DELETE FROM EmailVerification WHERE email = ?").run(email);
  } catch {
    /* table may not exist */
  }

  try {
    db.prepare("DELETE FROM EmailActivation WHERE email = ?").run(email);
  } catch {
    /* table may not exist */
  }

  if (restaurant) {
    db.prepare("DELETE FROM Restaurant WHERE id = ?").run(restaurant.id);
  }

  db.prepare("DELETE FROM User WHERE id = ?").run(user.id);
});

reset();
console.log("Deleted user and all related data for:", email);
