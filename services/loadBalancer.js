const { getBackends } = require('../config/backends');

let currentBackendIndex = 0;

const getNextHealthyBackend = () => {
  const backends = getBackends();
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

module.exports = { getNextHealthyBackend };
