export const NOTIFICATIONS_UPDATED_EVENT = "arcbench:notifications-updated";

export function publishUnreadNotificationCount(unreadCount: number): void {
  window.dispatchEvent(new CustomEvent<number>(NOTIFICATIONS_UPDATED_EVENT, { detail: unreadCount }));
}
