// Test process only: each synthetic HTTP fixture gets a new port for loopback requests.
const http = require('node:http');
const https = require('node:https');
http.globalAgent = new http.Agent({ keepAlive: false });
https.globalAgent = new https.Agent({ keepAlive: false });
const originalListen = http.Server.prototype.listen;
let nextPort = Number(process.env.TEST_HTTP_FIRST_PORT || 41000);
const reservedPorts = new Set((process.env.TEST_HTTP_RESERVED_PORTS || '').split(',').filter(Boolean).map(Number));
const fixtureFamilies = new Map();
const originalRequest = http.request;
http.request = function (options, ...args) {
  // macOS permits a wildcard IPv6 listener beside an IPv4 listener on the same port.
  // Match the actual fixture's address family rather than reaching another IPv4 service.
  if (options && typeof options === 'object' && options.host === '127.0.0.1' &&
      fixtureFamilies.get(Number(options.port)) === 'IPv6') options = { ...options, host: '::1' };
  return originalRequest.call(this, options, ...args);
};
if (!Number.isSafeInteger(nextPort) || nextPort < 10000 || nextPort > 60000) {
  throw new Error('TEST_HTTP_FIRST_PORT must be an isolated test port from 10000 through 60000');
}
http.Server.prototype.listen = function (...args) {
  while (reservedPorts.has(nextPort)) nextPort++;
  if (args[0] === 0) {
    if (nextPort > 65535) throw new Error('Isolated HTTP test port range exhausted');
    args[0] = nextPort++;
    // Preserve listen's overload: supertest expects address() synchronously.
  } else if (args[0] && typeof args[0] === 'object' && args[0].port === 0) {
    if (nextPort > 65535) throw new Error('Isolated HTTP test port range exhausted');
    args[0] = { ...args[0], port: nextPort++ };
  }
  const result = originalListen.apply(this, args);
  const address = this.address();
  if (address && typeof address === 'object') fixtureFamilies.set(address.port, address.family);
  return result;
};
