import { BulbOutlined, CodeOutlined, PlayCircleOutlined, TrophyOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const navItems = [
  { to: "/", label: "Home", icon: <TrophyOutlined /> },
  { to: "/requirements", label: "Competition", icon: <CodeOutlined /> },
  { to: "/requirements/12306", label: "Task Detail", icon: <BulbOutlined /> },
  { to: "/playground", label: "Playground", icon: <PlayCircleOutlined /> },
];

export default function AppShell() {
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
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          <Button
            className="theme-toggle"
            type="text"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀" : "☾"}
          </Button>
          <div className="nav-avatar">U</div>
        </div>
      </nav>
      <main className="shell-content">
        <Outlet />
      </main>
    </div>
  );
}
