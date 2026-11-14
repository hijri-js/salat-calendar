import { describe, expect, it } from "vitest";

import { identityMinutes } from "../index";

describe("identityMinutes (placeholder)", () => {
  it("returns its argument unchanged", () => {
    expect(identityMinutes(30)).toBe(30);
  });
});
