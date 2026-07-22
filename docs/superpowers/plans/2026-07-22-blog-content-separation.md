# 博客文章分仓实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将三篇现有文章迁移到 `ClozyA/FearrBlog-Content`，从 Mizuki 最新上游重建可部署的 `publish`，并让 EdgeOne 构建可靠拉取文章。

**架构：** 公开内容仓库只提供 `posts/`；代码仓库构建脚本显式启用时克隆该仓库并只映射文章目录。`master` 对齐 `LyraVoid/Mizuki`，`publish` 只叠加个人站点配置和经过测试的同步逻辑，旧生产提交保存在远端备份分支。

**技术栈：** PowerShell 7、Git/GitHub CLI、Node.js 24、Node 内置测试运行器、Astro 5、pnpm 10、GitHub Actions、腾讯云 EdgeOne Webhook。

---

## 文件结构

### 内容仓库 `ClozyA/FearrBlog-Content`

- `README.md`：说明仓库用途、目录契约和本地写作流程。
- `posts/**`：三篇历史文章和 TeamSpeak 文章的两张本地图片。
- `.github/workflows/trigger-edgeone.yml`：`main` 推送后调用 EdgeOne 部署 Webhook。

### 代码仓库候选生产分支

- `scripts/content-sync.js`：可测试的内容同步核心，只处理 `posts`。
- `scripts/sync-content.js`：加载 `.env` 并调用同步核心的 CLI 入口。
- `scripts/content-sync.test.js`：覆盖默认关闭、生产配置错误、文章映射和同步失败。
- `package.json`：加入 Node 测试命令，移除 `prebuild`/`predev` 的静默成功。
- `.env.example`：记录公开内容仓库和明确的默认关闭语义。
- `src/config.ts`：从旧生产分支选择性恢复站点名称、URL、个人链接和展示配置。
- `src/assets/images/avatar.jpg`、`public/images/avatar.jpg`：保留现有头像资源。
- `docs/superpowers/specs/2026-07-22-blog-content-separation-design.md`：已批准设计。
- `docs/superpowers/plans/2026-07-22-blog-content-separation.md`：本实现计划。

### 不进入候选生产分支

- 旧 `.github/workflows/*` 的删除/手动触发定制。
- 旧 `src/content/posts/**` 个人文章；它们迁入内容仓库。
- 旧 `src/content/spec/**`、`src/data/**`、友链、日记和番剧定制。

## 任务 1：创建并验证内容仓库

**文件：**
- 创建：`cache/content-repo/README.md`
- 创建：`cache/content-repo/posts/**`
- 创建：`cache/content-repo/.github/workflows/trigger-edgeone.yml`

- [ ] **步骤 1：核对源文章白名单**

运行：

```powershell
Get-ChildItem -LiteralPath 'src/content/posts' -Recurse -File |
  Select-Object FullName, Length
```

预期：只有三份 `index.md` 和 TeamSpeak 目录的 `1.png`、`2.png` 被选入迁移白名单。

- [ ] **步骤 2：创建内容仓库文件**

将三个白名单目录复制到 `cache/content-repo/posts/`。README 明确代码仓库消费路径为 `posts/`。工作流内容固定为：

```yaml
name: Trigger EdgeOne deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger EdgeOne
        env:
          EDGEONE_DEPLOY_WEBHOOK: ${{ secrets.EDGEONE_DEPLOY_WEBHOOK }}
        run: |
          test -n "$EDGEONE_DEPLOY_WEBHOOK"
          curl --fail-with-body --silent --show-error --request POST "$EDGEONE_DEPLOY_WEBHOOK"
```

- [ ] **步骤 3：验证内容仓库清单和 Markdown 图片引用**

运行一个 PowerShell 白名单比较，确认相对路径集合恰好为：

```text
posts/Ant Design Pro 无法使用umi-ui解决办法/index.md
posts/Git命令/index.md
posts/基于Docker-Compose搭建TeamSpeak服务器/1.png
posts/基于Docker-Compose搭建TeamSpeak服务器/2.png
posts/基于Docker-Compose搭建TeamSpeak服务器/index.md
```

并用 `rg -n '!\[[^]]*\]\((\./)?[^)]+\)' cache/content-repo/posts` 检查本地图片引用存在对应文件。

- [ ] **步骤 4：创建 GitHub 仓库并推送**

运行：

```powershell
git -C cache/content-repo init -b main
git -C cache/content-repo add .
git -C cache/content-repo commit -m 'chore: 迁移博客历史文章'
gh repo create ClozyA/FearrBlog-Content --public --source cache/content-repo --remote origin --push
```

