# 草莓工作台

草莓工作台是一个本地网页工作台，用来聚合常用网页系统、维护业务状态和今日动作，并自动检测链接入口是否可访问。

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev
```

默认地址：

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:8787

## 生产构建

```bash
npm run build
npm start
```

构建后，API 服务会同时提供前端页面和接口。

## 可迁移数据

运行数据默认保存在 `data/`：

- `data/workbench.json`
- `data/health-checks.json`
- `data/backups/`

迁移到另一台机器时，复制项目目录和 `data/` 目录，再按需调整 `.env`。如果要迁到 NAS、Docker 主机或云服务器，优先把 `STRAWBERRY_DATA_DIR` 指到一个可备份的持久化目录。

## 配置

```bash
STRAWBERRY_PORT=8787
STRAWBERRY_DATA_DIR=./data
STRAWBERRY_CHECK_INTERVAL_MINUTES=30
STRAWBERRY_CHECK_TIMEOUT_MS=8000
STRAWBERRY_ACCESS_TOKEN=
STRAWBERRY_ALLOW_LAN=false
```

- `STRAWBERRY_ACCESS_TOKEN` 非空时，API 请求需要带 `x-strawberry-token`。
- `STRAWBERRY_ALLOW_LAN=true` 时，服务监听局域网地址，适合内网设备访问。

## 第一版边界

第一版不做登录、多用户协作、云同步、浏览器插件、网页截图预览或自动生成今日动作。当前重点是 PC 版本地工作台、JSON 数据可迁移、导入导出、拖拽排序、手动状态维护和链接健康检查。
