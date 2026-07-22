# FearrBlog Mizuki 技术 SEO 优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让全部公开页面可抓取，并为公开 HTML 页面提供一致的 canonical、社交分享元数据、索引策略和结构化数据。

**架构：** 将 URL 规范化与元数据默认值集中在全局 `Layout.astro`，由 `MainGridLayout.astro` 向下透传少量兼容属性；文章路由只负责提供文章特有的日期、图片和 JSON-LD。使用独立的构建产物验证脚本检查 robots、sitemap 和代表性 HTML，避免侵入现有页面逻辑，并将修改限制在 SEO 入口以降低上游合并冲突。

**技术栈：** Astro 5、TypeScript、Node.js、`@astrojs/sitemap`、PowerShell 7、pnpm

---

## 文件结构与合并约束

- 创建 `scripts/check-seo.mjs`：只读检查 `dist` 中的 SEO 构建产物。
- 修改 `package.json`：新增 `check:seo` 脚本，不调整依赖或其他命令。
- 修改 `src/layouts/Layout.astro`：集中生成 canonical、robots、Open Graph、Twitter Card 和 WebSite JSON-LD。
- 修改 `src/layouts/MainGridLayout.astro`：仅新增并透传 `image`、`noindex`、`publishedTime`、`modifiedTime` 属性。
- 修改 `src/pages/robots.txt.ts`：允许抓取所有公开页面。
- 修改 `astro.config.mjs`：仅为现有 `sitemap()` 增加过滤函数。
- 修改 `src/pages/404.astro`：设置 `noindex`。
- 修改 `src/pages/posts/[...slug].astro`：传入文章图片和日期，完善 BlogPosting JSON-LD。
- 修改 `src/pages/[permalink].astro`：与标准文章路由保持同样的 SEO 输出。
- 修改 `src/pages/about.astro`、`src/pages/archive.astro`：补充稳定的页面描述；已有明确描述的页面不改。

不运行整仓库自动格式化，不移动文件，不重构布局，不修改文章内容和永久链接逻辑。每次提交只包含当前任务列出的文件。

### 任务 1：建立失败的构建产物 SEO 检查

**文件：**
- 创建：`scripts/check-seo.mjs`
- 修改：`package.json`

- [ ] **步骤 1：创建构建产物检查脚本**

创建 `scripts/check-seo.mjs`，完整内容如下：

```js
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const read = (file) => readFile(path.join(dist, file), "utf8");

const robots = await read("robots.txt");
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Allow: \//);
assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
assert.match(robots, /Sitemap: https:\/\/blog\.fearr\.xyz\/sitemap-index\.xml/);

const sitemapIndex = await read("sitemap-index.xml");
const sitemapMatch = sitemapIndex.match(/<loc>https:\/\/blog\.fearr\.xyz\/([^<]+\.xml)<\/loc>/);
assert.ok(sitemapMatch, "sitemap index must reference a child sitemap");
const sitemap = await read(sitemapMatch[1]);
assert.doesNotMatch(sitemap, /\/404\//);
assert.doesNotMatch(sitemap, /\/api\//);
assert.doesNotMatch(sitemap, /\/og\//);

const htmlFiles = [];
async function collectHtml(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) await collectHtml(absolute);
		else if (entry.name === "index.html") htmlFiles.push(absolute);
	}
}
await collectHtml(dist);

const publicHtml = htmlFiles.filter((file) => !file.endsWith(`${path.sep}404${path.sep}index.html`));
assert.ok(publicHtml.length > 0, "build must contain public HTML pages");
for (const file of publicHtml) {
	const html = await readFile(file, "utf8");
	const canonicals = html.match(/<link rel="canonical" href="https:\/\/blog\.fearr\.xyz\/[^\"]*"\s*\/?>/g) ?? [];
	assert.equal(canonicals.length, 1, `${file} must have exactly one canonical`);
	assert.match(html, /<meta name="description" content="[^"]+"\s*\/?>/);
	assert.match(html, /<meta property="og:url" content="https:\/\/blog\.fearr\.xyz\/[^\"]*"\s*\/?>/);
	assert.match(html, /<script type="application\/ld\+json">/);
}

const notFound = await read("404/index.html");
assert.match(notFound, /<meta name="robots" content="noindex, follow"\s*\/?>/);

console.log(`SEO checks passed for ${publicHtml.length} public HTML pages.`);
```

- [ ] **步骤 2：在 package.json 注册检查命令**

在 `scripts` 中紧邻 `check` 添加：

```json
"check:seo": "node scripts/check-seo.mjs",
```

- [ ] **步骤 3：建立当前基线并确认检查失败**

运行（需要 PowerShell 7 `pwsh`）：

```powershell
pnpm build && pnpm check:seo
```

预期：构建成功，`check:seo` 因 `robots.txt` 含全站 `Disallow: /` 或页面缺少 canonical 而失败。

- [ ] **步骤 4：提交测试基线**

```powershell
git add -- scripts/check-seo.mjs package.json
git commit -m "test: 添加 SEO 构建产物检查"
```

