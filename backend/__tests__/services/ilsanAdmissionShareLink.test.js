const { ACADEMY_ID, ACADEMY_NAME, PUBLIC_FORM_PATH } = require('../../constants/ilsanAdmission');
const { createAdmissionService } = require('../../services/ilsanAdmissionService');

function fixture(academy = { id: ACADEMY_ID, name: ACADEMY_NAME }) {
  const conn = {
    beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
    execute: jest.fn(async sql => sql.startsWith('SELECT id,name') ? [[academy].filter(Boolean)] : [[]]),
  };
  const pool = { getConnection: jest.fn(async () => conn) };
  return { pool, conn, service: createAdmissionService(pool) };
}

test.each(['academyId', 'academy_id'])('share link uses existing %s academy scope', async field => {
  const { service, conn } = fixture();
  expect(await service.shareLink({ id: 7, [field]: ACADEMY_ID })).toEqual({ path: PUBLIC_FORM_PATH });
  expect(conn.commit).toHaveBeenCalledTimes(1);
  expect(conn.execute.mock.calls.every(([, parameters]) => parameters[0] === ACADEMY_ID)).toBe(true);
});

test.each([{id:7,academyId:999}, {id:7}, {id:0,academyId:ACADEMY_ID}])('unauthorized actor cannot obtain a link: %j', async actor => {
  const { service, pool } = fixture();
  await expect(service.shareLink(actor)).rejects.toMatchObject({status:403,code:'ACADEMY_FORBIDDEN'});
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test.each([null, {id:ACADEMY_ID,name:'다른 교육원'}])('missing or mismatched academy never returns a link', async academy => {
  const { service, conn } = fixture(academy);
  await expect(service.shareLink({id:7,academyId:ACADEMY_ID})).rejects.toMatchObject({status:503,code:'ACADEMY_UNAVAILABLE'});
  expect(conn.rollback).toHaveBeenCalledTimes(1);
});

test('unavailable intake storage never produces a working-link claim', async () => {
  const { service, conn } = fixture();
  conn.execute.mockImplementationOnce(async () => [[{id:ACADEMY_ID,name:ACADEMY_NAME}]])
    .mockRejectedValueOnce(new Error('synthetic storage unavailable'));
  await expect(service.shareLink({id:7,academyId:ACADEMY_ID})).rejects.toThrow('synthetic storage unavailable');
  expect(conn.rollback).toHaveBeenCalledTimes(1);
});
