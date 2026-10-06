const crypto = require('crypto');
const { authenticate, query, cursor, mysqlToIso, isoToMysql } = require('../../models/maxEngineSyncPage');
const key = crypto.randomBytes(32).toString('hex');
test('no configured key disables the route; exact key and a direct local socket are required', () => {
  expect(() => authenticate(null, null, '127.0.0.1', {})).toThrow('비활성');
  expect(() => authenticate(key, 'invalid', '127.0.0.1', {})).toThrow('키가 유효');
  expect(() => authenticate(key, key, '203.0.113.1', {})).toThrow('내부 호출');
  expect(() => authenticate(key, key, '127.0.0.1', { 'x-forwarded-for': '127.0.0.1' })).toThrow('내부 호출');
  expect(() => authenticate(key, key, '127.0.0.1', {})).not.toThrow();
});
test('opaque cursor binds ordering, watermark, academy and lower bound; tampering fails', () => {
  const p = { academyId: 2, since: '2026-10-01T00:00:00.000Z', after: { id: 200, updated_at: '2026-10-06 10:00:00' }, watermark: '2026-10-06T01:00:01.000Z' };
  const encoded = cursor(p, key);
  expect(query({ academy_id: '2', updated_since: '2026-10-01T09:00:00+09:00', cursor: encoded }, key)).toEqual(p);
  expect(() => query({ academy_id: '3', updated_since: p.since, cursor: encoded }, key)).toThrow('cursor');
  expect(() => query({ academy_id: '2', cursor: encoded }, key)).toThrow('cursor');
  expect(() => query({ academy_id: '2', updated_since: p.since, cursor: encoded + 'x' }, key)).toThrow('cursor');
});
test('real ISO dates and positive academy ids are validated; MySQL KST times preserve UTC instants', () => {
  for (const input of [{ academy_id: '-1' }, { academy_id: '1', updated_since: '2026-02-30T00:00:00Z' }, { academy_id: '1', limit: '10000' }, { academy_id: '1', updated_since: '2026-10-06' }]) {
    expect(() => query(input, key)).toThrow();
  }
  expect(mysqlToIso('2026-10-06 09:00:00.123')).toBe('2026-10-06T00:00:00.123Z');
  expect(isoToMysql('2026-10-06T00:00:00.123Z')).toBe('2026-10-06 09:00:00.123');
});