### 任务 2：实现全局规范 URL 与核心元数据

**文件：**
- 修改：`src/layouts/Layout.astro`
- 修改：`src/layouts/MainGridLayout.astro`

- [ ] **步骤 1：扩展 Layout 属性并集中计算 SEO 默认值**

在 `Layout.astro` 的 `Props` 中添加：

```ts
image?: string;
noindex?: boolean;
publishedTime?: string;
modifiedTime?: string;
```

从 `Astro.props` 解构这些字段，并在 `pageTitle` 计算后加入：

```ts
const siteUrl = Astro.site ?? new URL(siteConfig.siteURL);
const canonicalUrl = new URL(Astro.url.pathname, siteUrl);
canonicalUrl.search = "";
canonicalUrl.hash = "";

const pageDescription =
	description?.trim() || siteConfig.subtitle?.trim() || siteConfig.title;
const pageLocale = siteLang.replace("-", "_");
const resolveAbsoluteUrl = (value?: string) =>
	value?.trim() ? new URL(value, siteUrl).toString() : undefined;
```

在原有动态 OG 图片逻辑之后计算统一图片：

```ts
const socialImageUrl = resolveAbsoluteUrl(image || ogImageUrl || profileConfig.avatar);
```

- [ ] **步骤 2：替换 Layout 头部的核心元数据**

保留现有 title、keywords、author、favicon 和 RSS，只局部替换 description、URL 与社交字段，并新增：

```astro
<link rel="canonical" href={canonicalUrl} />
<meta name="robots" content={noindex ? "noindex, follow" : "index, follow"} />
<meta name="description" content={pageDescription} />
<meta property="og:locale" content={pageLocale} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:description" content={pageDescription} />
{socialImageUrl && <meta property="og:image" content={socialImageUrl} />}
{setOGTypeArticle && publishedTime && <meta property="article:published_time" content={publishedTime} />}
{setOGTypeArticle && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
<meta property="twitter:url" content={canonicalUrl} />
<meta name="twitter:description" content={pageDescription} />
{socialImageUrl && <meta name="twitter:image" content={socialImageUrl} />}
```

普通页面追加 WebSite JSON-LD；文章页继续使用页面自己的 BlogPosting：

```astro
{
	!setOGTypeArticle && (
		<script
			is:inline
			type="application/ld+json"
			set:html={JSON.stringify({
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: siteConfig.title,
				url: new URL("/", siteUrl).toString(),
				inLanguage: siteLang,
				author: { "@type": "Person", name: profileConfig.name },
			})}
		/>
	)
}
```

- [ ] **步骤 3：让 MainGridLayout 原样透传 SEO 属性**

向 `MainGridLayout.astro` 的 `Props` 和解构增加同名四个属性，并将现有单行 `<Layout ...>` 局部展开为：

```astro
<Layout
	title={title}
	banner={banner}
	description={description}
	lang={lang}
	setOGTypeArticle={setOGTypeArticle}
	postSlug={postSlug}
	image={image}
	noindex={noindex}
	publishedTime={publishedTime}
	modifiedTime={modifiedTime}
>
```

- [ ] **步骤 4：运行静态检查**

```powershell
pnpm check
```

预期：Astro 检查退出码为 0；如项目存在与本次无关的基线诊断，记录完整诊断并确认新增文件无错误。

- [ ] **步骤 5：提交全局元数据实现**

```powershell
git add -- src/layouts/Layout.astro src/layouts/MainGridLayout.astro
git commit -m "feat: 完善全局 SEO 元数据"
```

### 任务 3：开放抓取并过滤 sitemap

**文件：**
- 修改：`src/pages/robots.txt.ts`
- 修改：`astro.config.mjs`
- 修改：`src/pages/404.astro`

- [ ] **步骤 1：开放 robots 抓取**

将 robots 内容改为：

```ts
const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${new URL("sitemap-index.xml", import.meta.env.SITE).href}
`.trim();
```

- [ ] **步骤 2：过滤非内容 sitemap URL**

将 `astro.config.mjs` 中的 `sitemap()` 局部改为：

```js
sitemap({
	filter: (page) => {
		const pathname = new URL(page).pathname;
		return !(
			pathname === "/404/" ||
			pathname.startsWith("/api/") ||
			pathname.startsWith("/og/")
		);
	},
}),
```

- [ ] **步骤 3：阻止 404 被索引**

将 `404.astro` 的布局调用改为：

```astro
<MainGridLayout
	title={i18n(I18nKey.notFound)}
	description={i18n(I18nKey.notFoundDescription)}
	noindex={true}
