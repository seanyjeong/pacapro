jest.mock('../../../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/students/classDays')(router);
    app.use('/paca/students', router);
    return app;
}

beforeEach(() => {
    db.query.mockReset();
});

describe('students class-days routes', () => {
    test('GET /class-days normalizes legacy numeric class_days with student time_slot', async () => {
        db.query.mockResolvedValueOnce([[
            {
                id: 9143,
                name: '백종환',
                grade: '고3',
                class_days: '[1,4,6]',
                weekly_count: 3,
                time_slot: 'evening',
                class_days_next: null,
                class_days_effective_from: null,
            },
        ]]);

        const res = await request(makeApp()).get('/paca/students/class-days');

        expect(res.status).toBe(200);
        expect(res.body.students[0].class_days).toEqual([
            { day: 1, timeSlot: 'evening' },
            { day: 4, timeSlot: 'evening' },
            { day: 6, timeSlot: 'evening' },
        ]);
    });

    test('PUT /:id/class-days scheduled change stores normalized class_days_next', async () => {
        db.query
            .mockResolvedValueOnce([[
                {
                    id: 9143,
                    class_days: '[1,4,6]',
                    time_slot: 'afternoon',
                    student_type: 'exam',
                },
            ]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(makeApp())
            .put('/paca/students/9143/class-days')
            .send({ class_days: [0, 3], effective_from: '2999-06-01' });

        expect(res.status).toBe(200);
        expect(res.body.mode).toBe('scheduled');
        const updateCall = db.query.mock.calls.find(([sql]) => /SET class_days_next/.test(sql));
        expect(updateCall).toBeDefined();
        expect(JSON.parse(updateCall[1][0])).toEqual([
            { day: 0, timeSlot: 'afternoon' },
            { day: 3, timeSlot: 'afternoon' },
        ]);
    });
});
