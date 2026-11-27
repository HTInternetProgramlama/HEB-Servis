-- Backward-compatible, nullable diagnostics for each access email attempt.
-- Messages are application-owned safe explanations; never provider error text.
alter table customer_access_deliveries
  add column error_code text,
  add column error_message text,
  add column completed_at timestamptz;
alter table customer_access_deliveries add constraint customer_access_delivery_safe_code
  check (error_code is null or error_code in (
    'email_address_not_authorized', 'over_email_send_rate_limit', 'over_request_rate_limit',
    'email_address_invalid', 'smtp_send_failed', 'email_delivery_unknown', 'test_address_not_deliverable'
  ));
alter table customer_access_deliveries add constraint customer_access_delivery_message_length
  check (error_message is null or length(error_message) <= 500);
comment on column customer_access_deliveries.error_code is 'Allowlisted diagnostic code; raw provider errors are never stored.';
comment on column customer_access_deliveries.error_message is 'Fixed application explanation only; no recipients, tokens or raw provider messages.';
-- Existing role/RLS restrictions remain unchanged. Historical attempts stay NULL.
