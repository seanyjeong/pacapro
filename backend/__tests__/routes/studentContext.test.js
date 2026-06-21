jest.mock('../../config/database', () => ({
  execute: jest.fn(),
}));

jest.mock('../../config/peak-database', () => ({
  execute: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 2, id: 100, role: 'owner' };
    next();
  }),
}));

jest.mock('../../utils/encryption', () => ({
  decrypt: jest.fn((value) => String(value).replace(/^enc:/, '')),
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../config/database');
const peakPool = require('../../config/peak-database');
const studentContextRouter = require('../../routes/studentContext');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/student-context', studentContextRouter);
  return app;
}

beforeEach(() => {
  pool.execute.mockReset();
  peakPool.execute.mockReset();
});

describe('GET /paca/student-context', () => {
  test('학생 검색어로 수업 요일과 최근 출석 컨텍스트를 반환한다', async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 7,
          name: 'enc:이서하',
          school: '행신고',
          grade: '고3',
          gender: 'female',
          status: 'active',
          class_days: JSON.stringify([{ day: 0, timeSlot: 'afternoon' }]),
          time_slot: 'evening',
        },
      ]])
      .mockResolvedValueOnce([[
        { class_date: '2026-05-24', time_slot: 'afternoon', attendance_status: 'present', notes: '' },
      ]]);
    peakPool.execute
      .mockResolvedValueOnce([[{ id: 77, paca_student_id: 7, status: 'active' }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(makeApp())
      .get('/paca/student-context')
      .query({ q: '서하', today: '2026-05-27', period_days: '14' });

    expect(res.status).toBe(200);
    expect(res.body.student).toMatchObject({ paca_student_id: 7, peak_student_id: 77, name: '이서하' });
    expect(res.body.schedule[0]).toMatchObject({ weekday: '일', time_slot_label: '오후반' });
    expect(res.body.message).toContain('이서하 수업 요일');
    expect(pool.execute.mock.calls[1][1]).toEqual([2, 7, '2026-05-14', '2026-05-27']);
  });

  test('부분검색이 여러 학생과 매칭되면 임의 선택하지 않는다', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, name: 'enc:김서하', school: 'A고', grade: '고2', status: 'active' },
      { id: 2, name: 'enc:이서하', school: 'B고', grade: '고3', status: 'active' },
    ]]);

    const res = await request(makeApp())
      .get('/paca/student-context')
      .query({ q: '서하', today: '2026-05-27' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('여러 명');
    expect(res.body.candidates.map((student) => student.name)).toEqual(['김서하', '이서하']);
    expect(peakPool.execute).not.toHaveBeenCalled();
  });
});
