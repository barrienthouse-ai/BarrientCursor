import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWorkbook } from './reporting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export function createApp(store) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'service-manager-report' });
  });

  app.get('/api/config', (_req, res) => {
    const data = store.read();
    res.json({
      roster: store.roster(),
      timezone: data.config.timezone,
      submitter: data.config.submitter
    });
  });

  app.get('/api/summary', (req, res) => {
    const date = req.query.date;
    res.json(store.snapshot(date));
  });

  app.get('/api/tech-hours', (req, res) => {
    const { from, to, date } = req.query;
    if (date) {
      res.json({ date, rows: store.recallTechHours(date) });
      return;
    }
    res.json({ rows: store.listTechHours(from, to) });
  });

  app.post('/api/tech-hours', (req, res) => {
    try {
      res.status(201).json(store.saveTechHours(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/gross', (req, res) => {
    const { from, to, period } = req.query;
    res.json({ rows: store.listGross(from, to, period) });
  });

  app.post('/api/gross', (req, res) => {
    try {
      res.status(201).json(store.saveGross(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/heat-cases', (req, res) => {
    res.json({ rows: store.listHeatCases(req.query.status || 'all') });
  });

  app.post('/api/heat-cases', (req, res) => {
    try {
      res.status(201).json(store.addHeatCase(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/heat-cases/:id', (req, res) => {
    try {
      const action = req.body?.action;
      if (!action) {
        res.status(400).json({ error: 'action is required (brief, resolve, or reopen).' });
        return;
      }
      res.json(store.updateHeatCase(req.params.id, action, req.body?.notes || ''));
    } catch (error) {
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.get('/api/repair-orders', (req, res) => {
    const { from, to, date } = req.query;
    if (date) {
      res.json({ date, row: store.recallRepairOrders(date) });
      return;
    }
    res.json({ rows: store.listRepairOrders(from, to) });
  });

  app.post('/api/repair-orders', (req, res) => {
    try {
      res.status(201).json(store.saveRepairOrders(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/daily-report/:date', (req, res) => {
    res.json(store.snapshot(req.params.date));
  });

  app.post('/api/daily-report', (req, res) => {
    try {
      res.status(201).json(store.saveDailyReport(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/compatibility', (_req, res) => {
    res.json(
      auditWorkbook({
        sheetNames: ['HOME', 'SUMMARY', 'SERVICE BOARD', 'SVC_RO', 'SVC_RO_LINES', 'SMR_Dashboard'],
        functionNames: ['onOpen', 'syncHours', 'SMR_onOpen']
      })
    );
  });

  return app;
}
