/**
 * Public surface of the wizard feature: the shared config store and the
 * step contract. Other features (location, rules, preview) may import this
 * index but never wizard internals — the wizard shell in `wizard.tsx` is
 * wired by `src/app/[locale]/page.tsx` directly.
 */
export {
	defaultConfig,
	selectEnabledPrayers,
	selectPlaceSet,
	useWizardConfig,
	type WizardState,
} from "./configStore";
export { MAX_KEYWORD_LENGTH, MAX_KEYWORDS, MAX_LABEL_LENGTH } from "./savedSettings";
export { WIZARD_STEPS, type WizardStep } from "./steps";
