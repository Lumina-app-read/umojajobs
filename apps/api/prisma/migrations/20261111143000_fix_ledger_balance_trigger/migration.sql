-- Correctif : le champ lu dans NEW dépend de la table déclencheuse (PL/pgSQL résout chaque
-- référence à NEW à l'exécution, y compris dans une branche CASE non retenue).
CREATE OR REPLACE FUNCTION "ledger_assert_balanced"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  tx_id uuid;
  lines integer;
  total_debit numeric;
  total_credit numeric;
BEGIN
  IF TG_TABLE_NAME = 'ledger_transactions' THEN
    tx_id := NEW."id";
  ELSE
    tx_id := NEW."transaction_id";
  END IF;
  SELECT count(*), coalesce(sum("debit"), 0), coalesce(sum("credit"), 0)
    INTO lines, total_debit, total_credit
    FROM "ledger_entries" WHERE "transaction_id" = tx_id;
  IF lines < 2 OR total_debit <> total_credit THEN
    RAISE EXCEPTION 'Transaction comptable % déséquilibrée (% lignes, débit %, crédit %)',
      tx_id, lines, total_debit, total_credit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
