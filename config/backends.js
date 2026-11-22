let backends = [
  { port: 3001, status: 'healthy' },
  { port: 3002, status: 'healthy' },
  { port: 3003, status: 'healthy' },
];

const getBackends = () => backends;

const setBackends = (newBackends) => {
  backends = newBackends;
};

module.exports = { getBackends, setBackends };
