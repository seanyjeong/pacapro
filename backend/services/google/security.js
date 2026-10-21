const crypto = require('crypto');
const { config } = require('../../config/google');
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function seal(value, academyId) {
    const key = config().encryptionKey;
    if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('GOOGLE_CONFIG');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    cipher.setAAD(Buffer.from(String(academyId)));
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64url')).join('.');
}
function unseal(value, academyId) {
    const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64url'));
    const cipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config().encryptionKey, 'hex'), iv);
    cipher.setAAD(Buffer.from(String(academyId)));
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
module.exports = { hash, seal, unseal };
