import "dotenv/config";

import express from "express";
import fs from "node:fs";
import path from "node:path";

const app = express();
const port = Number(process.env.STRAWBERRY_PORT ?? 8787);
const host = process.env.STRAWBERRY_ALLOW_LAN === "true" ? "0.0.0.0" : "127.0.0.1";
const staticDir = path.resolve(process.cwd(), "dist");

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
}

app.listen(port, host, () => {
  console.log(`草莓工作台 server listening at http://${host}:${port}`);
});
