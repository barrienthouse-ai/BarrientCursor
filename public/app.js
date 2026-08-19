const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function render(todos) {
  list.innerHTML = "";
  emptyState.classList.toggle("hidden", todos.length > 0);

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = `todo-item${todo.done ? " done" : ""}`;
    li.dataset.id = todo.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggle(todo.id));

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = todo.title;

    const del = document.createElement("button");
    del.type = "button";
    del.setAttribute("aria-label", `Delete ${todo.title}`);
    del.textContent = "\u2715";
    del.addEventListener("click", () => remove(todo.id));

    li.append(checkbox, title, del);
    list.append(li);
  }
}

async function refresh() {
  render(await api("/api/todos"));
}

async function toggle(id) {
  await api(`/api/todos/${id}`, { method: "PATCH" });
  await refresh();
}

async function remove(id) {
  await api(`/api/todos/${id}`, { method: "DELETE" });
  await refresh();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  await api("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  input.value = "";
  input.focus();
  await refresh();
});

refresh().catch((err) => console.error(err));