预期：`gh repo view ClozyA/FearrBlog-Content` 返回公开仓库，默认分支为 `main`。

## 任务 2：为内容同步编写失败测试

**文件：**
- 创建：`scripts/content-sync.test.js`
- 修改：`package.json`

- [ ] **步骤 1：在最新上游候选分支创建测试**

使用 `node:test` 和 `node:assert/strict`，测试以下行为：

```javascript
test("content sync is disabled unless explicitly enabled", async () => {
  const result = await syncContent({ rootDir, env: {}, runGit });
  assert.equal(result.status, "disabled");
  assert.equal(runGitCalls.length, 0);
});

test("enabled sync rejects a missing repository URL", async () => {
  await assert.rejects(
    syncContent({ rootDir, env: { ENABLE_CONTENT_SYNC: "true" }, runGit }),
    /CONTENT_REPO_URL/,
  );
});

test("sync maps only posts and leaves spec data and images untouched", async () => {
  const result = await syncContent({ rootDir, env, runGit });
  assert.equal(result.status, "synced");
  assert.deepEqual(await listFiles(path.join(rootDir, "src/content/posts")), ["article/index.md"]);
  assert.equal(await readFile(path.join(rootDir, "src/content/spec/about.md"), "utf8"), "keep");
  assert.equal(await readFile(path.join(rootDir, "src/data/friends.ts"), "utf8"), "keep");
});

test("clone failures reject instead of falling back to local posts", async () => {
  const runGit = async () => { throw new Error("clone failed"); };
  await assert.rejects(syncContent({ rootDir, env, runGit }), /clone failed/);
});
```

在 `package.json` 增加：

```json
"test": "node --test scripts/content-sync.test.js"
```

- [ ] **步骤 2：运行测试确认红灯**

运行：`pnpm test`

预期：FAIL，原因是 `scripts/content-sync.js` 尚不存在或未导出 `syncContent`。

## 任务 3：实现可靠的仅文章同步

**文件：**
- 创建：`scripts/content-sync.js`
- 修改：`scripts/sync-content.js`
- 修改：`package.json`
- 修改：`.env.example`

- [ ] **步骤 1：实现同步核心**

`syncContent({ rootDir, env, runGit })` 必须：

1. 仅当 `ENABLE_CONTENT_SYNC === "true"` 时启用。
2. 启用后要求非空 `CONTENT_REPO_URL`。
3. 将仓库克隆/更新到 `CONTENT_DIR`。
4. 要求内容仓库存在 `posts/`。
5. 备份普通目录到 `src/content/posts.backup`，然后创建 junction；junction 失败时复制目录。
6. Git 或文件操作失败时抛出错误，不调用 `process.exit(0)`。
7. 不执行 `git add`、`git commit`、`git reset --hard` 或 `stash`。

- [ ] **步骤 2：实现 CLI 入口**

`scripts/sync-content.js` 只负责 `loadEnv()`、调用 `syncContent()`、打印状态；错误写入 stderr 并设置 `process.exitCode = 1`。

- [ ] **步骤 3：移除静默构建**

将脚本改为：

```json
"predev": "node scripts/sync-content.js",
"prebuild": "node scripts/sync-content.js"
```

`.env.example` 使用：

```text
ENABLE_CONTENT_SYNC=false
CONTENT_REPO_URL=https://github.com/ClozyA/FearrBlog-Content.git
CONTENT_DIR=./content
```

- [ ] **步骤 4：运行测试确认绿灯**

运行：`pnpm test`

预期：4 个测试全部 PASS。

- [ ] **步骤 5：提交同步实现**

运行：

```powershell
git add scripts/content-sync.js scripts/content-sync.test.js scripts/sync-content.js package.json .env.example
git commit -m 'feat: 可靠同步独立文章仓库'
```

## 任务 4：从最新上游重建候选生产分支

**文件：**
- 修改：`src/config.ts`
- 创建：`src/assets/images/avatar.jpg`
- 创建：`public/images/avatar.jpg`
- 创建：设计与计划文档

- [ ] **步骤 1：创建上游候选 worktree**

从已获取的 `upstream/master` 创建 `codex/publish-rebuild`，不要把旧 `publish` 的合并历史带入候选分支。

- [ ] **步骤 2：恢复个人站点配置**

