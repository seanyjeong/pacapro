-- Local rollback only after verifying no audit rows. Production rollback retains this ledger.
DROP TABLE max_engine_payment_settlements;
