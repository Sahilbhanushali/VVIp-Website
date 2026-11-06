/**
 * PM2 process file for /var/www/projects/vvip
 *
 *   cd /var/www/projects/vvip
 *   pm2 start deploy/ecosystem.config.cjs && pm2 save
 *
 * Port 4380 is reserved for this site (the other projects on the server use their own ports).
 * If you ever change it, change it here AND in deploy/nginx/vapisvip.com.conf (upstream).
 *
 * One instance is recommended: login/form rate limits are kept per process.
 */
const path = require('node:path');
const APP_DIR = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'vvip',
      cwd: APP_DIR,
      script: 'dist/server/entry.mjs',
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      // PM2 env wins over .env, so the port/host can never collide with another project by accident.
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4380' },
      out_file: path.join(APP_DIR, 'logs/web.out.log'),
      error_file: path.join(APP_DIR, 'logs/web.err.log'),
      time: true,
    },
  ],
};
