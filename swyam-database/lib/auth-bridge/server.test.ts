import { describe, expect, it } from "vitest";
import { uuidV5 } from "./server";

describe("uuidV5", () => {
  it("matches the RFC 4122 reference value", async () => {
    // DNS namespace + "www.example.com" (the value every uuid library agrees on)
    expect(await uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("gives one Firebase account the same member id every time, and different accounts different ids", async () => {
    const a = await uuidV5("qTCA3Vwiw5RDZ2BB2Z34IL8iIhF3");
    expect(await uuidV5("qTCA3Vwiw5RDZ2BB2Z34IL8iIhF3")).toBe(a);
    expect(await uuidV5("another-firebase-uid")).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
