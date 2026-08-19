let nextId = 1;
let todos = [];

export function reset() {
  nextId = 1;
  todos = [];
}

export function listTodos() {
  return todos;
}

export function addTodo(title) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    throw new Error("title is required");
  }
  const todo = { id: nextId++, title: trimmed, done: false };
  todos.push(todo);
  return todo;
}

export function toggleTodo(id) {
  const todo = todos.find((t) => t.id === Number(id));
  if (!todo) return null;
  todo.done = !todo.done;
  return todo;
}

export function removeTodo(id) {
  const index = todos.findIndex((t) => t.id === Number(id));
  if (index === -1) return false;
  todos.splice(index, 1);
  return true;
}
