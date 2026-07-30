import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { NotificationItem } from "../lib/types";

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api.listNotifications()
      .then((payload) => setItems(payload.items))
      .finally(() => setLoading(false));
  }, [user]);

  const openNotification = async (item: NotificationItem) => {
    if (!item.is_read) {
      const updated = await api.markNotificationRead(item.id);
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    }
    if (item.submission_id) {
      navigate(`/runs/${item.submission_id}`);
    }
  };

  if (!user) {
    return <div className="page centered"><div className="empty-state">Login is required to view notifications.</div></div>;
  }

  return (
    <div className="page bg-[var(--bg-deep)] px-6 py-7 text-[var(--text)] lg:px-8">
      <div className="mx-auto max-w-[860px] rounded-lg border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Message center</div>
        <h1 className="mt-2 text-2xl font-semibold">Run notifications</h1>
        {loading ? <div className="mt-6 loading-state">Loading notifications...</div> : items.length === 0 ? (
          <div className="mt-6 empty-state">No run notifications yet.</div>
        ) : (
          <div className="mt-6 divide-y divide-[var(--border)]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full px-1 py-4 text-left"
                onClick={() => void openNotification(item)}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[var(--text)]">{item.title}{item.is_read ? "" : " · New"}</span>
                  <span className="text-xs text-[var(--text-muted)]">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{item.body}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
