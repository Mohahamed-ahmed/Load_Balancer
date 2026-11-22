# Node.js Load Balancer

A simple HTTP load balancer built with Node.js built-in modules. The project demonstrates round-robin load balancing, automatic health checks, retry logic, rate limiting, Prometheus-compatible metrics, and graceful shutdown without using external frameworks.

## Features

- Round Robin load balancing
- Automatic backend health checks (every 5 seconds)
- Automatic retry using another healthy backend
- Token Bucket rate limiting
- Prometheus-compatible metrics endpoint
- Graceful shutdown (`SIGINT` / `SIGTERM`)
- Structured JSON logging
- Dynamic backend management API
- Zero external runtime dependencies

---

## Requirements

- Node.js 18+ (or any recent LTS version)

No external runtime dependencies are required.

---

## Run the Demo

Start the demo backend servers in separate terminals:

```bash
node backend/server1.js
node backend/server2.js
node backend/server3.js
```

Start the load balancer:

```bash
npm start
```

The load balancer listens on **port 3000**.

The demo backend servers listen on:

- Backend 1 → `3001`
- Backend 2 → `3002`
- Backend 3 → `3003`

---

## API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| Any | Any other path | Forward the request to the next healthy backend |
| GET | `/backends` | List configured backends and their health status |
| POST | `/backends` | Add a backend (`{"port":3004}`) |
| DELETE | `/backends/:port` | Remove a backend |
| GET | `/metrics` | Expose Prometheus-compatible metrics |

---

## Rate Limiting

The load balancer uses the **Token Bucket** algorithm.

- Capacity: **10 tokens**
- Refill rate: **1 token/second**
- Each request consumes one token
- Requests are rejected with **HTTP 429** when no tokens remain

---

## Health Checks

Every **5 seconds** the load balancer checks all configured backends.

If a backend fails a health check or a proxied request

- it is marked as **unhealthy**
- new requests are skipped
- failed requests are automatically retried using another healthy backend (when available)

---

## Metrics

The `/metrics` endpoint exposes Prometheus-compatible metrics in plain text.

Current metrics:

- `requests_total`
- `retries_total`
- `rate_limited_total`
- `backend_failures_total`

---

## Project Structure

```text
Load_Balancer/
├── backend/               # Demo backend servers
├── config/                # Backend configuration
├── middleware/            # Rate limiter
├── services/              # Health checks, metrics, proxy, shutdown, load balancing
├── index.js               # Application bootstrap and route wiring
├── logger.js              # Structured JSON logger
└── package.json
```

---

## Notes

This project intentionally implements several features manually for learning purposes.

- The Prometheus-compatible metrics endpoint is implemented without using packages such as `prom-client`, in order to understand the Prometheus text exposition format.
- The project also includes a lightweight custom structured logger instead of using logging libraries such as **Pino** or **Winston**.
- In production applications, mature libraries would typically be preferred for logging and metrics.

---

## Graceful Shutdown

The load balancer listens for `SIGINT` and `SIGTERM` signals.

When shutting down, it:

- Stops the health check scheduler
- Stops accepting new connections
- Waits for active requests to finish
- Exits cleanly

You can test this by pressing:

```text
Ctrl + C
```
