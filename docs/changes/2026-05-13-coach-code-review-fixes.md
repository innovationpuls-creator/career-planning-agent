# Coach 界面代码审查修复

> 日期：2026-05-13  
> 依据：Coach 界面整体逻辑代码审查  
> 修复范围：5 项，全部完成

---

## 🔴 HIGH-1 — Reducer 副作用移除

**文件**：`myapp/src/pages/coach/eventReducer.ts`、`myapp/src/pages/coach/hooks/useCoachChat.ts`

**问题**：`RUN_DONE` reducer case 中直接操作 `window.history.replaceState`，违反 reducer 纯函数原则，导致 reducer 不可独立测试。

**修复**：
- `eventReducer.ts`：移除 `RUN_DONE` 中的 `window.history` 操作，仅保留 `currentSessionId` 状态更新
- `useCoachChat.ts`：在 `sendMessage` 的 streaming 循环中捕获 `run_done` 事件的 `sessionId`，循环完成后在 hook 层执行 URL 同步

---

## 🔴 HIGH-2 — 模块级可变状态消除

**文件**：`myapp/src/pages/coach/hooks/useCoachChat.ts`

**问题**：`messageCounter` 是模块级可变变量，HMR 和 React StrictMode 下会引发 ID 冲突，导致消息重复或覆盖。

**修复**：
- 移除模块级 `let messageCounter = 0`
- 在 `useCoachChat` 内部使用 `useRef(0)` 管理计数器
- `nextId()` 改为 hook 内部函数，闭包引用 `counterRef`

---

## 🟡 MEDIUM-3 — 非确定性 ID 修复

**文件**：
- `myapp/src/pages/coach/types.ts`
- `myapp/src/pages/coach/eventReducer.ts`
- `myapp/src/pages/coach/hooks/useCoachChat.ts`
- `myapp/src/pages/coach/hooks/useSessionRecovery.ts`

**问题**：
- `SYSTEM_MESSAGE` reducer case 使用 `Date.now()` 生成 ID，导致 reducer 输出非确定性
- `useSessionRecovery` 历史消息 ID 使用 `Date.now()`，每次调用 `loadSession` 都生成不同 ID

**修复**：
- `SYSTEM_MESSAGE` action 类型新增 `id: string` 字段
- Reducer 改为使用 `action.id` 而非 `Date.now()`
- 两处 dispatch 点改为在调用侧生成 ID（`sys-${nextId()}`）
- `useSessionRecovery` 改为 `msg-${sid}-${i}`，使用会话 ID + 索引生成稳定 ID

---

## 🟡 MEDIUM-4 — 流解析错误恢复

**文件**：`myapp/src/pages/coach/api.ts`

**问题**：NDJSON 解析中 `JSON.parse(line)` 无 try-catch，服务端发出格式错误行时直接终止 async generator，用户丢失本轮流中已缓冲的内容。

**修复**：
- 循环内 `JSON.parse` 包装 try-catch，解析失败时 yield `{ event: 'run_error', code: 'PARSE_ERROR', ... }`
- 尾部残留行 `JSON.parse` 同样包装 try-catch
- 解析失败不终止流，仅标记该行为错误事件

---

## 🟡 MEDIUM-5 — GlobalErrorBar 自动隐藏定时器稳定性

**文件**：`myapp/src/pages/coach/components/GlobalErrorBar.tsx`

**问题**：`useEffect` 依赖了 `onClose` 回调，父组件重渲染导致 `onClose` 引用变化，定时器被重置，错误提示可能永远不会自动消失。

**修复**：
- 新增 `onCloseRef` 存储最新 `onClose` 引用（`onCloseRef.current = onClose`）
- `useEffect` 改为通过 ref 调用关闭回调，从依赖数组中移除 `onClose`
- 定时器不再因父组件重渲染而重置

---

## 🟢 LOW-附加 — 命令面板键盘导航自动滚动

**文件**：`myapp/src/pages/coach/components/CoachChatInput.tsx`

**问题**：键盘 ArrowDown/ArrowUp 导航命令面板时，选中项可能超出可视区域，用户看不到当前高亮项。

**修复**：
- 新增 `paletteRef` 引用命令面板 DOM
- 新增 `useEffect`：`activeIndex` 变化时，查询 `[aria-selected="true"]` 元素并调用 `scrollIntoView({ block: 'nearest' })`
- 添加 `scrollIntoView` 特性检测，兼容 jsdom 测试环境

---

## 验证结果

```
npm run jest -- src/pages/coach/__tests__
→ 10 suites passed, 48 tests passed
```
