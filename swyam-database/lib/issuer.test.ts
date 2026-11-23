// @vitest-environment node
import { describe, expect, it } from "vitest";
import { issuerName } from "./issuer";

describe("certificate issuer", () => {
  it("replaces the project's old name and a missing value", () => {
    for (const v of ["SkillSwap", "skillswap", "Skill Swap", " SkillSwap ", null, undefined, ""])
      expect(issuerName(v)).toBe("स्वYAM");
  });
  it("keeps a real institute's name", () => {
    expect(issuerName("NSTI Delhi")).toBe("NSTI Delhi");
  });
});
