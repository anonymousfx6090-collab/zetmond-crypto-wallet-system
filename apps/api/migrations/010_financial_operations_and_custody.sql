CREATE TABLE finance.operations (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.users(id), asset_id uuid NOT NULL REFERENCES finance.assets(id),
 hold_id uuid NOT NULL UNIQUE REFERENCES finance.holds(id),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), intent_payload text NOT NULL,
 send_units numeric(78,0) NOT NULL CHECK(send_units>0), fee_units numeric(78,0) NOT NULL CHECK(fee_units>=0),
 fee_account_id uuid NOT NULL REFERENCES finance.accounts(id), completion_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 identity_attempt_id uuid NOT NULL REFERENCES public.identity_attempts(id), identity_revision bigint NOT NULL,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','signed','unknown','submitted','confirming','complete','failed','review')),
 signed_payload text, transaction_ref text UNIQUE, generation bigint NOT NULL DEFAULT 0,
 lease_until timestamptz, run_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((signed_payload IS NULL)=(transaction_ref IS NULL))
);
CREATE TABLE finance.attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, operation_id uuid NOT NULL REFERENCES finance.operations(id),
 state text NOT NULL, generation bigint NOT NULL, evidence_payload text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER finance_attempts_immutable BEFORE UPDATE OR DELETE ON finance.attempts FOR EACH ROW EXECUTE FUNCTION finance.immutable();
CREATE TABLE finance.events (
 id uuid PRIMARY KEY, mode text NOT NULL CHECK(mode IN ('sandbox','live')),
 provider text NOT NULL CHECK(provider ~ '^[a-z0-9-]{1,50}$'), event_ref text NOT NULL CHECK(length(event_ref) BETWEEN 1 AND 250),
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), protected_payload text NOT NULL,
 conflict boolean NOT NULL DEFAULT false, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','review','complete')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(mode,provider,event_ref)
);
CREATE TABLE finance.reconciliation_runs (
 id uuid PRIMARY KEY, mode text NOT NULL CHECK(mode IN ('sandbox','live')),
 result jsonb NOT NULL, evidence_payload text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE finance.event_conflicts (
 event_id uuid NOT NULL REFERENCES finance.events(id), payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 protected_payload text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,payload_hash)
);
CREATE TRIGGER finance_event_conflicts_immutable BEFORE UPDATE OR DELETE ON finance.event_conflicts FOR EACH ROW EXECUTE FUNCTION finance.immutable();
CREATE TRIGGER finance_reconciliation_immutable BEFORE UPDATE OR DELETE ON finance.reconciliation_runs FOR EACH ROW EXECUTE FUNCTION finance.immutable();

