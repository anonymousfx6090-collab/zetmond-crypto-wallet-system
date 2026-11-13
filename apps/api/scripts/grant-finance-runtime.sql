-- Run in a separate migration/owner context with psql -v runtime_role=YOUR_ROLE.
-- This does not create a role, password, asset, balance or custody key.
-- Do not grant role membership in the schema/table owner to the runtime role.
GRANT USAGE ON SCHEMA finance TO :"runtime_role";
GRANT EXECUTE ON FUNCTION
 finance.create_account(uuid,uuid,uuid,text,text,boolean),
 finance.post(uuid,uuid,uuid,text,text,jsonb,uuid),
 finance.reserve(uuid,uuid,uuid,uuid,text,timestamptz),
 finance.finish_hold(uuid,uuid,text,text,uuid),
 finance.read_balances(uuid,text),
 finance.asset_info(uuid),
 finance.prepare_operation(uuid,uuid,uuid,uuid,uuid,text,text,uuid,text,text,uuid,uuid,text,uuid,text),
 finance.claim_operation(text),
 finance.operation_lease_valid(uuid,bigint,boolean),
 finance.update_operation(uuid,bigint,text,text,text,text),
 finance.defer_operation(uuid,bigint),
 finance.finish_operation(uuid,bigint,text,uuid,text),
 finance.record_event(uuid,text,text,text,text,text),
 finance.operation_status(uuid,uuid,text),
 finance.claim_outbox(text),
 finance.ack_outbox(uuid,bigint),
 finance.readiness()
TO :"runtime_role";
-- Existing application permissions for authentication/verification must be
-- provisioned separately. No direct finance table/sequence writes are granted.
