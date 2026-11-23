import { describe, it, expect, beforeEach } from "vitest";
import { getItem, setItem, removeItem } from "./store";

beforeEach(() => {
  localStorage.clear();
});

describe("store", () => {
  it("round-trips an object", () => {
    const value = { name: "Asha", points: 42, tags: ["a", "b"] };
    setItem("profile", value);
    expect(getItem("profile", null)).toEqual(value);
  });

  it("returns the fallback for a missing key", () => {
    expect(getItem("missing", "fb")).toBe("fb");
  });

  it("returns the fallback for invalid JSON", () => {
    localStorage.setItem("swyam.bad", "{not json");
    expect(getItem("bad", "fb")).toBe("fb");
  });

  it("removeItem makes getItem return the fallback", () => {
    setItem("temp", 123);
    removeItem("temp");
    expect(getItem("temp", "fb")).toBe("fb");
  });
});
