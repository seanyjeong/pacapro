const { pacaSchema } = require('../config/maxEnginePeak');
const { tags } = require('../models/maxEngineExercisePack');
const common = require('./maxEngineFullCommandRepository');
const rows = async (conn, sql, params, lock) => (await conn.execute(sql + (lock ? ' FOR UPDATE' : ''), params))[0];
async function state(conn, actor, changes, lock = false) {
  const academy = actor.academy_id, ids = changes.exercise_ids;
  const exercises = await rows(conn, `SELECT id,name,tags,default_sets,default_reps,description,video_url,academy_id
    FROM exercises WHERE (academy_id=? OR academy_id IS NULL)
    AND id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, [academy, ...ids], lock);
  const tagIds = [...new Set(exercises.flatMap(row => tags(row.tags)))].sort();
  const metadata = tagIds.length ? await rows(conn, `SELECT id,academy_id,tag_id,label,color FROM exercise_tags
    WHERE (academy_id=? OR academy_id IS NULL) AND is_active=1
    AND tag_id IN (${tagIds.map(() => '?').join(',')}) ORDER BY academy_id,id`, [academy, ...tagIds], lock) : [];
  const authors = await rows(conn, `SELECT id,name FROM ${pacaSchema()}.users
    WHERE id=? AND academy_id=? AND is_active=1 AND deleted_at IS NULL`, [actor.user_id, academy], lock);
  const matches = await rows(conn, 'SELECT id,name FROM exercise_packs WHERE academy_id=? AND name=? ORDER BY id',
    [academy, changes.name], lock);
  return { exercises, tags: metadata, author: authors[0] ?? null, matches };
}
async function save(conn, actor, changes, author, snapshot) {
  const packId = await common.insert(conn, 'exercise_packs', { academy_id: actor.academy_id,
    is_system: 0, name: changes.name, description: changes.description ?? null, version: '1.0',
    author, snapshot_data: JSON.stringify(snapshot) });
  for (const [display_order, exercise_id] of changes.exercise_ids.entries()) {
    await common.insert(conn, 'exercise_pack_items', { pack_id: packId, exercise_id, display_order });
  }
  return packId;
}
module.exports = { state, save };
