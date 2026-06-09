const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "RELEASE_SIGNING_GOSTASRV";

const prelude = `
// ${MARKER}
def gostasrvKeystorePropertiesFile = rootProject.file("../keystore.properties")
def gostasrvKeystoreProperties = new Properties()
if (gostasrvKeystorePropertiesFile.exists()) {
    gostasrvKeystoreProperties.load(new FileInputStream(gostasrvKeystorePropertiesFile))
}
// ${MARKER}_APPLIED
`;

const releaseSigningBlock = `
        release {
            if (gostasrvKeystorePropertiesFile.exists()) {
                storeFile rootProject.file("../" + gostasrvKeystoreProperties['storeFile'])
                storePassword gostasrvKeystoreProperties['storePassword']
                keyAlias gostasrvKeystoreProperties['keyAlias']
                keyPassword gostasrvKeystoreProperties['keyPassword']
            }
        }`;

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") return mod;
    let contents = mod.modResults.contents;
    if (contents.includes(`${MARKER}_APPLIED`)) return mod;

    contents = contents.replace(/android\s*\{/, `${prelude}\nandroid {`);

    if (!contents.includes("gostasrvKeystoreProperties['keyAlias']")) {
      contents = contents.replace(/signingConfigs\s*\{/, `signingConfigs {${releaseSigningBlock}`);
    }

    contents = contents.replace(
      /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
      (match) => match.replace("signingConfigs.debug", "signingConfigs.release")
    );

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withAndroidReleaseSigning;
