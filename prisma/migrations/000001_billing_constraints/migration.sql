ALTER TABLE "credit_accounts"
  ADD CONSTRAINT "credit_accounts_balance_non_negative" CHECK ("balance" >= 0),
  ADD CONSTRAINT "credit_accounts_reserved_non_negative" CHECK ("reserved" >= 0),
  ADD CONSTRAINT "credit_accounts_reserved_not_above_balance" CHECK ("reserved" <= "balance");
