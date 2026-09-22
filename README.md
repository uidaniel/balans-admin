# Balans admin

The back office: the waitlist, and the six metrics that say whether the
campaigns are working.

Split out of the marketing site so it can be deployed, secured and restricted
on its own. It reads the same Supabase project as the API — the same tables,
not a copy — so nothing here needs the API to be running.

## Running it

    cp .env.example .env.local   # then fill in the three values
    npm install
    npm run dev                  # http://localhost:3100

Port 3100, so it can run beside the marketing site on 3000 and the API on 4000.

## Getting in

Sign-in is a Supabase magic link, and being signed in is not enough: the
address must also appear in the `admin_allowlist` table, keyed on the Supabase
`auth.users` id. Anyone else is told they are not staff rather than shown the
data.

That table starts empty, and there is a chicken-and-egg to it: the row needs
an `auth_user_id`, which only exists once the person has signed in at least
once. So the first time round they sign in, get told they are not staff, and
then somebody with database access runs:

    INSERT INTO admin_allowlist (auth_user_id, email, role)
    SELECT id, email, 'admin' FROM auth.users WHERE email = 'them@balans.ng';

Signing in again then works.

### The redirect allowlist — the bit that catches everyone

Supabase only honours a `redirectTo` that appears in its own allowlist. Ask
for one that is not on it and it silently falls back to the project's **Site
URL** instead, so the magic link lands somewhere that is not this app and the
sign-in looks broken for no visible reason.

In the Supabase dashboard, under **Authentication → URL Configuration →
Redirect URLs**, every origin this app is served from needs its callback
listed:

    http://localhost:3100/auth/callback
    https://admin.balans.ng/auth/callback     # or wherever it is deployed

This moved when the admin was split out of the marketing site — it used to be
`/admin/auth/callback` on port 3000 — so an old allowlist will send links to
the wrong place.

## The metrics

They come from the `admin_metrics` view, which lives in the API's migrations
(`0012_admin_metrics.sql`). Definitions belong there so this page and anything
else asking the same question cannot disagree. If the panel says there are no
metrics yet, that migration has not run against this database.
