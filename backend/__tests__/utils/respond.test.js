const { respondSuccess, respondError } = require('../../utils/respond');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('respondSuccess', () => {
  test('data만 있을 때 status 200 + { data }', () => {
    const res = mockRes();
    respondSuccess(res, { id: 1, name: '홍길동' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { id: 1, name: '홍길동' } });
  });

  test('배열 data도 정상 처리', () => {
    const res = mockRes();
    respondSuccess(res, [1, 2, 3]);
    expect(res.json).toHaveBeenCalledWith({ data: [1, 2, 3] });
  });

  test('meta 있으면 meta도 포함', () => {
    const res = mockRes();
    respondSuccess(res, [1], { count: 1, page: 1 });
    expect(res.json).toHaveBeenCalledWith({
      data: [1],
      meta: { count: 1, page: 1 },
    });
  });

  test('meta가 빈 객체면 meta 키 자체를 추가하지 않음', () => {
    const res = mockRes();
    respondSuccess(res, [1], {});
    expect(res.json).toHaveBeenCalledWith({ data: [1] });
  });

  test('커스텀 status 적용 (예: 201 Created)', () => {
    const res = mockRes();
    respondSuccess(res, { id: 1 }, undefined, 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('data가 null 이어도 동작 (의도적 명시)', () => {
    const res = mockRes();
    respondSuccess(res, null);
    expect(res.json).toHaveBeenCalledWith({ data: null });
  });
});

describe('respondError', () => {
  test('기본 에러 응답 { error: { code, message } }', () => {
    const res = mockRes();
    respondError(res, 400, 'VALIDATION_ERROR', '입력값이 올바르지 않습니다.');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값이 올바르지 않습니다.',
      },
    });
  });

  test('details 옵션 포함 가능', () => {
    const res = mockRes();
    respondError(res, 422, 'INVALID_FIELD', '학생 이름이 필요합니다.', {
      field: 'name',
    });
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_FIELD',
        message: '학생 이름이 필요합니다.',
        details: { field: 'name' },
      },
    });
  });

  test('details가 null/undefined면 details 키 미포함', () => {
    const res = mockRes();
    respondError(res, 500, 'DB_ERROR', '데이터를 불러오지 못했습니다.');
    const call = res.json.mock.calls[0][0];
    expect(call.error).not.toHaveProperty('details');
  });

  test('한국어 메시지 그대로 전달 (RULES.md ADR-003)', () => {
    const res = mockRes();
    respondError(res, 404, 'NOT_FOUND', '학생 정보를 찾을 수 없습니다.');
    const call = res.json.mock.calls[0][0];
    expect(call.error.message).toBe('학생 정보를 찾을 수 없습니다.');
  });
});
