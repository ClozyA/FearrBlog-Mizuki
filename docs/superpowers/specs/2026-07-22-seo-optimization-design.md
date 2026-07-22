# FearrBlog Mizuki 技术 SEO 优化设计

## 背景

站点已具备 Astro sitemap、RSS、基础 Open Graph 元数据和部分文章结构化数据，但当前 `robots.txt` 默认禁止抓取全站，仅放行首页与 `/posts/`。这会阻止归档、关于、友链、日记等公开页面被搜索引擎正常发现和收录。此外，全局页面尚未统一输出 canonical URL，社交分享元数据、页面索引策略和结构化数据仍有完善空间。

## 目标

- 允许搜索引擎抓取所有公开页面。
- 为每个可索引页面提供唯一、绝对且规范化的 canonical URL。
- 完善 Open Graph、Twitter Card 和 JSON-LD，使搜索结果与社交分享信息一致。
- 只让有搜索价值的 HTML 页面进入 sitemap，并明确阻止 404 等无价值页面被索引。
- 保持现有文章路由、内容仓库、页面功能和视觉表现不变。

## 非目标

- 不批量改写文章标题、正文、关键词或摘要。
- 不引入外部 SEO 平台、统计服务或运行时 API。
- 不改变永久链接规则、站点信息架构或页面视觉设计。
- 不承诺搜索排名或收录时间；本次只改善技术可抓取性与元数据质量。

## 方案

采用完整但克制的技术 SEO 优化：在现有 `Layout.astro`、Astro sitemap 和文章 JSON-LD 基础上补齐标准字段，集中处理 URL 规范化和默认值，避免为 SEO 新建复杂框架。

### 1. 抓取与索引策略

- 将 `robots.txt` 调整为允许抓取所有公开路径，并继续声明绝对 sitemap 地址。
- 为 404 页面输出 `noindex, follow`。
- 如项目中存在明确不应进入搜索结果的内部页面，则通过页面级属性设置 robots 元数据，而不是重新采用全站禁止规则。
- 配置 sitemap 过滤规则，排除 404、API、动态 OG 图片等非内容端点；保留首页、文章页和已启用的公开功能页。

### 2. URL 规范化

- 在全局布局中根据 `Astro.site`、当前 pathname 与项目的尾斜杠约定生成绝对 canonical URL。
- canonical 不包含查询参数或 hash，避免追踪参数和页面状态产生重复索引。
- `og:url` 与 Twitter URL 使用同一 canonical URL，避免不同元数据指向不同地址。
- sitemap、robots 与页面元数据均沿用 `siteConfig.siteURL` 作为唯一站点源。

### 3. 全局元数据接口

扩展全局布局的 SEO 属性，但保持现有调用方兼容：

- `title`：页面标题；继续按现有规则附加站点名。
- `description`：页面摘要；缺失时使用站点级默认描述，而不是直接退化为完整页面标题。
- `image`：页面分享图；文章图优先，其次为动态 OG 图，最后使用站点默认图。
- `noindex`：页面是否禁止索引，默认 `false`。
- `setOGTypeArticle`：继续控制 `website` 与 `article` 类型。

布局统一输出：

- `<link rel="canonical">`
- `robots`
- Open Graph 的类型、标题、描述、URL、站点名、语言和图片
- Twitter Card 的标题、描述、URL 和图片
- 现有 author、favicon、RSS alternate 等信息

所有图片 URL 在输出前转换为绝对 URL。没有可用图片时，不输出无效或空图片字段。

### 4. 结构化数据

- 普通站点页面提供 `WebSite` JSON-LD，至少包含名称、URL、语言和发布者/作者信息。
- 文章页沿用并完善现有 `BlogPosting`：`headline`、`description`、`url`、`mainEntityOfPage`、`datePublished`、可用时的 `dateModified`、作者和图片。
- 仅在页面层级数据真实、稳定时输出 `BreadcrumbList`；不根据展示组件虚构分类层级。
- JSON-LD 中的 URL 与 canonical 保持一致，缺失字段直接省略，不写入空字符串。

### 5. 页面级描述

- 首页使用站点标题、站点副标题或站点默认描述。
- 归档、关于、友链、日记等公开页面提供与页面内容对应的稳定描述。
- 文章优先使用 frontmatter 描述；缺失时使用现有内容摘要能力生成长度适中的纯文本回退值。
- 不使用 `meta keywords` 作为核心优化手段；为兼容现有配置可以保留，但不会围绕它扩展逻辑。

### 6. 边界与错误处理

- `Astro.site` 或资源路径缺失时使用 `siteConfig.siteURL` 安全构造绝对 URL。
- URL 构造集中在一个小型工具或布局内的单一逻辑中，避免每个页面重复拼接。
- 对可选日期、图片和描述先校验再写入 JSON-LD，确保构建产物是有效 JSON。
- 不因某篇文章缺少可选 SEO 字段而中断整站构建。

## 验证方案

1. 运行项目现有的 Astro 检查命令。
2. 运行生产构建，确认 sitemap 和静态路由正常生成。
3. 抽查构建产物中的首页、至少一篇文章、一个普通公开页面和 404 页面。
4. 验证每个抽查页面：
   - 只有一个 canonical，且为绝对 URL；
   - description 非空且与页面相关；
   - Open Graph 与 Twitter URL、标题、描述一致；
   - 图片字段存在时为绝对 URL；
   - JSON-LD 可解析且 URL 与 canonical 一致；
   - 404 包含 `noindex, follow`。
5. 验证 `robots.txt` 允许公开页面抓取并指向正确 sitemap。
6. 验证 sitemap 不包含 404、API 和 OG 图片端点。
7. 检查 Git diff，确保没有内容文章、路由结构或视觉样式的无关改动。

## 成功标准

- 所有公开 HTML 页面可被 robots 规则抓取。
- 每个可索引页面都有唯一、规范的绝对 canonical URL。
- 404 不进入搜索索引，非内容路由不进入 sitemap。
- 首页、文章页与普通页面均输出完整且一致的核心 SEO 元数据。
- 文章结构化数据通过 JSON 解析并与实际页面信息一致。
- Astro 检查和生产构建通过，且现有页面行为与视觉表现不变。
