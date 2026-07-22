import { execFile } from "node:child_process";
import {
	access,
	cp,
	lstat,
	mkdir,
	rename,
	rm,
	symlink,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function exists(targetPath) {
	try {
		await access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function defaultRunGit(args, cwd) {
	await execFileAsync("git", args, { cwd });
}

async function defaultCreateLink(sourcePath, destinationPath) {
	const relativeSource = path.relative(path.dirname(destinationPath), sourcePath);
	await symlink(relativeSource, destinationPath, "junction");
}

export async function syncContent({
	rootDir,
	env = process.env,
	runGit = defaultRunGit,
	createLink = defaultCreateLink,
}) {
	if (env.ENABLE_CONTENT_SYNC !== "true") {
		return { status: "disabled" };
	}

	const repositoryUrl = env.CONTENT_REPO_URL?.trim();
	if (!repositoryUrl) {
		throw new Error("CONTENT_REPO_URL is required when content sync is enabled");
	}

	const configuredContentDir = env.CONTENT_DIR?.trim() || "./content";
	const contentDir = path.isAbsolute(configuredContentDir)
		? configuredContentDir
		: path.resolve(rootDir, configuredContentDir);

	if (!(await exists(contentDir))) {
		await runGit(["clone", "--depth", "1", repositoryUrl, contentDir], rootDir);
	} else if (await exists(path.join(contentDir, ".git"))) {
		await runGit(["pull", "--ff-only"], contentDir);
	}

	const sourcePosts = path.join(contentDir, "posts");
	if (!(await exists(sourcePosts))) {
		throw new Error(`Content repository does not contain posts/: ${sourcePosts}`);
	}

	const destinationPosts = path.join(rootDir, "src", "content", "posts");
	const backupPosts = `${destinationPosts}.backup`;
	await mkdir(path.dirname(destinationPosts), { recursive: true });

	if (await exists(destinationPosts)) {
		const destinationStats = await lstat(destinationPosts);
		if (destinationStats.isSymbolicLink()) {
			await rm(destinationPosts, { force: true });
		} else {
			await rm(backupPosts, { recursive: true, force: true });
			await rename(destinationPosts, backupPosts);
		}
	}

	try {
		await createLink(sourcePosts, destinationPosts);
	} catch {
		await cp(sourcePosts, destinationPosts, { recursive: true });
	}

	return { status: "synced", contentDir, destinationPosts };
}
