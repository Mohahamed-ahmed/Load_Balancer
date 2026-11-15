const http = require('node:http');

let backends = [
  { port: 3001, status: 'healthy' },
  { port: 3002, status: 'healthy' },
  { port: 3003, status: 'healthy' },
];

let currentBackendIndex = 0;

const getNextHealthyBackend = () => {
  let checked = 0;

  while (checked < backends.length) {
    const backend = backends[currentBackendIndex];

    currentBackendIndex = (currentBackendIndex + 1) % backends.length;

    if (backend.status === 'healthy') {
      return backend;
    }

    checked++;
  }

  return null;
};

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

    proxyRequest(req, res, nextBackend);
  });

  req.pipe(proxy);
};

const checkBackendHealth = () => {
  for (const backend of backends) {
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

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  const backend = getNextHealthyBackend();

  if (!backend) {
    res.writeHead(503);
    return res.end('No healthy backends available');
  }

  proxyRequest(req, res, backend);
});

server.listen(3000);

setInterval(checkBackendHealth, 5000);