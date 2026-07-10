module.exports = {
  apps: [
    {
      name: 'mbutoms-whatsapp-bridge',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
    },
  ],
};
