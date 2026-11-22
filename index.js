const http = require('node:http');

const { getBackends, setBackends } = require('./config/backends');
const { rateLimiter } = require('./middleware/rateLimiter');
const { checkBackendHealth } = require('./services/healthCheck');
const { getNextHealthyBackend } = require('./services/loadBalancer');
const metrics = require('./services/metrics');
const { proxyRequest } = require('./services/proxy');
const { registerShutdown } = require('./services/shutdown');

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  metrics.requestsTotal++;

  if(req.method === 'GET' && req.url === '/backends'){
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify(getBackends()));
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
      if(getBackends().some(b => b.port === newBackend.port)){
        res.writeHead(400);
        return res.end('Backend with this port already exists');
      }
      if(!newBackend.status){
        newBackend.status = 'healthy';
      }
      getBackends().push(newBackend);
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
    const backend = getBackends().find(b => b.port === port);
    if(!backend){
      res.writeHead(404);
      return res.end('Backend not found');
    }
    const newBackends = getBackends().filter(b => b.port !== port);
    setBackends(newBackends);
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

  if (!rateLimiter(req, res, metrics)) {
    return;
  }

  const backend = getNextHealthyBackend();

  if (!backend) {
    res.writeHead(503);
    return res.end('No healthy backends available');
  }

  proxyRequest(req, res, backend);

});

server.listen(3000);


const healthCheckInterval = setInterval(checkBackendHealth, 5000);

registerShutdown(server, healthCheckInterval);
