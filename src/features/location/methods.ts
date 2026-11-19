/**
 * AlAdhan calculation methods (plan §2: the 15-method list taken from
 * salat-time, copied in — not a dependency) plus the
 * `suggestMethod` country → method table from salat-time's
 * `src/utils/calculations.ts`, also copied in per plan §2.
 *
 * Names are the EN/AR strings copied from salat-time's `public/locales`,
 * kept here as data because they label the calculation methods, not the UI
 * chrome, and must stay identical to the copied-in source.
 */

export const CALCULATION_METHOD_IDS = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export type CalculationMethodId = (typeof CALCULATION_METHOD_IDS)[number];

/** Copied-in EN/AR names; keyed by method id. */
export const METHOD_NAMES: Record<CalculationMethodId, { en: string; ar: string }> = {
	1: {
		en: "University of Islamic Sciences, Karachi",
		ar: "جامعة العلوم الإسلامية، كراتشي",
	},
	2: {
		en: "Islamic Society of North America (ISNA)",
		ar: "الجمعية الإسلامية لأمريكا الشمالية (إيسنا)",
	},
	3: {
		en: "Muslim World League (MWL)",
		ar: "رابطة العالم الإسلامي",
	},
	4: {
		en: "Umm Al-Qura University, Makkah",
		ar: "جامعة أم القرى، مكة المكرمة",
	},
	5: {
		en: "Egyptian General Authority of Survey",
		ar: "الهيئة المصرية العامة للمساحة",
	},
	7: {
		en: "Institute of Geophysics, University of Tehran",
		ar: "معهد الجيوفيزياء، جامعة طهران",
	},
	8: { en: "Gulf Region", ar: "منطقة الخليج" },
	9: { en: "Kuwait", ar: "الكويت" },
	10: { en: "Qatar", ar: "قطر" },
	11: {
		en: "Majlis Ugama Islam Singapura, Singapore",
		ar: "مجلس أوقاف إسلام سنغافورة",
	},
	12: {
		en: "Union Organization Islamic de France",
		ar: "الاتحاد الإسلامي في فرنسا",
	},
	13: {
		en: "Diyanet İşleri Başkanlığı, Turkey",
		ar: "رئاسة الشؤون الدينية التركية",
	},
	14: {
		en: "Spiritual Administration of Muslims of Russia",
		ar: "الإدارة الروحية لمسلمي روسيا",
	},
	15: {
		en: "Moonsighting Committee Worldwide",
		ar: "لجنة رؤية الهلال العالمية",
	},
	16: { en: "Dubai (experimental)", ar: "دبي (تجريبي)" },
};

/** Localised display name of a calculation method. */
export function methodName(id: CalculationMethodId, locale: "en" | "ar"): string {
	return METHOD_NAMES[id][locale];
}

/**
 * Suggest a calculation method from the country code
 * (source: salat-time src/utils/calculations.ts, copied in per plan §2).
 */
export function suggestMethod(countryCode: string): CalculationMethodId {
	switch (countryCode.toUpperCase()) {
		case "US":
		case "CA":
			return 2;
		case "SA":
		case "AE":
		case "KW":
		case "QA":
		case "BH":
			return 4;
		case "EG":
		case "LY":
			return 5;
		case "MY":
		case "SG":
		case "ID":
			return 11;
		case "PK":
		case "IN":
		case "BD":
			return 1;
		case "TR":
			return 13;
		case "IR":
			return 7;
		case "FR":
			return 12;
		case "RU":
			return 14;
		default:
			return 3;
	}
}
