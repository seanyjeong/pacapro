const { orderedSnapshot } = require('../../models/maxEngineExercisePack');
const at = '2026-10-06T12:00:00.000Z';
const changes = { name: '순서팩', exercise_ids: [2, 1] };
const before = { author: { id: 1, name: '작성자' }, matches: [], tags: [
  { tag_id: 'warmup', label: '준비', color: '#123456' }], exercises: [
  { id: 1, name: '준비운동', tags: '["warmup"]', default_sets: 2, default_reps: 10, description: '설명', video_url: 'https://example.invalid/a' },
  { id: 2, name: '점프', tags: [], default_sets: null, default_reps: null, description: null, video_url: null }] };
test('standard snapshot follows requested IDs, independent of query order, and excludes database identities', () => {
  const prior = JSON.stringify(before);
  const snapshot = orderedSnapshot(changes, before, at);
  expect(snapshot).toEqual({ format: 'peak-exercise-pack', version: '1.0', created_at: at,
    tags: [{ tag_id: 'warmup', label: '준비', color: '#123456' }], exercises: [
      { name: '점프', tags: [], default_sets: null, default_reps: null, description: null, video_url: null, order: 0 },
      { name: '준비운동', tags: ['warmup'], default_sets: 2, default_reps: 10, description: '설명', video_url: 'https://example.invalid/a', order: 1 }] });
  expect(JSON.stringify(before)).toBe(prior);
});
test('missing source fails rather than exporting another or a guessed exercise', () => {
  expect(() => orderedSnapshot({ ...changes, exercise_ids: [99] }, before, at)).toThrow();
});
test('missing exercise tags normalize to an empty list without erasing zero defaults', () => {
  const state = { ...before, tags: [], exercises: [{ id: 1, name: '맨몸', default_sets: 0, default_reps: 0 }] };
  const snapshot = orderedSnapshot({ ...changes, exercise_ids: [1] }, state, at);
  expect(snapshot.exercises[0]).toMatchObject({ name: '맨몸', tags: [], default_sets: 0, default_reps: 0, order: 0 });
});
test.each(['[invalid JSON', { warmup: true }, [123]])('invalid exercise tags %p reject the snapshot with PEAK_PACK_INVALID', invalidTags => {
  const state = { ...before, exercises: [{ ...before.exercises[0], tags: invalidTags }] };
  const prior = JSON.stringify(state);
  expect(() => orderedSnapshot({ ...changes, exercise_ids: [1] }, state, at))
    .toThrow(expect.objectContaining({ code: 'PEAK_PACK_INVALID', status: 422 }));
  expect(JSON.stringify(state)).toBe(prior);
});