比较 `publish:src/config.ts` 与 `upstream/master:src/config.ts`，只移植站点身份字段：站点标题、副标题、站点 URL、语言/时区、头像引用、社交链接、评论配置和当前启用的展示开关。不得恢复旧 `SESSDATA`，不得注释必填 `font`。

- [ ] **步骤 3：恢复头像并加入已批准文档**

从旧 `publish` 恢复两个 `avatar.jpg`。将设计、计划和任务 3 的同步实现带入候选分支。

- [ ] **步骤 4：审计候选 diff**

运行：

```powershell
git diff --stat upstream/master...HEAD
git diff --name-status upstream/master...HEAD
```

预期：不出现个人文章、`spec`、`data` 或旧工作流文件。

## 任务 5：用真实内容仓库验证候选构建

**文件：**
- 生成但不提交：`content/`、`src/content/posts.backup/`、`dist/`

- [ ] **步骤 1：安装锁定依赖并运行单元测试**

运行：`pnpm install --frozen-lockfile`，然后 `pnpm test`。

预期：安装退出 0，4 个同步测试全部通过。

- [ ] **步骤 2：验证类型检查**

在当前 PowerShell 进程设置：

```powershell
$env:ENABLE_CONTENT_SYNC = 'true'
$env:CONTENT_REPO_URL = 'https://github.com/ClozyA/FearrBlog-Content.git'
$env:CONTENT_DIR = './content'
pnpm check
```

预期：0 errors、0 warnings、0 hints。

- [ ] **步骤 3：验证生产构建与文章集合**

运行：`pnpm build`。

预期：退出 0；`dist/posts/` 或永久链接输出中可找到三个文章标题，找不到上游示例文章标题。

- [ ] **步骤 4：验证失败闭合**

在临时目录运行同步 CLI，并将 `CONTENT_REPO_URL` 设置为不存在的仓库。

预期：命令非零退出，stderr 包含克隆失败；代码仓库本地文章不被当成成功结果。

- [ ] **步骤 5：提交候选生产分支**

运行完整 `pnpm test`、`pnpm check`、`pnpm build` 后提交个人配置与文档，确保生成目录未暂存。

## 任务 6：安全更新 GitHub 分支

- [ ] **步骤 1：创建并推送旧生产备份**

运行：

```powershell
git branch backup/publish-before-content-split-20260722 origin/publish
git push origin backup/publish-before-content-split-20260722
```

- [ ] **步骤 2：更新 upstream URL**

运行：

```powershell
git remote set-url upstream https://github.com/LyraVoid/Mizuki.git
git fetch upstream --prune
```

- [ ] **步骤 3：对齐 master**

在备份存在且候选验证通过后，将 `master` 更新到已验证的 `upstream/master`，使用 `--force-with-lease` 防止覆盖并发远端更新。

- [ ] **步骤 4：更新 publish**

先推送候选分支供远端保存，再使用 `--force-with-lease` 将已验证候选提交更新到 `publish`。若 lease 不匹配，停止并重新审计远端，不强行覆盖。

- [ ] **步骤 5：验证远端**

用 `gh api` 确认备份、`master`、`publish` 和内容仓库 `main` 的 SHA、默认分支与公开状态。

## 任务 7：配置 EdgeOne 触发

- [ ] **步骤 1：检查可用的 EdgeOne 登录态**

若 Chrome/应用内浏览器已有登录态，进入项目设置创建绑定 `publish` 的部署 Webhook；否则停止在 Secret 录入前，不索取或暴露用户凭据。

- [ ] **步骤 2：写入 GitHub Secret**

从标准输入写入，避免 URL 出现在命令参数和日志：

```powershell
$webhook | gh secret set EDGEONE_DEPLOY_WEBHOOK --repo ClozyA/FearrBlog-Content
```

- [ ] **步骤 3：触发并验证部署**

手动运行内容仓库 workflow，确认 Action 成功，并在 EdgeOne 部署记录中确认来源分支为 `publish`。最后访问生产域名核对三篇文章。

## 完成前总验证

运行并记录：

```powershell
pnpm test
pnpm check
pnpm build
git status --short
gh repo view ClozyA/FearrBlog-Content --json visibility,defaultBranchRef,url
gh api repos/ClozyA/FearrBlog-Mizuki/branches --jq '.[].name'
```

只有所有本地命令退出 0、远端分支可读、内容清单精确且 EdgeOne 生产页面可访问时，才声明迁移完成。若缺少 EdgeOne 登录态，则明确报告 GitHub 和代码已完成、EdgeOne Secret 录入仍待用户操作。
