import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme } from "antd";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./styles/global.css";

const isLightTheme = document.documentElement.dataset.theme === "light";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: isLightTheme ? theme.defaultAlgorithm : theme.darkAlgorithm,
        token: {
          colorPrimary: "#00d4aa",
          fontFamily: "'Outfit', sans-serif",
          borderRadius: 12,
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
