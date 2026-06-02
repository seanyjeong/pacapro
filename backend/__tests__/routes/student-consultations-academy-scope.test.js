const fs = require('fs');
const path = require('path');

describe('student consultations academy scope', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../../routes/student-consultations.js'),
        'utf8'
    );

    test('does not fall back to academy 2 when reading the authenticated academy', () => {
        expect(source).toContain('req.user.academyId');
        expect(source).not.toContain('academy_id || 2');
        expect(source).not.toContain('academyId || 2');
    });
});
