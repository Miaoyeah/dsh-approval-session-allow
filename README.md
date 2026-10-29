# dsh-approval-session-allow

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的审批面板增强插件：给「允许一次 / 拒绝」加第三个选项——**本对话均允许**。

点一次之后，本次对话里同一个工具再需要越权授权时自动放行，不再反复弹窗；授权可随时撤销。

> Adds an **“Allow for this conversation”** answer to the DSH approval panel: one click, and later approvals from the same tool in the same conversation are auto-allowed.

---

## 它解决什么

DSH 内置的审批面板只有两个选择——「允许一次」和「拒绝」。工具每次越权（例如 `pwsh`、`write` 要访问工作区外的路径）都要重新问一遍，一个稍长的任务里可能被问十几次，每次都只能放行一次。

这个插件在面板上补了第三个答案，并在后续同类请求上直接放行：命中授权时，面板**根本不出现**。

| 按钮 | 行为 |
|---|---|
| 拒绝（Esc） | 拒绝这一次 |
| 允许一次（Enter） | 只放行这一次，默认行为 |
| **本对话均允许** | 放行这一次，并且本对话内同一工具不再询问 |

## 安装

### 方式一：作为 DSH 插件包（推荐）

在 DSH Web 界面的**插件**页粘贴本仓库地址安装：

```
https://github.com/Miaoyeah/dsh-approval-session-allow
```

安装会把它写进 profile 的 `dsh.profile.bundles` 并默认启用，包内的 `cordis.patch.yml` 随即生效（禁用内置审批面板 + 插入本插件条目）。让 agent 调用 `plugin_manager` 的 `install_bundle` 效果相同。

> 只跑 `dsh plugin add <git-url>` 是不够的：该命令把参数原样转发给 `pnpm add`，只安装依赖、**不会选中组合包**。这种情况下还要手动把 `dsh-approval-session-allow` 加进 profile `package.json` 的 `dsh.profile.bundles` 列表，否则插件不会被加载。

### 方式二：手动接进 profile

把仓库目录作为 `link:` 依赖登记，并在 profile 的 `cordis.patch.yml` 末尾追加：

```yaml
- id: ui-approval
  name: '@deepseek-ai/dsh-client-ui-approval'
  disabled: true
- insert:
    - id: approval-session-allow
      name: 'dsh-approval-session-allow'
```

**两种方式不要同时用**：同一个 Loader id 被插入两次是配置错误。用方式一就不要再手写这两行。

安装后无需重启应用：profile 的 patch 文件与插件文件都被运行中的 Host 监听，几秒内自动重组，浏览器页面通过 HMR 拿到新的插件图。

## 授权范围

授权按 **(会话, 工具名)** 记账，存于浏览器 `localStorage`（键 `dsh.approval.sessionAllow.v1`）：

- 只对**当前这个对话**生效，其他对话、其他工作区不受影响。
- 只对**点按钮时那个工具**生效：给 `pwsh` 授权不会顺带放过 `write`。
- **子代理**是独立会话，需要单独授权。
- 刷新页面、重启应用后仍然有效（同一对话）；**新建对话即失效**，清站点数据也会清空。
- 每次审批仍照常写入会话日志（`approval/asked` / `approval/decided`），审计链完整；Host 侧每次看到的都是一次正常的 `allowed-once`。

## 撤销

授权后，下一个审批面板里会出现一行「本对话已自动允许」，列出已放行的工具；点工具名后面的 `×` 立即撤销，该工具下次会重新询问。

也可以开新对话，或在开发者工具里执行 `localStorage.removeItem('dsh.approval.sessionAllow.v1')`。

## 原理

内置的 `@deepseek-ai/dsh-client-ui-approval` 只负责「临时决定」，持久策略按设计归 Host 侧所有。本插件走 DSH 的客户端插件机制接管面板，Host 代码零改动：

```
approval/request 瀑布
   ├─ 命中本会话授权  → 直接返回 allowed-once（面板不渲染）
   └─ 未命中          → 正常渲染面板：拒绝 / 允许一次 / 本对话均允许
```

- `lib/index.js`：Host 侧空实现，只为了让 Loader 有一条可启动的条目。
- `lib/client.js`：浏览器侧面板 + 授权账本 + `approval/request` 监听，整体是一个懒加载 CJS bundle（`window.__ModuleLoader__.load`）。
- 复用内置包的槽位约定：`conversation.composer` 面板、`conversation.approval.detail` 子槽、`ctx.uiSession.registerPendingInteraction`，因此工具自带的审批详情（例如 `pwsh` 的命令预览）照常显示。

## 兼容性

- 面向 DSH 0.2.x 的 Web / 桌面 GUI（客户端插件层）。CLI、headless、ACP 等没有浏览器面板的形态本来就走各自的审批通道。
- 依赖内置包暴露的客户端接口（`ctx.slots`、`ctx.uiSession`、`ctx.locale`、`ctx.remote.$on`、`conversation.approval.detail`）。DSH 大版本升级后若接口变化，插件会在插件列表里显示加载失败；卸下本插件、恢复内置面板即可。

## 开发

```powershell
npm test     # node test/contract.mjs：假页面 + 假 ctx，验证授权账本与面板按钮接线
```

`test/contract.mjs` 覆盖：无授权时正常等待、三个按钮都在、点「本对话均允许」后记账、下一次同类请求自动放行、其他工具/其他会话仍然询问、撤销后重新询问、存储损坏时降级为询问。

仓库里 `lib/client.js` 是可直接运行的构建产物（不依赖打包步骤）；改完 `npm test` 通过即可在 DSH 里热更新生效。

## 卸载

```powershell
dsh plugin --profile <profile> remove dsh-approval-session-allow
```

手动安装的把 profile `cordis.patch.yml` 里那两行删掉，内置审批面板自动恢复。

## License

[MIT](LICENSE)
