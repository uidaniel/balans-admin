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
address must also appear in the `staff` table. Anyone else gets told they are
not staff rather than shown the data.

## The metrics

They come from the `admin_metrics` view, which lives in the API's migrations
(`0012_admin_metrics.sql`). Definitions belong there so this page and anything
else asking the same question cannot disagree. If the panel says there are no
metrics yet, that migration has not run against this database.
