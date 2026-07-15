const {
  findUniqueStudent,
  prioritizeBranches,
} = require('../../../routes/jungsi/_autoDiscovery');

describe('MAX LINK 정시 지점 자동 식별', () => {
  test('교육원 브랜드 표현을 제거해 정확한 지점을 먼저 고른다', () => {
    expect(prioritizeBranches('일산 맥스체대입시', ['천안', '일산', '인천검단교육원'])).toEqual({
      candidates: ['일산'],
      confidence: 'academy-name',
    });
    expect(prioritizeBranches('맥스체대입시 검단교육원', ['일산', '인천검단교육원'])).toEqual({
      candidates: ['인천검단교육원'],
      confidence: 'academy-name',
    });
  });

  test('교육원명이 지점을 특정하지 못하면 모든 실제 지점을 탐색 대상으로 둔다', () => {
    expect(prioritizeBranches('맥스체대입시', ['일산', '천안'])).toEqual({
      candidates: ['일산', '천안'],
      confidence: 'student-identity',
    });
  });

  test('저장된 정시 학생 ID의 유일 일치를 이름보다 우선한다', () => {
    const result = findUniqueStudent(
      { name: '권동욱', school: '일산고', grade: '고3', jungsiStudentId: 991 },
      [
        { branchName: '일산', students: [{ student_id: 991, student_name: '다른표기', school_name: '다른고' }] },
        { branchName: '천안', students: [{ student_id: 88, student_name: '권동욱', school_name: '일산고' }] },
      ]
    );

    expect(result).toMatchObject({ branchName: '일산', method: 'auto-linked-id' });
    expect(result.student.student_id).toBe(991);
  });

  test('이름·학교·학년의 유일 일치만 허용한다', () => {
    const result = findUniqueStudent(
      { name: '권동욱', school: '일산고등학교', grade: '고3' },
      [
        { branchName: '일산', students: [{ student_id: 77, student_name: '권동욱', school_name: '일산고', grade: '3학년' }] },
        { branchName: '천안', students: [{ student_id: 88, student_name: '권동욱', school_name: '천안고', grade: '고3' }] },
      ]
    );

    expect(result).toMatchObject({ branchName: '일산', method: 'auto-name+school+grade' });
  });

  test('강한 조건으로도 둘 이상 일치하면 다른 학생 성적을 반환하지 않는다', () => {
    const result = findUniqueStudent(
      { name: '김학생', school: '중앙고', grade: '고3' },
      [
        { branchName: '일산', students: [{ student_id: 1, student_name: '김학생', school_name: '중앙고', grade: '고3' }] },
        { branchName: '천안', students: [{ student_id: 2, student_name: '김학생', school_name: '중앙고', grade: '고3' }] },
      ]
    );

    expect(result).toBeNull();
  });
});
