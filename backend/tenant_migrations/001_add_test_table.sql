-- This is a sample migration file for testing the runner.
-- It adds a simple 'test_table' to any schema it's applied to.

CREATE TABLE test_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO test_table (message) VALUES ('This table was created by the migration runner.');
