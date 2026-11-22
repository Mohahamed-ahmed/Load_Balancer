const shutdown = (server, healthCheckInterval) => {
  console.log('Shutting down gracefully...');

  clearInterval(healthCheckInterval);

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  })
}

const registerShutdown = (server, healthCheckInterval) => {
  process.on('SIGINT', () => shutdown(server, healthCheckInterval));
  process.on('SIGTERM', () => shutdown(server, healthCheckInterval));
};

module.exports = { registerShutdown };