CREATE FUNCTION finance.prepare_operation(operation uuid,customer uuid,asset uuid,available_value uuid,held_value uuid,send_value text,fee_value text,fee_account uuid,digest_value text,protected_intent text,session_value uuid,grant_value uuid,grant_digest text,expected_identity uuid,expected_revision text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior finance.operations%ROWTYPE; send_amount numeric; fee_amount numeric; identity_value public.identity_attempts%ROWTYPE;
BEGIN
 PERFORM finance.assert_runtime();
 PERFORM asset_id FROM finance.asset_safety WHERE asset_id=asset FOR SHARE;
 IF EXISTS(SELECT 1 FROM finance.asset_safety WHERE asset_id=asset AND withdrawals_paused) THEN RAISE EXCEPTION 'Asset requires reconciliation review'; END IF;
 send_amount:=finance.units(send_value);
 IF fee_value IS NULL OR fee_value !~ '^(0|[1-9][0-9]{0,77})$' THEN RAISE EXCEPTION 'Invalid fee units'; END IF;
 fee_amount:=fee_value::numeric;
 PERFORM pg_advisory_xact_lock(hashtextextended(operation::text,717));
 SELECT * INTO prior FROM finance.operations WHERE id=operation;
 IF FOUND THEN
  IF prior.owner_id<>customer OR prior.asset_id<>asset OR prior.digest<>digest_value THEN RAISE EXCEPTION 'Operation scope conflict'; END IF;
  RETURN operation;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s JOIN public.users u ON u.id=s.user_id WHERE s.id=session_value AND u.id=customer AND s.revoked_at IS NULL AND s.expires_at>now() AND s.mfa_verified AND u.role='customer' AND u.country='NG' AND u.email_verified AND u.kyc_status='approved' AND NOT u.restricted AND u.mfa_secret IS NOT NULL) THEN RAISE EXCEPTION 'Financial authorization required'; END IF;
 SELECT a.* INTO identity_value FROM public.identity_cases k JOIN public.identity_attempts a ON a.id=k.current_attempt_id JOIN finance.assets s ON s.id=asset WHERE k.user_id=customer AND a.id=expected_identity AND a.revision::text=expected_revision AND a.status='approved' AND a.mode=s.mode AND a.country='NG' AND a.evidence_payload IS NOT NULL AND a.revision>=0 FOR SHARE OF k,a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current identity evidence required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM finance.accounts a JOIN finance.accounts h ON h.asset_id=a.asset_id WHERE a.id=available_value AND h.id=held_value AND a.asset_id=asset AND a.owner_id=customer AND h.owner_id=customer AND h.purpose='withdrawal_held') THEN RAISE EXCEPTION 'Operation account mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM finance.accounts WHERE id=fee_account AND asset_id=asset AND owner_id IS NULL AND purpose='fee_liability' AND normal_side='credit') THEN RAISE EXCEPTION 'Invalid fee liability account'; END IF;
 UPDATE public.step_ups SET consumed_at=now() WHERE id=grant_value AND session_id=session_value AND purpose='withdrawal' AND operation_digest=grant_digest AND consumed_at IS NULL AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Exact-operation authorization required'; END IF;
 PERFORM finance.reserve(operation,operation,available_value,held_value,(send_amount+fee_amount)::text,NULL);
 INSERT INTO finance.operations(id,owner_id,asset_id,hold_id,digest,intent_payload,send_units,fee_units,fee_account_id,identity_attempt_id,identity_revision) VALUES(operation,customer,asset,operation,digest_value,protected_intent,send_amount,fee_amount,fee_account,identity_value.id,identity_value.revision);
 INSERT INTO public.audit_events(user_id,action,metadata) VALUES(customer,'financial_intent_created',jsonb_build_object('operationId',operation));
 RETURN operation;
END $$;

CREATE FUNCTION finance.claim_operation(mode_value text) RETURNS SETOF finance.operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE selected finance.operations%ROWTYPE;
BEGIN
 PERFORM finance.assert_runtime();
 SELECT o.* INTO selected FROM finance.operations o JOIN finance.assets a ON a.id=o.asset_id WHERE a.mode=mode_value AND o.state IN ('prepared','signed','unknown','submitted','confirming') AND o.run_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now()) ORDER BY o.created_at,o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE finance.operations SET generation=generation+1,lease_until=now()+interval '30 seconds' WHERE id=selected.id RETURNING * INTO selected;
 RETURN NEXT selected;
END $$;

