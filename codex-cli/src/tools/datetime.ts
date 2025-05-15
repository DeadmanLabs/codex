/**
 * Definition of the built-in datetime tool for Codex CLI.
 */
export const tools = [
  {
    type: "function",
    name: "datetime",
    description: "Returns the current date and time.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          description: "Optional date format (ignored—returns ISO string).",
        },
      },
      additionalProperties: false,
    },
  },
];