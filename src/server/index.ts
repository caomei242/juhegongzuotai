import "dotenv/config";

import express from "express";

const app = express();
const port = Number(process.env.STRAWBERRY_PORT ?? 8787);
const host = process.env.STRAWBERRY_ALLOW_LAN === "true" ? "0.0.0.0" : "127.0.0.1";

app.listen(port, host, () => {
  console.log(`草莓工作台服务已启动：http://${host}:${port}`);
});
