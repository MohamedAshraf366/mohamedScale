DELETE FROM communications WHERE (metadata->>'legacy_migration')::boolean = true;
DELETE FROM opportunities WHERE (metadata->>'legacy_migration')::boolean = true;