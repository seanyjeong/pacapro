
const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

// NOTE: This configuration should ideally point to a user with permissions
// to access all tenant databases, but not necessarily the 'root' user.
// For now, we use the provided 'paca' user.
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'paca',
    password: process.env.DB_PASSWORD || 'q141171616!',
    // No specific database is selected initially, as we will switch between tenant DBs.
};

const MIGRATIONS_TABLE = `_migrations_log`;
const MIGRATIONS_DIR = path.join(__dirname, '..', 'tenant_migrations');

async function getTenantSchemas() {
    // In a real implementation, this function would query a central
    // 'tenants' table to get the list of all active tenant schemas.
    // For now, it's a placeholder. We will assume schemas are named 'paca_1', 'paca_2', etc.
    // We will start with a placeholder for the first academy.
    // This will be replaced later.
    console.log('Fetching tenant schemas (using placeholder)...');
    return ['paca_1']; // Placeholder for the first migrated academy
}

async function ensureMigrationsTable(conn) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            file_name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY (file_name)
        );
    `);
}

async function getAppliedMigrations(conn) {
    const [rows] = await conn.query(`SELECT file_name FROM ${MIGRATIONS_TABLE}`);
    return new Set(rows.map(r => r.file_name));
}

async function run() {
    console.log('Starting tenant migration runner...');

    let tenantConnection;
    try {
        const tenantSchemas = await getTenantSchemas();
        const migrationFiles = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();

        if (migrationFiles.length === 0) {
            console.log('No migration files found. Exiting.');
            return;
        }
        console.log(`Found ${migrationFiles.length} migration files.`);

        for (const schema of tenantSchemas) {
            try {
                console.log(`\nProcessing schema: ${schema}`);
                tenantConnection = await mysql.createConnection({ ...dbConfig, database: schema });

                await ensureMigrationsTable(tenantConnection);
                const appliedMigrations = await getAppliedMigrations(tenantConnection);
                console.log(`${appliedMigrations.size} migrations already applied.`);

                for (const file of migrationFiles) {
                    if (appliedMigrations.has(file)) {
                        continue; // Skip already applied migration
                    }

                    console.log(`  -> Applying migration: ${file}`);
                    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
                    
                    // Execute the migration script. We allow multiple statements.
                    await tenantConnection.query(sql);

                    // Log the migration as applied
                    await tenantConnection.query(`INSERT INTO ${MIGRATIONS_TABLE} (file_name) VALUES (?)`, [file]);
                    console.log(`  -> Successfully applied and logged ${file}.`);
                }

                console.log(`Schema ${schema} is up to date.`);

            } catch (err) {
                console.error(`Error processing schema ${schema}: ${err.message}`);
                // Decide on error handling: stop all, or continue with next tenant?
                // For safety, we'll stop on the first error.
                throw err;
            } finally {
                if (tenantConnection) await tenantConnection.end();
            }
        }

        console.log('\nAll tenants processed successfully.');

    } catch (error) {
        console.error('\nMigration runner failed:', error.message);
        process.exit(1);
    }
}

run();
