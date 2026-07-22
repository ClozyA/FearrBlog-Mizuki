# 博客代码与文章分仓设计

## 目标

将现有博客的历史文章迁移到独立 GitHub 仓库，使主题代码可以持续跟随 Mizuki 上游，并由腾讯云 EdgeOne 在构建时拉取文章。只保留现有正式文章及文章目录中的配图，不迁移示例文章、友链、日记、番剧、项目或其他页面数据。

## 仓库与分支

- 代码仓库：`ClozyA/FearrBlog-Mizuki`。
- 内容仓库：新建公开仓库 `ClozyA/FearrBlog-Content`，默认分支 `main`。
- 上游仓库：`LyraVoid/Mizuki`，本地远端名保持 `upstream`。
- `master`：作为上游同步基线，尽量不包含个人内容。
- `publish`：EdgeOne 生产分支，包含最新上游代码、必要个人站点配置和内容同步可靠性修复。
- 旧生产状态：创建远端备份分支，命名为 `backup/publish-before-content-split-20260722`，在替换 `publish` 前推送。

## 内容范围

内容仓库采用最小结构：

```text
FearrBlog-Content/
├── .github/workflows/trigger-edgeone.yml
├── posts/
│   ├── Ant Design Pro 无法使用umi-ui解决办法/
│   ├── Git命令/
│   └── 基于Docker-Compose搭建TeamSpeak服务器/
└── README.md
```

`posts/` 从当前 `publish` 的 `src/content/posts/` 迁移，但只保留上述三篇个人历史文章以及各文章目录内的本地图片。上游自带的 `draft.md`、`encrypted-post.md`、`guide/`、`markdown-*` 和 `video.md` 不进入内容仓库。

不迁移以下内容：

- `src/content/spec/`
- `src/data/`
- `public/images/`
- 头像、横幅和主题资源

这些仍属于主题代码仓库或采用最新上游默认值。文章图片已经和文章放在同一个目录，因此不依赖 `public/images/`。

## 内容同步

代码仓库构建时通过 `scripts/sync-content.js` 将内容仓库的 `posts/` 映射到 `src/content/posts/`。同步只管理文章目录，不替换 `spec`、`data` 或整个 `public/images`，从边界上避免内容仓库覆盖主题文件。

EdgeOne 环境变量：

```text
ENABLE_CONTENT_SYNC=true
CONTENT_REPO_URL=https://github.com/ClozyA/FearrBlog-Content.git
CONTENT_DIR=./content
```

本地未显式启用同步时使用代码仓库内的内容。生产环境已设置 `ENABLE_CONTENT_SYNC=true` 时，内容仓库地址缺失、克隆失败或同步失败必须让构建失败，禁止静默发布示例或旧文章。

## EdgeOne 触发

EdgeOne 继续部署代码仓库的 `publish` 分支，构建命令为 `pnpm build`，输出目录为 `dist`。

在 EdgeOne 项目设置中创建绑定 `publish` 的部署 Webhook，将 URL 保存为内容仓库 Actions Secret `EDGEONE_DEPLOY_WEBHOOK`。内容仓库 `main` 每次推送后运行 GitHub Actions，以 HTTP POST 调用该 Webhook。Webhook 不写入仓库、日志或普通环境变量。

如果当前浏览器没有可用的 EdgeOne 登录态，代码和 GitHub 侧工作仍可完成，但 Webhook Secret 的最终录入作为唯一人工步骤明确交付。

## 上游重建策略

现有 `publish` 相对上游偏离较大，不继续累计历史合并。迁移采用以下顺序：

1. 推送旧 `publish` 的远端备份分支。
2. 更新 `upstream` URL 到 `https://github.com/LyraVoid/Mizuki.git`。
3. 让本地和远端 `master` 对齐最新 `upstream/master`。
4. 从最新 `master` 建立新的候选生产分支。
5. 恢复经过筛选的个人站点配置和主题资源，不恢复示例内容或已迁出的文章。
6. 加入只同步 `posts/` 的可靠性修改。
7. 使用真实内容仓库完成类型检查和生产构建。
8. 验证候选分支后更新远端 `publish`，保留备份分支用于回滚。

历史提交不逐个 cherry-pick；以文件级审计恢复当前有效个性化，避免把旧上游代码和已废弃工作流重新带回。

## 验证与回滚

迁移完成前必须验证：

- 内容仓库恰好包含三篇历史文章及其文章内配图。
- `pnpm check` 为零错误。
- 启用内容同步后 `pnpm build` 成功，生成页面中包含三篇文章。
- 使用无效内容仓库地址时生产构建失败。
- 禁用内容同步时本地开发仍使用代码仓库自带内容。
- GitHub 上 `master`、`publish`、内容仓库 `main` 和备份分支均存在。
- EdgeOne 候选部署可访问后再视为生产切换完成。

若新 `publish` 有问题，将 EdgeOne 部署分支临时切回备份分支，或用备份分支恢复 `publish`。内容仓库独立保留文章历史，不受代码分支回滚影响。
