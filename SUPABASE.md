# Connect Oikos to Supabase

## 1. Project credentials

Fill `.env.local` (ignored by Git) using the project's **Connect** dialog:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the publishable key, never a secret or service-role key. Restart `npm run dev`
after changing environment variables. On hosting, set the same variables before
building the app. `.env.example` is a safe template.

## 2. Database

In **SQL Editor**, run `supabase/migrations/202609180001_households.sql` once.
It creates two new tables and four functions inside a transaction. It does not
modify existing tables. The script is a migration, not a repeatable reset script.

### Personal contributions update

After the initial migration, run `supabase/migrations/202609180002_personal_contributions.sql`.
For an existing installation run only this new file. It preserves existing data.
All members can see contributions; only their owner can change the amount,
confirmation or confirmation timestamp. The database checks the signed-in identity,
not the member ID sent by the browser. This restriction requires applying the migration.

### Personal cleaning update

Next run `supabase/migrations/202609180003_personal_cleaning.sql` in SQL Editor.
For an existing installation with personal contributions already enabled, run only
this new migration. It preserves existing data and contribution restrictions.

At this migration level, only the assigned member can edit a pending duty or mark it complete. Other members
can see the assignment and its completion time. Completed duties remain immutable.
Schedule generation preserves other people's existing duties while filling new
weeks/zones; it can update the current person's pending automatic assignments.
Other members' duties cannot be deleted, replaced with new IDs, or claimed and
completed via a forged request. New assignments must be saved before completion.

### Deleted-zone schedule fix

Run `supabase/migrations/202609180004_retired_zone_duties.sql` after migration 003.
This lets any member retire a shared zone and cancels its pending duties from the
current week onward, including duties assigned to other members. Completed duties
and prior weeks stay intact. Other active-zone duties remain owner-only.
The database uses Europe/Warsaw for the current ISO week.

For zones deleted before this fix, click **Generuj grafik** once after applying the
migration. Regeneration also removes obsolete pending duties beyond the selected
planning period, so they cannot reappear in a later month.

### Shared cleaning rotation fix

Run `supabase/migrations/202610090001_shared_cleaning_rotation.sql` after migration 004.
It allows automatic pending duties from the current week onward to be redistributed
among participating household members. Assignment IDs and week/zone slots are retained;
history, manual assignments and completed duties remain protected. Completion still
requires the assigned member and uses the database timestamp.

Changing participation in **Dom** now rebalances the existing planning horizon.
For a previously generated schedule that includes only some selected members,
click **Wyrównaj przyszłe** after applying this migration, selecting the desired period.
The planner balances duty counts across all selected people; when there are more
people than zones, turns are spread across weeks.

### Replanning manually assigned duties

Run `supabase/migrations/202610090002_replan_cleaning_duties.sql` for the latest
cleaning planner. It replaces the save function and includes migration 001's shared
rotation fix, so installations already on migration 004 can apply this file directly.
No saved household data is changed by applying it.

**Generuj grafik** and **Wyrównaj przyszłe** now release pending manual assignments
in the selected period as well, so an old two-person plan cannot keep all zones
locked to those two people. Past weeks and completed duties remain unchanged.
With four enabled participants and four zones, each receives one zone per week.
With more zones, extra zones are shared; with fewer, the queue rotates across everyone.
Participant checkboxes are also available directly in the cleaning settings.

### Undoing your cleaning completion

Run `supabase/migrations/202610090003_undo_cleaning_completion.sql` in SQL Editor.
It replaces the save function, includes the preceding save-function fixes, and
preserves saved data. Click your checked cleaning checkbox again to reopen the
duty. Only the person who confirmed it can undo it; completion time and author
are cleared. Confirming it again records a new database timestamp. Undoing a
current/future duty for an already deleted zone cancels that obsolete duty.

### Deleting your expenses and entering decimal amounts

Run `supabase/migrations/202610090004_personal_expenses.sql` in SQL Editor.
It includes all preceding save-function fixes, including cleaning completion undo,
so an existing installation can apply this file directly. Saved data is preserved.
Only the expense's purchaser can delete or change it; new expenses use the signed-in
member as purchaser. Amounts must be positive and have at most two decimal places.

