/**
 * يمسح كل بيانات الحسابات المسجّلة (مستخدمون، مطاعم، منتجات، طلبات…)
 * دون المساس بهيكل الجداول أو إعدادات .env
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.env.DATABASE_PATH ?? path.join(__dirname, "../data/app.db");
const uploadDir = process.env.UPLOAD_DIR ?? path.join(__dirname, "../uploads");

function wipeUploads() {
  if (!fs.existsSync(uploadDir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(uploadDir)) {
    const full = path.join(uploadDir, name);
    if (!fs.statSync(full).isFile()) continue;
    fs.unlinkSync(full);
    removed++;
  }
  return removed;
}

function wipeDb() {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const counts = (table: string) =>
    (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

  const before = {
    users: counts("User"),
    orders: counts('"Order"'),
    products: counts("Product"),
  };

  const run = db.transaction(() => {
    db.exec(`DELETE FROM Payment`);
    db.exec(`DELETE FROM OrderItem`);
    db.exec(`DELETE FROM "Order"`);
    db.exec(`DELETE FROM Promotion`);
    db.exec(`DELETE FROM FavoriteRestaurant`);
    db.exec(`DELETE FROM Product`);
    db.exec(`DELETE FROM Restaurant`);
    db.exec(`DELETE FROM Captain`);
    db.exec(`DELETE FROM EmailVerification`);
    db.exec(`DELETE FROM User`);
  });

  run();
  db.close();

  return { before, dbPath };
}

const { before, dbPath: usedPath } = wipeDb();
const filesRemoved = wipeUploads();

console.log("تم تصفير بيانات الحسابات المسجّلة:");
console.log(`  قاعدة البيانات: ${usedPath}`);
console.log(`  قبل: ${before.users} مستخدم، ${before.orders} طلب، ${before.products} منتج`);
console.log(`  بعد: 0 حسابات (جاهز لتسجيل جديد)`);
console.log(`  صور مرفوعة محذوفة: ${filesRemoved} ملف`);
