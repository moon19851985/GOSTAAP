import { cpSync, existsSync, rmSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
const mobileRoot = path.join(backendRoot, "..", "mobile");
const publicDir = path.join(backendRoot, "public");
const mobilePkg = path.join(mobileRoot, "package.json");

if (!existsSync(mobilePkg)) {
  console.warn("[web] مجلد mobile/ غير موجود — تخطي بناء الواجهة");
  process.exit(0);
}

const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.PUBLIC_BASE_URL ||
  ""
).replace(/\/$/, "");

const env = {
  ...process.env,
  APP_ENV: "production",
  EXPO_PUBLIC_API_URL: apiUrl,
};

console.log("[web] بناء واجهة Expo Web…", apiUrl ? `API=${apiUrl}` : "");
execSync("npm install", { cwd: mobileRoot, stdio: "inherit", env });
execSync("npx expo export --platform web", { cwd: mobileRoot, stdio: "inherit", env });

const distDir = path.join(mobileRoot, "dist");
if (!existsSync(path.join(distDir, "index.html"))) {
  throw new Error("[web] فشل التصدير — index.html غير موجود في mobile/dist");
}

rmSync(publicDir, { recursive: true, force: true });
cpSync(distDir, publicDir, { recursive: true });
console.log("[web] تم نسخ الواجهة إلى backend/public");
