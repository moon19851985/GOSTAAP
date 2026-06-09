import Database from "better-sqlite3";

const db = new Database("./data/app.db");
const users = db.prepare("SELECT id, email, role FROM User").all();
const restaurants = db.prepare("SELECT id, userId, name FROM Restaurant").all();
const orders = db
  .prepare('SELECT id, status, customerId, createdAt FROM "Order" ORDER BY createdAt DESC LIMIT 10')
  .all();

console.log("users:", users);
console.log("restaurants:", restaurants);
console.log("recent orders:", orders);

for (const r of restaurants) {
  const incoming = db
    .prepare(
      `SELECT DISTINCT o.id, o.status FROM "Order" o
       JOIN OrderItem oi ON oi.orderId = o.id
       WHERE oi.restaurantId = ? AND o.status IN ('PAID','PREPARING','READY_FOR_PICKUP','CAPTAIN_ASSIGNED','PICKED_UP','DELIVERING')
       ORDER BY o.createdAt DESC`
    )
    .all(r.id);
  const completed = db
    .prepare(
      `SELECT DISTINCT o.id, o.status FROM "Order" o
       JOIN OrderItem oi ON oi.orderId = o.id
       WHERE oi.restaurantId = ? AND o.status IN ('DELIVERED')
       ORDER BY o.createdAt DESC`
    )
    .all(r.id);
  console.log(`active for ${r.name}:`, incoming);
  console.log(`completed for ${r.name}:`, completed);
}

const items = db.prepare("SELECT orderId, restaurantId, productId FROM OrderItem").all();
console.log("order items:", items);
