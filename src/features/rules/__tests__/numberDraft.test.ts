import { describe, expect, it } from "vitest";

import { commitDraft, liveValue } from "@/features/rules/numberDraft";

const DURATION = { min: 5, max: 180 };
const OFFSET = { min: -180, max: 180 };

describe("liveValue (while typing)", () => {
	it("waits on a prefix below the minimum instead of clamping it", () => {
		// Typing "15" over "20": the "1" must not become 5.
		expect(liveValue("1", DURATION, false)).toBe("skip");
		expect(liveValue("15", DURATION, false)).toBe(15);
	});

	it("waits on a lone minus sign, then accepts the negative number", () => {
		expect(liveValue("-", OFFSET, false)).toBe("skip");
		expect(liveValue("-10", OFFSET, false)).toBe(-10);
	});

	it("waits on out-of-range and fractional values", () => {
		expect(liveValue("181", OFFSET, false)).toBe("skip");
		expect(liveValue("12.5", OFFSET, false)).toBe("skip");
	});

	it("treats empty as 'default' only for optional fields", () => {
		expect(liveValue("", OFFSET, true)).toBeUndefined();
		expect(liveValue("  ", OFFSET, false)).toBe("skip");
	});
});

describe("commitDraft (on blur or Enter)", () => {
	it("clamps and rounds finite numbers", () => {
		expect(commitDraft("1", 20, DURATION, false)).toBe(5);
		expect(commitDraft("999", 20, DURATION, false)).toBe(180);
		expect(commitDraft("12.6", 0, OFFSET, false)).toBe(13);
	});

	it("keeps the previous value for junk", () => {
		expect(commitDraft("-", 15, OFFSET, false)).toBe(15);
		expect(commitDraft("abc", 15, OFFSET, false)).toBe(15);
	});

	it("empties an optional field back to the default, keeps a required one", () => {
		expect(commitDraft("", 30, DURATION, true)).toBeUndefined();
		expect(commitDraft("", 30, DURATION, false)).toBe(30);
	});
});
