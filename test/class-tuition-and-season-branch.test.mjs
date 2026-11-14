import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './helpers/load-typescript.mjs';

const { resolveTuitionTable } = loadTypeScript('src/lib/utils/tuition-table.ts');
const { filterSeasonBranchStudents } = loadTypeScript('src/features/season-enroll/season-enroll-utils.ts');

const academy = { exam_tuition: { weekly_3: 300000 }, adult_tuition: { weekly_3: 200000 } };

test('반 학원비 표가 없으면 지금처럼 학원 표(입시/성인)를 그대로 쓴다', () => {
  assert.equal(resolveTuitionTable(academy, 'exam', null), academy.exam_tuition);
  assert.equal(resolveTuitionTable(academy, 'adult', undefined), academy.adult_tuition);
});

test('반 학원비 표가 있으면 입시/성인과 상관없이 반 표를 쓴다', () => {
  const classTable = { weekly_3: 450000 };
  assert.equal(resolveTuitionTable(academy, 'exam', classTable), classTable);
  assert.equal(resolveTuitionTable(academy, 'adult', classTable), classTable);
});

test('지점 시즌 등록 후보는 그 지점 학생만, 전 지점 시즌은 모두', () => {
  const students = [{ id: 1, branch_id: 3 }, { id: 2, branch_id: 5 }, { id: 3, branch_id: null }, { id: 4 }];
  assert.deepEqual(filterSeasonBranchStudents(students, { branch_id: 3 }).map((s) => s.id), [1]);
  assert.deepEqual(filterSeasonBranchStudents(students, { branch_id: null }).map((s) => s.id), [1, 2, 3, 4]);
  assert.deepEqual(filterSeasonBranchStudents(students, {}).map((s) => s.id), [1, 2, 3, 4]);
});
