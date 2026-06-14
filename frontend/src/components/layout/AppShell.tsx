import { message } from "antd";
import { HomeOutlined, MoonOutlined, PlayCircleOutlined, ReadOutlined, SunOutlined, TrophyOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  matches?: string[];
};

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: <HomeOutlined />, matches: ["/"] },
  {
    to: "/requirements",
    label: "Competation",
    icon: <TrophyOutlined />,
    matches: ["/requirements", "/competitions/:competitionId", "/requirements/:requirementId", "/submissions/:submissionId"],
  },
  {
    to: "/playground",
    label: "Playground",
    icon: <PlayCircleOutlined />,
    matches: ["/playground", "/playground/create-task", "/playground/my-tasks", "/playground/my-tasks/:taskId"],
  },
  { to: "/research", label: "Research", icon: <ReadOutlined />, matches: ["/research"] },
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
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

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
              <div className="nav-avatar" title={user.username}>
                {initials}
              </div>
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
    </div>
  );
}
