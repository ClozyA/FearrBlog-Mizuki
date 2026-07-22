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

test("keeps personalized pages and safe upstream synchronization", () => {
	const friends = read("src/data/friends.ts");
	const about = read("src/content/spec/about.md");
	const workflow = read(".github/workflows/sync-upstream.yml");

	assert.match(friends, /ClozyA|fearr/i);
	assert.doesNotMatch(
		about,
		/This website is built with the \*\*Astro\*\* framework/,
	);
	assert.equal(
		workflow.includes("git merge --no-edit upstream/master"),
		true,
	);
	assert.doesNotMatch(
		workflow,
		/reset --hard|push --force origin HEAD:publish/,
	);
});
