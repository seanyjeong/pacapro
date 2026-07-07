const SUBJECT_SCORE_KEYS = {
  국어: ['선택과목', '원점수', '표준점수', '백분위', '등급'],
  수학: ['선택과목', '원점수', '표준점수', '백분위', '등급'],
  탐구1: ['선택과목', '원점수', '표준점수', '백분위', '등급'],
  탐구2: ['선택과목', '원점수', '표준점수', '백분위', '등급'],
};

function normalizeSchoolName(name) {
  if (!name) return '';
  return name
    .replace(/고등학교$/g, '고')
    .replace(/중학교$/g, '중')
    .replace(/초등학교$/g, '초')
    .trim();
}

function normalizeStudentId(id) {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}

function matchStudents(pacaStudent, jungsiStudents) {
  const linkedStudentId = normalizeStudentId(pacaStudent.jungsiStudentId || pacaStudent.jungsi_student_id);
  if (linkedStudentId) {
    const linkedMatch = jungsiStudents.find((student) => (
      normalizeStudentId(student.student_id || student.id) === linkedStudentId
    ));
    if (linkedMatch) return { match: linkedMatch, confidence: 'high', method: 'linked-id' };
  }

  const pacaSchool = normalizeSchoolName(pacaStudent.school);
  const nameMatches = jungsiStudents.filter((student) => student.student_name === pacaStudent.name);

  if (nameMatches.length === 1) {
    return { match: nameMatches[0], confidence: 'high', method: 'name' };
  }

  if (nameMatches.length > 1) {
    const schoolMatch = nameMatches.find((student) => (
      normalizeSchoolName(student.school_name) === pacaSchool
    ));
    if (schoolMatch) return { match: schoolMatch, confidence: 'high', method: 'name+school' };
  }

  return { match: null, confidence: 'none', method: null };
}

function pickSubjectScore(scores, subject) {
  return SUBJECT_SCORE_KEYS[subject].reduce((acc, key) => {
    acc[key] = scores[`${subject}_${key}`];
    return acc;
  }, {});
}

function formatScores(scores, year, exam) {
  return {
    year,
    exam,
    국어: pickSubjectScore(scores, '국어'),
    수학: pickSubjectScore(scores, '수학'),
    영어: {
      원점수: scores.영어_원점수,
      등급: scores.영어_등급,
    },
    한국사: {
      원점수: scores.한국사_원점수,
      등급: scores.한국사_등급,
    },
    탐구1: pickSubjectScore(scores, '탐구1'),
    탐구2: pickSubjectScore(scores, '탐구2'),
  };
}

module.exports = {
  formatScores,
  matchStudents,
  normalizeSchoolName,
  normalizeStudentId,
};
