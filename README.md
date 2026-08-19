# BarrientCursor

A minimal full-stack Todo app used to bootstrap and demonstrate the development
environment. The backend is a small [Express](https://expressjs.com/) API and the
frontend is a static HTML/CSS/JS page served by the same server.

## Requirements

- Node.js >= 20 (developed on Node 22)

## Getting started

```bash
npm ci        # install dependencies (use `npm install` if there is no lockfile yet)
npm run dev   # start the dev server with auto-reload on http://localhost:3000
```

Then open http://localhost:3000 and add a todo.

## Scripts

| Command        | Description                                    |
| -------------- | ---------------------------------------------- |
| `npm start`    | Start the server (`node src/server.js`).       |
| `npm run dev`  | Start the server with `--watch` auto-reload.   |
| `npm test`     | Run the API test suite (`node --test`).        |

## API

| Method   | Path              | Description               |
| -------- | ----------------- | ------------------------- |
| `GET`    | `/api/health`     | Health check.             |
| `GET`    | `/api/todos`      | List all todos.           |
| `POST`   | `/api/todos`      | Create a todo (`{title}`).|
| `PATCH`  | `/api/todos/:id`  | Toggle a todo's done flag.|
| `DELETE` | `/api/todos/:id`  | Delete a todo.            |

Todos are stored in memory, so they reset when the server restarts.

## Configuration

- `PORT` — server port (default `3000`).
- `HOST` — bind address (default `0.0.0.0`).

## Project layout

```
public/        Static frontend (index.html, styles.css, app.js)
src/           Express app (app.js), server entrypoint (server.js), in-memory store (store.js)
test/          API tests (node:test)
.cursor/       Cloud Agent environment configuration
```
