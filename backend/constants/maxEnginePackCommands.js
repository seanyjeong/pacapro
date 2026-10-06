const { Joi, text, id } = require('./maxEngineInput');
const commands = {
  peak_exercise_pack_create: {
    resource: 'exercise_packs', provider: 'peak', label: '운동 라이브러리에서 선택한 운동으로 내 교육원 팩 생성·저장',
    schema: Joi.object({ name: Joi.string().min(1).max(100).pattern(/\S/).required(),
      description: text(4000), exercise_ids: Joi.array().items(id.max(Number.MAX_SAFE_INTEGER))
        .unique().min(1).max(200).required() }).unknown(false),
    notice: '선택한 운동 id 순서대로 팩을 저장합니다. 미리보기 후 확인해야 저장되며, 내 교육원·공유 운동만 사용합니다. 팩과 운동 연결을 함께 저장하고 기존 운동 라이브러리는 유지합니다. 같은 이름의 내 팩이 있으면 새 이름을 정하세요.',
  },
};
module.exports = { commands };
