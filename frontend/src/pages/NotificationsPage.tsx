import { DeleteOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { publishUnreadNotificationCount } from "../lib/notificationEvents";
import type { NotificationItem } from "../lib/types";

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const applyItems = useCallback((nextItems: NotificationItem[], unreadCount?: number) => {
    setItems(nextItems);
    publishUnreadNotificationCount(unreadCount ?? nextItems.filter((item) => !item.is_read).length);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api.listNotifications()
      .then((payload) => applyItems(payload.items, payload.unread_count))
      .finally(() => setLoading(false));
  }, [applyItems, user]);

  const openNotification = async (item: NotificationItem) => {
    if (!item.is_read) {
      const updated = await api.markNotificationRead(item.id);
      setItems((current) => {
        const nextItems = current.map((entry) => entry.id === updated.id ? updated : entry);
        publishUnreadNotificationCount(nextItems.filter((entry) => !entry.is_read).length);
        return nextItems;
      });
    }
    if (item.submission_id) {
      navigate(`/runs/${item.submission_id}`);
    }
  };

  const markAllRead = async () => {
    try {
      const payload = await api.markAllNotificationsRead();
      applyItems(payload.items, payload.unread_count);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const payload = await api.deleteNotification(notificationId);
      applyItems(payload.items, payload.unread_count);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const clearNotifications = async () => {
    try {
      const payload = await api.clearNotifications();
      applyItems(payload.items, payload.unread_count);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  if (!user) {
    return <div className="page centered"><div className="empty-state">Login is required to view notifications.</div></div>;
  }

  return (
    <div className="page bg-[var(--bg-deep)] px-6 py-7 text-[var(--text)] lg:px-8">
      <div className="mx-auto max-w-[860px] rounded-lg border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Message center</div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Run notifications</h1>
          {items.length > 0 ? <div className="notification-list-actions">
            <button type="button" className="notification-list-action" onClick={() => void markAllRead()} disabled={!items.some((item) => !item.is_read)}>Mark all read</button>
            <button type="button" className="notification-list-action danger" onClick={() => void clearNotifications()}>Clear all</button>
          </div> : null}
        </div>
        {loading ? <div className="mt-6 loading-state">Loading notifications...</div> : items.length === 0 ? (
          <div className="mt-6 empty-state">No run notifications yet.</div>
        ) : (
          <div className="mt-6 divide-y divide-[var(--border)]">
            {items.map((item) => (
              <div key={item.id} className="notification-list-item">
                <button type="button" className="notification-list-open" onClick={() => void openNotification(item)}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-[var(--text)]">{item.title}</span>
                    <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">{new Date(item.created_at).toLocaleString()}{!item.is_read ? <span className="notification-item-unread-dot" aria-label="Unread" /> : null}</span>
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{item.body}</div>
                </button>
                <button type="button" className="notification-delete-button" aria-label={`Delete ${item.title}`} title="Delete message" onClick={() => void deleteNotification(item.id)}>
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
