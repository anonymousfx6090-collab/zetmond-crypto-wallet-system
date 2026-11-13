-- Separate operator login; never use this credential in a customer/API process.
-- Run as migration owner: psql -v operator_role=YOUR_ROLE -f this-file.sql
GRANT USAGE ON SCHEMA finance TO :"operator_role";
GRANT EXECUTE ON FUNCTION
 finance.readiness(),
 finance.reconcile(text,jsonb,text),
 finance.repair_projection(uuid),
 finance.resume_asset(uuid,uuid)
TO :"operator_role";
-- No table writes, owner membership, raw posting or signing authority.
