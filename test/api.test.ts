import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createApp } from "../src/app";
import { createSeededStore } from "../src/store";

const now = new Date("2026-11-01T10:00:00+09:00");
let server: Server;
let base: string;

beforeEach(async () => {
  server = createApp(createSeededStore(now), () => now);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function apply(seminarId: string, body: unknown) {
  return fetch(`${base}/api/seminars/${seminarId}/registrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("画面のHTMLを返す", async () => {
  const response = await fetch(`${base}/`);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("セミナー申込受付");
});

test("セミナー一覧に残席と受付状態が付く", async () => {
  const seminars = await (await fetch(`${base}/api/seminars`)).json();
  expect(seminars).toHaveLength(4);
  expect(seminars[1]).toMatchObject({ id: "s2", capacity: 3, remaining: 1, open: true });
  expect(seminars[3]).toMatchObject({ id: "s4", open: false });
});

test("申込を受け付けると一覧に載り、残席が減る", async () => {
  const response = await apply("s1", { name: "山田 太郎", email: "taro@example.com" });
  expect(response.status).toBe(201);
  const registrations = await (await fetch(`${base}/api/registrations`)).json();
  expect(registrations.some((entry: { email: string }) => entry.email === "taro@example.com")).toBe(true);
  const seminars = await (await fetch(`${base}/api/seminars`)).json();
  expect(seminars[0].remaining).toBe(29);
});

test("入力の不備は400、受付できない状態は409で理由を返す", async () => {
  const invalid = await apply("s1", { name: "山田 太郎", email: "not-an-email" });
  expect(invalid.status).toBe(400);
  expect((await invalid.json()).reason).toBe("invalid_email");
  const closed = await apply("s4", { name: "山田 太郎", email: "taro@example.com" });
  expect(closed.status).toBe(409);
  expect((await closed.json()).reason).toBe("deadline_passed");
});

test("存在しないセミナーや壊れたJSONを拒否する", async () => {
  expect((await apply("nope", { name: "a", email: "a@example.com" })).status).toBe(404);
  const broken = await fetch(`${base}/api/seminars/s1/registrations`, { method: "POST", body: "{" });
  expect(broken.status).toBe(400);
});

test("キャンセルすると返金額を返し、一覧から消える", async () => {
  const early = await fetch(`${base}/api/registrations/r1`, { method: "DELETE" });
  expect(await early.json()).toEqual({ refund: 11500 });
  const late = await fetch(`${base}/api/registrations/r3`, { method: "DELETE" });
  expect(await late.json()).toEqual({ refund: 0 });
  expect(await (await fetch(`${base}/api/registrations`)).json()).toHaveLength(1);
  expect((await fetch(`${base}/api/registrations/r1`, { method: "DELETE" })).status).toBe(404);
});
