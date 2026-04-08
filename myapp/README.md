# Frontend README

`myapp/` 是 `Career Planning Agent` 的前端应用，基于 Ant Design Pro 和 Umi Max。

如果你是第一次接触这个仓库，建议先阅读根目录的 [README.md](C:/Users/yzh/Desktop/feature_map_text/README.md)。根 README 提供完整的新手启动流程，这里只补充前端相关说明。

## 开发启动

先确保后端已经运行在 `127.0.0.1:9100`：

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

再启动前端：

```bash
cd myapp
npm install
npm start
```

本地开发环境会把 `/api/*` 代理到 `http://127.0.0.1:9100`。

## 常用命令

```bash
npm start
npm run build
npm run lint
npm test -- --runInBand
```

如果需要仅使用 mock：

```bash
npm run start:mock
```

## 说明

- `package-lock.json` 会随仓库提交，确保前端依赖可复现。
- `node_modules/` 和 `dist/` 属于本地依赖与构建产物，不会提交到仓库。
- 前端主要配置位于 `config/`，页面代码位于 `src/pages/`。
