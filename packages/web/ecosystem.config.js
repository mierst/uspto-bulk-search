module.exports = {
  apps: [{
    name: 'uspto-search-web',
    script: 'server/index.js',
    cwd: '/opt/uspto-search/packages/web',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_file: '/opt/uspto-search/packages/web/.env',
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/opt/uspto-search-data/logs/error.log',
    out_file: '/opt/uspto-search-data/logs/out.log',
  }],
};