>
```

- [ ] **步骤 4：构建并验证抓取规则**

```powershell
pnpm build
Get-Content -LiteralPath dist\robots.txt -Raw
Select-String -LiteralPath dist\404\index.html -Pattern 'noindex, follow'
```

预期：robots 只含 `Allow: /` 和 sitemap；404 匹配到 `noindex, follow`。

- [ ] **步骤 5：提交抓取策略**

```powershell
git add -- src/pages/robots.txt.ts astro.config.mjs src/pages/404.astro
git commit -m "feat: 开放公开页面搜索抓取"
```

### 任务 4：完善两类文章路由的结构化数据

**文件：**
- 修改：`src/pages/posts/[...slug].astro`
- 修改：`src/pages/[permalink].astro`

- [ ] **步骤 1：在标准文章路由生成一致的文章 URL 与日期**

在 `jsonLd` 前加入：

```ts
const articleUrl = new URL(Astro.url.pathname, Astro.site ?? siteConfig.siteURL).toString();
const publishedTime = entry.data.published.toISOString();
const modifiedTime = (entry.data.updated || entry.data.published).toISOString();
const articleImage = entry.data.image
	? new URL(entry.data.image, Astro.site ?? siteConfig.siteURL).toString()
	: undefined;
```

将现有 `jsonLd` 完善为：

```ts
const jsonLd = {
	"@context": "https://schema.org",
	"@type": "BlogPosting",
	headline: entry.data.title,
	description: entry.data.description || entry.data.title,
	url: articleUrl,
	mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
	keywords: entry.data.tags,
	author: {
		"@type": "Person",
		name: entry.data.author || profileConfig.name,
		url: new URL("/about/", Astro.site ?? siteConfig.siteURL).toString(),
	},
	datePublished: publishedTime,
	dateModified: modifiedTime,
	inLanguage: entry.data.lang
		? entry.data.lang.replace("_", "-")
		: siteConfig.lang.replace("_", "-"),
	...(articleImage ? { image: articleImage } : {}),
};
```

向 `MainGridLayout` 增加：

```astro
image={entry.data.image}
publishedTime={publishedTime}
modifiedTime={modifiedTime}
```

- [ ] **步骤 2：对 permalink 文章路由应用相同字段**

在 `src/pages/[permalink].astro` 使用与步骤 1 完全一致的 `articleUrl`、`publishedTime`、`modifiedTime`、`articleImage` 和 `jsonLd` 字段；保留该文件现有的永久链接选择、文章渲染与评论逻辑不变，并向其 `MainGridLayout` 传入同样三个属性。

- [ ] **步骤 3：运行类型与构建检查**

```powershell
pnpm check && pnpm build
```

预期：两个命令退出码均为 0；两类文章产物均含 `BlogPosting`、canonical、发布日期和修改日期。

- [ ] **步骤 4：提交文章元数据**

```powershell
git add -- 'src/pages/posts/[...slug].astro' 'src/pages/[permalink].astro'
git commit -m "feat: 完善文章结构化数据"
```

### 任务 5：补充缺失的公共页面描述并完成验收

**文件：**
- 修改：`src/pages/about.astro`
- 修改：`src/pages/archive.astro`
- 修改：`scripts/check-seo.mjs`（仅在实际 Astro 序列化格式与测试正则存在无语义差异时局部修正）

- [ ] **步骤 1：为关于页增加内容相关描述**

将布局调用改为：

```astro
<MainGridLayout
	title={title}
	description={`了解${siteConfig.title}的作者、博客内容与联系方式。`}
>
```

并从 `../config` 导入 `siteConfig`。

- [ ] **步骤 2：为归档页增加内容相关描述**

将布局调用改为：

```astro
<MainGridLayout
	title={i18n(I18nKey.archive)}
	description={`浏览${siteConfig.title}的文章归档、分类与标签。`}
>
```

并从 `../config` 导入 `siteConfig`。友链与日记页已有非空描述，不为凑改动而修改。

- [ ] **步骤 3：执行完整验证**

```powershell
pnpm check
pnpm build
pnpm check:seo
git diff --check HEAD~4..HEAD
git status --short
```

预期：检查与构建退出码为 0；SEO 脚本输出 `SEO checks passed for N public HTML pages.`；diff check 无输出；工作区只含本任务尚未提交的两个页面文件。

- [ ] **步骤 4：人工抽查代表性产物**

```powershell
$homeHtml = Get-Content -LiteralPath dist\index.html -Raw
$aboutHtml = Get-Content -LiteralPath dist\about\index.html -Raw
@($homeHtml, $aboutHtml) | ForEach-Object {
	[pscustomobject]@{
		Canonical = [regex]::Matches($_, '<link rel="canonical"').Count
		Description = [regex]::Matches($_, '<meta name="description"').Count
		JsonLd = [regex]::Matches($_, 'application/ld\+json').Count
	}
}
```

预期：首页和关于页的 Canonical、Description 至少各为 1，canonical 必须恰好为 1，JsonLd 至少为 1。

- [ ] **步骤 5：提交公共页面描述**

```powershell
git add -- src/pages/about.astro src/pages/archive.astro scripts/check-seo.mjs
git commit -m "feat: 完善公共页面 SEO 描述"
```

- [ ] **步骤 6：检查最终提交边界**

```powershell
git log -5 --oneline --decorate
git status --short
git diff --stat HEAD~5..HEAD
```

预期：SEO 工作由小而独立的提交组成；没有文章内容、样式、依赖锁文件或永久链接代码的无关改动，工作区干净。
