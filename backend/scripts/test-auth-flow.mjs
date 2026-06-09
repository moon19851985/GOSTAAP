/**
 * اختبار: تسجيل → كود → تفعيل → دخول
 * شغّل الخادم أولاً: npm run dev
 * ثم: node scripts/test-auth-flow.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = process.env.API_URL ?? "http://localhost:4000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const otpFile = path.join(__dirname, "../data/last-otp.json");
const email = `test_${Date.now()}@example.com`;

async function req(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("1) تسجيل جديد → إرسال كود...");
  const reg = await req("/api/auth/register", {
    email,
    password: "123456",
    name: "مستخدم اختبار",
    role: "CUSTOMER",
  });
  if (!reg.ok) {
    console.error("فشل التسجيل:", reg.data);
    process.exit(1);
  }
  console.log("   ✓", reg.data.message);

  await new Promise((r) => setTimeout(r, 500));
  let code;
  if (fs.existsSync(otpFile)) {
    const saved = JSON.parse(fs.readFileSync(otpFile, "utf8"));
    if (saved.email === email.toLowerCase()) code = saved.code;
  }
  if (!code) {
    console.log("   ⚠ راجع بريدك أو طرفية الخادم للكود");
    process.exit(0);
  }
  console.log("2) كود التفعيل:", code);

  console.log("3) إدخال الكود وتفعيل الحساب...");
  const verify = await req("/api/auth/verify-email", { email, code });
  if (!verify.ok) {
    console.error("فشل التفعيل:", verify.data);
    process.exit(1);
  }
  console.log("   ✓", verify.data.message);

  console.log("4) تسجيل الدخول...");
  const login = await req("/api/auth/login", { email, password: "123456" });
  if (!login.ok) {
    console.error("فشل الدخول:", login.data);
    process.exit(1);
  }
  console.log("   ✓ تم الدخول، التوكن:", login.data.token ? "موجود" : "مفقود");

  console.log("\n✅ التدفق كامل: تسجيل → كود → تفعيل → دخول");
}

main().catch((e) => {
  console.error("تأكد أن الخادم يعمل: npm run dev", e.message);
  process.exit(1);
});
