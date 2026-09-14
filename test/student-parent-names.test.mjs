import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesStudentIdentity, visibleParentName } from '../src/lib/utils/student-parent-names.ts';

test('student, number and either parent can find every matching sibling', () => {
  const students = [
    { id: 1, student_name: '김첫째', student_number: '2026001', father_name: '김아버지', mother_name: 'Jane Doe' },
    { id: 2, student_name: '김둘째', student_number: '2026002', father_name: '김아버지' },
    { id: 3, student_name: '이학생', student_number: '2026003' },
  ];
  const find = (query) => students.filter(student => matchesStudentIdentity(student, query)).map(s => s.id);
  assert.deepEqual(find(' 김 아버지 '), [1, 2]);
  assert.deepEqual(find('janeDOE'), [1]);
  assert.deepEqual(find('둘째'), [2]);
  assert.deepEqual(find('2026003'), [3]);
  assert.deepEqual(find('없음'), []);
  assert.deepEqual(find('  '), [1, 2, 3]);
});

test('empty or encrypted names never become visible or searchable identity', () => {
  for (const value of [null, undefined, '', '  ', ' ENC:private ']) assert.equal(visibleParentName(value), '');
  assert.equal(visibleParentName(' 김아버지 '), '김아버지');
  assert.equal(matchesStudentIdentity({ father_name: 'ENC:private' }, 'private'), false);
});
