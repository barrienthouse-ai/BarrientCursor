import { spawn } from "node:child_process";

const PORT = 9344;
let browserSocket = null;
let nextId = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debuggerVersion() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
  if (!response.ok) throw new Error(`Chrome debugger returned ${response.status}`);
  return response.json();
}

export async function ensureChrome() {
  try {
    return await debuggerVersion();
  } catch {
    spawn(
      "google-chrome",
      [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        `--user-data-dir=/tmp/chrome-pricing`,
        `--remote-debugging-port=${PORT}`,
        "--window-size=1280,800",
        "about:blank",
      ],
      {
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ":1" },
        detached: true,
        stdio: "ignore",
      },
    ).unref();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(500);
      try {
        return await debuggerVersion();
      } catch {
        // Chrome is still starting.
      }
    }
    throw new Error("Chrome did not start");
  }
}

async function browserClient() {
  if (browserSocket && browserSocket.readyState === 1) return browserSocket;
  const version = await ensureChrome();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("Chrome debugger connection failed")), { once: true });
  });
  browserSocket = ws;
  return ws;
}

function send(ws, method, params = {}, sessionId, timeoutMs = 45000) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", onMessage);
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolve(message.result);
    }
    ws.addEventListener("message", onMessage);
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
  });
}

export async function withPage(run) {
  const ws = await browserClient();
  const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send(ws, "Target.attachToTarget", { targetId, flatten: true });
  await send(ws, "Page.enable", {}, sessionId);
  await send(ws, "Runtime.enable", {}, sessionId);
  try {
    return await run({
      navigate: (url) => send(ws, "Page.navigate", { url }, sessionId),
      evaluate: async (expression, timeoutMs = 180000) => {
        const result = await send(
          ws,
          "Runtime.evaluate",
          { expression, awaitPromise: true, returnByValue: true },
          sessionId,
          timeoutMs,
        );
        if (result.exceptionDetails) {
          const text = result.exceptionDetails.text || "Page script failed";
          throw new Error(text);
        }
        return result.result?.value;
      },
    });
  } finally {
    await send(ws, "Target.closeTarget", { targetId }).catch(() => {});
  }
}
