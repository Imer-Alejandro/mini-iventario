CREATE TRIGGER "audit_log_prevent_update"
BEFORE UPDATE ON "audit_log"
BEGIN
  SELECT RAISE(ABORT, 'audit_log rows are immutable');
END;

CREATE TRIGGER "audit_log_prevent_delete"
BEFORE DELETE ON "audit_log"
BEGIN
  SELECT RAISE(ABORT, 'audit_log rows are immutable');
END;
