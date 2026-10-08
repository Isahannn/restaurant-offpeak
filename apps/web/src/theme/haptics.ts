import {
  hapticFeedbackImpactOccurred,
  hapticFeedbackNotificationOccurred,
  hapticFeedbackSelectionChanged,
} from "@telegram-apps/sdk-react";

// Haptics are a nicety: silently do nothing outside Telegram or on old clients.
function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // noop
  }
}

export const haptic = {
  select: () => safe(() => hapticFeedbackSelectionChanged()),
  tap: () => safe(() => hapticFeedbackImpactOccurred("light")),
  success: () => safe(() => hapticFeedbackNotificationOccurred("success")),
  error: () => safe(() => hapticFeedbackNotificationOccurred("error")),
};
