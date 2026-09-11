const { continueWithExpectedAcademy } = require('../../middleware/expectedAcademy');

describe('bridge expected academy guard', () => {
    function response() {
        const res = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
        res.status.mockReturnValue(res); res.json.mockReturnValue(res); return res;
    }
    test('ordinary UI requests keep the existing authentication path', () => {
        const next = jest.fn(), res = response();
        continueWithExpectedAcademy({ headers: {}, user: { academyId: 5 } }, res, next);
        expect(next).toHaveBeenCalledTimes(1); expect(res.setHeader).not.toHaveBeenCalled();
    });
    test('verified academy is acknowledged only when the current user scope matches', () => {
        const next = jest.fn(), res = response();
        continueWithExpectedAcademy({ headers: { 'x-academy-bridge-expected-academy': '5' }, user: { academy_id: 5 } }, res, next);
        expect(next).toHaveBeenCalledTimes(1); expect(res.setHeader).toHaveBeenCalledWith('x-academy-bridge-verified-academy', '5');
    });
    test.each(['7', '0', '5,7', '', ['5'], '9007199254740992'])('rejects mismatched or malformed scope %p', (expected) => {
        const next = jest.fn(), res = response();
        continueWithExpectedAcademy({ headers: { 'x-academy-bridge-expected-academy': expected }, user: { academyId: 5 } }, res, next);
        expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
    });
});
