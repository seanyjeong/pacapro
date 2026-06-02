const {
  createPeakSsoCode,
  hashPeakSsoCode,
} = require('../../utils/peakSso');

describe('peak SSO code utility', () => {
  test('creates a one-time code without storing the raw value', async () => {
    const db = { query: jest.fn().mockResolvedValue([{}]) };

    const result = await createPeakSsoCode(db, {
      id: 10,
      academyId: 5,
    });

    expect(result.code).toMatch(/^[a-f0-9]{64}$/);
    expect(result.codeHash).toBe(hashPeakSsoCode(result.code));
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO peak_sso_codes'),
      [result.codeHash, 10, 5]
    );
    expect(JSON.stringify(db.query.mock.calls)).not.toContain(result.code);
  });

  test('requires a logged-in academy user', async () => {
    await expect(createPeakSsoCode({ query: jest.fn() }, { id: 10 }))
      .rejects.toThrow('PACA_USER_REQUIRED');
  });
});
