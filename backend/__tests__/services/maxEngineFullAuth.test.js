jest.mock('../../repositories/maxEngineRepository', () => ({
  userByEmail: jest.fn(), userById: jest.fn(), academyById: jest.fn(),
}));
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repo = require('../../repositories/maxEngineRepository');
const auth = require('../../services/maxEngineFullAuth');

let user;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.MAX_ENGINE_LINK_SECRET = crypto.randomBytes(48).toString('hex');
  user = { id: 1, academy_id: 2, role: 'owner', is_active: 1,
    approval_status: 'approved', password_hash: bcrypt.hashSync('synthetic-password', 4) };
  repo.userByEmail.mockResolvedValue(user);
  repo.userById.mockResolvedValue(user);
  repo.academyById.mockResolvedValue({ id: 2, name: 'Synthetic academy' });
});

test.each([undefined, 'mcp'])('delegation purpose %s issues a 30-day signed token with unchanged scope', async purpose => {
  const issued = await auth.login('synthetic@example.invalid', 'synthetic-password', { purpose });
  const claims = jwt.verify(issued.access_token, process.env.MAX_ENGINE_LINK_SECRET,
    { algorithms: ['HS256'], issuer: 'paca-max-engine', audience: 'max-engine-full' });
  expect(issued.expires_in).toBe(2592000);
  expect(claims.exp - claims.iat).toBe(2592000);
  expect(claims.scope).toBe('business:read business:confirmed-write');
  expect(await auth.authenticate('Bearer ' + issued.access_token))
    .toEqual({ user_id: 1, academy_id: 2, expires_at: claims.exp, role: 'owner', permissions: {} });
});

test('staff connects and carries the current PACA staff permissions; other roles get a specific reason', async () => {
  const perms = { students: { view: true, edit: false } };
  repo.userByEmail.mockResolvedValue({ ...user, role: 'staff', permissions: JSON.stringify(perms) });
  const issued = await auth.login('synthetic@example.invalid', 'synthetic-password', { purpose: 'mcp' });
  repo.userById.mockResolvedValue({ ...user, role: 'staff', permissions: JSON.stringify(perms) });
  expect(await auth.authenticate('Bearer ' + issued.access_token)).toEqual(expect.objectContaining({ role: 'staff', permissions: perms }));
  repo.userByEmail.mockResolvedValue({ ...user, role: 'teacher' });
  await expect(auth.login('synthetic@example.invalid', 'synthetic-password')).rejects.toThrow('원장·관리자·직원');
  repo.userByEmail.mockResolvedValue({ ...user, approval_status: 'pending' });
  await expect(auth.login('synthetic@example.invalid', 'synthetic-password')).rejects.toThrow('승인되지 않은');
});

test.each([
  ['is_active', 0], ['approval_status', 'pending'], ['role', 'teacher'],
  ['academy_id', 3], ['password_hash', 'changed'],
])('30-day token fails immediately after account %s changes', async (field, value) => {
  const issued = await auth.login('synthetic@example.invalid', 'synthetic-password');
  repo.userById.mockResolvedValue({ ...user, [field]: value });
  await expect(auth.authenticate('Bearer ' + issued.access_token)).rejects.toThrow();
});
