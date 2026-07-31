import { message } from "antd";
import { ApiOutlined, BellOutlined, MoonOutlined, PlayCircleOutlined, ReadOutlined, SunOutlined, TrophyOutlined, UserOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { QuickStartProvider } from "../../quickstart/QuickStartContext";
import QuickStartOverlay from "../../quickstart/QuickStartOverlay";
import { api } from "../../lib/api";
import { NOTIFICATIONS_UPDATED_EVENT } from "../../lib/notificationEvents";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  matches?: string[];
};

const navItems: NavItem[] = [
  // { to: "/", label: "Home", icon: <HomeOutlined />, matches: ["/"] },
  {
    to: "/playground",
    label: "Playground",
    icon: <PlayCircleOutlined />,
    matches: [
      "/playground",
      "/playground/arc-bench/:taskType",
      "/playground/arc-bench/:taskType/:requirementId",
      "/playground/arc-bench/:taskType/:requirementId/submissions/:submissionId",
      "/playground/task-bank/:taskType",
      "/playground/task-bank/:taskType/:requirementId",
      "/playground/task-bank/:taskType/:requirementId/submissions/:submissionId",
      "/playground/create-task",
      "/playground/my-tasks",
      "/playground/my-tasks/:taskId",
      "/playground/my-tasks/:taskId/edit",
      "/playground/my-tasks/:taskId/submissions/:submissionId",
    ],
  },
  {
    to: "/requirements",
    label: "Competition",
    icon: <TrophyOutlined />,
    matches: ["/requirements", "/competitions/:competitionId", "/requirements/:requirementId", "/submissions/:submissionId"],
  },
  { to: "/research", label: "Research", icon: <ReadOutlined />, matches: ["/research"] },
  { to: "/api-doc", label: "API Doc", icon: <ApiOutlined />, matches: ["/api-doc"] },
];

function isNavItemActive(pathname: string, item: NavItem) {
  return item.matches?.some((pattern) => matchPath({ path: pattern, end: true }, pathname)) ?? false;
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return;
    }
    void api.listNotifications().then((payload) => setUnreadNotifications(payload.unread_count)).catch(() => setUnreadNotifications(0));
  }, [user]);

  useEffect(() => {
    const updateUnreadCount = (event: Event) => {
      const unreadCount = (event as CustomEvent<number>).detail;
      setUnreadNotifications(typeof unreadCount === "number" ? unreadCount : 0);
    };
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, updateUnreadCount);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, updateUnreadCount);
  }, []);

  const initials = useMemo(() => {
    if (!user) {
      return "";
    }
    return user.username.slice(0, 2).toUpperCase();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      message.success("Signed out.");
      navigate("/");
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  return (
    <QuickStartProvider>
      <div className="app-shell">
        <nav className="nav">
          <button className="nav-brand" onClick={() => navigate("/")}>
            <span className="mark">A</span>
            <span>ArcBench</span>
          </button>
          <div className="nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-quickstart-id={item.to === "/api-doc" ? "quickstart-nav-api-doc" : undefined}
                className={() => `nav-link${isNavItemActive(location.pathname, item) ? " active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
          <div className="nav-right">
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunOutlined /> : <MoonOutlined />}
            </button>
            {isLoading ? null : user ? (
              <div className="nav-auth-group">
                <button className="theme-toggle notification-bell" type="button" title="Message center" aria-label={unreadNotifications > 0 ? "Message center: unread messages" : "Message center"} onClick={() => navigate("/notifications")}>
                  <BellOutlined />
                  {unreadNotifications > 0 ? <span className="notification-unread-dot" aria-hidden="true" /> : null}
                </button>
                <button className="nav-avatar" type="button" title={user.username} onClick={() => navigate("/profile")}>
                  {initials || <UserOutlined />}
                </button>
                <button className="nav-auth-link" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <div className="nav-auth-group">
                <NavLink to="/login" className="nav-auth-link">
                  Login
                </NavLink>
                <NavLink to="/register" className="nav-auth-link nav-auth-link-primary">
                  Register
                </NavLink>
              </div>
            )}
          </div>
        </nav>
        <main className="shell-content">
          <Outlet />
        </main>
        <QuickStartOverlay />
      </div>
    </QuickStartProvider>
  );
}
