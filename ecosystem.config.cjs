/**
 * pm2 process definition. One instance only: zapo enforces a single writer per
 * store, and two connections make Meta evict each other with `stream:error
 * replaced`.
 *
 * Restarts are the reconnection strategy — zapo does not auto-reconnect by
 * design. The backoff and restart cap exist so a logged-out session (which can
 * never succeed without re-pairing) stops instead of hammering the server.
 */
module.exports = {
  apps: [
    {
      name: 'zapo-fun-bot',
      script: 'dist/index.js',
      cwd: '/root/zapo-fun-bot',
      // --env-file is the only way this project loads .env (no dotenv dependency).
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      exp_backoff_restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      kill_timeout: 10000,
      time: false,
      merge_logs: true,
      out_file: '/root/.pm2/logs/zapo-fun-bot-out.log',
      error_file: '/root/.pm2/logs/zapo-fun-bot-error.log',
    },
  ],
}
