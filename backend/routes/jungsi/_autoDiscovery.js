const MAX_BRANCHES = 100;
const FETCH_BATCH_SIZE = 4;
const ACADEMY_LABELS = [
  '맥스체대입시학원',
  '맥스체대입시',
  '맥스체대',
  '맥스',
  '체대입시학원',
  '체대입시',
  '체대학원',
  '교육원',
  '학원',
  '센터',
];

function compact(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '');
}

function locationName(value) {
  return ACADEMY_LABELS.reduce(
    (name, label) => name.replaceAll(label, ''),
    compact(value)
  );
}

function uniqueBranches(branches) {
  return [...new Set(
    (Array.isArray(branches) ? branches : [])
      .map((branch) => String(branch || '').trim())
      .filter((branch) => branch && branch.length <= 120)
  )].slice(0, MAX_BRANCHES);
}

function prioritizeBranches(academyName, branches) {
  const candidates = uniqueBranches(branches);
  const academyLocation = locationName(academyName);
  if (!academyLocation) return { candidates, confidence: 'student-identity' };

  const matches = candidates.filter((branch) => {
    const branchLocation = locationName(branch);
    return branchLocation === academyLocation
      || branchLocation.includes(academyLocation)
      || academyLocation.includes(branchLocation);
  });
  return matches.length === 1
    ? { candidates: matches, confidence: 'academy-name' }
    : { candidates, confidence: 'student-identity' };
}

function studentId(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function schoolName(value) {
  return compact(value)
    .replace(/고등학교$/u, '고')
    .replace(/중학교$/u, '중')
    .replace(/초등학교$/u, '초');
}

function gradeNumber(value) {
  const matched = String(value || '').match(/[1-3]/);
  return matched ? matched[0] : '';
}

function flattened(rosters) {
  return rosters.flatMap(({ branchName, students }) => (
    (Array.isArray(students) ? students : []).map((student) => ({ branchName, student }))
  ));
}

function uniqueResult(matches, method) {
  return matches.length === 1 ? { ...matches[0], method } : null;
}

function findUniqueStudent(pacaStudent, rosters) {
  const entries = flattened(rosters);
  const linkedId = studentId(pacaStudent.jungsiStudentId || pacaStudent.jungsi_student_id);
  if (linkedId) {
    const linkedMatches = entries.filter(({ student }) => (
      studentId(student.student_id || student.id) === linkedId
    ));
    const linkedResult = uniqueResult(linkedMatches, 'auto-linked-id');
    if (linkedResult) return linkedResult;
    if (linkedMatches.length > 1) return null;
  }

  const name = compact(pacaStudent.name);
  const school = schoolName(pacaStudent.school);
  const grade = gradeNumber(pacaStudent.grade);
  if (!name || !school) return null;

  const identityMatches = entries.filter(({ student }) => {
    if (compact(student.student_name || student.name) !== name) return false;
    if (schoolName(student.school_name || student.school) !== school) return false;
    const jungsiGrade = gradeNumber(student.grade);
    return !grade || !jungsiGrade || grade === jungsiGrade;
  });
  const method = grade ? 'auto-name+school+grade' : 'auto-name+school';
  return uniqueResult(identityMatches, method);
}

async function fetchRosters(branches, year, exam, fetchStudents) {
  const rosters = [];
  for (let index = 0; index < branches.length; index += FETCH_BATCH_SIZE) {
    const batch = branches.slice(index, index + FETCH_BATCH_SIZE);
    const studentsByBranch = await Promise.all(
      batch.map((branchName) => fetchStudents(branchName, year, exam))
    );
    batch.forEach((branchName, offset) => {
      rosters.push({ branchName, students: studentsByBranch[offset] });
    });
  }
  return rosters;
}

module.exports = {
  fetchRosters,
  findUniqueStudent,
  locationName,
  prioritizeBranches,
};
