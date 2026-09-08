import { NotificationManager } from "react-notifications";

const duration = 4000;

export function showSuccess(message: string, title = "Success") {
  NotificationManager.success(message, title, duration);
}

export function showError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message || fallback)
      : fallback;
  NotificationManager.error(message, "Action failed", duration);
}

export function showInfo(message: string, title = "Notice") {
  NotificationManager.info(message, title, duration);
}