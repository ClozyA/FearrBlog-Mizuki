# 旧站功能迁移到新版上游实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在当前新版 Mizuki 上恢复旧站实际启用的页面入口、个性化配置、数据和资源，同时保留文章分仓与每周上游同步。

**架构：** 以 `codex/publish-rebuild` 的新版组件树为唯一实现基线，用一份回归清单锁定用户可见功能。旧版单文件配置按语义写入新版 `src/config/*.ts`，用户数据和资源逐项迁移；只有新版没有等价能力时才增加兼容代码。

**技术栈：** Astro、TypeScript、Svelte、Node.js `node:test`、pnpm、GitHub Actions。

---

## 文件职责

- `scripts/site-feature-regression.test.js`：锁定站点身份、页面入口、功能开关、用户数据、资源和构建路由。
- `src/config/siteConfig.ts`：恢复旧站启用页面、横幅、主题、目录和布局行为。
- `src/config/navBarConfig.ts`：恢复旧站导航菜单及外部链接。
- `src/config/musicConfig.ts`、`src/config/pioConfig.ts`：恢复旧站音乐和看板娘的真实启用状态。
- `src/config/sidebarConfig.ts`：按旧站布局恢复左右侧栏和移动抽屉组件。
- `src/data/friends.ts`、`src/content/spec/about.md`、`src/content/spec/friends.md`：恢复旧站个性化内容。
- `public/assets/**`、`src/assets/images/**`：提供上述配置实际引用的头像、Logo、横幅和必要媒体。
- `.github/workflows/sync-upstream.yml`：确保每周同步只合并上游，不重建或覆盖 `publish`。

### 任务 1：建立站点功能回归清单

**文件：**
- 创建：`scripts/site-feature-regression.test.js`

- [ ] **步骤 1：编写失败的配置回归测试**

