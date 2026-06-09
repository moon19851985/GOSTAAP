/** اختبار تسجيل عميل + كابتن */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = "http://localhost:4000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const otpFile = path.join(__dirname, "../data/last-otp.json");
const ts = Date.now();

async function req(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function getOtp(email) {
  await new Promise((r) => setTimeout(r, 300));
  if (!fs.existsSync(otpFile)) return null;
  const saved = JSON.parse(fs.readFileSync(otpFile, "utf8"));
  return saved.email === email.toLowerCase() ? saved.code : null;
}

async function testRole(role, email) {
  console.log(`\n=== ${role} ===`);
  const reg = await req("/api/auth/register", {
    email,
    password: "123456",
    name: role === "CAPTAIN" ? "كابتن تجريبي" : "عميل تجريبي",
    role,
    phone: "0500000099",
    ...(role === "CAPTAIN" ? { captain: { vehicle: "دراجة" } } : {}),
  });
  if (!reg.ok) {
    console.error("❌ تسجيل:", reg.data);
    return false;
  }
  console.log("✓ تسجيل:", reg.data.message);

  const code = await getOtp(email);
  if (!code) {
    console.error("❌ لم يُعثر على كود OTP");
    return false;
  }
  console.log("✓ كود:", code);

  const verify = await req("/api/auth/verify-email", { email, code });
  if (!verify.ok) {
    console.error("❌ تفعيل:", verify.data);
    return false;
  }
  console.log("✓ تفعيل:", verify.data.user.role, verify.data.user.captainId ?? verify.data.user.restaurantId ?? "-");

  const login = await req("/api/auth/login", { email, password: "123456" });
  if (!login.ok) {
    console.error("❌ دخول:", login.data);
    return false;
  }
  console.log("✓ دخول:", login.data.user.role);

  const me = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${login.data.token}` },
  });
  const meData = await me.json();
  if (!me.ok) {
    console.error("❌ /me:", meData);
    return false;
  }
  if (role === "CAPTAIN" && !meData.user.captainId) {
    console.error("❌ ملف الكابتن غير موجود");
    return false;
  }
  console.log("✓ /me:", meData.user.name, meData.user.role);
  return true;
}

const customerOk = await testRole("CUSTOMER", `customer_${ts}@test.com`);
const captainOk = await testRole("CAPTAIN", `captain_${ts}@test.com`);

console.log("\n" + (customerOk && captainOk ? "✅ العميل والكابتن يعملان" : "❌ يوجد مشكلة"));
process.exit(customerOk && captainOk ? 0 : 1);
