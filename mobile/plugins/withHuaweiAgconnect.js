const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const MARKER = "HUAWEI_AGCONNECT_GOSTASRV";

/**
 * يضيف تعليقاً في build.gradle إذا وُجد agconnect-services.json.
 * بعد prebuild ضع الملف في android/app/agconnect-services.json
 * وفعّل HMS حسب docs/HUAWEI_APPGALLERY.md
 */
function withHuaweiAgconnect(config) {
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const appBuildGradle = path.join(mod.modRequest.platformProjectRoot, "app", "build.gradle");
      if (!fs.existsSync(appBuildGradle)) return mod;

      const agcPath = path.join(mod.modRequest.platformProjectRoot, "app", "agconnect-services.json");
      const hasAgc = fs.existsSync(agcPath);

      let contents = fs.readFileSync(appBuildGradle, "utf8");
      if (contents.includes(MARKER)) return mod;

      const note = hasAgc
        ? `// ${MARKER}: agconnect-services.json موجود — فعّل HMS IAP في Gradle يدوياً إن لزم`
        : `// ${MARKER}: ضع agconnect-services.json في android/app/ ثم أعد prebuild`;

      contents = `${note}\n${contents}`;
      fs.writeFileSync(appBuildGradle, contents);
      return mod;
    },
  ]);
}

module.exports = withHuaweiAgconnect;
