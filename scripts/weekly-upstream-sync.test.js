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
});

test("weekly sync lease-protects master and never force-pushes publish", async () => {
	const workflow = await loadWorkflow();
	const masterPush = workflow.split("\n").find((line) => line.includes("refs/heads/master"));
	const publishPush = workflow.split("\n").find((line) => line.includes("HEAD:publish"));
	assert.ok(masterPush?.includes("--force-with-lease"));
	assert.ok(publishPush, "publish push command is required");
	assert.doesNotMatch(publishPush, /--force/);
});

test("weekly sync reports failures without opening duplicate issues", async () => {
	const workflow = await loadWorkflow();
	assert.match(workflow, /Weekly upstream sync failed/);
	assert.match(workflow, /issues\.create/);
	assert.match(workflow, /issues\.createComment/);
	assert.match(workflow, /issues\.update/);
	assert.match(workflow, /state:\s*["']closed["']/);
});
