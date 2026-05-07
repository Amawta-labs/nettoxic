package cl.nettoxic.app.proactive;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.HashMap;
import java.util.Map;

public class NettoxicNotificationListenerService extends NotificationListenerService {
  private static final long DEDUPE_WINDOW_MS = 20000;
  private static final Map<Integer, Long> RECENT = new HashMap<>();

  @Override
  public void onNotificationPosted(StatusBarNotification sbn) {
    if (sbn == null || !AwkiMessageRiskEngine.isSupportedPackage(sbn.getPackageName())) return;
    Notification notification = sbn.getNotification();
    if (notification == null) return;

    Bundle extras = notification.extras;
    String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
    String text = text(extras.getCharSequence(Notification.EXTRA_TEXT));
    String bigText = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
    String subText = text(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
    String lines = lines(extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES));
    String content = join(text, bigText, subText, lines);
    if (content.length() < 8) return;

    String sourceApp = AwkiMessageRiskEngine.appLabel(this, sbn.getPackageName());
    long timestamp = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
    String sender = title.isEmpty() ? sourceApp : title;
    String fingerprint = sbn.getPackageName() + "|" + sender + "|" + content;
    if (shouldSkip(fingerprint.hashCode())) return;

    AwkiMessageRiskEngine.submit(
      this,
      new AwkiMessageRiskEngine.Capture(
        "notification-" + timestamp + "-" + Math.abs(fingerprint.hashCode()),
        sourceApp,
        sbn.getPackageName(),
        "notification",
        sender,
        sourceApp + " notification",
        content,
        timestamp
      )
    );
  }

  private static boolean shouldSkip(int hash) {
    long now = System.currentTimeMillis();
    Long previous = RECENT.get(hash);
    RECENT.put(hash, now);
    RECENT.entrySet().removeIf((entry) -> now - entry.getValue() > DEDUPE_WINDOW_MS);
    return previous != null && now - previous < DEDUPE_WINDOW_MS;
  }

  private static String text(CharSequence value) {
    return value == null ? "" : value.toString().replaceAll("\\s+", " ").trim();
  }

  private static String lines(CharSequence[] values) {
    if (values == null || values.length == 0) return "";
    StringBuilder builder = new StringBuilder();
    for (CharSequence value : values) {
      String text = text(value);
      if (!text.isEmpty()) {
        if (builder.length() > 0) builder.append("\n");
        builder.append(text);
      }
    }
    return builder.toString();
  }

  private static String join(String... values) {
    StringBuilder builder = new StringBuilder();
    for (String value : values) {
      if (value == null || value.trim().isEmpty()) continue;
      String clean = value.trim();
      if (builder.indexOf(clean) >= 0) continue;
      if (builder.length() > 0) builder.append("\n");
      builder.append(clean);
    }
    return builder.toString();
  }
}
