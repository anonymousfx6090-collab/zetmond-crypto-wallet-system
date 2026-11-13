-- Private accounting schema. No funding, key, provider or customer balance is seeded.
CREATE SCHEMA finance;
REVOKE ALL ON SCHEMA finance FROM PUBLIC;

CREATE TABLE finance.assets (
 id uuid PRIMARY KEY, code text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{0,39}$'),
 network text NOT NULL CHECK (network ~ '^[a-z0-9_-]{1,50}$'),
 mode text NOT NULL CHECK (mode IN ('sandbox','live')),
 decimals integer NOT NULL CHECK (decimals BETWEEN 0 AND 18),
 contract_ref text CHECK (length(contract_ref) BETWEEN 1 AND 200),
 UNIQUE(code,network,mode)
);
CREATE TABLE finance.accounts (
 id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES finance.assets(id),
 owner_id uuid REFERENCES public.users(id),
 purpose text NOT NULL CHECK (purpose IN ('available','trade_held','collateral_held','withdrawal_held','custody','clearing','unmatched','payout','refund','fee_liability','revenue','expense','equity')),
 normal_side text NOT NULL CHECK (normal_side IN ('debit','credit')),
 nonnegative boolean NOT NULL CHECK(nonnegative),
 CHECK(purpose NOT IN ('available','trade_held','collateral_held','withdrawal_held') OR owner_id IS NOT NULL),
 CHECK (owner_id IS NULL OR (purpose IN ('available','trade_held','collateral_held','withdrawal_held') AND normal_side='credit' AND nonnegative)),
 CHECK(purpose NOT IN ('custody','expense') OR normal_side='debit'),
 CHECK(purpose NOT IN ('available','trade_held','collateral_held','withdrawal_held','unmatched','payout','refund','fee_liability','revenue') OR normal_side='credit'),
 UNIQUE NULLS NOT DISTINCT (asset_id,owner_id,purpose)
);
CREATE TABLE finance.asset_safety (
 asset_id uuid PRIMARY KEY REFERENCES finance.assets(id), withdrawals_paused boolean NOT NULL DEFAULT false,
 reason text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION finance.initialize_asset_safety() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN INSERT INTO finance.asset_safety(asset_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER finance_asset_safety AFTER INSERT ON finance.assets FOR EACH ROW EXECUTE FUNCTION finance.initialize_asset_safety();
CREATE TABLE finance.balances (
 account_id uuid PRIMARY KEY REFERENCES finance.accounts(id),
 units numeric(78,0) NOT NULL DEFAULT 0,
 version bigint NOT NULL DEFAULT 0 CHECK(version>=0)
);
CREATE TABLE finance.journals (
 id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES finance.assets(id),
 operation_id uuid NOT NULL, posting_key text NOT NULL CHECK(length(posting_key) BETWEEN 1 AND 150),
 kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]{0,49}$'),
 payload jsonb NOT NULL, reverses_id uuid REFERENCES finance.journals(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(asset_id,posting_key), UNIQUE(reverses_id)
);
CREATE TABLE finance.entries (
 journal_id uuid NOT NULL REFERENCES finance.journals(id), line integer NOT NULL,
 account_id uuid NOT NULL REFERENCES finance.accounts(id),
 side text NOT NULL CHECK(side IN ('debit','credit')),
 units numeric(78,0) NOT NULL CHECK(units>0), PRIMARY KEY(journal_id,line)
);
CREATE INDEX finance_entries_account ON finance.entries(account_id);
CREATE TABLE finance.outbox (
 journal_id uuid PRIMARY KEY REFERENCES finance.journals(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','complete')),
 generation bigint NOT NULL DEFAULT 0,
 lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE finance.holds (
 id uuid PRIMARY KEY, available_id uuid NOT NULL REFERENCES finance.accounts(id),
 held_id uuid NOT NULL REFERENCES finance.accounts(id),
 total numeric(78,0) NOT NULL CHECK(total>0), remaining numeric(78,0) NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('trade_held','collateral_held','withdrawal_held')),
 expires_at timestamptz, external_unknown boolean NOT NULL DEFAULT false,
 CHECK(remaining BETWEEN 0 AND total), CHECK(available_id<>held_id)
);
CREATE TABLE finance.hold_actions (
 id uuid PRIMARY KEY, hold_id uuid NOT NULL REFERENCES finance.holds(id),
 action text NOT NULL CHECK(action IN ('reserve','release','consume')),
 units numeric(78,0) NOT NULL CHECK(units>0), destination_id uuid NOT NULL REFERENCES finance.accounts(id),
 journal_id uuid NOT NULL REFERENCES finance.journals(id), UNIQUE(journal_id)
);

CREATE FUNCTION finance.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Immutable financial record'; END $$;
CREATE TRIGGER finance_journals_immutable BEFORE UPDATE OR DELETE ON finance.journals FOR EACH ROW EXECUTE FUNCTION finance.immutable();
CREATE TRIGGER finance_entries_immutable BEFORE UPDATE OR DELETE ON finance.entries FOR EACH ROW EXECUTE FUNCTION finance.immutable();
CREATE TRIGGER finance_assets_immutable BEFORE UPDATE OR DELETE ON finance.assets FOR EACH ROW EXECUTE FUNCTION finance.immutable();
CREATE TRIGGER finance_accounts_immutable BEFORE UPDATE OR DELETE ON finance.accounts FOR EACH ROW EXECUTE FUNCTION finance.immutable();
CREATE TRIGGER finance_actions_immutable BEFORE UPDATE OR DELETE ON finance.hold_actions FOR EACH ROW EXECUTE FUNCTION finance.immutable();

CREATE FUNCTION finance.assert_journal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE journal uuid; asset uuid; total numeric; legs integer;
BEGIN
 IF TG_TABLE_NAME='journals' THEN journal:=NEW.id; ELSE journal:=NEW.journal_id; END IF;
 SELECT asset_id INTO asset FROM finance.journals WHERE id=journal;
 SELECT count(*),sum(CASE WHEN side='debit' THEN units ELSE -units END) INTO legs,total FROM finance.entries WHERE journal_id=journal;
 IF legs<2 OR total<>0 OR EXISTS(SELECT 1 FROM finance.entries e JOIN finance.accounts a ON a.id=e.account_id WHERE e.journal_id=journal AND a.asset_id<>asset) THEN
  RAISE EXCEPTION 'Invalid balanced journal';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_journal_balance AFTER INSERT ON finance.journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance.assert_journal();
CREATE CONSTRAINT TRIGGER finance_entry_balance AFTER INSERT ON finance.entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance.assert_journal();

-- SECURITY DEFINER functions identify the original login/SET ROLE, not the definer.
CREATE FUNCTION finance.assert_runtime() RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE caller text; owner_name text;
BEGIN
 caller := CASE WHEN current_setting('role')='none' THEN session_user ELSE current_setting('role') END;
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='finance.journals'::regclass;
 IF caller=owner_name OR pg_has_role(caller,owner_name,'MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=caller AND (rolsuper OR rolcreaterole))
 OR EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='finance' AND t.relkind IN ('r','p') AND has_table_privilege(caller,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE'))
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finance' AND p.proname IN ('post_internal','finish_hold_internal') AND has_function_privilege(caller,p.oid,'EXECUTE'))
 OR has_schema_privilege(caller,'finance','CREATE') THEN RAISE EXCEPTION 'Separate financial runtime role required'; END IF;
END $$;
CREATE FUNCTION finance.units(value text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF value IS NULL OR value !~ '^[1-9][0-9]{0,77}$' THEN RAISE EXCEPTION 'Invalid atomic units'; END IF;
 RETURN value::numeric;
END $$;

CREATE FUNCTION finance.create_account(account uuid,asset uuid,customer uuid,purpose_value text,side_value text,nonnegative_value boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing finance.accounts%ROWTYPE;
BEGIN
 PERFORM finance.assert_runtime();
 PERFORM pg_advisory_xact_lock(hashtextextended(account::text,714));
 SELECT * INTO existing FROM finance.accounts WHERE id=account;
 IF FOUND THEN
  IF existing.asset_id<>asset OR existing.owner_id IS DISTINCT FROM customer OR existing.purpose<>purpose_value OR existing.normal_side<>side_value OR existing.nonnegative<>nonnegative_value THEN RAISE EXCEPTION 'Account scope conflict'; END IF;
  RETURN account;
 END IF;
 IF customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=customer AND role='customer' AND country='NG') THEN RAISE EXCEPTION 'Unsupported customer account'; END IF;
 INSERT INTO finance.accounts VALUES(account,asset,customer,purpose_value,side_value,nonnegative_value);
 INSERT INTO finance.balances(account_id) VALUES(account);
 RETURN account;
END $$;

CREATE FUNCTION finance.post_internal(journal uuid,asset uuid,operation uuid,key_value text,kind_value text,legs jsonb,reversal uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing finance.journals%ROWTYPE; payload_value jsonb; leg jsonb; account_value uuid; amount numeric; total numeric:=0; position integer:=0;
BEGIN
 PERFORM finance.assert_runtime();
 IF jsonb_typeof(legs)<>'array' OR jsonb_array_length(legs) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Invalid journal legs'; END IF;
 IF kind_value='test_fixture' AND current_database() !~ '_test$' THEN RAISE EXCEPTION 'Fixture funding is test-only'; END IF;
 payload_value:=jsonb_build_object('asset',asset,'operation',operation,'key',key_value,'kind',kind_value,'legs',legs,'reversal',reversal);
 PERFORM pg_advisory_xact_lock(hashtextextended(asset::text||':'||key_value,715));
 SELECT * INTO existing FROM finance.journals WHERE asset_id=asset AND posting_key=key_value;
 IF FOUND THEN
  IF existing.payload<>payload_value THEN RAISE EXCEPTION 'Financial operation conflict'; END IF;
  RETURN existing.id;
 END IF;
 IF EXISTS(SELECT 1 FROM finance.journals WHERE id=journal) THEN RAISE EXCEPTION 'Journal identity conflict'; END IF;
 FOR leg IN SELECT value FROM jsonb_array_elements(legs) LOOP
  IF jsonb_typeof(leg)<>'object' OR jsonb_typeof(leg->'units')<>'string' OR NOT(leg ?& ARRAY['accountId','side','units'])
   OR (SELECT count(*) FROM jsonb_object_keys(leg))<>3 OR leg->>'side' NOT IN ('debit','credit') THEN RAISE EXCEPTION 'Invalid posting leg'; END IF;
  amount:=finance.units(leg->>'units'); account_value:=(leg->>'accountId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM finance.accounts WHERE id=account_value AND asset_id=asset) THEN RAISE EXCEPTION 'Invalid account asset'; END IF;
  total:=total+CASE WHEN leg->>'side'='debit' THEN amount ELSE -amount END;
 END LOOP;
 IF total<>0 THEN RAISE EXCEPTION 'Unbalanced posting'; END IF;
 -- Every account projection is locked in one deterministic order before checking funds.
 PERFORM b.account_id FROM finance.balances b WHERE b.account_id IN (SELECT (v->>'accountId')::uuid FROM jsonb_array_elements(legs) v) ORDER BY b.account_id FOR UPDATE;
 IF reversal IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM finance.journals j WHERE j.id=reversal AND j.asset_id=asset) THEN RAISE EXCEPTION 'Invalid reversal'; END IF;
  IF EXISTS(
    (SELECT e.account_id,CASE e.side WHEN 'debit' THEN 'credit' ELSE 'debit' END AS side,sum(e.units) AS units FROM finance.entries e WHERE e.journal_id=reversal GROUP BY 1,2
     EXCEPT SELECT (v->>'accountId')::uuid,v->>'side',sum(finance.units(v->>'units')) FROM jsonb_array_elements(legs) v GROUP BY 1,2)
    UNION ALL
    (SELECT (v->>'accountId')::uuid,v->>'side',sum(finance.units(v->>'units')) FROM jsonb_array_elements(legs) v GROUP BY 1,2
     EXCEPT SELECT e.account_id,CASE e.side WHEN 'debit' THEN 'credit' ELSE 'debit' END,sum(e.units) FROM finance.entries e WHERE e.journal_id=reversal GROUP BY 1,2)
  ) THEN RAISE EXCEPTION 'Reversal must exactly compensate original'; END IF;
 END IF;
 FOR account_value IN SELECT DISTINCT (v->>'accountId')::uuid FROM jsonb_array_elements(legs) v ORDER BY 1 LOOP
  SELECT sum(CASE WHEN v->>'side'=a.normal_side THEN finance.units(v->>'units') ELSE -finance.units(v->>'units') END)
   INTO amount FROM jsonb_array_elements(legs) v JOIN finance.accounts a ON a.id=(v->>'accountId')::uuid WHERE a.id=account_value;
  IF EXISTS(SELECT 1 FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id WHERE b.account_id=account_value AND (abs(b.units+amount)>=power(10::numeric,78) OR (a.nonnegative AND b.units+amount<0))) THEN RAISE EXCEPTION 'Insufficient balance or amount overflow'; END IF;
  IF EXISTS(SELECT 1 FROM finance.balances b JOIN finance.accounts a ON a.id=b.account_id WHERE b.account_id=account_value AND b.units<>COALESCE((SELECT sum(CASE WHEN e.side=a.normal_side THEN e.units ELSE -e.units END) FROM finance.entries e WHERE e.account_id=a.id),0)) THEN RAISE EXCEPTION 'Ledger projection requires reconciliation'; END IF;
  UPDATE finance.balances SET units=units+amount,version=version+1 WHERE account_id=account_value;
 END LOOP;
 INSERT INTO finance.journals(id,asset_id,operation_id,posting_key,kind,payload,reverses_id) VALUES(journal,asset,operation,key_value,kind_value,payload_value,reversal);
 FOR leg IN SELECT value FROM jsonb_array_elements(legs) LOOP
  position:=position+1;
  INSERT INTO finance.entries VALUES(journal,position,(leg->>'accountId')::uuid,leg->>'side',finance.units(leg->>'units'));
 END LOOP;
 INSERT INTO finance.outbox(journal_id) VALUES(journal);
 RETURN journal;
END $$;

CREATE FUNCTION finance.reserve(hold_value uuid,action_value uuid,available_value uuid,held_value uuid,amount_value text,expiry timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h finance.holds%ROWTYPE; a finance.accounts%ROWTYPE; b finance.accounts%ROWTYPE; j uuid; amount numeric;
BEGIN
 PERFORM finance.assert_runtime(); amount:=finance.units(amount_value);
 PERFORM pg_advisory_xact_lock(hashtextextended(hold_value::text,716));
 SELECT * INTO h FROM finance.holds WHERE id=hold_value;
 IF FOUND THEN
  IF h.available_id<>available_value OR h.held_id<>held_value OR h.total<>amount OR h.expires_at IS DISTINCT FROM expiry
   OR NOT EXISTS(SELECT 1 FROM finance.hold_actions WHERE id=action_value AND hold_id=hold_value AND action='reserve') THEN RAISE EXCEPTION 'Hold scope conflict'; END IF;
  RETURN hold_value;
 END IF;
 SELECT * INTO a FROM finance.accounts WHERE id=available_value;
 SELECT * INTO b FROM finance.accounts WHERE id=held_value;
 IF a.id IS NULL OR b.id IS NULL OR a.purpose<>'available' OR a.owner_id IS NULL OR a.owner_id IS DISTINCT FROM b.owner_id OR a.asset_id<>b.asset_id OR b.purpose NOT IN ('trade_held','collateral_held','withdrawal_held') THEN RAISE EXCEPTION 'Invalid hold accounts'; END IF;
 PERFORM asset_id FROM finance.asset_safety WHERE asset_id=a.asset_id FOR SHARE;
 IF EXISTS(SELECT 1 FROM finance.asset_safety WHERE asset_id=a.asset_id AND withdrawals_paused) THEN RAISE EXCEPTION 'Asset requires reconciliation review'; END IF;
 j:=finance.post_internal(action_value,a.asset_id,hold_value,'hold:'||action_value,'hold_reserve',jsonb_build_array(jsonb_build_object('accountId',a.id,'side','debit','units',amount_value),jsonb_build_object('accountId',b.id,'side','credit','units',amount_value)));
 INSERT INTO finance.holds VALUES(hold_value,available_value,held_value,amount,amount,b.purpose,expiry,false);
 INSERT INTO finance.hold_actions VALUES(action_value,hold_value,'reserve',amount,held_value,j);
 RETURN hold_value;
END $$;

CREATE FUNCTION finance.finish_hold_internal(hold_value uuid,action_value uuid,action_name text,amount_value text,destination uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h finance.holds%ROWTYPE; a finance.accounts%ROWTYPE; d finance.accounts%ROWTYPE; prior finance.hold_actions%ROWTYPE; amount numeric; j uuid;
BEGIN
 PERFORM finance.assert_runtime(); amount:=finance.units(amount_value);
 PERFORM pg_advisory_xact_lock(hashtextextended(hold_value::text,716));
 SELECT * INTO h FROM finance.holds WHERE id=hold_value FOR UPDATE;
 IF NOT FOUND OR action_name NOT IN ('release','consume') THEN RAISE EXCEPTION 'Invalid hold action'; END IF;
 SELECT * INTO prior FROM finance.hold_actions WHERE id=action_value;
 IF FOUND THEN
  IF prior.hold_id<>hold_value OR prior.action<>action_name OR prior.units<>amount OR prior.destination_id<>destination THEN RAISE EXCEPTION 'Hold action conflict'; END IF;
  RETURN prior.journal_id;
 END IF;
 IF h.external_unknown OR amount>h.remaining THEN RAISE EXCEPTION 'Hold outcome unknown or insufficient remaining units'; END IF;
 SELECT * INTO a FROM finance.accounts WHERE id=h.held_id;
 SELECT * INTO d FROM finance.accounts WHERE id=destination;
 IF d.id IS NULL OR d.asset_id<>a.asset_id OR d.purpose IN ('trade_held','collateral_held','withdrawal_held') OR (action_name='release' AND destination<>h.available_id) THEN RAISE EXCEPTION 'Invalid hold destination'; END IF;
 j:=finance.post_internal(action_value,a.asset_id,hold_value,'hold:'||action_value,'hold_'||action_name,jsonb_build_array(jsonb_build_object('accountId',a.id,'side','debit','units',amount_value),jsonb_build_object('accountId',destination,'side','credit','units',amount_value)));
 UPDATE finance.holds SET remaining=remaining-amount WHERE id=hold_value;
 INSERT INTO finance.hold_actions VALUES(action_value,hold_value,action_name,amount,destination,j);
 RETURN j;
END $$;

CREATE FUNCTION finance.post(journal uuid,asset uuid,operation uuid,key_value text,kind_value text,legs jsonb,reversal uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM finance.assert_runtime();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(legs) v JOIN finance.accounts a ON a.id=(v->>'accountId')::uuid WHERE a.purpose IN ('trade_held','collateral_held','withdrawal_held')) THEN RAISE EXCEPTION 'Use controlled hold commands'; END IF;
 IF kind_value='correction' AND reversal IS NULL THEN RAISE EXCEPTION 'Linked correction required'; END IF;
 RETURN finance.post_internal(journal,asset,operation,key_value,kind_value,legs,reversal);
END $$;

CREATE FUNCTION finance.read_balances(customer uuid,mode_value text) RETURNS TABLE(account_id uuid,asset_id uuid,code text,network text,purpose text,units text,version text,spending_paused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM finance.assert_runtime();
 RETURN QUERY SELECT a.id,s.id,s.code,s.network,a.purpose,b.units::text,b.version::text,safety.withdrawals_paused FROM finance.accounts a JOIN finance.assets s ON s.id=a.asset_id JOIN finance.asset_safety safety ON safety.asset_id=s.id JOIN finance.balances b ON b.account_id=a.id WHERE a.owner_id=customer AND s.mode=mode_value ORDER BY a.id;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA finance FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance FROM PUBLIC;
