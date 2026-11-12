# Security and release checklist

- Never commit `.clasp.json`, `.clasp.json` tokens, `.env.local`, Google Sheet data, PINs or session tokens.
- Restrict Google Sheet access and Google Account rights. Rotate Apps Script deploy access and PINs after suspicion of compromise.
- PIN is 6 digits by product requirement; GAS limits failed attempts. Consider longer codes and 2FA for stronger protection.
- Public Worker URL is not an authentication mechanism. All read/write actions must be checked in Apps Script.
- For production use test more than one device, shared/private account separation, offline outbox, idempotent retries, and malformed request validation.
- Session tokens are stored encrypted with AES-GCM derived from PIN, but transactional IndexedDB data is not encrypted at rest.
- Email reminders opt-in only; do not enable trigger before cloud sync is operating.
- Set `VITE_API_URL` as a GitHub Actions **variable**, not as a secret: it is a public endpoint. Do not expose a real token or Sheets ID in frontend env.
- Back up spreadsheet regularly. Deleting IndexedDB before sync can permanently lose unsent transactions.
