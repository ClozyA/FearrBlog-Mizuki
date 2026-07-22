import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/sync-upstream.yml", import.meta.url);

async function loadWorkflow() {
	return readFile(workflowUrl, "utf8");
}

test("weekly sync has the approved schedule permissions and runtime", async () => {
	const workflow = await loadWorkflow();
	assert.match(workflow, /cron:\s*["']0 4 \* \* 1["']/);
	assert.match(workflow, /workflow_dispatch:/);
	assert.match(workflow, /contents:\s*write/);
	assert.match(workflow, /issues:\s*write/);
	assert.match(workflow, /node-version:\s*["']22\.14\.0["']/);
});

test("weekly sync validates with the production content repository before pushing", async () => {
	const workflow = await loadWorkflow();
	const commands = [
		"pnpm install --frozen-lockfile",
		"pnpm test",
		"pnpm check",
		"pnpm build",
	];
	let previousIndex = -1;
	for (const command of commands) {
		const commandIndex = workflow.indexOf(command);
		assert.ok(commandIndex > previousIndex, `${command} must appear in order`);
		previousIndex = commandIndex;
	}
	assert.match(workflow, /ENABLE_CONTENT_SYNC:\s*["']true["']/);
	assert.match(workflow, /CONTENT_REPO_URL:\s*https:\/\/github\.com\/ClozyA\/FearrBlog-Content\.git/);
	assert.match(workflow, /CONTENT_DIR:\s*\.\/content/);
	const buildIndex = workflow.indexOf("pnpm build");
	const postBuildTestIndex = workflow.indexOf("pnpm test", buildIndex);
	assert.ok(postBuildTestIndex > buildIndex, "build output tests must run after build");
});

test("weekly sync atomically lease-protects master and never force-pushes publish", async () => {
	const workflow = await loadWorkflow();
	const pushLines = workflow
		.split("\n")
		.filter((line) => line.trimStart().startsWith("git push"));
	assert.equal(pushLines.length, 1, "validated branches must use one push transaction");
	assert.match(pushLines[0], /git push --atomic/);
	assert.match(workflow, /UPSTREAM_SHA:refs\/heads\/master/);
	assert.match(workflow, /HEAD:refs\/heads\/publish/);
	assert.match(
		workflow,
		/--force-with-lease=refs\/heads\/master:\$ORIGIN_MASTER_SHA/,
	);
	assert.doesNotMatch(
		workflow,
		/--force-with-lease=refs\/heads\/publish|--force origin HEAD:refs\/heads\/publish/,
	);
});

test("weekly sync reports failures without opening duplicate issues", async () => {
	const workflow = await loadWorkflow();
	assert.match(workflow, /Weekly upstream sync failed/);
	assert.match(workflow, /issues\.create/);
	assert.match(workflow, /issues\.createComment/);
	assert.match(workflow, /issues\.update/);
	assert.match(workflow, /state:\s*["']closed["']/);
});