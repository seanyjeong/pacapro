const { signingKey } = require('./maxEngine');

module.exports = {
  signingKey, issuer: 'paca-max-engine', audience: 'max-engine-full',
  scope: 'business:read business:confirmed-write', tokenSeconds: 3600,
  previewSeconds: 600, pageSize: 100,
  dataKey: () => process.env.DATA_ENCRYPTION_KEY,
};
