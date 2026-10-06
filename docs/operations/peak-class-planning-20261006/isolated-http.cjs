// Test processes only: ephemeral Express fixtures must not reuse another fixture's sockets.
const http = require('node:http');
const https = require('node:https');
http.globalAgent = new http.Agent({ keepAlive: false });
https.globalAgent = new https.Agent({ keepAlive: false });
