-- The original numeric IDs are not kept, so this migration cannot be reverted.
DO $$
BEGIN
    RAISE EXCEPTION '000002_string_ids is irreversible; restore from a backup instead';
END $$;
