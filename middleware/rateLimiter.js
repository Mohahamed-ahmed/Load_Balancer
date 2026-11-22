const { log } = require('../logger');

const buckets = new Map();

const rateLimiter = (req, res, metrics) => {
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
    res.end('Too many requests');
    return false;
  }

  bucket.tokens--;
  log('Rate Limiting', { ip, tokens: bucket.tokens, message: 'Request processed' });
  
  log('Rate Limiting', { ip, tokens: bucket.tokens, message: 'Backend selected' });

  return true;
};

module.exports = { rateLimiter };
