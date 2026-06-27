-- Per-service Postgres schemas (ADR-008: a service reads ONLY its own schema).
-- TypeORM's synchronize creates TABLES but never the SCHEMA that holds them, so
-- we pre-create one per producing service here.
--
-- NOTE: the postgres image runs this only when the data volume is EMPTY (first
-- boot). On an existing volume, create new schemas by hand (see README/notes).
CREATE SCHEMA IF NOT EXISTS order_service;
CREATE SCHEMA IF NOT EXISTS payment_service;
CREATE SCHEMA IF NOT EXISTS shipping_service;
CREATE SCHEMA IF NOT EXISTS notification_service;
