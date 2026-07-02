/**
 * settings.js — GET /paca/settings/academy 회귀 테스트
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => {
        req.user = { id: 1, academyId: 3, role: 'owner' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
    checkPermission: () => (req, res, next) => next()
}));
jest.mock('../../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const db = require('../../config/database');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/settings', require('../../routes/settings'));
    return app;
}

describe('GET /paca/settings/academy', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('온보딩에서 저장된 숫자 키 학원비를 설정 화면용 weekly_N 키로 반환한다', async () => {
        db.query
            .mockResolvedValueOnce([[
                { id: 3, name: '테스트학원', phone: null, address: null, business_number: null }
            ]])
            .mockResolvedValueOnce([[
                {
                    tuition_due_day: 5,
                    settings: JSON.stringify({
                        exam_tuition: { '1': 110000, '2': 220000 },
                        adult_tuition: { '1': 90000, weekly_2: 180000 },
                        season_fees: { exam_regular: 650000 }
                    })
                }
            ]]);

        const res = await request(buildApp()).get('/paca/settings/academy');

        expect(res.status).toBe(200);
        expect(res.body.settings.exam_tuition).toMatchObject({
            weekly_1: 110000,
            weekly_2: 220000
        });
        expect(res.body.settings.adult_tuition).toMatchObject({
            weekly_1: 90000,
            weekly_2: 180000
        });
        expect(res.body.settings.season_fees).toMatchObject({
            exam_early: 0,
            exam_regular: 650000,
            civil_service: 0
        });
        expect(res.body.settings.exam_tuition).not.toHaveProperty('1');
    });
});

describe('PUT /paca/settings/academy', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('저장 시 숫자 키 학원비도 weekly_N 키로 정규화해 DB에 저장한다', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 1, settings: JSON.stringify({}) }]])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[
                { id: 3, name: '테스트학원', phone: null, address: null, business_number: null }
            ]])
            .mockResolvedValueOnce([[
                {
                    tuition_due_day: 5,
                    settings: JSON.stringify({
                        exam_tuition: { weekly_1: 120000 },
                        adult_tuition: { weekly_1: 90000 },
                        season_fees: { exam_early: 0, exam_regular: 0, civil_service: 0 }
                    })
                }
            ]]);

        const res = await request(buildApp())
            .put('/paca/settings/academy')
            .send({
                exam_tuition: { '1': 120000 },
                adult_tuition: { '1': 90000 },
                season_fees: {}
            });

        const updateCall = db.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE academy_settings SET'));
        const savedSettings = JSON.parse(updateCall[1][0]);

        expect(res.status).toBe(200);
        expect(savedSettings.exam_tuition).toMatchObject({ weekly_1: 120000 });
        expect(savedSettings.exam_tuition).not.toHaveProperty('1');
        expect(res.body.message).toBe('학원 설정이 저장되었습니다.');
    });
});
