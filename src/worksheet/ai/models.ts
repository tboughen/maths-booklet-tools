/** Claude models offered first. Prices are US dollars per million tokens (input, output, cache read). */
export const claudeModels = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best)", price: [4, 20, 0.2] },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, cheaper)", price: [2, 10, 0.1] },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest, cheapest)", price: [0.1, 0.5, 0.01] },
] as const;
