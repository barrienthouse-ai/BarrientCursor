import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWorkbook, normalizeDailyReport } from './reporting.js';
import { buildReportEmail, isValidEmail, normalizeEmail } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export function createApp(store, options = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  function composeEmail(payload = {}) {
    const report = normalizeDailyReport(payload);
    const snapshot = store.snapshot(report.date);
    const mail = buildReportEmail({
      report,
      monthlyPrior: snapshot.monthlyPrior || {},
      nextBusinessDate: snapshot.nextBusinessDate || report.nextBusinessDate,
      storeName: store.read().config.storeName
    });
    return { report, snapshot, mail };
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'sales-manager-report' });
  });

  app.get('/api/config', (_req, res) => {
    const data = store.read();
    res.json({
      timezone: data.config.timezone,
      submitter: data.config.submitter,
      storeName: data.config.storeName,
      reportEmail: data.config.reportEmail || ''
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
        reportEmail: data.config.reportEmail || ''
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

  app.get('/api/email-preview', (req, res) => {
    try {
      const snapshot = store.snapshot(req.query.date);
      const mail = buildReportEmail({
        report: snapshot.report,
        monthlyPrior: snapshot.monthlyPrior || {},
        nextBusinessDate: snapshot.nextBusinessDate,
        storeName: store.read().config.storeName
      });
      res.type('html').send(mail.html);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/email-report', async (req, res) => {
    try {
      const payload = req.body || {};
      const to = normalizeEmail(payload.to || store.read().config.reportEmail);
      if (payload.to && !isValidEmail(payload.to) && String(payload.to).trim()) {
        res.status(400).json({ error: 'Enter a valid report email address.' });
        return;
      }
      if (to) {
        store.setReportEmail(to);
      }
      const { mail } = composeEmail(payload);
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
          subject: mail.subject,
          html: mail.html,
          message: 'Preview built. Add a report email when you are ready to send.'
        });
        return;
      }
      if (typeof options.sendEmail === 'function') {
        await options.sendEmail(message);
        res.json({ sent: true, to, subject: mail.subject });
        return;
      }
      res.json({
        sent: false,
        preview: true,
        to,
        subject: mail.subject,
        html: mail.html,
        message: 'Preview built. In the live workbook this sends through Gmail once Report email is set on SLM_Config.'
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
