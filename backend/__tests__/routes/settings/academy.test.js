jest.mock('../../../config/database', () => ({
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 5, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/settings/academy')(router);
    app.use('/paca/settings', router);
    return app;
}

beforeEach(() => {
    db.query.mockReset();
});

describe('settings academy route', () => {
    test('GET: 설정이 없으면 시즌비가 월납부를 대체하는 기본 정책을 반환', async () => {
        db.query
            .mockResolvedValueOnce([[{
                id: 5,
                name: 'PACA 일산',
                phone: '031',
                address: '고양',
                business_number: '123',
            }]])
            .mockResolvedValueOnce([[]]);

        const res = await request(makeApp()).get('/paca/settings/academy');

        expect(res.status).toBe(200);
        expect(res.body.settings.season_monthly_policy).toBe('season_replaces_monthly');
        expect(res.body.settings.season_fees.exam_regular).toBe(0);
    });

    test('GET: 저장된 시즌 월납부 정책을 반환', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 5, name: 'PACA 강남', phone: '', address: '', business_number: '' }]])
            .mockResolvedValueOnce([[{
                tuition_due_day: 7,
                settings: JSON.stringify({
                    season_fees: { exam_early: 1, exam_regular: 2, civil_service: 3 },
                    season_monthly_policy: 'season_plus_monthly',
                }),
            }]]);

        const res = await request(makeApp()).get('/paca/settings/academy');

        expect(res.status).toBe(200);
        expect(res.body.settings.tuition_due_day).toBe(7);
        expect(res.body.settings.season_monthly_policy).toBe('season_plus_monthly');
    });

    test('PUT: 시즌 월납부 정책을 settings JSON에 보존해 저장', async () => {
        db.query
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{
                id: 11,
                settings: JSON.stringify({ keep: true, season_monthly_policy: 'season_replaces_monthly' }),
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 5, name: 'PACA', phone: '', address: '', business_number: '' }]])
            .mockResolvedValueOnce([[{
                tuition_due_day: 5,
                settings: JSON.stringify({
                    keep: true,
                    season_monthly_policy: 'season_plus_monthly',
                    season_fees: { exam_early: 1, exam_regular: 2, civil_service: 3 },
                }),
            }]]);

        const res = await request(makeApp())
            .put('/paca/settings/academy')
            .send({
                academy_name: 'PACA',
                season_fees: { exam_early: 1, exam_regular: 2, civil_service: 3 },
                season_monthly_policy: 'season_plus_monthly',
            });

        expect(res.status).toBe(200);
        const updateSettingsCall = db.query.mock.calls.find((call) => call[0].includes('UPDATE academy_settings SET settings'));
        const savedSettings = JSON.parse(updateSettingsCall[1][0]);
        expect(savedSettings.keep).toBe(true);
        expect(savedSettings.season_monthly_policy).toBe('season_plus_monthly');
        expect(res.body.settings.season_monthly_policy).toBe('season_plus_monthly');
    });

    test('PUT: 잘못된 시즌 월납부 정책은 400', async () => {
        const res = await request(makeApp())
            .put('/paca/settings/academy')
            .send({ season_monthly_policy: 'invalid' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('시즌 월납부 처리 방식을 확인해주세요.');
        expect(db.query).not.toHaveBeenCalled();
    });
});
