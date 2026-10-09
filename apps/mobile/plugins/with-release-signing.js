const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @specsync release signing';

/**
 * Signs `assembleRelease` with the SpecSync upload key when the Gradle
 * properties `SPECSYNC_UPLOAD_STORE_FILE`, `SPECSYNC_UPLOAD_KEY_ALIAS`,
 * `SPECSYNC_UPLOAD_STORE_PASSWORD` and `SPECSYNC_UPLOAD_KEY_PASSWORD` are set
 * (in `~/.gradle/gradle.properties`, never in the repo). Without them the
 * release build keeps the template's debug signing. `android/` is generated
 * by `expo prebuild`, so the change lives here rather than in build.gradle.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(MARKER)) return mod;
    gradle = gradle.replace(
      /signingConfigs \{\n(\s*)debug \{/,
      (match, indent) =>
        `signingConfigs {\n${indent}${MARKER}\n${indent}release {\n` +
        `${indent}    if (project.hasProperty('SPECSYNC_UPLOAD_STORE_FILE')) {\n` +
        `${indent}        storeFile file(SPECSYNC_UPLOAD_STORE_FILE)\n` +
        `${indent}        storePassword SPECSYNC_UPLOAD_STORE_PASSWORD\n` +
        `${indent}        keyAlias SPECSYNC_UPLOAD_KEY_ALIAS\n` +
        `${indent}        keyPassword SPECSYNC_UPLOAD_KEY_PASSWORD\n` +
        `${indent}    }\n${indent}}\n${indent}debug {`,
    );
    gradle = gradle.replace(
      /(release \{[^{}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('SPECSYNC_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (!gradle.includes('signingConfigs.release'))
      throw new Error(
        'with-release-signing: the app build.gradle template changed; update the plugin.',
      );
    mod.modResults.contents = gradle;
    return mod;
  });
};
