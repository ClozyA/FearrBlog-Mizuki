import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
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
assert.doesNotMatch(sitemap, /\/albums\//);
assert.doesNotMatch(sitemap, /\/anime\//);
assert.doesNotMatch(sitemap, /\/devices\//);
assert.doesNotMatch(sitemap, /\/projects\//);
assert.doesNotMatch(sitemap, /\/skills\//);
assert.doesNotMatch(sitemap, /\/timeline\//);
assert.doesNotMatch(sitemap, /\/ai-tools\//);

const htmlFiles = [];
async function collectHtml(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) await collectHtml(absolute);
		else if (entry.name === "index.html") htmlFiles.push(absolute);
	}
}
await collectHtml(dist);

let contentHtmlCount = 0;
for (const file of htmlFiles) {
	const html = await readFile(file, "utf8");
	if (/<meta http-equiv="refresh"/.test(html)) continue;
	contentHtmlCount++;
	const canonicals = html.match(/<link rel="canonical" href="https:\/\/blog\.fearr\.xyz\/[^"]*"\s*\/?>/g) ?? [];
	assert.equal(canonicals.length, 1, `${file} must have exactly one canonical`);
	const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"\s*\/?>/);
	assert.ok(canonicalMatch, `${file} must expose a canonical URL`);
	const canonicalHref = canonicalMatch[1];
	assert.match(html, /<meta name="description" content="[^"]+"\s*\/?>/);
	assert.match(html, /<meta property="og:url" content="https:\/\/blog\.fearr\.xyz\/[^"]*"\s*\/?>/);
	const socialImageMatch = html.match(
		/<meta property="og:image" content="([^"]+)"\s*\/?>/,
	);
	assert.ok(socialImageMatch, `${file} must have an Open Graph image`);
	const socialImage = new URL(socialImageMatch[1]);
	if (socialImage.origin === "https://blog.fearr.xyz") {
		const relativeImagePath = decodeURIComponent(socialImage.pathname).replace(/^\/+/, "");
		await access(path.join(dist, relativeImagePath));
	}
	const jsonLdBlocks = [
		...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
	].map((match) => JSON.parse(match[1]));
	assert.ok(jsonLdBlocks.length > 0, `${file} must contain valid JSON-LD`);
	if (file.includes(`${path.sep}posts${path.sep}`)) {
		const articleJsonLd = jsonLdBlocks.find(
			(block) => block["@type"] === "BlogPosting",
		);
		assert.ok(articleJsonLd, `${file} must contain BlogPosting JSON-LD`);
		assert.equal(articleJsonLd.url, canonicalHref);
		assert.equal(articleJsonLd.mainEntityOfPage?.["@id"], canonicalHref);
		assert.ok(articleJsonLd.dateModified);
		assert.match(html, /property="article:published_time"/);
		assert.match(html, /property="article:modified_time"/);
	}
}
assert.ok(
	contentHtmlCount > 0,
	"build must contain public HTML content pages",
);

const notFound = await read("404.html");
assert.match(notFound, /<meta name="robots" content="noindex, follow"\s*\/?>/);

console.log(`SEO checks passed for ${contentHtmlCount} public HTML pages.`);
