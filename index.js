const http = require('node:http');

const {log} = require('./logger');

let backends = [
  { port: 3001, status: 'healthy' },
  { port: 3002, status: 'healthy' },
  { port: 3003, status: 'healthy' },
];

const metrics = {
  requestsTotal: 0,
  retriesTotal: 0,
  rateLimitedTotal: 0,
  backendFailuresTotal: 0,
};

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
    metrics.backendFailuresTotal++;
    metrics.retriesTotal++;
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

const buckets = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  metrics.requestsTotal++;

  if(req.method === 'GET' && req.url === '/backends'){
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify(backends));
  }

  if(req.method === 'POST' && req.url === '/backends'){
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      let newBackend;

      try{
        newBackend = JSON.parse(body);
      }
      catch(e){
        res.writeHead(400);
        return res.end('Invalid JSON');
      }
      
      if(newBackend.port === undefined){
        res.writeHead(400);
        return res.end('Port is required');
      }
      if(typeof newBackend.port !== 'number'){
        res.writeHead(400);
        return res.end('Port must be a number');
      }
      if(backends.some(b => b.port === newBackend.port)){
        res.writeHead(400);
        return res.end('Backend with this port already exists');
      }
      if(!newBackend.status){
        newBackend.status = 'healthy';
      }
      backends.push(newBackend);
      res.writeHead(201, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify(newBackend));
    });
  }

  if(req.method === 'DELETE' && req.url.startsWith('/backends/')){
    const port = parseInt(req.url.split('/')[2]);
    if(Number.isNaN(port)){
      res.writeHead(400);
      return res.end('Port must be a number');
    }
    const backend = backends.find(b => b.port === port);
    if(!backend){
      res.writeHead(404);
      return res.end('Backend not found');
    }
    const newBackends = backends.filter(b => b.port !== port);
    backends = newBackends;
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify({ message: 'Backend deleted' }));
  }

  if(req.method === 'GET' && req.url === '/metrics'){
    const metricsText =`
      # HELP requests_total Total requests
      # TYPE requests_total counter
      requests_total ${metrics.requestsTotal}

      # HELP retries_total Total retries
      # TYPE retries_total counter
      retries_total ${metrics.retriesTotal}

      # HELP rate_limited_total Rate limited requests
      # TYPE rate_limited_total counter
      rate_limited_total ${metrics.rateLimitedTotal}

      # HELP backend_failures_total Backend failures
      # TYPE backend_failures_total counter
      backend_failures_total ${metrics.backendFailuresTotal}
  `;
    res.writeHead(200, {'Content-Type': 'text/plain'});

    return res.end(metricsText);
  }

  const ip = req.socket.remoteAddress;
  if(!buckets.has(ip)){
    buckets.set(ip,{
      tokens: 10,
      lastRefill: Date.now()
    })
  }

  const bucket = buckets.get(ip);
  const now = Date.now();
  const timeSinceLastRefill = now - bucket.lastRefill;
  log('Rate Limiting', {
    ip,
    tokens: bucket.tokens,
    timeSinceLastRefill
  });

  if(timeSinceLastRefill >= 1000){
    let tokensToAdd = Math.floor(timeSinceLastRefill / 1000);
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, 10);
    bucket.lastRefill += tokensToAdd * 1000
     log('Rate Limiting',{
    tokens: bucket.tokens,
    tokensToAdd,
    lastRefill: bucket.lastRefill,
    now,
  });
  }

  log('Rate Limiting', {
    ip,
    tokens: bucket.tokens,
    timeSinceLastRefill
  });
  
  if (bucket.tokens === 0) {
    log('Rate Limiting', { ip, tokens: bucket.tokens, message: 'Too many requests' });
    metrics.rateLimitedTotal++;
    res.writeHead(429);
    return res.end('Too many requests');
  }

  bucket.tokens--;
  log('Rate Limiting', { ip, tokens: bucket.tokens, message: 'Request processed' });
  
  log('Rate Limiting', { ip, tokens: bucket.tokens, message: 'Backend selected' });

  const backend = getNextHealthyBackend();

  if (!backend) {
    res.writeHead(503);
    return res.end('No healthy backends available');
  }

  proxyRequest(req, res, backend);

});

server.listen(3000);


const healthCheckInterval = setInterval(checkBackendHealth, 5000);

const shutdown = () => {
  console.log('Shutting down gracefully...');

  clearInterval(healthCheckInterval);

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  })
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);