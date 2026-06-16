import React from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  throw new Error("没有找到 #root 根节点。");
}

createRoot(root).render(
  <React.StrictMode>
    <div>草莓工作台初始化完成</div>
  </React.StrictMode>
);
