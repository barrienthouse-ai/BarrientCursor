import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { reset } from "../src/store.js";

function startServer() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

beforeEach(() => reset());

test("health endpoint reports ok", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    server.close();
  }
});

test("todos start empty", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/todos`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  } finally {
    server.close();
  }
});

test("create, toggle and delete a todo end to end", async () => {
  const { server, base } = await startServer();
  try {
    const created = await fetch(`${base}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "write tests" }),
    });
    assert.equal(created.status, 201);
    const todo = await created.json();
    assert.equal(todo.title, "write tests");
    assert.equal(todo.done, false);

    const toggled = await fetch(`${base}/api/todos/${todo.id}`, {
      method: "PATCH",
    });
    assert.equal(toggled.status, 200);
    assert.equal((await toggled.json()).done, true);

    const deleted = await fetch(`${base}/api/todos/${todo.id}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 204);

    const list = await (await fetch(`${base}/api/todos`)).json();
    assert.deepEqual(list, []);
  } finally {
    server.close();
  }
});

test("rejects empty title", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
