const http = require('node:http');
const { getBackends } = require('../config/backends');

const checkBackendHealth = () => {
  for (const backend of getBackends()) {
    const healthReq = http.request(
      {
        hostname: 'localhost',
        port: backend.port,
        method: 'GET',
      },
      (healthRes) => {
        backend.status =
          healthRes.statusCode === 200 ? 'healthy' : 'unhealthy';
      }
    );

    healthReq.on('error', () => {
      backend.status = 'unhealthy';
    });

    healthReq.end();
  }
};

module.exports = { checkBackendHealth };
