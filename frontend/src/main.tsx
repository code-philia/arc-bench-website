import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme } from "antd";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./styles/global.css";

function resolveThemeMode() {
  if (document.documentElement.dataset.theme === "dark" || window.localStorage.getItem("theme") === "dark") {
    return "dark" as const;
  }
  return "light" as const;
}

function Root() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => resolveThemeMode());

  useEffect(() => {
    const syncThemeMode = () => {
      setThemeMode(resolveThemeMode());
    };

    syncThemeMode();
    const observer = new MutationObserver(syncThemeMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("storage", syncThemeMode);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncThemeMode);
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: themeMode === "light" ? theme.defaultAlgorithm : theme.darkAlgorithm,
        token: {
          colorPrimary: "#24272d",
          fontFamily: "'Outfit', sans-serif",
          borderRadius: 12,
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
