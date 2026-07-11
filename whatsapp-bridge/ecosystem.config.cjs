module.exports = {
  apps: [
    {
      name: 'mbutoms-whatsapp-bridge',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '30s',
      restart_delay: 10000,
      max_memory_restart: '450M',
      kill_timeout: 15000,
      listen_timeout: 120000,
    },
  ],
};
