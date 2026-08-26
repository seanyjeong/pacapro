const fs = require('fs');
const path = require('path');

const migrationPath = path.join(
    __dirname,
    '../../migrations/20260826_add_advance_student_admission_type.mysql',
);

describe('advance admission type migration', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    test('기존 enum과 기본값을 보존하면서 advance를 추가한다', () => {
        expect(migration).toContain("ENUM('regular','early','civil_service','military_academy','police_university','advance')");
        expect(migration).toMatch(/NULL DEFAULT 'regular'/);
        expect(migration).toMatch(/ALGORITHM=INSTANT/);
        expect(migration).not.toMatch(/LOCK\s*=\s*(NONE|SHARED|EXCLUSIVE)/i);
    });

    test('롤백 전에 선행반 데이터를 정시로 치환하도록 명시한다', () => {
        expect(migration).toContain(
            "UPDATE students SET admission_type = 'regular' WHERE admission_type = 'advance'",
        );
        expect(migration).toContain("ENUM('regular','early','civil_service','military_academy','police_university')");
    });
});
