/** Backwards-compatible entry point; shares the one approved AI-Coach preflight. */
import { runDeploymentPreflight } from "./verify-deployment-config.mjs";

process.exitCode = runDeploymentPreflight(["--target=staging"]);
