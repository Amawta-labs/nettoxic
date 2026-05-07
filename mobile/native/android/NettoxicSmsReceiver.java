package cl.nettoxic.app.sms;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NettoxicSmsReceiver extends BroadcastReceiver {
  private static final String CHANNEL_ID = "nettoxic_sms_alerts";
  private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

  @Override
  public void onReceive(Context context, Intent intent) {
    if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
      return;
    }

    PendingResult pendingResult = goAsync();
    EXECUTOR.execute(() -> {
      try {
        SmsPayload sms = parseSms(intent.getExtras());
        if (sms == null || sms.body.trim().isEmpty()) return;
        JSONObject analysis = postSmsForAnalysis(context, sms);
        maybeNotify(context, sms, analysis);
      } catch (Exception error) {
        error.printStackTrace();
      } finally {
        pendingResult.finish();
      }
    });
  }

  private static SmsPayload parseSms(Bundle extras) {
    if (extras == null) return null;
    Object[] pdus = (Object[]) extras.get("pdus");
    if (pdus == null || pdus.length == 0) return null;

    String format = extras.getString("format");
    StringBuilder body = new StringBuilder();
    String sender = null;
    long timestamp = System.currentTimeMillis();

    for (Object pdu : pdus) {
      SmsMessage message;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        message = SmsMessage.createFromPdu((byte[]) pdu, format);
      } else {
        message = SmsMessage.createFromPdu((byte[]) pdu);
      }

      if (message == null) continue;
      if (sender == null) sender = message.getOriginatingAddress();
      timestamp = message.getTimestampMillis();
      body.append(message.getMessageBody());
    }

    return new SmsPayload(sender == null ? "desconocido" : sender, body.toString(), timestamp);
  }

  private static JSONObject postSmsForAnalysis(Context context, SmsPayload sms) throws Exception {
    String ingestUrl = metaData(context, "cl.nettoxic.SMS_INGEST_URL", "http://127.0.0.1:8787/ingest/sms");
    String ingestKey = metaData(context, "cl.nettoxic.INGEST_API_KEY", "");
    JSONObject payload = new JSONObject();
    payload.put("id", "sms-" + sms.timestamp + "-" + Math.abs(sms.body.hashCode()));
    payload.put("sender", sms.sender);
    payload.put("content", sms.body);
    payload.put("receivedAt", String.valueOf(sms.timestamp));

    byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
    HttpURLConnection connection = (HttpURLConnection) new URL(ingestUrl).openConnection();
    connection.setRequestMethod("POST");
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(8000);
    connection.setDoOutput(true);
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setRequestProperty("User-Agent", "Nettoxic-Android-SmsReceiver/0.1");
    if (!ingestKey.isEmpty()) {
      connection.setRequestProperty("X-Nettoxic-Ingest-Key", ingestKey);
    }

    try (OutputStream outputStream = connection.getOutputStream()) {
      outputStream.write(body);
    }

    int status = connection.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new IllegalStateException("SMS ingest failed with HTTP " + status);
    }

    byte[] response = readAllBytes(connection.getInputStream());
    return new JSONObject(new String(response, StandardCharsets.UTF_8)).getJSONObject("analysis");
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

  private static void maybeNotify(Context context, SmsPayload sms, JSONObject analysis) throws Exception {
    int score = analysis.optInt("score", 0);
    if (score < 35) return;
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return;
    }

    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Awki SMS alerts", NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Alertas antifraude generadas al recibir SMS sospechosos.");
      manager.createNotificationChannel(channel);
    }

    Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    PendingIntent pendingIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
    );

    String level = analysis.optString("nivel", "riesgo");
    String explanation = analysis.optString("explicacion", "Revisa este SMS antes de abrir enlaces o entregar datos.");
    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_warning)
      .setContentTitle("Awki: " + level.toUpperCase() + " · " + score + "/100")
      .setContentText(explanation)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(explanation + "\nDe: " + sms.sender))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent);

    manager.notify(("nettoxic-" + sms.timestamp).hashCode(), builder.build());
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

  private static class SmsPayload {
    final String sender;
    final String body;
    final long timestamp;

    SmsPayload(String sender, String body, long timestamp) {
      this.sender = sender;
      this.body = body;
      this.timestamp = timestamp;
    }
  }
}
