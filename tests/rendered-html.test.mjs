import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the paymentrader campaign dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>paymentrader｜支付優惠情報<\/title>/i);
  assert.match(html, /有效活動總覽/);
  assert.match(html, /平台分類/);
  assert.match(html, /個人專區/);
  assert.match(html, /歷史軌跡/);
});

test("server-renders sign-in and password recovery routes", async () => {
  const signIn = await render("/auth/sign-in?callbackURL=%2Faccount");
  const forgotPassword = await render("/auth/forgot-password");
  const resetPassword = await render("/auth/reset-password?token=test-token");

  assert.equal(signIn.status, 200);
  assert.match(await signIn.text(), /以 Google 繼續/);

  assert.equal(forgotPassword.status, 200);
  assert.match(await forgotPassword.text(), /找回你的帳號/);

  assert.equal(resetPassword.status, 200);
  assert.match(await resetPassword.text(), /設定新密碼/);
});
