import express from "express";
import { readConfig } from "./config.js";

const app = express();
const appConfig = readConfig();
const host = appConfig.allowLan ? "0.0.0.0" : "127.0.0.1";

app.listen(appConfig.port, host, () => {
  console.log(`草莓工作台服务已启动：http://${host}:${appConfig.port}`);
});
