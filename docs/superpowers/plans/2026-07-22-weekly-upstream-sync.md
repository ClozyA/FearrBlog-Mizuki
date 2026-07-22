# 每周自动同步 Mizuki 上游实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 每周验证后自动将 `LyraVoid/Mizuki:master` 同步到 fork 的 `master` 并合入生产 `publish`，失败时通过 GitHub Issue 通知。

**架构：** 单个 GitHub Actions workflow 在临时候选分支完成上游 merge 和真实内容仓库构建，验证通过后才推送。Node 结构测试读取 workflow 文本，固定关键安全不变量，避免以后误改为强推生产或跳过构建。

**技术栈：** GitHub Actions、Git、Node.js 22.11、pnpm 11、Node 内置测试运行器、Astro、GitHub Script。

---

## 文件结构

- 创建：`.github/workflows/sync-upstream.yml` — 定时同步、验证、推送与 Issue 通知。
- 创建：`scripts/weekly-upstream-sync.test.js` — 工作流安全不变量测试。
- 修改：`package.json` — `pnpm test` 同时运行内容同步和工作流结构测试。

## 任务 1：编写失败的工作流结构测试

- [ ] 创建 `scripts/weekly-upstream-sync.test.js`，读取 `.github/workflows/sync-upstream.yml`，并断言：
  - cron 为 `0 4 * * 1` 且包含 `workflow_dispatch`。
  - 权限包含 `contents: write` 和 `issues: write`。
  - Node 版本为 `22.14.0`。
  - 依次出现 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm check`、`pnpm build`。
  - 包含真实内容仓库三个环境变量。
  - `master` 推送包含 `--force-with-lease`。
  - `publish` 推送不含 `--force`。
  - 包含失败 Issue 的创建/追加和成功关闭逻辑。
- [ ] 将 `package.json` 的测试命令改为：

```json
"test": "node --test scripts/*.test.js"
```

- [ ] 运行 `pnpm test`，预期工作流测试因 YAML 文件不存在而失败，原 4 个内容同步测试继续通过。

## 任务 2：实现最小工作流

- [ ] 创建 `.github/workflows/sync-upstream.yml`：
  - `schedule` 每周一 04:00 UTC，支持 `workflow_dispatch`。
  - concurrency 不取消正在运行的同步。
  - checkout `publish` 且 `fetch-depth: 0`。
  - 获取并记录 origin 两分支 SHA，获取 `upstream/master`。
  - 从 `origin/publish` 创建 `sync-candidate` 并普通 merge 上游。
  - Node/pnpm 安装后运行完整四道验证，内容同步环境变量指向公开仓库。
  - 使用记录的 SHA lease 更新 `master`，普通推送候选到 `publish`。
  - 失败时创建或更新固定标题 Issue，成功时关闭旧 Issue。
- [ ] 运行 `pnpm test`，预期所有结构测试和内容同步测试通过。
- [ ] 运行 YAML 基础解析/静态检查，确认 workflow 语法可被 GitHub 接受。
- [ ] 提交：`feat: 每周自动同步 Mizuki 上游`。

## 任务 3：本地质量门槛

- [ ] 运行 `pnpm test`，预期全部通过。
- [ ] 运行 `pnpm check`，预期 0 errors、0 warnings、0 hints。
- [ ] 设置真实内容仓库环境变量后运行 `pnpm build`，预期退出 0 并生成三篇文章。
- [ ] 恢复构建产生的文章 junction，确认 `git status --short` 干净。

## 任务 4：推送与首次 Action 验证

- [ ] 用当前远端 `publish` SHA 执行普通快进推送，不 force。
- [ ] 通过 `gh workflow run sync-upstream.yml --ref publish` 手动触发。
- [ ] 使用 `gh run watch --exit-status` 等待完成。
- [ ] 核对 Action 中 merge、4 道验证和推送步骤均成功；无上游变化时允许 merge 报告 already up to date，不能产生无意义提交。
- [ ] 核对 `master` 等于当次上游 SHA，`publish` 保留工作流提交。
- [ ] 核对 EdgeOne 首页与三篇文章全部 HTTP 200。

## 完成标准

- `pnpm test`、`pnpm check`、`pnpm build` 均退出 0。
- 手动触发的首次每周同步 Action 成功。
- 工作流未使用 PAT，未强推 `publish`。
- 生产站未回退到示例文章。
- 两个历史备份分支继续存在。
