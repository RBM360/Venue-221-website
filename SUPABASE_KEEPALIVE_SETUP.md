# Supabase Keepalive Setup

This repository includes a scheduled GitHub Actions workflow at:

- `.github/workflows/supabase-keepalive.yml`

It sends a lightweight request to your Supabase REST API every 6 hours to reduce inactivity pauses on free-tier projects.

## 1. Add GitHub repository secrets

In your GitHub repo:

1. Go to `Settings` -> `Secrets and variables` -> `Actions`
2. Add these secrets:
   - `SUPABASE_URL` (example: `https://xyzcompany.supabase.co`)
   - `SUPABASE_ANON_KEY` (your project anon/public key)

Use the same values already used in your local `.env`:

- `VITE_SUPABASE_URL` -> `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` -> `SUPABASE_ANON_KEY`

## 2. Enable Actions (if disabled)

If GitHub Actions is disabled for the repo, enable it in repo settings.

## 3. Run once manually

1. Open the `Actions` tab
2. Select `Supabase Keepalive`
3. Click `Run workflow`
4. Confirm it returns a `2xx` status

## Notes

- This does not guarantee against every free-tier limitation.
- If your table/RLS policies change, update the endpoint in the workflow to a route that remains readable with the anon key.
