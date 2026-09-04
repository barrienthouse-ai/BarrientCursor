import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataPath = path.join(__dirname, '..', 'data', 'store.json');
const dataPath = process.env.FLM_DATA_PATH || defaultDataPath;
const port = Number(process.env.PORT || 3000);

const store = createStore(dataPath);
const app = createApp(store);

if (process.env.FLM_SKIP_LISTEN !== '1') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Fleet Manager Report listening on http://localhost:${port}`);
  });
}

export { app, store };
