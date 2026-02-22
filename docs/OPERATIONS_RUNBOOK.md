# TovalTech Operations Runbook

## 1. Secrets Rotation

### OpenAI / MercadoPago / Webhook / Cron
1. Create a new key/secret in the provider console.
2. Update Azure Static Web Apps application settings:
   - `OPENAI_API_KEY`
   - `MP_ACCESS_TOKEN`
   - `MP_WEBHOOK_SECRET`
   - `CRON_SECRET`
   - `WEB3FORMS_ACCESS_KEY`
3. Save settings and trigger a redeploy.
4. Validate health endpoint: `GET /api/health` (admin) and confirm `config_ok=true`.
5. Revoke old key in provider console only after validation succeeds.

## 2. Pre-Deploy Checklist
1. `npm run check` passes locally.
2. DB migrations in `migrations/` are reviewed and idempotent.
3. Checkout flow smoke-tested:
   - `POST /api/checkout-quote`
   - `POST /api/create-preference` with returned `quote_id`
4. Admin guard tested:
   - `/api/products?admin=1` without admin principal returns `403`.
5. Contact form tested through `/api/contact`.

## 3. Post-Deploy Checklist
1. Open `/api/health` with admin session and verify:
   - `ok = true`
   - `db = true`
   - all required checks true.
2. Create a real quote and preference in production.
3. Confirm MP webhook receives signed events and stores orders.
4. Confirm cron sync is authorized (`CRON_SECRET` required).

## 4. Incident Response

### Payments not being created
1. Check `MP_ACCESS_TOKEN` in Azure settings.
2. Inspect function logs for `create_preference_failed` and `trace_id`.
3. Validate quote existence and expiration in `dbo.tovaltech_checkout_quotes`.

### Webhook not processing
1. Verify `MP_WEBHOOK_SECRET` matches MercadoPago panel.
2. Confirm signature headers are present (`x-signature`, `x-request-id`).
3. Check logs for `mp_webhook_invalid_signature` and `trace_id`.

### Sync timer not running
1. Verify `CRON_SECRET` configured.
2. Validate cron caller sends matching `?secret=` or `x-cron-secret`.
3. Check `last_sync_result` in `dbo.tovaltech_settings`.

## 5. Rollback
1. Revert to last green commit in GitHub (`main`).
2. Redeploy through GitHub Actions.
3. Re-run post-deploy checklist.
4. If migration introduced issues, apply dedicated rollback SQL script (do not drop data blindly).

## 6. Known Risks
1. `xlsx` dependency has known advisory without published npm fix.
2. `scripts/audit-api.cjs` currently allowlists only `xlsx`; any additional advisory fails CI.
