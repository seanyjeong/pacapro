const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const databaseUrl = process.env.PACA_WEBHOOK_TEST_DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

integrationDescribe('MAX LINK webhook outbox MySQL integration', () => {
    let connection;

    beforeAll(async () => {
        connection = await mysql.createConnection({
            uri: databaseUrl,
            multipleStatements: true
        });
        const [[database]] = await connection.query('SELECT DATABASE() AS name');
        if (!database.name.endsWith('_test')) {
            throw new Error('PACA_WEBHOOK_TEST_DATABASE_URL must use an isolated *_test database');
        }
        await connection.query(
            `CREATE TABLE students (
                id BIGINT NOT NULL PRIMARY KEY,
                academy_id BIGINT NOT NULL,
                status VARCHAR(16) NULL
            ) ENGINE=InnoDB`
        );
        await connection.query(migrationSql('20260715_maxlink_webhook_outbox.mysql'));
    });

    afterAll(async () => {
        if (!connection) return;
        await connection.query(migrationSql('20260715_maxlink_webhook_outbox_down.mysql'));
        await connection.query('DROP TABLE students');
        await connection.end();
    });

    test('captures terminal changes once and rolls back with the student transaction', async () => {
        await connection.query("INSERT INTO students VALUES (77, 2, 'active')");
        await connection.query("UPDATE students SET status = 'withdrawn' WHERE id = 77");
        await connection.query("UPDATE students SET status = 'withdrawn' WHERE id = 77");
        await connection.query('DELETE FROM students WHERE id = 77');

        await connection.query("INSERT INTO students VALUES (88, 2, 'active')");
        await connection.beginTransaction();
        await connection.query("UPDATE students SET status = 'withdrawn' WHERE id = 88");
        await connection.rollback();

        const [events] = await connection.query(
            `SELECT source_student_id, status
             FROM maxlink_webhook_outbox
             ORDER BY id`
        );
        expect(events).toEqual([
            { source_student_id: '77', status: 'withdrawn' },
            { source_student_id: '77', status: 'deleted' }
        ]);
    });
});

function migrationSql(filename) {
    return fs.readFileSync(path.join(__dirname, '../../migrations', filename), 'utf8');
}
