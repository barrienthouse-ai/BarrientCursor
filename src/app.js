import express from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditWorkbook, toDateKey } from './reporting.js';
import { buildReportEmail, isValidEmail, normalizeEmail } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export function createApp(store, options = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  function composeEmailFromSnapshot(snapshot) {
    return buildReportEmail({
      snapshot,
      storeName: store.read().config.storeName
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'parts-manager-report' });
  });

  app.get('/sheet-briefing', (req, res) => {
    const date = toDateKey(req.query.date || new Date());
    const snapshot = store.snapshot(date);
    const data = store.read();
    const seed = {
      summary: snapshot,
      lostSales: data.lostSales,
      sopItems: data.sopItems,
      backorders: data.backorders,
      cores: data.cores,
      cached: true
    };
    const html = readFileSync(path.join(__dirname, '..', 'apps-script', 'PMR_App.html'), 'utf8')
      .replace('var SEED = null;', 'var SEED = ' + JSON.stringify(seed).replace(/</g, '\\u003c') + ';');
    res.type('html').send(html);
  });

  app.get('/api/config', (_req, res) => {
    const data = store.read();
    res.json({
      timezone: data.config.timezone,
      submitter: data.config.submitter,
      storeName: data.config.storeName,
      reportEmail: data.config.reportEmail || '',
      capitalLimit: data.config.capitalLimit,
      rimTargetPercent: data.config.rimTargetPercent
    });
  });

  app.put('/api/config', (req, res) => {
    try {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'reportEmail')) {
        const email = String(req.body.reportEmail || '').trim();
        if (email && !isValidEmail(email)) {
          res.status(400).json({ error: 'Enter a valid report email address.' });
          return;
        }
        store.setReportEmail(email);
      }
      const data = store.read();
      res.json({
        timezone: data.config.timezone,
        submitter: data.config.submitter,
        storeName: data.config.storeName,
        reportEmail: data.config.reportEmail || '',
        capitalLimit: data.config.capitalLimit,
        rimTargetPercent: data.config.rimTargetPercent
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
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

  app.post('/api/daily-report', (req, res) => {
    try {
      res.status(201).json(store.saveDailyReport(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  function listHandler(listFn) {
    return (req, res) => {
      res.json({ rows: listFn.call(store, req.query.status || 'all') });
    };
  }

  function addHandler(addFn) {
    return (req, res) => {
      try {
        res.status(201).json(addFn.call(store, req.body || {}));
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    };
  }

  function patchHandler(updateFn) {
    return (req, res) => {
      try {
        const action = req.body?.action;
        if (!action) {
          res.status(400).json({ error: 'action is required.' });
          return;
        }
        res.json(updateFn.call(store, req.params.id, action, req.body?.notes || ''));
      } catch (error) {
        const status = error.message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: error.message });
      }
    };
  }

  app.get('/api/lost-sales', listHandler(store.listLostSales));
  app.post('/api/lost-sales', addHandler(store.addLostSale));
  app.patch('/api/lost-sales/:id', patchHandler(store.updateLostSale));

  app.get('/api/sop', listHandler(store.listSop));
  app.post('/api/sop', addHandler(store.addSop));
  app.patch('/api/sop/:id', patchHandler(store.updateSop));

  app.get('/api/backorders', listHandler(store.listBackorders));
  app.post('/api/backorders', addHandler(store.addBackorder));
  app.patch('/api/backorders/:id', patchHandler(store.updateBackorder));

  app.get('/api/cores', listHandler(store.listCores));
  app.post('/api/cores', addHandler(store.addCore));
  app.patch('/api/cores/:id', patchHandler(store.updateCore));

  app.get('/api/email-preview', (req, res) => {
    try {
      const snapshot = store.snapshot(req.query.date);
      const mail = composeEmailFromSnapshot(snapshot);
      res.type('html').send(mail.html);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/email-report', async (req, res) => {
    try {
      const payload = req.body || {};
      const rawTo = String(payload.to || '').trim();
      if (rawTo && !isValidEmail(rawTo)) {
        res.status(400).json({ error: 'Enter a valid report email address.' });
        return;
      }
      const to = normalizeEmail(rawTo || store.read().config.reportEmail);
      if (to) {
        store.setReportEmail(to);
      }
      const snapshot = store.saveDailyReport(payload);
      const mail = composeEmailFromSnapshot(snapshot);
      const message = {
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text
      };
      if (!to) {
        res.json({
          sent: false,
          preview: true,
          needsEmail: true,
          saved: true,
          snapshot,
          subject: mail.subject,
          html: mail.html,
          message: 'Saved. Preview built. Add a report email when you are ready to send.'
        });
        return;
      }
      if (typeof options.sendEmail === 'function') {
        await options.sendEmail(message);
        res.json({ sent: true, saved: true, snapshot, to, subject: mail.subject });
        return;
      }
      res.json({
        sent: false,
        preview: true,
        saved: true,
        snapshot,
        to,
        subject: mail.subject,
        html: mail.html,
        message: 'Saved. Preview built. In the live workbook this sends through Gmail once Report email is set on PMR_Config.'
      });
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
          'SERVICE BOARD',
          'PARTS_ITEMS',
          'PARTS_TICKETS',
          'SVC_PARTS_REQUESTS',
          'SMR_Dashboard',
          'SLM_Dashboard',
          'FLM_Dashboard',
          'PMR_Dashboard'
        ],
        functionNames: ['onOpen', 'SMR_onOpen', 'SLM_onOpen', 'FLM_onOpen', 'PMR_onOpen']
      })
    );
  });

  return app;
}
