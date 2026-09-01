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
    res.json({ ok: true, service: 'sales-manager-report' });
  });

  app.get('/api/config', (_req, res) => {
    const data = store.read();
    res.json({
      timezone: data.config.timezone,
      submitter: data.config.submitter,
      storeName: data.config.storeName
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
    const date = req.query.date;
    res.json(store.dealHint(date));
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

  app.get('/api/compatibility', (_req, res) => {
    res.json(
      auditWorkbook({
        sheetNames: [
          'HOME',
          'SUMMARY',
          'DEALINPUT',
          'LOGDEAL',
          'MANAGER',
          'SMR_Dashboard',
          'SLM_Dashboard'
        ],
        functionNames: ['onOpen', 'logDeal', 'SLM_onOpen']
      })
    );
  });

  return app;
}
