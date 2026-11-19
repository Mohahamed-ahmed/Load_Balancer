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

const buckets = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

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
      const newBackend = JSON.parse(body);
      backends.push(newBackend);
      if(!newBackend.port){
        res.writeHead(400);
        return res.end('Port is required');
      }
      if(backends.some(b => b.port === newBackend.port)){
        res.writeHead(400);
        return res.end('Backend with this port already exists');
      }
      if(typeof newBackend.port !== 'number'){
        res.writeHead(400);
        return res.end('Port must be a number');
      }
      if(!newBackend.status){
        newBackend.status = 'healthy';
      }
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
  console.log('time'+timeSinceLastRefill);

  if(timeSinceLastRefill >= 1000){
    let tokensToAdd = Math.floor(timeSinceLastRefill / 1000);
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, 10);
    bucket.lastRefill += tokensToAdd * 1000
     console.log({
    tokens: bucket.tokens,
    tokensToAdd,
    lastRefill: bucket.lastRefill,
    now,
  });
  }

  console.log(`Tokens count for ${ip}: ${bucket.tokens}`);

  
  if (bucket.tokens === 0) {
    console.log("Before request", bucket.tokens);
    res.writeHead(429);
    return res.end('Too many requests');
  }

  bucket.tokens--;
  console.log("After request", bucket.tokens);
  
  console.log(buckets)
  console.log(buckets.get(ip))

  const backend = getNextHealthyBackend();

  if (!backend) {
    res.writeHead(503);
    return res.end('No healthy backends available');
  }

  proxyRequest(req, res, backend);
});

server.listen(3000);

setInterval(checkBackendHealth, 5000);