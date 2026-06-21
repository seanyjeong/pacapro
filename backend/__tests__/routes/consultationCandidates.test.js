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
  decrypt: jest.fn((value) => `dec:${value}`),
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../config/database');
const peakPool = require('../../config/peak-database');
const consultationCandidatesRouter = require('../../routes/consultationCandidates');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/consultation-candidates', consultationCandidatesRouter);
  return app;
}

beforeEach(() => {
  pool.execute.mockReset();
  peakPool.execute.mockReset();
});

describe('GET /paca/consultation-candidates', () => {
  test('PACA 학생 id와 Peak paca_student_id를 매핑해 후보를 반환한다', async () => {
    pool.execute
      .mockResolvedValueOnce([[
        { id: 10, name: '홍길동', school: '일산고', grade: '고2', status: 'active' },
      ]])
      .mockResolvedValueOnce([[
        { student_id: 10, class_date: '2026-05-20', time_slot: 'evening', attendance_status: 'absent', notes: '' },
        { student_id: 10, class_date: '2026-05-22', time_slot: 'evening', attendance_status: 'absent', notes: '' },
      ]]);
    peakPool.execute
      .mockResolvedValueOnce([[
        { id: 900, paca_student_id: 10, status: 'active' },
      ]])
      .mockResolvedValueOnce([[
        ...recordSet(900, 1, '제자리멀리뛰기', [250, 246, 242, 239, 235]),
        ...recordSet(900, 2, '메디신볼', [8.0, 8.0, 8.0, 8.0, 8.0]),
      ]]);

    const res = await request(makeApp())
      .get('/paca/consultation-candidates?today=2026-05-27&attendance_days=14&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('상담 후보 1명');
    expect(res.body.candidates[0].student).toMatchObject({
      paca_student_id: 10,
      peak_student_id: 900,
      name: 'dec:홍길동',
    });
    expect(pool.execute.mock.calls[1][1]).toEqual([2, '2026-05-14', '2026-05-27']);
    expect(peakPool.execute.mock.calls[1][1]).toEqual([2, '2026-05-27']);
  });

  test('today 형식이 틀리면 한국어 검증 메시지를 반환한다', async () => {
    const res = await request(makeApp()).get('/paca/consultation-candidates?today=bad');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('today는 YYYY-MM-DD 형식이어야 합니다.');
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test('DB 오류는 사용자용 한국어 메시지로 감싼다', async () => {
    pool.execute.mockRejectedValueOnce(new Error('db down'));

    const res = await request(makeApp()).get('/paca/consultation-candidates?today=2026-05-27');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('상담 후보 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  });
});

function recordSet(peakStudentId, recordTypeId, name, values) {
  return values.map((value, index) => ({
    id: recordTypeId * 100 + index,
    peak_student_id: peakStudentId,
    paca_student_id: 10,
    record_type_id: recordTypeId,
    record_type_name: name,
    direction: 'higher',
    unit: recordTypeId === 1 ? 'cm' : 'm',
    measured_at: `2026-05-${String(1 + index).padStart(2, '0')}`,
    value,
  }));
}
