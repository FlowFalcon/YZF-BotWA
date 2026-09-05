module.exports = {
  apps: [
    {
      name: 'yzf-botwa',
      script: 'dist/app/index.js',
      cwd: __dirname,
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
    },
  ],
}
