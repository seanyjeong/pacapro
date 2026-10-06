const { fail } = require('./maxEngineError');
function tags(value) {
  let result = value;
  if (result == null || result === '') return [];
  if (typeof result === 'string') {
    try { result = JSON.parse(result); }
    catch { fail(422, 'PEAK_PACK_INVALID', '운동 태그 형식을 확인해 주세요.'); }
  }
  if (!Array.isArray(result) || result.some(tag => typeof tag !== 'string' || !tag.trim())) {
    fail(422, 'PEAK_PACK_INVALID', '운동 태그 형식을 확인해 주세요.');
  }
  return [...result];
}
function orderedSnapshot(changes, before, at = new Date()) {
  if (before.matches?.length) fail(409, 'PEAK_PACK_DUPLICATE', '내 교육원에 같은 이름의 팩이 있습니다. 새 이름을 정해 주세요.');
  const available = new Map(before.exercises.map(row => [row.id, row]));
  const exercises = changes.exercise_ids.map((id, order) => {
    const row = available.get(id);
    if (!row) fail(404, 'NOT_FOUND', '선택한 운동을 찾을 수 없습니다. 내 교육원 또는 공유 운동 id를 확인해 주세요.');
    return { name: row.name, tags: tags(row.tags), default_sets: row.default_sets ?? null,
      default_reps: row.default_reps ?? null, description: row.description ?? null,
      video_url: row.video_url ?? null, order };
  });
  const selected = new Set(exercises.flatMap(row => row.tags));
  const metadata = new Map();
  // Repository puts shared rows first, so owned metadata wins if both are available.
  for (const row of before.tags) if (selected.has(row.tag_id)) {
    metadata.set(row.tag_id, { tag_id: row.tag_id, label: row.label, color: row.color });
  }
  return { format: 'peak-exercise-pack', version: '1.0',
    created_at: typeof at === 'string' ? at : at.toISOString(),
    tags: [...metadata.values()], exercises };
}
module.exports = { orderedSnapshot, tags };
