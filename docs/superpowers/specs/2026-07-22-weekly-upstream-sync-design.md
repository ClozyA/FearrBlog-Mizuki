# 每周自动同步 Mizuki 上游设计

## 目标

在 `ClozyA/FearrBlog-Mizuki` 中每周自动获取 `LyraVoid/Mizuki` 的 `master`，先在候选提交中合入生产 `publish` 并完成全部验证，只有验证通过才更新 `master` 和 `publish`。`publish` 推送后由 EdgeOne 自动部署。

## 触发与并发

- 定时：每周一 `04:00 UTC`，即北京时间周一 `12:00`。
- 手动：支持 `workflow_dispatch`。
- 使用固定 concurrency group，同一时间只运行一个同步任务，不取消已开始的运行。

## 权限

工作流只申请：

- `contents: write`：更新本 fork 的 `master` 和 `publish`。
- `issues: write`：同步失败时创建或更新通知 Issue。

不使用 PAT，不读取 EdgeOne Webhook。EdgeOne 仍通过代码仓库 `publish` 自动部署。

## 同步事务

1. 以完整历史检出 `origin/publish`。
2. 记录运行开始时的 `origin/master` 和 `origin/publish` SHA，作为并发写入保护基线。
3. 添加只读远端 `upstream=https://github.com/LyraVoid/Mizuki.git` 并获取 `upstream/master`。
4. 从 `origin/publish` 创建临时候选分支。
5. 使用普通 merge 将 `upstream/master` 合入候选分支；不使用 rebase，不修改上游历史。
6. 若有冲突，立即停止，不更新任何远端分支。
7. 验证通过后，先用精确 `--force-with-lease` 将 fork 的 `master` 对齐已验证的 `upstream/master`，再用普通快进推送候选提交到 `publish`。
8. 若运行期间远端分支被其他人更新，lease 或普通推送失败，工作流停止并通知，不覆盖并发提交。

`master` 允许 lease 保护的强制更新，因为它被定义为上游镜像，并且上游本身可能改写历史。`publish` 永不强制推送。

## 验证门槛

候选分支依次运行：

```text
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
```

Node.js 固定为 `22.14.0`，满足 pnpm 11.5.3 的最低 Node.js 要求。验证时启用真实公开内容仓库：

```text
ENABLE_CONTENT_SYNC=true
CONTENT_REPO_URL=https://github.com/ClozyA/FearrBlog-Content.git
CONTENT_DIR=./content
```

任何安装、测试、类型检查、文章同步或生产构建失败都会阻止远端更新。

## 失败通知

失败时使用 GitHub API 查找标题为 `Weekly upstream sync failed` 的开放 Issue：

- 不存在时创建，正文包含工作流运行链接。
- 已存在时追加本次失败运行链接，避免每周产生重复 Issue。

成功时如果存在该开放 Issue，则追加恢复成功的运行链接并关闭。

## 安全与回滚

- 不删除现有 `backup/master-before-content-split-20260722` 和 `backup/publish-before-content-split-20260722`。
- 不自动解决 merge conflict。
- 不在验证前推送 `publish`。
- 不对 `publish` 使用 force push。
- GitHub Action 成功后，EdgeOne 仍由现有生产分支关联和自动部署机制接管。

## 验证

工作流加入后先使用 `workflow_dispatch` 手动运行一次。成功标准：

- Action 安装、测试、Astro 检查和构建全部通过。
- 无上游变化时不会产生无意义生产提交；有变化时 `publish` 只增加正常 merge 提交。
- `master` 等于当次获取的 `upstream/master`。
- `publish` 保留文章分仓和个人配置。
- EdgeOne 生产首页和三篇文章继续返回 HTTP 200。
