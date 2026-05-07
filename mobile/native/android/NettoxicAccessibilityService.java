package cl.nettoxic.app.proactive;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class NettoxicAccessibilityService extends AccessibilityService {
  private static final long MIN_SEND_INTERVAL_MS = 5000;
  private long lastSentAt = 0;
  private int lastHash = 0;

  @Override
  public void onAccessibilityEvent(AccessibilityEvent event) {
    if (event == null || event.getPackageName() == null) return;
    String packageName = event.getPackageName().toString();
    if (!AwkiMessageRiskEngine.isSupportedPackage(packageName)) return;

    int type = event.getEventType();
    if (type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
      && type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
      && type != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
      return;
    }

    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root == null) return;
    StringBuilder builder = new StringBuilder();
    collectText(root, builder, 0);
    root.recycle();

    String content = builder.toString().replaceAll("\\s+", " ").trim();
    if (content.length() < 20) return;
    if (content.length() > 3000) content = content.substring(0, 3000);

    long now = System.currentTimeMillis();
    int hash = (packageName + "|" + content).hashCode();
    if (hash == lastHash && now - lastSentAt < MIN_SEND_INTERVAL_MS) return;
    if (now - lastSentAt < MIN_SEND_INTERVAL_MS) return;
    lastHash = hash;
    lastSentAt = now;

    String sourceApp = AwkiMessageRiskEngine.appLabel(this, packageName);
    AwkiMessageRiskEngine.submit(
      this,
      new AwkiMessageRiskEngine.Capture(
        "accessibility-" + now + "-" + Math.abs(hash),
        sourceApp,
        packageName,
        "accessibility",
        sourceApp,
        sourceApp + " visible chat",
        content,
        now
      )
    );
  }

  @Override
  public void onInterrupt() {}

  private static void collectText(AccessibilityNodeInfo node, StringBuilder builder, int depth) {
    if (node == null || depth > 8 || builder.length() > 3500) return;
    if (!node.isPassword()) {
      append(builder, node.getText());
      append(builder, node.getContentDescription());
    }

    int childCount = node.getChildCount();
    for (int index = 0; index < childCount; index += 1) {
      AccessibilityNodeInfo child = node.getChild(index);
      try {
        collectText(child, builder, depth + 1);
      } finally {
        if (child != null) child.recycle();
      }
    }
  }

  private static void append(StringBuilder builder, CharSequence value) {
    if (value == null) return;
    String text = value.toString().replaceAll("\\s+", " ").trim();
    if (text.length() < 2) return;
    if (builder.indexOf(text) >= 0) return;
    if (builder.length() > 0) builder.append("\n");
    builder.append(text);
  }
}
