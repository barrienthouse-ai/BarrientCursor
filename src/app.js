import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addTodo, listTodos, removeTodo, toggleTodo } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/todos", (_req, res) => {
    res.json(listTodos());
  });

  app.post("/api/todos", (req, res) => {
    try {
      const todo = addTodo(req.body?.title);
      res.status(201).json(todo);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/todos/:id", (req, res) => {
    const todo = toggleTodo(req.params.id);
    if (!todo) return res.status(404).json({ error: "not found" });
    res.json(todo);
  });

  app.delete("/api/todos/:id", (req, res) => {
    const removed = removeTodo(req.params.id);
    if (!removed) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  });

  app.use(express.static(join(__dirname, "..", "public")));

  return app;
}
