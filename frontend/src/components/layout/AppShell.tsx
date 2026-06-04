import { useEffect, useState } from "react";
import { BulbOutlined, CodeOutlined, PlayCircleOutlined, TrophyOutlined } from "@ant-design/icons";
import { NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  matches?: string[];
};

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: <TrophyOutlined />, matches: ["/"] },
  { to: "/requirements", label: "Competition", icon: <CodeOutlined />, matches: ["/requirements"] },
  {
    to: "/requirements/12306",
    label: "Task Detail",
    icon: <BulbOutlined />,
    matches: ["/requirements/:requirementId"],
  },
  { to: "/playground", label: "Playground", icon: <PlayCircleOutlined />, matches: ["/playground"] },
];

function isNavItemActive(pathname: string, item: NavItem) {
  return item.matches?.some((pattern) => matchPath({ path: pattern, end: true }, pathname)) ?? false;
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

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
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <div className="nav-avatar">U</div>
        </div>
      </nav>
      <main className="shell-content">
        <Outlet />
      </main>
    </div>
  );
}
