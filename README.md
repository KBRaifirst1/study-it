# Study It

An AI-powered learning workspace. Bring your own material (notes, PDFs, lecture transcripts) and Claude turns it into flashcards, practice quizzes, explainers, mind maps, and more — grounded in your sources, not made-up.

- Single-file React app (`src/App.jsx`)
- Works fully local: no backend required (notebooks + profile stored in browser localStorage)
- Optional backend: Supabase for cross-device notebook sync, Edge Functions for iCal subscription + web search on local model

## Quick start — deploy to Vercel in ~10 minutes

### 1. Fork or clone this repo

```bash
git clone <this-repo> study-it
cd study-it
npm install
npm run dev          # http://localhost:5173 to verify it runs
```

### 2. (Optional) Set up your own Supabase backend

If you want notebook sync across devices and your friends/classmates to be able to use your deployment, you'll need a Supabase project. Otherwise skip to step 3 — the app works fine without it (purely local).

1. Create a free Supabase project at <https://supabase.com>
2. In your project's SQL editor, run the schemas in `SQL_SCHEMA.md` (see this repo)
3. Copy your project's URL + anon key from Settings → API
4. Open `src/App.jsx`, find the constants near the top:
   ```js
   const DEFAULT_SUPABASE_URL = "https://...";
   const DEFAULT_SUPABASE_ANON_KEY = "ey...";
   ```
   Replace with your own. **Don't commit the service-role key — anon key only.**

### 3. (Optional) Deploy Edge Functions for web search + iCal subscription

These are the cloud-function side-channels that let:
- **Web search on local model**: Required if you want lateral-reading fact-check on the local WebGPU AI. Without it, local model has no internet access.
- **iCal subscription**: Required if you want your study schedule to live-update in Apple/Google Calendar.

Both are optional. Skip to step 4 if you don't care about either.

**To deploy:**

1. Install Supabase CLI: <https://supabase.com/docs/guides/cli>
2. In your project, run `supabase login && supabase link --project-ref <your-ref>`
3. Get a free Brave Search API key at <https://api-dashboard.search.brave.com/app/keys> (2,000 queries/month free)
4. Set the secret: `supabase secrets set BRAVE_API_KEY=<your-key>`
5. Copy the function code from the in-app Integrations panel (Settings → Integrations → "Show Edge Function code") into `supabase/functions/study-search/index.ts` and `supabase/functions/study-ics/index.ts`
6. Deploy: `supabase functions deploy study-search --no-verify-jwt && supabase functions deploy study-ics --no-verify-jwt`
7. Note the function URLs — you'll paste them in the app's Settings → Integrations panel

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or use the Vercel dashboard:

1. Push your repo to GitHub
2. Go to <https://vercel.com/new>
3. Import the repo
4. Click Deploy (no env vars needed — defaults are baked into the source)
5. You get a URL like `study-it.vercel.app`

### 5. Share with friends/classmates

Send them the URL. They sign in with their own email (Supabase magic-link auth). Each user's notebooks/profile are isolated via Row Level Security on the Supabase side.

**Three sharing scenarios:**

**A. Trust-based group (recommended for friends/classmates):**
- Everyone uses your Vercel deployment's defaults
- You pay the Supabase + Brave Search quota (it's all free-tier-able for groups under ~10 users)
- Row Level Security keeps users isolated from each other on the Supabase side
- Easiest path; recipients just visit your URL and sign in

**B. Each user brings their own backend (most private):**
- They open Settings → Integrations → Backend Configuration → paste their own Supabase URL + anon key
- They deploy their own Edge Functions for web search/iCal
- Your Supabase and Brave quota stay untouched by their use
- Recipients need ~30 minutes of setup; you can help by giving them the SQL schemas + Edge Function code (both already embedded in the in-app Integrations panel)

**C. You give recipients a Setup Pack (compromise):**
- In Settings → Integrations → Backend Configuration → Export Setup Pack
- This generates a JSON blob with all your backend URLs (Supabase + function URLs)
- Send them the JSON
- They open the same deployment, go to Settings → Integrations → Backend Configuration → Import Setup Pack
- All their config gets populated in one paste

## What works without any backend

The app runs entirely in the browser. Without Supabase or Edge Functions:

- ✅ All 18 AI generation modes (using Anthropic API directly with your own key, OR fully local via WebGPU)
- ✅ Notebooks (stored in browser localStorage — single device only)
- ✅ Vault (saved generations)
- ✅ Spaced repetition review queue
- ✅ Wellbeing tracking
- ✅ Export Everything (full data backup as zip)
- ✅ PDF text extraction (client-side via pdf.js)
- ✅ All Code & STEM tools (Math Solver, Whiteboard, Derive, Explain Code)
- ✅ Onboarding flow + mobile responsive design

**Without backend, these are unavailable:**
- ❌ Cross-device notebook sync (Supabase)
- ❌ Shareable notebook links (Supabase)
- ❌ iCal subscription (Edge Function)
- ❌ Web search on local model (Edge Function — Claude API web search still works)

## SQL schemas

If using Supabase, run these in your project's SQL editor:

```sql
-- Profiles table (per-user profile + classes + settings)
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb default '{}'::jsonb,
  classes jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;
create policy "users see only their own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notebooks (per-user notebook collection)
create table if not exists notebooks (
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamp with time zone default now(),
  primary key (user_id)
);

alter table notebooks enable row level security;
create policy "users see only their own notebooks" on notebooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shared notebooks (for the share-via-email feature)
create table if not exists shared_notebooks (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  notebook_id text not null,
  shared_with_emails text[] not null default '{}',
  notebook_data jsonb not null,
  created_at timestamp with time zone default now()
);

alter table shared_notebooks enable row level security;
create policy "owner can manage their shares" on shared_notebooks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "invited users can read their shares" on shared_notebooks
  for select using (auth.jwt() ->> 'email' = any(shared_with_emails));
```

## Honest caveats

- **Multi-tenancy isn't bulletproof.** If you deploy to Vercel and share the URL, you (as the Supabase project owner) can technically see all users' data via the service-role key. RLS only protects users from EACH OTHER. If your friends need real privacy, they should set up their own Supabase.
- **Free tiers have limits.** Supabase free tier: 500MB database, 50,000 monthly active users. Brave Search: 2,000 queries/month. For a study group of ~10 people, you're nowhere near limits. For wider sharing, you'd need paid tiers.
- **API keys are per-user.** Each user enters their own Anthropic API key in Settings → AI Provider. The deployer's key isn't shared.
- **Vercel free tier covers this easily.** ~100GB bandwidth/month, which is way more than a study group will use.

## Tech notes

- Single-file React app (`src/App.jsx` is ~10,800 lines)
- No build-time env vars needed
- Vite for dev/build
- Lazy-loads heavy libs from CDN: pdf.js (PDFs), JSZip (zip imports), mammoth (DOCX), docx/xlsx/pptxgenjs (exports), WebLLM (local AI)
- Test suite: 1,800+ assertions across 50+ test files (not included in this share pack — see the source repo)

## License

Use it however you want. Built with [Claude](https://claude.ai).
