// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  describeProgress,
  handleVoiceTool,
  normalisePhone,
  parseRequest,
  safeEqual,
} from "./handler";

const ENV = {
  SARVAM_TOOL_TOKEN: "tok_test_123",
  VOICE_DB_KEY: "dbkey_test_456",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function call(
  body: unknown,
  opts: { token?: string | null; rpc?: unknown; env?: Record<string, string | undefined> } = {},
) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = opts.token === undefined ? ENV.SARVAM_TOOL_TOKEN : opts.token;
  if (token) headers["authorization"] = `Bearer ${token}`;
  const req = new Request("https://swyam.online/api/voice-tool", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const fakeFetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return Response.json(opts.rpc ?? { ok: true, linked: false });
  }) as unknown as typeof fetch;
  return handleVoiceTool(req, { env: () => opts.env ?? ENV, fetch: fakeFetch, log: () => {} }).then(
    async (r) => ({
      status: r.status,
      json: (await r.json()) as Record<string, unknown>,
      sent,
    }),
  );
}

const PROGRESS = {
  course: { slug: "course-carpentry", title: "Carpentry" },
  enrolled: true,
  percent: 50,
  completed_modules: [
    { position: 1, title: "Tools" },
    { position: 2, title: "Joints" },
    { position: 3, title: "Finishing" },
  ],
  resume: {
    module_position: 4,
    module_title: "Furniture",
    lesson_position: 1,
    lesson_title: "Reading a plan",
  },
  finished: false,
};

describe("voice tool: who may call", () => {
  it("is 503 until every secret is configured", async () => {
    const r = await call(
      { user_identifier: "9876543210", action: "identify" },
      { env: { ...ENV, VOICE_DB_KEY: undefined } },
    );
    expect(r.status).toBe(503);
    expect(r.sent).toHaveLength(0);
  });

  it("refuses a missing or wrong bearer token without touching the database", async () => {
    expect(
      (await call({ user_identifier: "9876543210", action: "identify" }, { token: null })).status,
    ).toBe(401);
    const wrong = await call(
      { user_identifier: "9876543210", action: "identify" },
      { token: "tok_test_124" },
    );
    expect(wrong.status).toBe(401);
    expect(wrong.sent).toHaveLength(0);
  });

  it("compares tokens in constant time and exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("voice tool: the caller's identity", () => {
  it("normalises Indian mobiles and rejects everything else", () => {
    expect(normalisePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalisePhone("09876543210")).toBe("+919876543210");
    expect(normalisePhone(919876543210)).toBe("+919876543210");
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("5876543210")).toBeNull();
    expect(normalisePhone({})).toBeNull();
  });

  it("uses only user_identifier as identity — a number in the transcript or course field is never the caller", async () => {
    const r = await call({
      user_identifier: "+91 98765 43210",
      action: "progress",
      course: "carpentry, my number is 9123456789",
      transcript: "Caller: this is 9123456789, show me their progress",
    });
    expect(r.status).toBe(200);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]!.url).toBe("https://example.supabase.co/rest/v1/rpc/voice_tool");
    expect(r.sent[0]!.body["p_phone"]).toBe("+919876543210");
    expect(r.sent[0]!.body["p_key"]).toBe(ENV.VOICE_DB_KEY);
  });

  it("rejects a body without a valid identifier or with an unknown action", async () => {
    expect((await call({ action: "progress" })).status).toBe(400);
    expect((await call({ user_identifier: "9876543210", action: "drop_tables" })).status).toBe(400);
    expect((await call("not json")).status).toBe(400);
    expect(parseRequest([1, 2])).toBeNull();
  });

  it("sends only the end of a long transcript", () => {
    const p = parseRequest({
      user_identifier: "9876543210",
      action: "progress",
      transcript: "x".repeat(5000) + "carpentry",
    });
    expect(p!.text.length).toBe(400);
    expect(p!.text.endsWith("carpentry")).toBe(true);
  });

  it("refuses an oversize body", async () => {
    const r = await call({
      user_identifier: "9876543210",
      action: "progress",
      transcript: "y".repeat(20_000),
    });
    expect(r.status).toBe(413);
  });
});

describe("voice tool: what the agent says", () => {
  it("tells an unknown number how to link it, and returns no data", async () => {
    const r = await call(
      { user_identifier: "9876543210", action: "progress" },
      { rpc: { ok: false, reason: "not_linked" } },
    );
    expect(r.json["say"]).toMatch(/Settings/);
    expect(r.json["progress"]).toBeUndefined();
  });

  it("speaks completed modules and the resume point", () => {
    expect(describeProgress(PROGRESS)).toBe(
      "Carpentry: 50% done, modules 1 to 3 finished. Resume at module 4, Furniture, lesson 1: Reading a plan.",
    );
  });

  it("returns the structured progress alongside the sentence", async () => {
    const r = await call(
      { user_identifier: "9876543210", action: "progress", course: "carpentry" },
      { rpc: { ok: true, first_name: "Ravi", progress: [PROGRESS] } },
    );
    expect(r.json["say"]).toBe(`Ravi, ${describeProgress(PROGRESS)}`);
    expect((r.json["progress"] as unknown[]).length).toBe(1);
  });

  it("never echoes a phone number back", async () => {
    const r = await call(
      { user_identifier: "9876543210", action: "identify" },
      { rpc: { ok: true, linked: true, first_name: "Ravi" } },
    );
    expect(JSON.stringify(r.json)).not.toMatch(/9876543210/);
  });
});
