# Phase Screenshot Verification Skill

AI 指令文档 — 指导 Claude Code 正确执行 Phase 截图验收流程。

---

## 触发条件

当用户要求以下操作时，执行本 skill：

- 对某个 Phase 的前端改动进行视觉验收
- 截图保存到 `docs/images/test/PhaseN/`
- 验证组件渲染是否符合预期

---

## 前置检查（必须全部通过）

### 1. 前端服务

```
URL: http://localhost:8000
启动: cd myapp && npm start
```

如果未启动，用 `run_in_background` 启动，等待 `Ready in` 日志出现。

### 2. 后端服务

```
URL: http://localhost:9100
启动: cd backend && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

### 3. Playwright 浏览器

```bash
cd myapp && npx playwright install chromium
```

如果已安装会跳过。首次安装约 150MB。

---

## 截图方式选择

### 方式 A：CLI 脚本（批量截图，推荐）

**适用场景**：一次性截取整个 Phase 的全页 + 分段截图。

```bash
cd myapp
npm run screenshot -- phase2
```

**输出目录**：`docs/images/test/Phase2/`

**可选参数**：
- `--full-only` — 仅全页截图
- `--sections` — 仅分段截图

**关键约束**：必须从 `myapp/` 目录运行。脚本位于 `docs/images/test/screenshot.js`，通过相对路径 `../../../myapp/node_modules` 解析 playwright 模块。从其他目录运行会导致 `Cannot find module 'playwright'`。

### 方式 B：Playwright MCP Server（交互式验收）

**适用场景**：需要逐个检查元素、交互操作、实时调试。

**MCP 工具前缀**：`mcp__plugin_everything-claude-code_playwright__*` 或 `mcp__plugin_playwright_playwright__*`

**操作流程**：

1. **导航到目标页面**：
   ```
   browser_navigate → http://localhost:8000/phase2-demo
   ```

2. **检查渲染**：
   ```
   browser_snapshot → 查看页面结构
   browser_take_screenshot → 截取当前视口
   ```

3. **截取全页**：
   ```
   browser_take_screenshot(type: "png", fullPage: true, filename: "phase2-full-page.png")
   ```

---

## 必须执行：登录步骤

**所有页面（包括 `layout: false` 的路由）都需要登录。** Umi.js 的 `layout: false` 仅移除布局外壳，不免除认证。

CLI 脚本已内置自动登录。使用 MCP 时，必须手动登录：

```
1. browser_navigate → http://localhost:8000/user/login
2. browser_snapshot → 确认到达登录页
3. browser_fill_form → 填入用户名 "444"、密码 "12345678"
4. browser_click → 提交登录按钮
5. browser_wait_for(text: "首页" 或其他登录后标志) 或 browser_navigate → 目标页面
```

**验证登录成功**：`browser_snapshot` 后检查 URL 不再包含 `/user/login`。

---

## Playwright MCP Server 故障排除

### 连接失败：`Failed to reconnect to plugin:playwright:playwright`

**根因**：`npx @playwright/mcp@latest` 每次启动会检查 npm registry 更新，网络问题导致超时。

**修复**：锁定版本号。修改两个文件：

```
~/.claude/plugins/cache/claude-plugins-official/playwright/unknown/.mcp.json
~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json
```

内容统一为：
```json
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@0.0.69"]
  }
}
```

修改后运行 `/reload-plugins` 生效。

**验证当前版本**（如果不确定）：
```bash
cat ~/.npm/_npx/*/node_modules/@playwright/mcp/package.json | grep version
```

---

## Phase 配置

在 `docs/images/test/screenshot.js` 的 `PHASES` 对象中定义：

```javascript
const PHASES = {
  phase2: {
    route: '/phase2-demo',           // Umi 路由路径
    sections: [                       // h2 标题中包含的关键字
      'ClaudeButton', 'ClaudeCard', 'ClaudeTag', 'ClaudeInput',
      'ClaudeSelect', 'ClaudeStatCard', 'ProgressRing', 'CountUpNumber',
      'FadeInWhenVisible',
    ],
  },
};
```

**添加新 Phase**：在 `PHASES` 中添加 `phaseN` 条目，`route` 为目标页面路径，`sections` 为 h2 标题关键字列表。然后运行 `npm run screenshot -- phaseN`。

---

## 分段截图的 Selector 策略

CLI 脚本使用 `h2` 标题定位分段截图。工作原理：

1. 查找页面所有 `<h2>` 元素
2. 比对 h2 文本内容是否包含 `sections` 配置中的关键字
3. 匹配成功后，截取该 h2 的父元素

**为什么不用更精确的选择器**：
- 页面组件使用 `createStyles` 生成动态 class 名（如 `css-1a2b3c`），不可靠
- `text=` 选择器对括号等特殊字符敏感（如 `ClaudeButton (4 variants)` 会匹配失败）
- h2 标题是稳定的语义标记，不随样式变化

**如果页面没有 h2 标题**：分段截图将为空（0 个 section）。检查目标页面是否使用了 h2 作为 section 标题。

---

## MCP 截图文件保存

通过 Playwright MCP 的 `browser_take_screenshot` 截图时，`filename` 参数是相对路径。实际保存位置取决于 MCP Server 的工作目录，通常是项目根目录（`/Users/torch/torch/opt/career-planning-agent/`），**不是** `docs/images/test/PhaseN/`。

### 强制流程（必须遵守）

**截图后必须立即用 Bash 移动到目标目录，不要跳过此步骤，不要删除未移动的文件。**

```
1. browser_take_screenshot → 文件保存在 repo 根目录
2. find <repo-root> -name "phaseN-*.png" → 确认文件位置
3. mv <repo-root>/phaseN-*.png docs/images/test/PhaseN/ → 移动
4. ls docs/images/test/PhaseN/ → 确认所有文件都在
```

```bash
# 1. 截图后立即查找文件位置
find /Users/torch/torch/opt/career-planning-agent -maxdepth 1 -name "phase4-*.png"

# 2. 移动到目标目录（PhaseN 大写首字母）
mv /Users/torch/torch/opt/career-planning-agent/phase4-*.png \
   /Users/torch/torch/opt/career-planning-agent/docs/images/test/Phase4/

# 3. 确认文件已到位
ls -la /Users/torch/torch/opt/career-planning-agent/docs/images/test/Phase4/
```

### 常见错误

- ❌ 截图后忘记移动，文件留在 repo 根目录
- ❌ 误删 repo 根目录的截图文件（无法恢复）
- ❌ 只看 CLI 脚本输出，遗漏 MCP 补充截图

### 替代方案

直接使用 CLI 脚本（`npm run screenshot -- phaseN`），输出路径一步到位，无需手动移动。

---

## 输出规范

```
docs/images/test/
├── README.md            # 本文件
├── screenshot.js        # CLI 截图工具
├── Phase1/
│   └── phase1-*.png
├── Phase2/
│   ├── phase2-full-page.png
│   ├── phase2-claudebutton.png
│   ├── phase2-claudecard.png
│   └── ...
└── PhaseN/
    └── phaseN-*.png
```

截图文件命名：`{phase}-{section-key}.png`（section key 全小写）。

---

## 完整执行流程

```
1. 检查前端/后端服务是否运行
2. 确认 Phase 配置存在于 screenshot.js 的 PHASES 对象中
3. cd myapp && npm run screenshot -- phaseN
4. 检查输出：全页截图 + 分段截图数量是否与 sections 配置一致
5. 如有缺失 section：检查目标页面 h2 标题是否包含对应关键字
6. 向用户报告截图结果和文件路径
```
