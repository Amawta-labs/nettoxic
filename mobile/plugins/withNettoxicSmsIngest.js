const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RECEIVER_CLASS = "cl.nettoxic.app.sms.NettoxicSmsReceiver";
const PROACTIVE_PACKAGE = "cl.nettoxic.app.proactive";
const NOTIFICATION_LISTENER_CLASS = `${PROACTIVE_PACKAGE}.NettoxicNotificationListenerService`;
const ACCESSIBILITY_SERVICE_CLASS = `${PROACTIVE_PACKAGE}.NettoxicAccessibilityService`;
const TARGET_PACKAGES = [
  "com.whatsapp",
  "com.whatsapp.w4b",
  "org.telegram.messenger",
  "org.telegram.messenger.web",
  "org.thunderdog.challegram",
  "com.facebook.orca",
  "com.google.android.apps.messaging"
];
const ACCESSIBILITY_DESCRIPTION =
  "Awki analiza mensajes visibles para alertar sobre posibles estafas antes de que respondas.";

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

function upsertQueryPackage(manifest, packageName) {
  manifest.queries = manifest.queries || [];
  const queries = manifest.queries[0] || {};
  queries.package = queries.package || [];
  const exists = queries.package.some((entry) => entry.$["android:name"] === packageName);
  if (!exists) queries.package.push({ $: { "android:name": packageName } });
  manifest.queries[0] = queries;
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

function upsertService(application, className, permission, actionName, metaData) {
  application.service = application.service || [];
  const existing = application.service.find((entry) => entry.$["android:name"] === className);
  const service = existing ?? {
    $: {
      "android:name": className,
      "android:enabled": "true",
      "android:exported": "true"
    }
  };
  service.$["android:permission"] = permission;
  service["intent-filter"] = [{ action: [{ $: { "android:name": actionName } }] }];
  if (metaData) service["meta-data"] = [{ $: metaData }];
  if (!existing) application.service.push(service);
}

module.exports = function withNettoxicSmsIngest(config, options = {}) {
  const ingestUrl = options.ingestUrl || process.env.EXPO_PUBLIC_SMS_INGEST_URL || "http://127.0.0.1:8787/ingest/sms";
  const appMessageIngestUrl = ingestUrl.endsWith("/ingest/sms")
    ? `${ingestUrl.slice(0, -"/ingest/sms".length)}/ingest/app-message`
    : process.env.EXPO_PUBLIC_APP_MESSAGE_INGEST_URL || ingestUrl;
  const ingestKey = options.ingestKey || process.env.EXPO_PUBLIC_INGEST_API_KEY || "";

  config = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.INTERNET",
    "android.permission.RECEIVE_SMS",
    "android.permission.READ_SMS",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.VIBRATE",
    "android.permission.SYSTEM_ALERT_WINDOW"
  ]);

  config = withStringsXml(config, (pluginConfig) => {
    AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: "awki_accessibility_service_description" },
          _: ACCESSIBILITY_DESCRIPTION
        }
      ],
      pluginConfig.modResults
    );
    return pluginConfig;
  });

  config = withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    addPermission(manifest, "android.permission.RECEIVE_SMS");
    addPermission(manifest, "android.permission.READ_SMS");
    addPermission(manifest, "android.permission.POST_NOTIFICATIONS");
    addPermission(manifest, "android.permission.VIBRATE");
    addPermission(manifest, "android.permission.SYSTEM_ALERT_WINDOW");
    TARGET_PACKAGES.forEach((packageName) => upsertQueryPackage(manifest, packageName));

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(pluginConfig.modResults);
    application.$["android:usesCleartextTraffic"] = ingestUrl.startsWith("http://") ? "true" : application.$["android:usesCleartextTraffic"];
    upsertMetaData(application, "cl.nettoxic.SMS_INGEST_URL", ingestUrl);
    upsertMetaData(application, "cl.nettoxic.APP_MESSAGE_INGEST_URL", appMessageIngestUrl);
    upsertMetaData(application, "cl.nettoxic.INGEST_API_KEY", ingestKey);
    upsertReceiver(application);
    upsertService(
      application,
      NOTIFICATION_LISTENER_CLASS,
      "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
      "android.service.notification.NotificationListenerService"
    );
    upsertService(
      application,
      ACCESSIBILITY_SERVICE_CLASS,
      "android.permission.BIND_ACCESSIBILITY_SERVICE",
      "android.accessibilityservice.AccessibilityService",
      {
        "android:name": "android.accessibilityservice",
        "android:resource": "@xml/awki_accessibility_service"
      }
    );
    return pluginConfig;
  });

  config = withDangerousMod(config, [
    "android",
    async (pluginConfig) => {
      const copies = [
        ["NettoxicSmsReceiver.java", "app/src/main/java/cl/nettoxic/app/sms/NettoxicSmsReceiver.java"],
        ["AwkiMessageRiskEngine.java", "app/src/main/java/cl/nettoxic/app/proactive/AwkiMessageRiskEngine.java"],
        ["AwkiRiskOverlay.java", "app/src/main/java/cl/nettoxic/app/proactive/AwkiRiskOverlay.java"],
        ["NettoxicNotificationListenerService.java", "app/src/main/java/cl/nettoxic/app/proactive/NettoxicNotificationListenerService.java"],
        ["NettoxicAccessibilityService.java", "app/src/main/java/cl/nettoxic/app/proactive/NettoxicAccessibilityService.java"],
        ["awki_accessibility_service.xml", "app/src/main/res/xml/awki_accessibility_service.xml"]
      ];
      for (const [sourceName, targetName] of copies) {
        const source = path.join(pluginConfig.modRequest.projectRoot, "native/android", sourceName);
        const target = path.join(pluginConfig.modRequest.platformProjectRoot, targetName);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      }
      return pluginConfig;
    }
  ]);

  return config;
};
