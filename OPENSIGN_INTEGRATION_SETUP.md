# OpenSign Integration Setup

## 1. Run SQL migration

Run:

- `Database-Migrations/2026-04-30-opensign-forms-and-agreements.sql`

in Supabase SQL Editor.

## 2. Add environment variables

In local `.env`:

- `VITE_OPENSIGN_BASE_URL=http://localhost:3001`
- `VITE_OPENSIGN_DISPATCH_FUNCTION=opensign-dispatch`

For production later:

- `VITE_OPENSIGN_BASE_URL=https://sign.venue221.net`

## 3. Create Supabase Edge Function

Create function named `opensign-dispatch`.

Purpose:

- Receive booking + template payload from manager portal
- Create/send document in OpenSign (renter signs first, venue signs second)
- Send notification email to `notify_email` when renter submits and status becomes `awaiting_manager_approval`
- Return document metadata and draft/signed URLs

Expected request body:

```json
{
  "agreement_id": 123,
  "reservation": {
    "id": 11,
    "date": "2026-05-18",
    "booking_type": "full_day",
    "start_hour": 8,
    "end_hour": 21,
    "renter_name": "Jane Doe",
    "renter_email": "jane@example.com",
    "renter_phone": "555-555-5555",
    "event_type": "Wedding"
  },
  "template": {
    "id": 1,
    "name": "Venue 221 Rental Agreement",
    "file_url": "https://..."
  },
  "notify_email": "manager@venue221.net",
  "venue_signer_email": "contracts@venue221.net",
  "approval_required": true
}
```

Expected success response:

```json
{
  "opensign_document_id": "doc_abc123",
  "agreement_status": "sent",
  "opensign_draft_url": "https://sign.../document/doc_abc123",
  "draft_pdf_url": "https://...",
  "signed_pdf_url": null
}
```

## 4. Webhook follow-up (recommended)

Create another edge function (example: `opensign-webhook`) and configure OpenSign webhooks to:

- update `booking_agreements.agreement_status`
- set `completed_at` when signed
- copy signed PDF into Supabase Storage bucket (`rental-agreements/signed/...`)
- update `booking_reservations.status` from `pending` to `booked` when completed

## 5. Manager domain behavior

The manager UI changes are domain-agnostic. In production:

- serve manager portal at `manager.venue221.net`
- keep OpenSign at `sign.venue221.net`

Only env and reverse-proxy/DNS settings need to change.
