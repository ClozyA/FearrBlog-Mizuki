import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncContent } from "./content-sync.js";
import { loadEnv } from "./load-env.js";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");

loadEnv();

try {
	const result = await syncContent({ rootDir });
	if (result.status === "disabled") {
		console.log("Content sync is disabled; using repository content.");
	} else {
		console.log(`Content synced from ${result.contentDir}`);
	}
} catch (error) {
	console.error(`Content sync failed: ${error.message}`);
	process.exitCode = 1;
}