CREATE FUNCTION finance.update_operation(operation uuid,fence bigint,state_value text,transaction_value text DEFAULT NULL,protected_signed text DEFAULT NULL,protected_evidence text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior finance.operations%ROWTYPE;
BEGIN
 PERFORM finance.assert_runtime();
 SELECT * INTO prior FROM finance.operations WHERE id=operation FOR UPDATE;
 IF NOT FOUND OR prior.generation<>fence OR prior.lease_until IS NULL OR prior.lease_until<=now() OR prior.state IN ('complete','failed','review') THEN RETURN false; END IF;
 IF state_value NOT IN ('signed','unknown','submitted','confirming','review') THEN RAISE EXCEPTION 'Invalid operation transition'; END IF;
 IF state_value='signed' THEN
  IF prior.state<>'prepared' OR transaction_value !~ '^[a-f0-9]{64}$' OR protected_signed IS NULL THEN RAISE EXCEPTION 'Invalid signed reference'; END IF;
 ELSE
  IF transaction_value IS NOT NULL OR protected_signed IS NOT NULL OR (prior.signed_payload IS NULL AND state_value<>'review') OR (prior.state='prepared' AND state_value<>'review') THEN RAISE EXCEPTION 'Invalid operation transition'; END IF;
 END IF;
 UPDATE finance.operations SET state=state_value,
 transaction_ref=COALESCE(transaction_value,transaction_ref),signed_payload=COALESCE(protected_signed,signed_payload),
 lease_until=CASE WHEN state_value IN ('signed','unknown') THEN lease_until ELSE NULL END,
 run_at=now()+interval '10 seconds' WHERE id=operation;
 UPDATE finance.holds SET external_unknown=true WHERE id=prior.hold_id;
 INSERT INTO finance.attempts(operation_id,state,generation,evidence_payload) VALUES(operation,state_value,fence,protected_evidence);
 RETURN true;
END $$;

CREATE FUNCTION finance.operation_lease_valid(operation uuid,fence bigint,require_authorization boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM finance.assert_runtime();
 RETURN EXISTS(SELECT 1 FROM finance.operations o JOIN finance.assets s ON s.id=o.asset_id JOIN finance.asset_safety safety ON safety.asset_id=s.id JOIN finance.holds h ON h.id=o.hold_id JOIN public.users u ON u.id=o.owner_id JOIN public.identity_cases k ON k.user_id=u.id JOIN public.identity_attempts a ON a.id=k.current_attempt_id WHERE o.id=operation AND o.generation=fence AND o.lease_until>now() AND o.state NOT IN ('complete','failed','review') AND (NOT require_authorization OR (NOT safety.withdrawals_paused AND NOT u.restricted AND u.role='customer' AND u.country='NG' AND u.email_verified AND u.kyc_status='approved' AND u.mfa_secret IS NOT NULL AND a.id=o.identity_attempt_id AND a.revision=o.identity_revision AND a.status='approved' AND a.mode=s.mode AND a.evidence_payload IS NOT NULL AND h.remaining=o.send_units+o.fee_units)));
END $$;

CREATE FUNCTION finance.defer_operation(operation uuid,fence bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM finance.assert_runtime();
 UPDATE finance.operations SET lease_until=NULL,run_at=now()+interval '10 seconds' WHERE id=operation AND generation=fence AND lease_until>now();
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO finance.attempts(operation_id,state,generation) VALUES(operation,'deferred',fence);
 RETURN true;
END $$;

CREATE FUNCTION finance.finish_operation(operation uuid,fence bigint,state_value text,destination uuid,protected_evidence text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior finance.operations%ROWTYPE; h finance.holds%ROWTYPE; a finance.accounts%ROWTYPE; legs jsonb; j uuid;
BEGIN
 PERFORM finance.assert_runtime();
 SELECT * INTO prior FROM finance.operations WHERE id=operation FOR UPDATE;
 IF NOT FOUND OR prior.generation<>fence OR prior.lease_until IS NULL OR prior.lease_until<=now() OR prior.state IN ('complete','failed','review') OR prior.signed_payload IS NULL THEN RETURN false; END IF;
 IF protected_evidence IS NULL OR length(protected_evidence)<1 THEN RAISE EXCEPTION 'Canonical evidence required'; END IF;
 IF state_value NOT IN ('complete','failed') THEN RAISE EXCEPTION 'Invalid final state'; END IF;
 SELECT * INTO h FROM finance.holds WHERE id=prior.hold_id FOR UPDATE;
 SELECT * INTO a FROM finance.accounts WHERE id=destination;
 IF state_value='complete' AND (a.id IS NULL OR a.asset_id<>prior.asset_id OR a.owner_id IS NOT NULL OR a.purpose<>'custody' OR a.normal_side<>'debit') THEN RAISE EXCEPTION 'Invalid custody clearing account'; END IF;
 IF state_value='failed' AND destination<>h.available_id THEN RAISE EXCEPTION 'Invalid release account'; END IF;
 IF h.remaining<>prior.send_units+prior.fee_units THEN RAISE EXCEPTION 'Operation reservation changed'; END IF;
 UPDATE finance.holds SET external_unknown=false WHERE id=h.id;
 IF state_value='failed' THEN
  PERFORM finance.finish_hold_internal(h.id,prior.completion_id,'release',h.remaining::text,destination);
 ELSE
  legs:=jsonb_build_array(jsonb_build_object('accountId',h.held_id,'side','debit','units',h.remaining::text),jsonb_build_object('accountId',destination,'side','credit','units',prior.send_units::text));
  IF prior.fee_units>0 THEN legs:=legs||jsonb_build_array(jsonb_build_object('accountId',prior.fee_account_id,'side','credit','units',prior.fee_units::text)); END IF;
  j:=finance.post_internal(prior.completion_id,prior.asset_id,operation,'operation:'||operation,'custody_settlement',legs);
  UPDATE finance.holds SET remaining=0 WHERE id=h.id;
  INSERT INTO finance.hold_actions VALUES(prior.completion_id,h.id,'consume',h.remaining,destination,j);
 END IF;
 UPDATE finance.operations SET state=state_value,lease_until=NULL WHERE id=operation;
 INSERT INTO finance.attempts(operation_id,state,generation,evidence_payload) VALUES(operation,state_value,fence,protected_evidence);
 RETURN true;
END $$;

CREATE FUNCTION finance.record_event(event_id uuid,mode_value text,provider_value text,reference_value text,hash_value text,protected_value text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing finance.events%ROWTYPE;
BEGIN
 PERFORM finance.assert_runtime();
 PERFORM pg_advisory_xact_lock(hashtextextended(mode_value||':'||provider_value||':'||reference_value,718));
 SELECT * INTO existing FROM finance.events WHERE mode=mode_value AND provider=provider_value AND event_ref=reference_value;
 IF FOUND THEN
  IF existing.payload_hash<>hash_value THEN
   INSERT INTO finance.event_conflicts(event_id,payload_hash,protected_payload) VALUES(existing.id,hash_value,protected_value) ON CONFLICT DO NOTHING;
   UPDATE finance.events SET conflict=true,state='review' WHERE id=existing.id; RETURN 'conflict';
  END IF;
  RETURN 'duplicate';
 END IF;
 INSERT INTO finance.events(id,mode,provider,event_ref,payload_hash,protected_payload) VALUES(event_id,mode_value,provider_value,reference_value,hash_value,protected_value);
 RETURN 'queued';
END $$;

CREATE FUNCTION finance.finish_hold(hold_value uuid,action_value uuid,action_name text,amount_value text,destination uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM finance.assert_runtime();
 IF EXISTS(SELECT 1 FROM finance.operations WHERE hold_id=hold_value) THEN RAISE EXCEPTION 'Use controlled operation settlement'; END IF;
 RETURN finance.finish_hold_internal(hold_value,action_value,action_name,amount_value,destination);
END $$;

CREATE FUNCTION finance.operation_status(operation uuid,customer uuid,mode_value text) RETURNS TABLE(id uuid,state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM finance.assert_runtime(); RETURN QUERY SELECT o.id,o.state FROM finance.operations o JOIN finance.assets a ON a.id=o.asset_id WHERE o.id=operation AND o.owner_id=customer AND a.mode=mode_value; END $$;

CREATE FUNCTION finance.asset_info(asset uuid) RETURNS SETOF finance.assets LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM finance.assert_runtime(); RETURN QUERY SELECT * FROM finance.assets WHERE id=asset; END $$;

CREATE FUNCTION finance.claim_outbox(mode_value text) RETURNS TABLE(journal_id uuid,generation bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE selected uuid;
BEGIN
 PERFORM finance.assert_runtime();
 SELECT o.journal_id INTO selected FROM finance.outbox o JOIN finance.journals j ON j.id=o.journal_id JOIN finance.assets a ON a.id=j.asset_id WHERE a.mode=mode_value AND (o.state='queued' OR (o.state='running' AND o.lease_until<=now())) ORDER BY o.created_at,o.journal_id LIMIT 1 FOR UPDATE OF o SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY UPDATE finance.outbox o SET state='running',generation=o.generation+1,lease_until=now()+interval '30 seconds' WHERE o.journal_id=selected RETURNING o.journal_id,o.generation;
END $$;
CREATE FUNCTION finance.ack_outbox(journal uuid,fence bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM finance.assert_runtime(); UPDATE finance.outbox SET state='complete',lease_until=NULL WHERE journal_id=journal AND generation=fence AND state='running' AND lease_until>now(); RETURN FOUND; END $$;

CREATE FUNCTION finance.readiness() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM finance.assert_runtime();
 RETURN jsonb_build_object('runtimeRoleProtected',true,'custodyConfigured',false,
 'pendingJournalEvents',(SELECT count(*) FROM finance.outbox WHERE state<>'complete'),
 'unresolvedOperations',(SELECT count(*) FROM finance.operations WHERE state NOT IN ('complete','failed')),
 'conflictingEvents',(SELECT count(*) FROM finance.events WHERE conflict),
 'pausedAssets',(SELECT count(*) FROM finance.asset_safety WHERE withdrawals_paused));
END $$;

CREATE FUNCTION finance.repair_projection(account uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE balance_value numeric; prior numeric;
BEGIN
 PERFORM finance.assert_runtime();
 SELECT units INTO prior FROM finance.balances WHERE account_id=account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown ledger account'; END IF;
 SELECT COALESCE(sum(CASE WHEN e.side=a.normal_side THEN e.units ELSE -e.units END),0) INTO balance_value FROM finance.accounts a LEFT JOIN finance.entries e ON e.account_id=a.id WHERE a.id=account GROUP BY a.id;
 IF EXISTS(SELECT 1 FROM finance.accounts WHERE id=account AND nonnegative AND balance_value<0) OR abs(balance_value)>=power(10::numeric,78) THEN RAISE EXCEPTION 'Invalid journal-derived balance'; END IF;
 IF balance_value=prior THEN RETURN false; END IF;
 UPDATE finance.balances SET units=balance_value,version=version+1 WHERE account_id=account;
 INSERT INTO finance.reconciliation_runs(id,mode,result) SELECT gen_random_uuid(),s.mode,jsonb_build_object('projectionRepaired',true,'accountId',account,'previousUnits',prior::text,'restoredUnits',balance_value::text,'actor',session_user) FROM finance.accounts a JOIN finance.assets s ON s.id=a.asset_id WHERE a.id=account;
 RETURN true;
END $$;

CREATE FUNCTION finance.reconcile(mode_value text,observations jsonb,protected_evidence text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result_value jsonb; versions_value jsonb; drift bigint; unbalanced bigint; unknown_count bigint; missing_count bigint; custody_count bigint; id_value uuid; observed numeric; stored numeric; observation jsonb;
BEGIN
 PERFORM finance.assert_runtime();
 IF mode_value NOT IN ('sandbox','live') OR jsonb_typeof(observations)<>'array' OR jsonb_array_length(observations)>1000 OR protected_evidence IS NULL OR length(protected_evidence)<1 THEN RAISE EXCEPTION 'Invalid reconciliation scope'; END IF;
 FOR observation IN SELECT value FROM jsonb_array_elements(observations) LOOP
  IF jsonb_typeof(observation)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(observation))<>2 OR jsonb_typeof(observation->'units')<>'string' OR observation->>'units' !~ '^(0|[1-9][0-9]{0,77})$' OR NOT EXISTS(SELECT 1 FROM finance.accounts a JOIN finance.assets s ON s.id=a.asset_id WHERE a.id=(observation->>'accountId')::uuid AND a.purpose='custody' AND s.mode=mode_value) THEN RAISE EXCEPTION 'Invalid custody observation'; END IF;
 END LOOP;
 -- Lock asset controls before balances, as prepare_operation does.
 PERFORM s.asset_id FROM finance.asset_safety s JOIN finance.assets a ON a.id=s.asset_id WHERE a.mode=mode_value ORDER BY s.asset_id FOR UPDATE OF s;
 -- Same account-lock ordering as postings gives a consistent comparison point.
 PERFORM b.account_id FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id JOIN finance.assets s ON s.id=a.asset_id WHERE s.mode=mode_value ORDER BY b.account_id FOR UPDATE;
 SELECT count(*) INTO drift FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id JOIN finance.assets s ON s.id=a.asset_id WHERE s.mode=mode_value AND b.units<>COALESCE((SELECT sum(CASE WHEN e.side=a.normal_side THEN e.units ELSE -e.units END) FROM finance.entries e WHERE e.account_id=a.id),0);
 SELECT count(*) INTO unbalanced FROM (SELECT j.id FROM finance.journals j JOIN finance.assets a ON a.id=j.asset_id LEFT JOIN finance.entries e ON e.journal_id=j.id WHERE a.mode=mode_value GROUP BY j.id HAVING count(e.journal_id)<2 OR sum(CASE e.side WHEN 'debit' THEN e.units ELSE -e.units END)<>0) q;
 SELECT count(*) INTO unknown_count FROM finance.operations o JOIN finance.assets a ON a.id=o.asset_id WHERE a.mode=mode_value AND o.state NOT IN ('complete','failed');
 missing_count:=0; custody_count:=0;
 FOR id_value IN SELECT a.id FROM finance.accounts a JOIN finance.assets s ON s.id=a.asset_id WHERE s.mode=mode_value AND a.purpose='custody' LOOP
  custody_count:=custody_count+1;
  IF (SELECT count(*) FROM jsonb_array_elements(observations) o WHERE o->>'accountId'=id_value::text)<>1 THEN missing_count:=missing_count+1; CONTINUE; END IF;
  SELECT (o->>'units')::numeric INTO observed FROM jsonb_array_elements(observations) o WHERE o->>'accountId'=id_value::text AND jsonb_typeof(o->'units')='string';
  SELECT units INTO stored FROM finance.balances WHERE account_id=id_value;
  IF observed IS NULL OR observed<>stored THEN missing_count:=missing_count+1; END IF;
 END LOOP;
 -- Conservative mode-wide pause. Existing observations and obligations remain saved.
 IF drift>0 OR unbalanced>0 OR missing_count>0 THEN
  UPDATE finance.asset_safety safety SET withdrawals_paused=true,reason='reconciliation_review',updated_at=now() FROM finance.assets a WHERE a.id=safety.asset_id AND a.mode=mode_value;
 END IF;
 SELECT COALESCE(jsonb_object_agg(b.account_id::text,b.version::text),'{}'::jsonb) INTO versions_value FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id JOIN finance.assets s ON s.id=a.asset_id WHERE s.mode=mode_value;
 result_value:=jsonb_build_object('projectionDifferences',drift,'unbalancedJournals',unbalanced,'unresolvedOperations',unknown_count,'custodyDifferencesOrMissing',missing_count,'custodyAccountCount',custody_count,'versionSnapshot',versions_value,'reconciled',custody_count>0 AND drift=0 AND unbalanced=0 AND unknown_count=0 AND missing_count=0);
 INSERT INTO finance.reconciliation_runs(id,mode,result,evidence_payload) VALUES(gen_random_uuid(),mode_value,result_value,protected_evidence);
 RETURN result_value;
END $$;

-- Explicit operator action after a fresh, complete reconciliation; never automatic.
CREATE FUNCTION finance.resume_asset(asset uuid,reconciliation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE mode_value text; versions_value jsonb;
BEGIN
 PERFORM finance.assert_runtime();
 SELECT mode INTO mode_value FROM finance.assets WHERE id=asset;
 PERFORM s.asset_id FROM finance.asset_safety s JOIN finance.assets a ON a.id=s.asset_id WHERE a.mode=mode_value ORDER BY s.asset_id FOR UPDATE OF s;
 PERFORM b.account_id FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id JOIN finance.assets s ON s.id=a.asset_id WHERE s.mode=mode_value ORDER BY b.account_id FOR UPDATE;
 SELECT COALESCE(jsonb_object_agg(b.account_id::text,b.version::text),'{}'::jsonb) INTO versions_value FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id JOIN finance.assets s ON s.id=a.asset_id WHERE s.mode=mode_value;
 IF NOT EXISTS(SELECT 1 FROM finance.reconciliation_runs r WHERE r.id=reconciliation AND r.mode=mode_value AND r.result->>'reconciled'='true' AND r.result->'versionSnapshot'=versions_value AND r.created_at>now()-interval '5 minutes' AND r.id=(SELECT recent.id FROM finance.reconciliation_runs recent WHERE recent.mode=mode_value ORDER BY recent.created_at DESC,recent.id DESC LIMIT 1)) THEN RAISE EXCEPTION 'Fresh complete reconciliation required'; END IF;
 IF EXISTS(SELECT 1 FROM finance.operations WHERE asset_id=asset AND state NOT IN ('complete','failed')) THEN RAISE EXCEPTION 'Outstanding operations require review'; END IF;
 UPDATE finance.asset_safety SET withdrawals_paused=false,reason=NULL,updated_at=now() WHERE asset_id=asset AND withdrawals_paused;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO finance.reconciliation_runs(id,mode,result) VALUES(gen_random_uuid(),mode_value,jsonb_build_object('assetResumed',asset,'basis',reconciliation,'actor',session_user));
 RETURN true;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA finance FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA finance FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance FROM PUBLIC;
