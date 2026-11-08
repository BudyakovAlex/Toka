# TOKA Boryspil monitor

Production: https://toka-monitor-boryspil.vercel.app/api/check

Uses the official website JSON endpoints, without browser sessions or EVBOOST:

| Station | TOKA API ID | Connector |
|---|---:|---|
| #1134 Спортшкола | 1212 | GB/T DC |
| #1315 Salt GastroBar | 1541 | GB/T DC |
| #1103 Sinsay | 1174 | GB/T AC |

External cron-job.org invokes GET or POST /api/check. Minimum interval is 120 seconds, enforced persistently. This is a minimum interval, not a scheduler. The external job must be set to every 2 minutes; GitHub scheduled monitoring is removed to prevent duplicate notifications. workflow_dispatch is a read-only diagnostic.

State is saved to private Vercel Blob `toka-direct-v1.json`, separate from legacy HTML-derived states. Initial observations are silent. Notifications contain only changes of the selected connector's normalized status. Codes 0 and 5 both mean available; HTTP/schema errors retain previous status and are never interpreted as outages. Unknown is notified only when explicitly reported as code 4 by TOKA. Timestamps are fetch observation times, not operator update times.

Compare-and-swap ETags serialize invocations; a 90-second lease recovers after crashes. The function timeout is 60 seconds. Saved outbox retries failed sends. Delivery is at-least-once: a crash after Telegram accepts a message can cause a duplicate. Errors are returned to the scheduler and logged; no error-spam is sent to Telegram.

Health: GET /api/check?mode=health (configuration booleans only).
Cached status: GET /api/check?mode=status (no upstream request or Telegram message).

Existing public scheduler compatibility is preserved. Persistent throttling prevents additional checks within 120 seconds. State is private. Existing BLOB_READ_WRITE_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID remain in Vercel environment; never commit values.

401/403/428 from TOKA permanently halt further source reads until manual state repair; 429 honors Retry-After with a minimum 2-minute cooldown (default 15 minutes). Polling permission, quotas, and data freshness SLA are not published/confirmed; respect operator restrictions and contact TOKA if needed.

Run `npm ci && npm test`. `node monitor.mjs` performs a one-shot read-only live diagnostic. No Telegram messages are sent by diagnostics or tests.
