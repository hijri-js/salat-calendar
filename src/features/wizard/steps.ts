/** The six wizard steps, in display order (plan §6). */
export const WIZARD_STEPS = [
	"place",
	"prayers",
	"timing",
	"calendar",
	"preview",
	"getIt",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
