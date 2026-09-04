import express from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditWorkbook, toDateKey } from './reporting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'fleet-manager-report' });
  });

  app.get('/sheet-briefing', (req, res) => {
    const date = toDateKey(req.query.date || new Date());
    const snapshot = store.snapshot(date);
    const seed = {
      customers: store.customers(),
      summary: snapshot,
      working: store.listWorkingDeals('all'),
      cached: true
    };
    const html = readFileSync(path.join(__dirname, '..', 'apps-script', 'FLM_App.html'), 'utf8')
      .replace('<?!= seedJson ?>', JSON.stringify(seed).replace(/</g, '\\u003c'));
    res.type('html').send(html);
  });

  app.get('/api/config', (_req, res) => {
    const data = store.read();
    res.json({
      timezone: data.config.timezone,
      submitter: data.config.submitter,
      storeName: data.config.storeName,
      customers: store.customers()
    });
  });

  app.get('/api/summary', (req, res) => {
    res.json(store.snapshot(req.query.date));
  });

  app.get('/api/daily-report/:date', (req, res) => {
    res.json(store.snapshot(req.params.date));
  });

  app.get('/api/history', (req, res) => {
    res.json({ rows: store.listReports(req.query.from, req.query.to) });
  });

  app.get('/api/deal-log', (req, res) => {
    res.json(store.dealHint(req.query.date));
  });

  app.post('/api/fill-from-deal-log', (req, res) => {
    try {
      const date = req.body?.date;
      res.json({
        report: store.fillFromDealLog(date, req.body || {}),
        dealLog: store.dealHint(date)
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/daily-report', (req, res) => {
    try {
      res.status(201).json(store.saveDailyReport(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/goals', (req, res) => {
    const date = req.query.date || req.query.month;
    res.json({ goal: store.recallGoal(date || new Date()) });
  });

  app.post('/api/goals', (req, res) => {
    try {
      const goal = store.saveMonthlyGoal(req.body || {});
      res.status(201).json({ goal, snapshot: store.snapshot(req.body?.date || `${goal.month}-01`) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/working-deals', (req, res) => {
    res.json({ rows: store.listWorkingDeals(req.query.status || 'open') });
  });

  app.post('/api/working-deals', (req, res) => {
    try {
      res.status(201).json(store.addWorkingDeal(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/working-deals/:id', (req, res) => {
    try {
      const action = req.body?.action;
      if (!action) {
        res.status(400).json({ error: 'action is required (sold, deliver, dead, reopen, or update).' });
        return;
      }
      res.json(store.updateWorkingDeal(req.params.id, action, req.body || {}));
    } catch (error) {
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.get('/api/compatibility', (_req, res) => {
    res.json(
      auditWorkbook({
        sheetNames: [
          'HOME',
          'SUMMARY',
          'DEALINPUT',
          'FLEET CUSTOMERS',
          'LOGDEAL',
          'SMR_Dashboard',
          'SLM_Dashboard',
          'FLM_Dashboard'
        ],
        functionNames: ['onOpen', 'logDeal', 'FLM_onOpen']
      })
    );
  });

  return app;
}
