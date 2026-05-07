package cl.nettoxic.app.proactive;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

public final class AwkiRiskOverlay {
  private static View activeView;

  private AwkiRiskOverlay() {}

  public static void show(Context context, AwkiMessageRiskEngine.Capture capture, JSONObject analysis) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || !Settings.canDrawOverlays(context)) return;
    Handler handler = new Handler(Looper.getMainLooper());
    handler.post(() -> {
      try {
        WindowManager manager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (activeView != null) {
          try {
            manager.removeView(activeView);
          } catch (Exception ignored) {}
          activeView = null;
        }

        LinearLayout container = new LinearLayout(context);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setPadding(26, 18, 26, 18);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(255, 245, 242));
        background.setStroke(3, Color.rgb(185, 48, 42));
        background.setCornerRadius(28);
        container.setBackground(background);

        TextView title = new TextView(context);
        title.setText("Awki: posible estafa · " + analysis.optInt("score", 0) + "/100");
        title.setTextColor(Color.rgb(120, 22, 18));
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        container.addView(title);

        TextView body = new TextView(context);
        body.setText(analysis.optString("explicacion", "No respondas ni entregues claves.") + "\n" + capture.sourceApp + ": " + capture.sender);
        body.setTextColor(Color.rgb(50, 35, 32));
        body.setTextSize(14);
        body.setPadding(0, 8, 0, 0);
        container.addView(body);

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
          ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
          : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.WRAP_CONTENT,
          type,
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
          PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.x = 0;
        params.y = 70;
        params.horizontalMargin = 0.05f;

        activeView = container;
        manager.addView(container, params);
        handler.postDelayed(() -> {
          try {
            if (activeView != null) manager.removeView(activeView);
          } catch (Exception ignored) {
          } finally {
            activeView = null;
          }
        }, 18000);
      } catch (Exception error) {
        error.printStackTrace();
      }
    });
  }
}
