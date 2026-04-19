// PM2 process list for Franchise Ready Hub
// Start all:   pm2 start deploy/ecosystem.config.cjs
// Restart all: pm2 restart all
// Logs:        pm2 logs
// Status:      pm2 status

const APP_DIR = '/home/ubuntu/franchise-ready-hub';

module.exports = {
  apps: [
    // ── NestJS HTTP API ──────────────────────────────────────────────
    {
      name: 'nestjs-api',
      cwd: `${APP_DIR}/backend`,
      script: 'node',
      args: 'dist/main',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },

    // ── NestJS BullMQ Workers ─────────────────────────────────────────
    // Workers are standalone Node scripts — they don't use NestJS ConfigModule.
    // -r dotenv/config loads backend/.env automatically (cwd is backend/).
    {
      name: 'worker-calendly',
      cwd: `${APP_DIR}/backend`,
      script: 'node',
      args: '-r dotenv/config dist/calendly/calendly-reminders.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'worker-calendar',
      cwd: `${APP_DIR}/backend`,
      script: 'node',
      args: '-r dotenv/config dist/calendar/calendar-reminders.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'worker-voice',
      cwd: `${APP_DIR}/backend`,
      script: 'node',
      args: '-r dotenv/config dist/voice/voice-fallback.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'worker-documents',
      cwd: `${APP_DIR}/backend`,
      script: 'node',
      args: '-r dotenv/config dist/documents/document-generation.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'worker-proposal',
      cwd: `${APP_DIR}/backend`,
      script: 'node',
      args: '-r dotenv/config dist/documents/proposal-followup.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },

    // ── Next.js CRM ───────────────────────────────────────────────────
    {
      name: 'nextjs-crm',
      cwd: `${APP_DIR}/crm`,
      script: 'node_modules/.bin/next',
      args: 'start --port 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },

    // ── CRM BullMQ Worker ─────────────────────────────────────────────
    {
      name: 'worker-sequence',
      cwd: `${APP_DIR}/crm`,
      script: 'node_modules/.bin/tsx',
      args: 'lib/queues/workers/sequence.worker.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },

    // ── Flask Bot ─────────────────────────────────────────────────────
    {
      name: 'freddy-bot',
      cwd: `${APP_DIR}/freddy_bot`,
      script: '.venv/bin/gunicorn',
      args: '-w 2 app:app -b 0.0.0.0:5001',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { PYTHONUNBUFFERED: '1' },
    },
  ],
};
