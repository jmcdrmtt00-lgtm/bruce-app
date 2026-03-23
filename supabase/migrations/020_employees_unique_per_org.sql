-- Replace global email uniqueness with per-org email uniqueness.
-- This allows the same person (e.g. Bruce, Judy) to have a record in
-- both the Oriol and Demo orgs without hitting a duplicate-key error.

ALTER TABLE employees DROP CONSTRAINT employees_email_key;

ALTER TABLE employees ADD CONSTRAINT employees_email_org_unique UNIQUE (org_id, email);