In **Budżet → Historia zakupów**, **Usuń** removes your expense from the budget.
All expenses are shown, including older entries. Purchased-item and shopping-trip
history is retained. Add the expense again if its amount was wrong. Manual expenses,
trip totals and estimated prices accept either `7,80` or `7.80`.

## 3. Login redirect URLs

In **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` during development.
- Redirect URLs: `http://localhost:3000/**`.
- When deploying, set Site URL to your HTTPS domain and add that domain's redirects.

Oikos uses Google sign-in only. Keep Google and signups enabled. The app no longer
requests email login links, so SMTP is not needed for this login flow.

## Google sign-in (works before deployment)

Use your hosted Supabase project even when Oikos runs on localhost.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select
   the Oikos project. Open **Google Auth Platform**.
2. If prompted, choose **Get started**. Set app name to **Oikos**, select your
   support email, choose **External** audience for personal Google accounts,
   and enter your contact email.
3. Under **Audience**, keep **Testing** while setting up and add your Google email
   (and any household accounts you want to test with) under **Test users**.
4. Under **Data Access**, use only `openid`, `userinfo.email` and
   `userinfo.profile` (Google may display the latter two with full URL prefixes).
5. In Supabase, open **Authentication → Sign In / Providers → Google** and copy
   the callback URL shown there. It normally looks like
   `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.
6. In Google Auth Platform → **Clients → Create client**, select **Web application**.
   Set **Authorized JavaScript origins** to `http://localhost:3000`.
   Set **Authorized redirect URIs** to the exact Supabase callback from step 5.
   The Google callback goes to Supabase, not to your local Next.js server.
7. Copy the resulting **Client ID** and **Client Secret** into Supabase's Google
   provider settings, enable the provider and save. The Google secret belongs in
   Supabase only; do not put it in a `NEXT_PUBLIC_` variable or commit it.
8. Keep the Supabase Site URL and allowed redirects from section 3. Open Oikos and
   choose **Zaloguj się przez Google**. After consent, you should return to Oikos.
   Invitation links are preserved through this redirect.

Google login does not use SMTP. When deploying, add your HTTPS app origin in Google and your
production redirect URL in Supabase. Review Google's Audience/publishing settings
before inviting people beyond your test accounts.

Reference: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 4. First household

1. Open the app and sign in with Google.
2. Enter your name and create a household.
3. In **Dom**, copy the invitation link and open it in another browser/profile.
4. Alternatively paste the full link into **Link zaproszenia → Użyj linku** on
   the login page. Sign in with another Google account and choose **Dołącz do domu**.
   Links must belong to the current Oikos origin. Invalid links stay on the form;
   expired/revoked tokens are rejected by Supabase.
5. Add a cleaning zone and generate the schedule. Mark a duty complete.
6. Confirm it appears on the other device (refresh on focus or within 10 seconds).

A person belongs to one household in this first version. Every member has equal
permissions. Removing another member revokes their access and rotates the shared
invitation link. Existing completed duties and spending history retain authors.
There is no administrative role.

## Data and concurrency

The existing domain state is stored as a JSON document per household, keeping the
current rotation and shopping logic. Membership is stored in a separate table
linked to Supabase Auth. Row-level security restricts reads to household members;
direct writes are denied. Database functions authorize writes, lock the household
row, and check its revision. Stale saves are rejected with an explanation in the
UI. The database stamps first completion and protects already completed duties.

The browser sends its session token using the Supabase SDK. Authentication happens
in the client; there are no server-rendered private pages or service-role bypasses.
PostgreSQL enforces access regardless of the UI. An active member can modify shared
household data; this is intentionally a household of peers.

Remote data is never loaded from or saved into the old `oikos-state-v1` demo store.
Existing local demo data remains untouched; it is not automatically imported into
a real household. Without credentials, a setup screen offers the local demo.

## Checks

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`: runs rotation tests and the actual SQL migration in an isolated
  PostgreSQL engine, testing access isolation, denied direct writes, invitations,
  revision conflicts, server timestamps, protected completions and owner-only undo and member removal.
- `npm run build -- --webpack` (available fallback for restricted Turbopack workers)

Live Google consent and your hosted Supabase configuration must additionally be
checked using the two-account flow above.