使用真实文件内容验证旧站的两个特色页面入口、导航菜单、Meting 音乐模式、禁用看板娘和关键资源：

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("restores the legacy visible feature configuration", () => {
  const site = read("src/config/siteConfig.ts");
  const nav = read("src/config/navBarConfig.ts");
  const music = read("src/config/musicConfig.ts");
  const pio = read("src/config/pioConfig.ts");

  assert.match(site, /diary:\s*true/);
  assert.match(site, /friends:\s*true/);
  assert.equal(nav.includes('url: "/diary/"'), true);
  assert.equal(nav.includes('url: "/friends/"'), true);
  assert.match(music, /mode:\s*["']meting["']/);
  assert.equal(music.includes("https://www.bilibili.uno/api"), true);
  assert.match(pio, /enable:\s*false/);
  assert.equal(existsSync("src/assets/images/avatar.jpg"), true);
});
```

- [ ] **步骤 2：编写失败的数据与同步安全测试**

在同一文件追加：

```js
test("keeps personalized pages and safe upstream synchronization", () => {
  const friends = read("src/data/friends.ts");
  const about = read("src/content/spec/about.md");
  const workflow = read(".github/workflows/sync-upstream.yml");

  assert.match(friends, /ClozyA|fearr/i);
  assert.doesNotMatch(about, /This website is built with the \*\*Astro\*\* framework/);
  assert.equal(workflow.includes("git merge --no-edit upstream/master"), true);
  assert.doesNotMatch(workflow, /reset --hard|push --force origin HEAD:publish/);
});
```

- [ ] **步骤 3：运行测试并确认因当前配置缺失而失败**

运行：`pnpm test`

预期：现有 8 项测试通过，新测试至少在 `diary: true`、`friends: true`、导航、Meting 模式或个性化内容断言处失败。

- [ ] **步骤 4：提交测试红灯**

```powershell
git add -- scripts/site-feature-regression.test.js
git commit -m "test: 锁定旧站可见功能"
```

### 任务 2：迁移站点页面开关与导航

**文件：**
- 修改：`src/config/siteConfig.ts`
- 修改：`src/config/navBarConfig.ts`

- [ ] **步骤 1：恢复旧站实际启用的特色页面**

在 `siteConfig.featurePages` 中保持未使用页面关闭，只恢复旧站明确开启的页面：

```ts
featurePages: {
  anime: false,
  diary: true,
  friends: true,
  projects: false,
  skills: false,
  timeline: false,
  albums: false,
  devices: false,
  aiTools: false,
},
```

同时保持当前新版的主题色、文章列表、目录、页面进度条和横幅实现，不从旧版覆盖已升级结构。

- [ ] **步骤 2：按旧站语义恢复导航**

在 `navBarConfig.links` 中保留首页和归档，并恢复包含 Diary、Friends、GitHub 和 Bilibili 的分组入口；外链使用旧站当前用户地址：

```ts
links: [
  LinkPreset.Home,
  LinkPreset.Archive,
  {
    name: "My",
    url: "/content/",
    icon: "material-symbols:person",
    children: [
      { name: "Diary", url: "/diary/", icon: "material-symbols:book" },
      { name: "Friends", url: "/friends/", icon: "material-symbols:group" },
    ],
  },
  {
    name: "Links",
    url: "/links/",
    icon: "material-symbols:link",
    children: [
      { name: "GitHub", url: "https://github.com/ClozyA", external: true, icon: "fa7-brands:github" },
      { name: "Bilibili", url: "https://space.bilibili.com/52391971", external: true, icon: "fa7-brands:bilibili" },
    ],
  },
],
```

- [ ] **步骤 3：运行功能测试**

运行：`pnpm test`

预期：页面和导航相关断言转绿；音乐、个性化内容相关断言仍失败。

- [ ] **步骤 4：提交配置迁移**

```powershell
git add -- src/config/siteConfig.ts src/config/navBarConfig.ts
git commit -m "feat: 恢复旧站页面入口"
```

### 任务 3：迁移音乐、看板娘与侧栏行为

**文件：**
- 修改：`src/config/musicConfig.ts`
- 修改：`src/config/pioConfig.ts`
- 修改：`src/config/sidebarConfig.ts`

- [ ] **步骤 1：恢复旧站音乐配置**

保持新版播放器组件和悬浮按钮字段，将数据源改回旧站设置：

```ts
enable: true,
showFloatingPlayer: true,
floatingEntryMode: "fab",
mode: "meting",
meting_api: "https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
id: "14164869977",
server: "netease",
type: "playlist",
```

- [ ] **步骤 2：恢复旧站看板娘状态**

将 `pioConfig.enable` 设为 `false`，模型字段保留新版格式；这样恢复旧站真实行为，同时避免复制旧 Cubism 资源树。

- [ ] **步骤 3：核对侧栏等价映射**

保留新版 `profile`、`announcement`、`tags`、`card-toc`、`site-stats`、`calendar`、`categories` 和 `music-sidebar` 组件；确认桌面双栏和移动抽屉都包含音乐入口，不复制旧版已被新版替代的组件。

- [ ] **步骤 4：运行功能测试并提交**

运行：`pnpm test`

预期：音乐、看板娘和前两项配置断言通过。

```powershell
git add -- src/config/musicConfig.ts src/config/pioConfig.ts src/config/sidebarConfig.ts
git commit -m "feat: 恢复旧站音乐与侧栏行为"
```

### 任务 4：迁移个性化内容和必要资源

**文件：**
- 修改：`src/data/friends.ts`
- 修改：`src/content/spec/about.md`
- 修改：`src/content/spec/friends.md`
- 按引用恢复：`public/assets/home/**`
- 按引用恢复：`public/assets/desktop-banner/**`
- 按引用恢复：`public/assets/mobile-banner/**`
- 按引用恢复：`src/assets/images/avatar.jpg`

- [ ] **步骤 1：从备份提取用户内容作为迁移来源**

运行以下只读命令，把终端输出作为人工迁移依据，不直接覆盖新版文件：

```powershell
git show 'origin/backup/publish-before-content-split-20260722:src/data/friends.ts'
git show 'origin/backup/publish-before-content-split-20260722:src/content/spec/about.md'
git show 'origin/backup/publish-before-content-split-20260722:src/content/spec/friends.md'
```

- [ ] **步骤 2：手动迁移友链和说明内容**

将旧站真实友链条目及交换说明写入新版对应文件，删除 Astro、Vercel、React 等上游演示友链；保留新版 `FriendItem` 类型和 `getFriendsList`、`getShuffledFriendsList` 接口。

- [ ] **步骤 3：只恢复配置实际引用的资源**

逐个使用 `git restore --source` 恢复旧站引用资源，不恢复演示相册、示例文章、旧脚本或整棵 Pio 模型目录：

```powershell
git restore --source origin/backup/publish-before-content-split-20260722 -- src/assets/images/avatar.jpg
```

Logo 和横幅若新版现有 WebP 路径可正常显示，则保留新版压缩资源；只有视觉内容不一致时才恢复旧图，并同步修改 `siteConfig.ts` 引用路径。

- [ ] **步骤 4：运行测试并验证资源无断链**

运行：`pnpm test`

运行：

```powershell
rg -n 'assets/|/images/' src/config src/data src/content/spec
```

逐项确认输出中的本地路径在 `public` 或 `src/assets` 中存在。

- [ ] **步骤 5：提交个性化内容**

```powershell
git add -- src/data/friends.ts src/content/spec/about.md src/content/spec/friends.md src/assets/images/avatar.jpg public/assets
git commit -m "feat: 恢复旧站个性化内容"
```

### 任务 5：验证新版组件覆盖旧站功能

**文件：**
- 修改：`scripts/site-feature-regression.test.js`
- 检查：`src/components/control/FloatingControls.astro`
- 检查：`src/components/features/posts/RelatedPosts.astro`
- 检查：`src/components/features/posts/RandomPosts.astro`
- 检查：`src/components/features/posts/ShareCard.astro`
- 检查：`src/components/features/toc/SidebarTOC.astro`
- 检查：`src/components/widgets/music-player/MusicPlayer.svelte`

- [ ] **步骤 1：建立构建路由断言**

在测试中增加构建后检查；如果 `dist` 存在，则验证旧站启用页面和三篇文章产物：

```js
test("build output contains enabled pages and separated legacy posts", () => {
  if (!existsSync("dist")) return;
  assert.equal(existsSync("dist/diary/index.html"), true);
  assert.equal(existsSync("dist/friends/index.html"), true);
  assert.equal(existsSync("dist/posts/git命令/index.html"), true);
  assert.equal(existsSync("dist/posts/ant-design-pro-无法使用umi-ui解决办法/index.html"), true);
  assert.equal(existsSync("dist/posts/基于docker-compose搭建teamspeak服务器/index.html"), true);
});
```

- [ ] **步骤 2：运行 Astro 类型检查**

运行：`pnpm check`

预期：0 errors；若新版类型拒绝旧配置值，只适配配置到新版类型，不回退类型文件。

- [ ] **步骤 3：运行生产构建**

运行：

```powershell
$env:ENABLE_CONTENT_SYNC = 'true'
$env:CONTENT_REPO_URL = 'https://github.com/ClozyA/FearrBlog-Content.git'
$env:CONTENT_DIR = './content'
pnpm run build
```

预期：构建退出码为 0，输出 Diary、Friends 和三篇历史文章路由。

- [ ] **步骤 4：重新运行完整测试**

运行：`pnpm test`

预期：全部测试通过，构建路由断言不再被跳过。

- [ ] **步骤 5：提交验证保护**

```powershell
git add -- scripts/site-feature-regression.test.js
git commit -m "test: 防止站点功能再次丢失"
```

### 任务 6：发布前审计与线上验收

**文件：**
- 检查：`.github/workflows/sync-upstream.yml`
- 检查：本计划涉及的全部文件

- [ ] **步骤 1：审计提交范围和差异**

运行：

```powershell
git status --short
git diff --check origin/publish...HEAD
git diff --stat origin/publish...HEAD
git log --oneline origin/publish..HEAD
```

确认没有上游示例文章、整棵旧组件树、无引用媒体或构建产物进入提交。

- [ ] **步骤 2：验证自动同步不会重建 publish**

运行：`pnpm test`

人工检查 Action 从 `origin/publish` 创建候选分支并执行 `git merge upstream/master`，且发布使用普通 `git push origin HEAD:publish`。

- [ ] **步骤 3：推送 publish**

```powershell
git push origin HEAD:publish
```

- [ ] **步骤 4：等待 EdgeOne 部署后验证线上页面**

检查首页、`/diary/`、`/friends/`、`/archive/` 和三篇文章均返回 HTTP 200；在桌面与移动宽度下核对导航、侧栏、音乐入口、主题/壁纸切换、目录、分享和推荐组件。

- [ ] **步骤 5：失败时回退**

若线上出现阻断问题，使用本次推送前记录的 `publish` SHA 创建回退提交或将 EdgeOne 暂时切回该提交；不得删除 `origin/backup/publish-before-content-split-20260722`。
