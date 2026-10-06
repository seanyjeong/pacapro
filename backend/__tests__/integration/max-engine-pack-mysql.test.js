/** Real HTTP and MySQL; fixture() requires an explicitly isolated loopback port. */
jest.mock('../../config/database', () => global.__packs.paca);
jest.mock('../../config/peak-database', () => global.__packs.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
run('exercise pack creation: authenticated preview, isolated persistence and rollback', () => {
  let f, server, token;
  const original = { ...process.env };
  beforeAll(async () => {
    f = await fixture(); global.__packs = f;
    process.env.DB_NAME = 'max_engine_eff_test_paca';
    for (const sql of fs.readFileSync(require.resolve('../../migrations/20261003_peak_max_engine_commands.sql'), 'utf8')
      .replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await f.peak.query(sql);
    await f.paca.execute('UPDATE users SET name=? WHERE id=1', [f.encrypt('합성작성자')]);
    const app = express(); app.use(express.json()); app.use('/full', require('../../routes/integrations/full'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const login = await request(server).post('/full/token').send({ email: 'a@example.invalid', password: 'synthetic' });
    expect(login.status).toBe(200); token = login.body.access_token;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await f?.close(); process.env = original;
  });
  const post = (path, body, provider = 'peak') => request(server).post(`/full/${provider}/${path}`)
    .auth(token, { type: 'bearer' }).send(body);
  const command = changes => ({ operation: 'peak_exercise_pack_create',
    changes: { name: '합성 순서팩', description: '선택 운동 보존', exercise_ids: [2, 1], ...changes } });
  const preview = (changes, provider) => post('preview', command(changes), provider);
  const confirm = (p, provider) => post('confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true }, provider);
  const count = async table => (await f.peak.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n;
  beforeEach(async () => {
    for (const table of ['exercise_pack_items', 'exercise_packs', 'max_engine_commands', 'exercises', 'exercise_tags']) {
      await f.peak.query(`DELETE FROM ${table}`);
    }
    await f.paca.execute('UPDATE users SET name=? WHERE id=1', [f.encrypt('합성작성자')]);
    for (const [id, academy_id, name, tags] of [[1, 1, '준비운동', ['warmup']], [2, null, '공유점프', ['jump']],
      [3, 2, '외부운동', ['foreign']], [4, 1, '태그없는운동', []]]) {
      await f.insert('peak', 'exercises', { id, academy_id, is_system: academy_id === null ? 1 : 0,
        name, tags: JSON.stringify(tags), default_sets: id === 4 ? null : 3, default_reps: id === 4 ? null : 5,
        description: id === 4 ? null : `${name} 설명`, video_url: id === 4 ? null : `https://example.invalid/${id}` });
    }
    for (const [id, academy_id, tag_id, label, active] of [[1, 1, 'warmup', '준비', 1], [2, 1, 'jump', '점프', 1],
      [3, 2, 'foreign', '외부', 1], [4, 1, 'inactive', '비활성', 0], [5, 1, 'unused', '미사용', 1]]) {
      await f.insert('peak', 'exercise_tags', { id, academy_id, tag_id, label, color: '#123456', is_active: active, display_order: id });
    }
  });
  test('preview writes nothing; confirmed snapshot and item order match the selected library and UI format; retry saves once', async () => {
    const raw = (await f.peak.query('SELECT * FROM exercises ORDER BY id'))[0];
    const p = await preview(); expect(p.status).toBe(200);
    expect(p.body.after).toMatchObject({ name: '합성 순서팩', description: '선택 운동 보존', author: '합성작성자' });
    expect(p.body.after.exercises.map(e => [e.exercise_id, e.display_order, e.name])).toEqual([[2, 0, '공유점프'], [1, 1, '준비운동']]);
    for (const table of ['exercise_packs', 'exercise_pack_items', 'max_engine_commands']) expect(await count(table)).toBe(0);
    const result = await confirm(p.body); expect(result.status).toBe(200);
    expect((await confirm(p.body)).body).toEqual(result.body);
    const pack = (await f.peak.query('SELECT * FROM exercise_packs'))[0][0];
    expect(pack).toMatchObject({ id: result.body.resource_id, academy_id: 1, is_system: 0, version: '1.0', author: '합성작성자' });
    const snapshot = json(pack.snapshot_data);
    expect(snapshot).toMatchObject({ format: 'peak-exercise-pack', version: '1.0' });
    expect(new Date(snapshot.created_at).toISOString()).toBe(snapshot.created_at);
    expect(snapshot.tags).toEqual(expect.arrayContaining([{ tag_id: 'warmup', label: '준비', color: '#123456' },
      { tag_id: 'jump', label: '점프', color: '#123456' }]));
    expect(snapshot.tags).toHaveLength(2);
    expect(snapshot.exercises).toEqual([2, 1].map((id, order) => {
      const e = raw.find(row => row.id === id);
      return { name: e.name, tags: json(e.tags), default_sets: e.default_sets, default_reps: e.default_reps,
        description: e.description, video_url: e.video_url, order };
    }));
    expect(snapshot.exercises.every(e => !Object.hasOwn(e, 'exercise_id') && !Object.hasOwn(e, 'id'))).toBe(true);
    expect((await f.peak.query('SELECT pack_id,exercise_id,display_order FROM exercise_pack_items ORDER BY display_order'))[0])
      .toEqual([{ pack_id: pack.id, exercise_id: 2, display_order: 0 }, { pack_id: pack.id, exercise_id: 1, display_order: 1 }]);
    expect(await count('exercise_packs')).toBe(1); expect(await count('max_engine_commands')).toBe(1);
    expect((await f.peak.query('SELECT * FROM exercises ORDER BY id'))[0]).toEqual(raw);
  });
  test('PACA alias confirms into PEAK; omitted description and null defaults keep the standard snapshot', async () => {
    const p = await preview({ description: undefined, exercise_ids: [4] }, 'paca'); expect(p.status).toBe(200);
    expect((await confirm(p.body, 'paca')).status).toBe(200);
    const row = (await f.peak.query('SELECT description,snapshot_data FROM exercise_packs'))[0][0];
    expect(row.description).toBeNull();
    expect(json(row.snapshot_data).exercises).toEqual([{ name: '태그없는운동', tags: [], default_sets: null,
      default_reps: null, description: null, video_url: null, order: 0 }]);
  });
  test('foreign and missing sources fail; duplicate, unsafe and excessive IDs and untrusted author or snapshot are rejected', async () => {
    for (const exercise_ids of [[3], [999]]) expect((await preview({ exercise_ids })).status).toBe(404);
    for (const changes of [{ exercise_ids: [1, 1] }, { exercise_ids: [] }, { exercise_ids: [0] },
      { exercise_ids: [Number.MAX_SAFE_INTEGER + 1] }, { exercise_ids: ['1'] },
      { exercise_ids: Array.from({ length: 201 }, (_, i) => i + 1) }, { name: '' }, { name: 'x'.repeat(101) },
      { description: 'x'.repeat(4001) }, { author: '위조' }, { snapshot_data: {} }, { academy_id: 2 }]) {
      expect((await preview(changes)).status).toBe(422);
    }
    expect(await count('exercise_packs')).toBe(0);
  });
  test('same owned name conflicts while another academy and a shared pack do not block own creation', async () => {
    for (const [id, academy_id] of [[10, 2], [11, null]]) await f.insert('peak', 'exercise_packs',
      { id, academy_id, is_system: academy_id === null ? 1 : 0, name: '합성 순서팩' });
    const p = await preview(); expect(p.status).toBe(200); expect((await confirm(p.body)).status).toBe(200);
    const duplicate = await preview(); expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('PEAK_PACK_DUPLICATE');
  });
  test.each(['exercise', 'tag', 'author', 'matching pack'])('%s change after preview rejects the stale proposal without partial writes', async source => {
    const p = await preview(); expect(p.status).toBe(200);
    if (source === 'exercise') await f.peak.execute("UPDATE exercises SET name='바뀐운동' WHERE id=2");
    if (source === 'tag') await f.peak.execute("UPDATE exercise_tags SET label='바뀐태그' WHERE id=1");
    if (source === 'author') await f.paca.execute('UPDATE users SET name=? WHERE id=1', [f.encrypt('바뀐작성자')]);
    if (source === 'matching pack') await f.insert('peak', 'exercise_packs', { academy_id: 1, name: '합성 순서팩' });
    const result = await confirm(p.body); expect(result.status).toBe(409); expect(result.body.error.code).toBe('SOURCE_CHANGED');
    expect(await count('exercise_packs')).toBe(source === 'matching pack' ? 1 : 0);
    expect(await count('exercise_pack_items')).toBe(0); expect(await count('max_engine_commands')).toBe(0);
  });
  test('irrelevant library/tag changes do not invalidate a snapshot of only selected source rows', async () => {
    const p = await preview(); expect(p.status).toBe(200);
    await f.peak.execute("UPDATE exercises SET name='외부변경' WHERE id=3");
    await f.peak.execute("UPDATE exercise_tags SET label='미사용변경' WHERE id=5");
    expect((await confirm(p.body)).status).toBe(200);
  });
  test('item insertion failure rolls back the pack, all items and ledger; the same confirmation can safely retry', async () => {
    const p = await preview(); expect(p.status).toBe(200);
    await f.peak.query("CREATE TRIGGER synthetic_pack_item_failure BEFORE INSERT ON exercise_pack_items FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
    try {
      expect((await confirm(p.body)).status).toBe(503);
      for (const table of ['exercise_packs', 'exercise_pack_items', 'max_engine_commands']) expect(await count(table)).toBe(0);
    } finally { await f.peak.query('DROP TRIGGER synthetic_pack_item_failure'); }
    expect((await confirm(p.body)).status).toBe(200);
    expect(await count('exercise_packs')).toBe(1); expect(await count('exercise_pack_items')).toBe(2);
    expect(await count('max_engine_commands')).toBe(1);
  });
});
