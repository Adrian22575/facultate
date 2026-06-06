export async function markAdminNotificationViewed(scope) {
  if (!scope) {
    return;
  }

  await fetch("/api/admin/notification-views", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ scope }),
    keepalive: true
  });
}
