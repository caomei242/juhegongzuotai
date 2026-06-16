import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";

const root = document.getElementById("root");

if (!root) {
  throw new Error("没有找到 #root 根节点。");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
