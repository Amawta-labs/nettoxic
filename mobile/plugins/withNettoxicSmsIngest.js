const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RECEIVER_CLASS = "cl.nettoxic.app.sms.NettoxicSmsReceiver";

function addPermission(manifest, permission) {
  manifest["uses-permission"] = manifest["uses-permission"] || [];
  const exists = manifest["uses-permission"].some((entry) => entry.$["android:name"] === permission);
  if (!exists) manifest["uses-permission"].push({ $: { "android:name": permission } });
}

function upsertMetaData(application, name, value) {
  application["meta-data"] = application["meta-data"] || [];
  const existing = application["meta-data"].find((entry) => entry.$["android:name"] === name);
  if (existing) {
    existing.$["android:value"] = value;
    return;
  }
  application["meta-data"].push({ $: { "android:name": name, "android:value": value } });
}

function upsertReceiver(application) {
  application.receiver = application.receiver || [];
  const existing = application.receiver.find((entry) => entry.$["android:name"] === RECEIVER_CLASS);
  const receiver = existing ?? {
    $: {
      "android:name": RECEIVER_CLASS,
      "android:enabled": "true",
      "android:exported": "true"
    }
  };

  receiver["intent-filter"] = [
    {
      $: { "android:priority": "999" },
      action: [{ $: { "android:name": "android.provider.Telephony.SMS_RECEIVED" } }]
    }
  ];

  if (!existing) application.receiver.push(receiver);
}

module.exports = function withNettoxicSmsIngest(config, options = {}) {
  const ingestUrl = options.ingestUrl || process.env.EXPO_PUBLIC_SMS_INGEST_URL || "http://127.0.0.1:8787/ingest/sms";
  const ingestKey = options.ingestKey || process.env.EXPO_PUBLIC_INGEST_API_KEY || "";

  config = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.INTERNET",
    "android.permission.RECEIVE_SMS",
    "android.permission.READ_SMS",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.VIBRATE"
  ]);

  config = withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    addPermission(manifest, "android.permission.RECEIVE_SMS");
    addPermission(manifest, "android.permission.READ_SMS");
    addPermission(manifest, "android.permission.POST_NOTIFICATIONS");
    addPermission(manifest, "android.permission.VIBRATE");

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(pluginConfig.modResults);
    application.$["android:usesCleartextTraffic"] = ingestUrl.startsWith("http://") ? "true" : application.$["android:usesCleartextTraffic"];
    upsertMetaData(application, "cl.nettoxic.SMS_INGEST_URL", ingestUrl);
    upsertMetaData(application, "cl.nettoxic.INGEST_API_KEY", ingestKey);
    upsertReceiver(application);
    return pluginConfig;
  });

  config = withDangerousMod(config, [
    "android",
    async (pluginConfig) => {
      const source = path.join(pluginConfig.modRequest.projectRoot, "native/android/NettoxicSmsReceiver.java");
      const target = path.join(
        pluginConfig.modRequest.platformProjectRoot,
        "app/src/main/java/cl/nettoxic/app/sms/NettoxicSmsReceiver.java"
      );
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      return pluginConfig;
    }
  ]);

  return config;
};
