import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Cross-feature import guard (plan §7): files inside one feature folder may
 * not reach into another feature's internals. Importing another feature's
 * public index (the bare folder path, e.g. "@/features/wizard") is allowed.
 *
 * The generated pattern is any path ending in "<other>/<file>": it matches
 * imports that go into another feature's internals (alias or relative, at
 * any depth) while leaving the bare folder path alone.
 */
const features = ["wizard", "location", "rules", "preview", "ics-export"];

const crossFeatureGuards = features.map((feature) => ({
	files: [`src/features/${feature}/**`],
	rules: {
		"no-restricted-imports": [
			"error",
			{
				patterns: features
					.filter((other) => other !== feature)
					.map((other) => ({
						group: [`**/${other}/*`],
						message: `Cross-feature imports must go through the public index of @/features/${other}, not its internals.`,
					})),
			},
		],
	},
}));

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	...crossFeatureGuards,
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		".next/**",
		"out/**",
		"build/**",
		"next-env.d.ts",
		// Test and coverage artifacts:
		"coverage/**",
	]),
]);

export default eslintConfig;
