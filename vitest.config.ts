import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		coverage: {
			provider: "v8",
			// The 100% threshold applies to the pure engine only (plan §10, PR 3).
			include: ["src/lib/prayer-engine/**"],
			thresholds: {
				lines: 100,
				branches: 100,
				functions: 100,
				statements: 100,
			},
		},
	},
});
