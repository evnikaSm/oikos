This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Backend and setup

Oikos supports Supabase Google login and shared household data. Follow
[SUPABASE.md](SUPABASE.md) to configure credentials, run the database migration,
and test invitations. Every member has equal permissions.

Without credentials, the app offers an explicit local demo. Existing demo state
in `oikos-state-v1` stays separate from real household data and is not imported
automatically. Connected households save in Supabase with revision checks; updates
are refreshed on window focus and every 10 seconds.

Cleaning assignments remain weekly. Selecting a calendar day shows that week's
assignments, rather than inventing a daily deadline. The calendar opens at the
current month; swiping left goes to the previous month and right to the next.
Buttons provide the same navigation. Completion records an ISO timestamp and
shows the full local date, time (including seconds) and time zone. Adding or
renaming a zone regenerates the selected planning period while preserving past
weeks, completed duties and manual overrides. Rename a zone by editing its field
and leaving the field.

## Validation

- `npm run lint`
- `npx tsc --noEmit`
- `npm test` (Node 22.6+; rotation, history preservation, ISO weeks and leap months)
- `npm run build` (or `npm run build -- --webpack` if Turbopack's CSS worker cannot
  open a local port in the execution environment)

Browser checks covered every tab at 320, 375, 390, 430 and 1280 px, plus long
unbroken names on mobile. Calendar navigation, swipes, completion timestamps,
regeneration, reload persistence and zone editing were checked in headless Chrome.
# oikos
