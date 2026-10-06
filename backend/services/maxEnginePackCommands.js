const repository = require('../repositories/maxEnginePackRepository');
const { fail, decrypt } = require('./maxEngineFullSecurity');
const { orderedSnapshot } = require('../models/maxEngineExercisePack');
const supports = operation => operation === 'peak_exercise_pack_create';
const state = (conn, actor, command, lock) => repository.state(conn, actor, command.changes, lock);
function authorName(before) {
  if (!before.author) fail(403, 'ACTOR_INVALID', '활성 작성자 계정을 확인해 주세요.');
  const author = decrypt(before.author.name) || 'Unknown';
  if (typeof author !== 'string' || author.length > 100) fail(422, 'PEAK_PACK_INVALID', '작성자 이름 형식을 확인해 주세요.');
  return author;
}
function display(command, before) {
  const snapshot = orderedSnapshot(command.changes, before, '확인 시각에 기록');
  return { before: null, after: { name: command.changes.name, description: command.changes.description ?? null,
    author: authorName(before), version: '1.0',
    exercises: snapshot.exercises.map((row, index) => ({ ...row,
      exercise_id: command.changes.exercise_ids[index], display_order: index })), snapshot_data: snapshot } };
}
async function apply(conn, actor, command, before) {
  return repository.save(conn, actor, command.changes, authorName(before), orderedSnapshot(command.changes, before));
}
module.exports = { supports, state, display, apply };
