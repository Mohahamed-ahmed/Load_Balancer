const http = require('node:http');
const { getNextHealthyBackend } = require('./loadBalancer');
const metrics = require('./metrics');

const proxyRequest = (req, res, backend) => {
  const options = {
    hostname: 'localhost',
    port: backend.port,
    path: req.url,
    method: req.method,
  };

  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);

    backendRes.pipe(res);
  });

  proxy.on('error', () => {
    backend.status = 'unhealthy';

    const nextBackend = getNextHealthyBackend();

    if (!nextBackend) {
      res.writeHead(503);
      res.end('No healthy backends available');
      return;
    }
    metrics.backendFailuresTotal++;
    metrics.retriesTotal++;
    proxyRequest(req, res, nextBackend);
  });

  req.pipe(proxy);
};

module.exports = { proxyRequest };
