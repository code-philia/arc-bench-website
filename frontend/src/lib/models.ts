export const MODEL_OPTIONS = [
  "gpt-5.5",
  "gpt-5.6",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "kimi-k3",
] as const;

export type ModelName = (typeof MODEL_OPTIONS)[number];

export const DEFAULT_MODEL_NAME: ModelName = "gpt-5.6";
