package cl.nettoxic.app.proactive;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class AwkiMessageRiskEngine {
  private static final String CHANNEL_ID = "awki_proactive_alerts";
  private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

  private AwkiMessageRiskEngine() {}

  public static void submit(Context context, Capture capture) {
    if (capture == null || capture.content == null || capture.content.trim().length() < 8) return;
    Context appContext = context.getApplicationContext();
    EXECUTOR.execute(() -> {
      try {
        JSONObject response = postForAnalysis(appContext, capture);
        JSONObject analysis = response.getJSONObject("analysis");
        notifyIfRisky(appContext, capture, analysis);
      } catch (Exception error) {
        error.printStackTrace();
      }
    });
  }

  private static JSONObject postForAnalysis(Context context, Capture capture) throws Exception {
    String ingestUrl = metaData(context, "cl.nettoxic.APP_MESSAGE_INGEST_URL", defaultAppMessageUrl(context));
    String ingestKey = metaData(context, "cl.nettoxic.INGEST_API_KEY", "");
    JSONObject payload = new JSONObject();
    payload.put("id", capture.id);
    payload.put("sourceApp", capture.sourceApp);
    payload.put("sourcePackage", capture.sourcePackage);
    payload.put("captureMethod", capture.captureMethod);
    payload.put("sender", capture.sender);
    payload.put("subject", capture.subject);
    payload.put("content", capture.content);
    payload.put("receivedAt", String.valueOf(capture.timestamp));

    byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
    HttpURLConnection connection = (HttpURLConnection) new URL(ingestUrl).openConnection();
    connection.setRequestMethod("POST");
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(30000);
    connection.setDoOutput(true);
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setRequestProperty("User-Agent", "Awki-Android-Proactive/0.1");
    if (!ingestKey.isEmpty()) connection.setRequestProperty("X-Nettoxic-Ingest-Key", ingestKey);

    try (OutputStream outputStream = connection.getOutputStream()) {
      outputStream.write(body);
    }

    int status = connection.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new IllegalStateException("App message ingest failed with HTTP " + status);
    }

    byte[] response = readAllBytes(connection.getInputStream());
    return new JSONObject(new String(response, StandardCharsets.UTF_8));
  }

  private static void notifyIfRisky(Context context, Capture capture, JSONObject analysis) throws Exception {
    int score = analysis.optInt("score", 0);
    if (score < 35) return;
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      AwkiRiskOverlay.show(context, capture, analysis);
      return;
    }

    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Awki proactive alerts", NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Alertas antifraude generadas al detectar mensajes sospechosos en apps.");
      manager.createNotificationChannel(channel);
    }

    Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    PendingIntent pendingIntent = PendingIntent.getActivity(
      context,
      Math.abs(capture.id.hashCode()),
      launchIntent,
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
    );

    String level = analysis.optString("nivel", "riesgo").toUpperCase(Locale.ROOT);
    String explanation = analysis.optString("explicacion", "Revisa este mensaje antes de abrir enlaces o entregar datos.");
    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_warning)
      .setContentTitle("Awki: " + level + " · " + score + "/100")
      .setContentText(explanation)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(explanation + "\nApp: " + capture.sourceApp + "\nDe: " + capture.sender))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent);

    manager.notify(("awki-proactive-" + capture.id).hashCode(), builder.build());
    AwkiRiskOverlay.show(context, capture, analysis);
  }

  public static String appLabel(Context context, String packageName) {
    try {
      PackageManager manager = context.getPackageManager();
      return String.valueOf(manager.getApplicationLabel(manager.getApplicationInfo(packageName, 0)));
    } catch (Exception ignored) {
      return packageName;
    }
  }

  public static boolean isSupportedPackage(String packageName) {
    if (packageName == null) return false;
    return packageName.equals("com.whatsapp")
      || packageName.equals("com.whatsapp.w4b")
      || packageName.equals("org.telegram.messenger")
      || packageName.equals("org.telegram.messenger.web")
      || packageName.equals("org.thunderdog.challegram")
      || packageName.equals("com.facebook.orca")
      || packageName.equals("com.google.android.apps.messaging");
  }

  private static String defaultAppMessageUrl(Context context) {
    String smsUrl = metaData(context, "cl.nettoxic.SMS_INGEST_URL", "http://127.0.0.1:8787/ingest/sms");
    return smsUrl.endsWith("/ingest/sms")
      ? smsUrl.substring(0, smsUrl.length() - "/ingest/sms".length()) + "/ingest/app-message"
      : smsUrl;
  }

  private static String metaData(Context context, String key, String fallback) {
    try {
      ApplicationInfo info = context.getPackageManager().getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA);
      Object value = info.metaData == null ? null : info.metaData.get(key);
      return value == null ? fallback : String.valueOf(value);
    } catch (Exception ignored) {
      return fallback;
    }
  }

  private static byte[] readAllBytes(InputStream inputStream) throws Exception {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] chunk = new byte[4096];
    int read;
    while ((read = inputStream.read(chunk)) != -1) {
      buffer.write(chunk, 0, read);
    }
    return buffer.toByteArray();
  }

  public static final class Capture {
    public final String id;
    public final String sourceApp;
    public final String sourcePackage;
    public final String captureMethod;
    public final String sender;
    public final String subject;
    public final String content;
    public final long timestamp;

    public Capture(String id, String sourceApp, String sourcePackage, String captureMethod, String sender, String subject, String content, long timestamp) {
      this.id = id;
      this.sourceApp = sourceApp;
      this.sourcePackage = sourcePackage;
      this.captureMethod = captureMethod;
      this.sender = sender;
      this.subject = subject;
      this.content = content;
      this.timestamp = timestamp;
    }
  }
}
