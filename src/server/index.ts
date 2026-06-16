import express from "express";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { apiJsonErrorHandler, createWorkbenchRouter } from "./api/workbenchRoutes.js";
import { readConfig } from "./config.js";
import { JsonStore } from "./storage/jsonStore.js";

const app = express();
const appConfig = readConfig();
const store = new JsonStore(appConfig.dataDir);
const host = appConfig.allowLan ? "0.0.0.0" : "127.0.0.1";
const clientDistDir = resolve("dist/client");
const clientIndexPath = join(clientDistDir, "index.html");

app.use(express.json({ limit: "1mb" }));
app.use(apiJsonErrorHandler);

if (appConfig.accessToken.length > 0) {
  app.use("/api", (req, res, next) => {
    if (req.header("x-strawberry-token") !== appConfig.accessToken) {
      res.status(401).json({ error: "未授权：访问令牌无效。" });
      return;
    }

    next();
  });
}

app.use("/api", createWorkbenchRouter(store));

if (existsSync(clientIndexPath)) {
  app.use(express.static(clientDistDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.includes(".")) {
      next();
      return;
    }

    res.sendFile(clientIndexPath);
  });
}

app.listen(appConfig.port, host, () => {
  console.log(`草莓工作台服务已启动：http://${host}:${appConfig.port}`);
});
