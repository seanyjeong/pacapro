/**
 * 데이터 암호화 마이그레이션 스크립트
 * Phase 1: 기존 평문 데이터를 암호화
 *
 * 사용법: node scripts/migrate-encrypt-data.js [--dry-run]
 * --dry-run: 실제 업데이트 없이 암호화될 레코드 수만 출력
 */

require('dotenv').config();
const db = require('../config/database');
const { encrypt, ENCRYPTED_FIELDS } = require('../utils/encryption');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateTable(tableName, fields) {
    console.log(`\n📦 Processing table: ${tableName}`);
    console.log(`   Fields to encrypt: ${fields.join(', ')}`);

    const connection = await db.getConnection();

    try {
        // 암호화되지 않은 레코드 조회 (ENC: 접두사 없는 것)
        const selectFields = ['id', ...fields].join(', ');
        const [rows] = await connection.query(
            `SELECT ${selectFields} FROM ${tableName} WHERE deleted_at IS NULL`
        );

        console.log(`   Found ${rows.length} total records`);

        let encryptedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const row of rows) {
            const updates = {};
            let needsUpdate = false;

            for (const field of fields) {
                const value = row[field];
                // 이미 암호화된 필드 스킵
                if (value && typeof value === 'string' && !value.startsWith('ENC:')) {
                    updates[field] = encrypt(value);
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                if (DRY_RUN) {
                    console.log(`   [DRY-RUN] Would encrypt record ID: ${row.id}`);
                    encryptedCount++;
                } else {
                    try {
                        const setClause = Object.keys(updates)
                            .map(key => `${key} = ?`)
                            .join(', ');
                        const values = [...Object.values(updates), row.id];

                        await connection.query(
                            `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
                            values
                        );
                        encryptedCount++;
                    } catch (err) {
                        console.error(`   ❌ Error encrypting record ID ${row.id}:`, err.message);
                        errorCount++;
                    }
                }
            } else {
                skippedCount++;
            }
        }

        console.log(`   ✅ Encrypted: ${encryptedCount}, Skipped (already encrypted): ${skippedCount}, Errors: ${errorCount}`);
        return { table: tableName, encrypted: encryptedCount, skipped: skippedCount, errors: errorCount };

    } finally {
        connection.release();
    }
}

async function main() {
    console.log('🔐 P-ACA 데이터 암호화 마이그레이션');
    console.log('====================================');

    if (DRY_RUN) {
        console.log('⚠️  DRY-RUN 모드: 실제 업데이트 없음\n');
    }

    const results = [];

    // students 테이블
    results.push(await migrateTable('students', ENCRYPTED_FIELDS.students));

    // instructors 테이블
    results.push(await migrateTable('instructors', ENCRYPTED_FIELDS.instructors));

    // consultations 테이블 (notes 필드가 있는 경우)
    try {
        results.push(await migrateTable('consultations', ENCRYPTED_FIELDS.consultations));
    } catch (err) {
        console.log(`\n⚠️  consultations 테이블 스킵 (테이블 없음 또는 오류)`);
    }

    // users 테이블 (name, phone)
    results.push(await migrateTable('users', ENCRYPTED_FIELDS.users));

    // 결과 요약
    console.log('\n====================================');
    console.log('📊 마이그레이션 결과 요약:');
    console.log('====================================');

    let totalEncrypted = 0;
    let totalErrors = 0;

    for (const result of results) {
        if (result) {
            console.log(`   ${result.table}: ${result.encrypted} encrypted, ${result.errors} errors`);
            totalEncrypted += result.encrypted;
            totalErrors += result.errors;
        }
    }

    console.log('------------------------------------');
    console.log(`   총 암호화: ${totalEncrypted} 레코드`);
    console.log(`   총 에러: ${totalErrors} 레코드`);

    if (DRY_RUN) {
        console.log('\n💡 실제 마이그레이션을 실행하려면 --dry-run 옵션을 제거하세요.');
    } else {
        console.log('\n✅ 마이그레이션 완료!');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('마이그레이션 실패:', err);
    process.exit(1);
});
