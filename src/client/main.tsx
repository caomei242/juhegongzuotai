import React from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <div>
      <h1>草莓工作台</h1>
      <p>Bootstrap shell is ready.</p>
    </div>
  </React.StrictMode>
);
