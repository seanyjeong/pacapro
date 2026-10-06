const http = require('node:http');
(async () => {
  const ipv4 = http.createServer((_req, res) => res.end('synthetic IPv4'));
  await new Promise(resolve => ipv4.listen(0, '127.0.0.1', resolve));
  const port = ipv4.address().port;
  const wildcard = http.createServer((_req, res) => res.end('synthetic wildcard'));
  const wildcardState = await new Promise(resolve => {
    wildcard.once('error', error => resolve({ error: error.code }));
    wildcard.listen(port, () => resolve({ address: wildcard.address() }));
  });
  const response = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, agent: false }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve(body));
    }).once('error', reject);
  });
  console.log(JSON.stringify({ ipv4: ipv4.address(), wildcard: wildcardState, response }));
  if (wildcard.listening) await new Promise(resolve => wildcard.close(resolve));
  await new Promise(resolve => ipv4.close(resolve));
})().catch(error => { console.error(error); process.exitCode = 1; });
