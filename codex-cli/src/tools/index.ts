/**
 * Registry of all function-style tools available to the Codex CLI.
 */
import { tools as shellTools } from "./shell.js";
import { tools as datetimeTools } from "./datetime.js";

// TODO: import additional tools here as they are added, e.g.:
// import { tools as datetimeTools } from "./datetime.js";

/** Complete list of tool definitions to be exposed to the OpenAI API. */
export const ALL_TOOLS = [
  ...shellTools,
  ...datetimeTools,
];