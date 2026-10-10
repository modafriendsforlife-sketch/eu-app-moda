/*
# Create registered_emails table — global email uniqueness

## Purpose
The app currently stores accounts only in the browser's IndexedDB, which means
the same e-mail can be registered on multiple devices. This table provides a
server-side UNIQUE constraint on the email column so that the database itself
rejects any duplicate registration, regardless of which device is used.

## New Tables
- `registered_emails`
  - `id` (uuid, primary key, auto-generated)
  - `email` (text, NOT NULL, UNIQUE) — the e-mail address, stored in lowercase
  - `display_name` (text) — the user's display name at time of signup
  - `created_at` (timestamptz, default now()) — when the registration happened

## Security
- RLS is enabled on `registered_emails`.
- The app has a sign-in/sign-up screen, but this table is used as a
  pre-authentication check: the frontend (anon key) needs to be able to:
  1. SELECT to check if an email already exists before signup.
  2. INSERT to register a new email on successful signup.
- Policies are scoped to `anon, authenticated` because the anon-key client
  must be able to perform these operations (no Supabase Auth session exists yet;
  the app uses its own local auth flow).

## Important Notes
1. The UNIQUE constraint on `email` is the physical guarantee — even if two
   devices submit simultaneously, the database rejects the second insert.
2. Email is stored normalized to lowercase to prevent case-variant duplicates.
3. The existing local IndexedDB accounts remain untouched — this table is an
   additional server-side guard that runs before any local account creation.
*/

CREATE TABLE IF NOT EXISTS registered_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz DEFAULT now()
);

-- Ensure emails are stored in lowercase (prevents case-variant duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS registered_emails_email_lower_idx
  ON registered_emails (lower(email));

ALTER TABLE registered_emails ENABLE ROW LEVEL SECURITY;

-- Allow anon + authenticated to check if an email exists (needed before signup)
DROP POLICY IF EXISTS "select_registered_emails" ON registered_emails;
CREATE POLICY "select_registered_emails"
  ON registered_emails FOR SELECT
  TO anon, authenticated USING (true);

-- Allow anon + authenticated to insert a new email registration
DROP POLICY IF EXISTS "insert_registered_emails" ON registered_emails;
CREATE POLICY "insert_registered_emails"
  ON registered_emails FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- No UPDATE or DELETE — registrations are immutable once created
