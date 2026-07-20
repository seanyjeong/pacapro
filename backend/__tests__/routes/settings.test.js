const express = require('express');
const request = require('supertest');

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getConnection: jest.fn(),
}));
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => {
        req.user = { id: 1, academyId: 26, role: 'owner' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
    checkPermission: () => (req, res, next) => next(),
}));
jest.mock('../../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

const db = require('../../config/database');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/settings', require('../../routes/settings'));
    return app;
}

describe('PUT /paca/settings', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('수업 없음 값을 정상 수업시간 설정으로 저장한다', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 9 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[
                {
                    academy_id: 26,
                    morning_class_time: '-',
                    afternoon_class_time: '-',
                    evening_class_time: '-',
                },
            ]]);

        const response = await request(buildApp())
            .put('/paca/settings')
            .send({
                morning_class_time: '-',
                afternoon_class_time: '-',
                evening_class_time: '-',
            });

        expect(response.status).toBe(200);
        expect(response.body.settings).toMatchObject({
            morning_class_time: '-',
            afternoon_class_time: '-',
            evening_class_time: '-',
        });
        expect(db.query.mock.calls[1]).toEqual([
            expect.stringContaining('UPDATE academy_settings SET'),
            ['-', '-', '-', 26],
        ]);
    });

    test.each([
        ['morning_class_time', '오전'],
        ['afternoon_class_time', '오후'],
        ['evening_class_time', '저녁'],
    ])('잘못된 %s 값은 %s 수업시간을 확인하도록 안내한다', async (field, label) => {
        const response = await request(buildApp())
            .put('/paca/settings')
            .send({ [field]: '시간 미정' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            `${label} 수업시간을 다시 선택해주세요. 수업이 없으면 "수업 없음"을 선택할 수 있습니다.`
        );
        expect(db.query).not.toHaveBeenCalled();
    });
});
