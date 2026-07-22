import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { syncContent } from "./content-sync.js";

async function createRoot() {
	return mkdtemp(path.join(os.tmpdir(), "mizuki-content-sync-"));
}

async function listFiles(directory, base = directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(entryPath, base)));
		} else {
			files.push(path.relative(base, entryPath).replaceAll("\\", "/"));
		}
	}
	return files.sort();
}

test("content sync is disabled unless explicitly enabled", async () => {
	const rootDir = await createRoot();
	const runGitCalls = [];
	const runGit = async (...args) => runGitCalls.push(args);
	const result = await syncContent({ rootDir, env: {}, runGit });
	assert.equal(result.status, "disabled");
	assert.equal(runGitCalls.length, 0);
});

test("enabled sync rejects a missing repository URL", async () => {
	const rootDir = await createRoot();
	await assert.rejects(
		syncContent({ rootDir, env: { ENABLE_CONTENT_SYNC: "true" }, runGit: async () => {} }),
		/CONTENT_REPO_URL/,
	);
});

test("sync maps only posts and leaves spec data and images untouched", async () => {
	const rootDir = await createRoot();
	const contentDir = path.join(rootDir, "content");
	await mkdir(path.join(contentDir, "posts", "article"), { recursive: true });
	await writeFile(path.join(contentDir, "posts", "article", "index.md"), "article");
	await mkdir(path.join(rootDir, "src", "content", "posts"), { recursive: true });
	await writeFile(path.join(rootDir, "src", "content", "posts", "old.md"), "old");
	await mkdir(path.join(rootDir, "src", "content", "spec"), { recursive: true });
	await writeFile(path.join(rootDir, "src", "content", "spec", "about.md"), "keep");
	await mkdir(path.join(rootDir, "src", "data"), { recursive: true });
	await writeFile(path.join(rootDir, "src", "data", "friends.ts"), "keep");
	await mkdir(path.join(rootDir, "public", "images"), { recursive: true });
	await writeFile(path.join(rootDir, "public", "images", "keep.txt"), "keep");
	const result = await syncContent({
		rootDir,
		env: {
			ENABLE_CONTENT_SYNC: "true",
			CONTENT_REPO_URL: "https://github.com/ClozyA/FearrBlog-Content.git",
			CONTENT_DIR: "./content",
		},
		runGit: async () => {},
		createLink: async () => { throw new Error("junction unavailable"); },
	});
	assert.equal(result.status, "synced");
	assert.deepEqual(await listFiles(path.join(rootDir, "src", "content", "posts")), ["article/index.md"]);
	assert.equal(await readFile(path.join(rootDir, "src", "content", "spec", "about.md"), "utf8"), "keep");
	assert.equal(await readFile(path.join(rootDir, "src", "data", "friends.ts"), "utf8"), "keep");
	assert.equal(await readFile(path.join(rootDir, "public", "images", "keep.txt"), "utf8"), "keep");
});

test("clone failures reject instead of falling back to local posts", async () => {
	const rootDir = await createRoot();
	const runGit = async () => { throw new Error("clone failed"); };
	await assert.rejects(
		syncContent({
			rootDir,
			env: {
				ENABLE_CONTENT_SYNC: "true",
				CONTENT_REPO_URL: "https://github.com/ClozyA/does-not-exist.git",
			},
			runGit,
		}),
		/clone failed/,
	);
});
