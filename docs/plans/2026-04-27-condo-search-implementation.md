CONDO SEARCH IMPLEMENTATION PLAN
Date: 2026-04-27
Spec: docs/specs/2026-04-27-condo-search-design.md


GOAL

Ship a single-user web app at a Vercel URL where Perry can paste Houston condo listing URLs, see them as colored pins on a map with a CrimeGrade overlay, view a sortable sidebar of all properties, edit per-property notes/status/rating/pros-cons, and compare them side-by-side. Reachable from laptop and phone.

ARCHITECTURE

One Next.js (App Router, TypeScript) project deployed to Vercel. Five serverless API routes under /api. Supabase for Postgres + Auth + Storage. Leaflet + OpenStreetMap for the map. No separate backend service.

TECH STACK

Next.js 15 (App Router), TypeScript, Tailwind CSS, Leaflet 1.9, react-leaflet 4, Supabase JS v2, cheerio (server-side HTML parsing), zod (request validation), vitest (parser unit tests).

SUPABASE PROJECT (already created)

Project ID: qzhkwftjsqvwnogrqseb
Project URL: https://qzhkwftjsqvwnogrqseb.supabase.co


HOW TO USE THIS PLAN

Tasks are grouped into 5 phases. Within each task, steps are checkboxes — work top to bottom, mark complete as you go. Each task ends with a commit step. Code blocks contain the actual content to paste; do not summarize them. Paths are absolute relative to the project root C:\Users\perry\OneDrive\Desktop\Condo Search.

Manual verification is used for UI tasks per the spec. The scrape parser has unit tests with HTML fixtures because that is the most fragile part of the system.


==========================================
PHASE 1 — FOUNDATION
==========================================


TASK 1: Initialize the Next.js project and git

Files:
    Create: package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs, .gitignore, app/layout.tsx, app/page.tsx, app/globals.css

Steps:

[ ] Step 1: Open a terminal in C:\Users\perry\OneDrive\Desktop\Condo Search

[ ] Step 2: Run the Next.js scaffolder. From inside the project directory:

    npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --turbopack --no-install

    When prompted whether to overwrite existing docs folder, choose No. The scaffolder should leave docs/ alone since it does not target that folder.

[ ] Step 3: Install dependencies:

    npm install

[ ] Step 4: Verify dev server starts:

    npm run dev

    Open http://localhost:3000 in a browser. Confirm the default Next.js welcome page renders. Stop the server with Ctrl+C.

[ ] Step 5: Initialize git:

    git init
    git add -A
    git commit -m "chore: scaffold Next.js project with Tailwind"


TASK 2: Install project-specific dependencies

Files:
    Modify: package.json

Steps:

[ ] Step 1: Install runtime libraries:

    npm install @supabase/supabase-js @supabase/ssr leaflet react-leaflet cheerio zod

[ ] Step 2: Install type packages and dev tools:

    npm install -D @types/leaflet vitest @vitejs/plugin-react

[ ] Step 3: Confirm package.json now lists all of: @supabase/supabase-js, @supabase/ssr, leaflet, react-leaflet, cheerio, zod, @types/leaflet, vitest, @vitejs/plugin-react.

[ ] Step 4: Commit:

    git add package.json package-lock.json
    git commit -m "chore: add runtime and dev dependencies"


TASK 3: Wire Supabase environment variables

Files:
    Create: .env.local
    Modify: .gitignore (verify .env.local is ignored — Next.js scaffolder includes it)

Steps:

[ ] Step 1: In the Supabase dashboard, navigate to Project Settings → API Keys. Copy the anon (public) key and the service_role key.

[ ] Step 2: Create C:\Users\perry\OneDrive\Desktop\Condo Search\.env.local with the following content (replace the two placeholder values with the real keys):

    NEXT_PUBLIC_SUPABASE_URL=https://qzhkwftjsqvwnogrqseb.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key here>
    SUPABASE_SERVICE_ROLE_KEY=<paste service role key here>

[ ] Step 3: Confirm .env.local is in .gitignore by running:

    git check-ignore .env.local

    Expected: prints ".env.local". If it does not, add a line ".env.local" to .gitignore.

[ ] Step 4: Commit (only if .gitignore changed):

    git add .gitignore
    git commit -m "chore: ensure .env.local is gitignored"


TASK 4: Create the Supabase client helpers

Files:
    Create: lib/supabase/client.ts (browser client)
    Create: lib/supabase/server.ts (server client with cookies)
    Create: lib/supabase/admin.ts (service-role client for trusted server actions)

Steps:

[ ] Step 1: Create lib/supabase/client.ts:

    import { createBrowserClient } from "@supabase/ssr";

    export function createClient() {
      return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
    }

[ ] Step 2: Create lib/supabase/server.ts:

    import { createServerClient } from "@supabase/ssr";
    import { cookies } from "next/headers";

    export async function createClient() {
      const cookieStore = await cookies();
      return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options),
                );
              } catch {
                // setAll called from a Server Component; ignore.
              }
            },
          },
        },
      );
    }

[ ] Step 3: Create lib/supabase/admin.ts:

    import { createClient } from "@supabase/supabase-js";

    export function createAdminClient() {
      return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );
    }

[ ] Step 4: Commit:

    git add lib/supabase
    git commit -m "feat: add Supabase client helpers (browser, server, admin)"


TASK 5: Create the database schema and storage bucket

Files:
    Create: supabase/migrations/0001_initial.sql (kept in repo for reproducibility)

Steps:

[ ] Step 1: In the Supabase dashboard, open SQL Editor → New query.

[ ] Step 2: Paste and run the following SQL:

    create type tour_status as enum (
      'not_toured', 'scheduled', 'toured', 'rejected', 'top_pick'
    );

    create table public.properties (
      id              uuid primary key default gen_random_uuid(),
      user_id         uuid not null references auth.users(id) on delete cascade,
      listing_url     text not null,
      address         text not null,
      latitude        double precision not null,
      longitude       double precision not null,
      price           integer,
      beds            smallint,
      baths           numeric(2,1),
      square_feet     integer,
      photo_path      text,
      tour_status     tour_status not null default 'not_toured',
      star_rating     smallint check (star_rating between 1 and 5),
      notes           text not null default '',
      pros            text[] not null default '{}',
      cons            text[] not null default '{}',
      created_at      timestamptz not null default now(),
      updated_at      timestamptz not null default now()
    );

    create index properties_user_id_idx on public.properties(user_id);

    alter table public.properties enable row level security;

    create policy "user owns properties select"
      on public.properties for select
      using (auth.uid() = user_id);

    create policy "user owns properties insert"
      on public.properties for insert
      with check (auth.uid() = user_id);

    create policy "user owns properties update"
      on public.properties for update
      using (auth.uid() = user_id);

    create policy "user owns properties delete"
      on public.properties for delete
      using (auth.uid() = user_id);

    create or replace function public.set_updated_at()
    returns trigger language plpgsql as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$;

    create trigger properties_updated_at
      before update on public.properties
      for each row execute function public.set_updated_at();

[ ] Step 3: Confirm the run succeeded with no errors. In Table Editor, confirm the properties table exists with the expected columns.

[ ] Step 4: In the Supabase dashboard, open Storage → New bucket. Name: property-photos. Public bucket: yes (read-only public, writes still require auth via RLS). Click Create.

[ ] Step 5: Still in Storage, open the property-photos bucket → Policies → New policy. Use the "For full customization" template and paste:

    create policy "user can upload to own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'property-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    create policy "user can update own files"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'property-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    create policy "user can delete own files"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'property-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    create policy "anyone can read property photos"
      on storage.objects for select
      using (bucket_id = 'property-photos');

[ ] Step 6: Save the SQL from Steps 2 and 5 into supabase/migrations/0001_initial.sql so the schema is version-controlled.

[ ] Step 7: Commit:

    git add supabase
    git commit -m "feat: add initial database schema and storage policies"


TASK 6: Add Supabase Auth (sign up + sign in)

Files:
    Create: app/(auth)/login/page.tsx
    Create: app/(auth)/login/actions.ts
    Create: middleware.ts
    Create: lib/supabase/middleware.ts

Steps:

[ ] Step 1: Create lib/supabase/middleware.ts:

    import { createServerClient } from "@supabase/ssr";
    import { NextResponse, type NextRequest } from "next/server";

    export async function updateSession(request: NextRequest) {
      let response = NextResponse.next({ request });

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value),
              );
              response = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options),
              );
            },
          },
        },
      );

      const { data: { user } } = await supabase.auth.getUser();

      const path = request.nextUrl.pathname;
      const isPublic = path.startsWith("/login") || path.startsWith("/_next") || path.startsWith("/api/auth");

      if (!user && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      return response;
    }

[ ] Step 2: Create middleware.ts at the project root:

    import { type NextRequest } from "next/server";
    import { updateSession } from "@/lib/supabase/middleware";

    export async function middleware(request: NextRequest) {
      return await updateSession(request);
    }

    export const config = {
      matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
    };

[ ] Step 3: Create app/(auth)/login/actions.ts:

    "use server";

    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";

    export async function signIn(formData: FormData) {
      const supabase = await createClient();
      const email = String(formData.get("email"));
      const password = String(formData.get("password"));
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      redirect("/");
    }

    export async function signUp(formData: FormData) {
      const supabase = await createClient();
      const email = String(formData.get("email"));
      const password = String(formData.get("password"));
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      redirect("/");
    }

[ ] Step 4: Create app/(auth)/login/page.tsx:

    import { signIn, signUp } from "./actions";

    export default function LoginPage() {
      return (
        <main className="min-h-screen flex items-center justify-center p-6">
          <form className="w-full max-w-sm space-y-4">
            <h1 className="text-2xl font-semibold">Condo Search</h1>
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              className="w-full border rounded px-3 py-2"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={6}
              className="w-full border rounded px-3 py-2"
            />
            <div className="flex gap-2">
              <button formAction={signIn} className="flex-1 bg-black text-white rounded py-2">
                Sign in
              </button>
              <button formAction={signUp} className="flex-1 border rounded py-2">
                Sign up
              </button>
            </div>
          </form>
        </main>
      );
    }

[ ] Step 5: Manual verification:
    Run npm run dev, visit http://localhost:3000. Should redirect to /login.
    Click Sign up with your email and a password (min 6 chars). Check Supabase dashboard → Authentication → Users to confirm the user was created.
    If Supabase requires email confirmation, disable it for now under Authentication → Providers → Email → "Confirm email" toggle off, then sign up again. Re-enable after the project is deployed if desired.
    After sign up you should be redirected to / (the default Next.js home page is fine for now).

[ ] Step 6: Commit:

    git add middleware.ts lib/supabase/middleware.ts app
    git commit -m "feat: add Supabase Auth login page and protected middleware"


==========================================
PHASE 2 — DATA LAYER (API ROUTES)
==========================================


TASK 7: Type definitions and zod schemas for properties

Files:
    Create: lib/types/property.ts

Steps:

[ ] Step 1: Create lib/types/property.ts:

    import { z } from "zod";

    export const tourStatusSchema = z.enum([
      "not_toured", "scheduled", "toured", "rejected", "top_pick",
    ]);
    export type TourStatus = z.infer<typeof tourStatusSchema>;

    export const propertySchema = z.object({
      id: z.string().uuid(),
      user_id: z.string().uuid(),
      listing_url: z.string().url(),
      address: z.string().min(1),
      latitude: z.number(),
      longitude: z.number(),
      price: z.number().int().nullable(),
      beds: z.number().int().nullable(),
      baths: z.number().nullable(),
      square_feet: z.number().int().nullable(),
      photo_path: z.string().nullable(),
      tour_status: tourStatusSchema,
      star_rating: z.number().int().min(1).max(5).nullable(),
      notes: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      created_at: z.string(),
      updated_at: z.string(),
    });
    export type Property = z.infer<typeof propertySchema>;

    export const propertyInsertSchema = propertySchema.pick({
      listing_url: true,
      address: true,
      latitude: true,
      longitude: true,
      price: true,
      beds: true,
      baths: true,
      square_feet: true,
      photo_path: true,
    }).extend({
      photo_source_url: z.string().url().nullable().optional(),
    });
    export type PropertyInsert = z.infer<typeof propertyInsertSchema>;

    export const propertyPatchSchema = z.object({
      tour_status: tourStatusSchema.optional(),
      star_rating: z.number().int().min(1).max(5).nullable().optional(),
      notes: z.string().optional(),
      pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      price: z.number().int().nullable().optional(),
      beds: z.number().int().nullable().optional(),
      baths: z.number().nullable().optional(),
      square_feet: z.number().int().nullable().optional(),
      photo_path: z.string().nullable().optional(),
    });
    export type PropertyPatch = z.infer<typeof propertyPatchSchema>;

[ ] Step 2: Commit:

    git add lib/types
    git commit -m "feat: add property type schema with zod"


TASK 8: GET /api/properties (list)

Files:
    Create: app/api/properties/route.ts

Steps:

[ ] Step 1: Create app/api/properties/route.ts with GET handler only for now (POST is added in Task 11):

    import { NextResponse } from "next/server";
    import { createClient } from "@/lib/supabase/server";

    export async function GET() {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ properties: data });
    }

[ ] Step 2: Manual verification:
    Sign in via the browser. Visit http://localhost:3000/api/properties — expect {"properties": []}.

[ ] Step 3: Commit:

    git add app/api/properties
    git commit -m "feat: GET /api/properties"


TASK 9: Listing scraper module with unit tests

Files:
    Create: lib/scraper/index.ts (dispatch by domain)
    Create: lib/scraper/og.ts (universal og:image and meta fallback)
    Create: lib/scraper/apartments-com.ts
    Create: lib/scraper/zillow.ts
    Create: lib/scraper/trulia.ts
    Create: lib/scraper/__fixtures__/apartments-com.html (sample HTML; user pastes real listing source view in browser)
    Create: lib/scraper/__fixtures__/zillow.html
    Create: lib/scraper/__fixtures__/trulia.html
    Create: lib/scraper/scraper.test.ts
    Create: vitest.config.ts

Steps:

[ ] Step 1: Create vitest.config.ts at project root:

    import { defineConfig } from "vitest/config";

    export default defineConfig({
      test: {
        environment: "node",
        include: ["lib/**/*.test.ts"],
      },
    });

[ ] Step 2: Add a test script to package.json under "scripts":

    "test": "vitest run"

[ ] Step 3: Create lib/scraper/og.ts (used as a fallback for any domain):

    import * as cheerio from "cheerio";

    export interface ScrapeResult {
      address: string | null;
      price: number | null;
      beds: number | null;
      baths: number | null;
      square_feet: number | null;
      photo_url: string | null;
    }

    export function parseOgFallback(html: string): ScrapeResult {
      const $ = cheerio.load(html);
      const og = (prop: string) =>
        $(`meta[property="${prop}"]`).attr("content") ||
        $(`meta[name="${prop}"]`).attr("content") ||
        null;

      const title = og("og:title") ?? $("title").text() ?? null;
      const description = og("og:description") ?? null;
      const image = og("og:image") ?? null;

      const text = `${title ?? ""} ${description ?? ""}`;
      const price = matchPrice(text);
      const beds = matchBeds(text);
      const baths = matchBaths(text);
      const sqft = matchSqft(text);
      const address = guessAddress(title);

      return {
        address,
        price,
        beds,
        baths,
        square_feet: sqft,
        photo_url: image,
      };
    }

    function matchPrice(s: string): number | null {
      const m = s.match(/\$\s*([\d,]+)(?:\s*\/?\s*(?:mo|month))?/i);
      if (!m) return null;
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    }
    function matchBeds(s: string): number | null {
      const m = s.match(/(\d+)\s*(?:bd|bed|beds|bedroom)/i);
      return m ? parseInt(m[1], 10) : null;
    }
    function matchBaths(s: string): number | null {
      const m = s.match(/(\d+(?:\.\d)?)\s*(?:ba|bath|baths|bathroom)/i);
      return m ? parseFloat(m[1]) : null;
    }
    function matchSqft(s: string): number | null {
      const m = s.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square feet)/i);
      if (!m) return null;
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    }
    function guessAddress(title: string | null): string | null {
      if (!title) return null;
      // Titles often look like "123 Main St, Houston, TX 77004 - apartments.com"
      const m = title.match(/([\d]+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s*\d{5})/);
      return m ? m[1] : null;
    }

[ ] Step 4: Create lib/scraper/apartments-com.ts:

    import * as cheerio from "cheerio";
    import type { ScrapeResult } from "./og";
    import { parseOgFallback } from "./og";

    export function parseApartmentsCom(html: string): ScrapeResult {
      const $ = cheerio.load(html);
      const fallback = parseOgFallback(html);

      const address =
        $("[data-tagname='propertyAddress']").text().trim() ||
        $(".propertyAddressContainer").text().trim() ||
        fallback.address;

      const price =
        parsePriceText($(".rentInfoDetail").first().text()) ?? fallback.price;

      const bedsText = $(".bedRangeBath").first().text();
      const beds = matchInt(bedsText, /(\d+)\s*bed/i) ?? fallback.beds;
      const baths = matchFloat(bedsText, /(\d+(?:\.\d)?)\s*bath/i) ?? fallback.baths;
      const sqft = matchInt($(".sqftRange").first().text(), /([\d,]+)/) ?? fallback.square_feet;

      const photo = $("meta[property='og:image']").attr("content") ?? fallback.photo_url;

      return { address: address || null, price, beds, baths, square_feet: sqft, photo_url: photo };
    }

    function parsePriceText(s: string): number | null {
      const m = s.match(/\$\s*([\d,]+)/);
      if (!m) return null;
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    }
    function matchInt(s: string, re: RegExp): number | null {
      const m = s.match(re);
      if (!m) return null;
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    }
    function matchFloat(s: string, re: RegExp): number | null {
      const m = s.match(re);
      if (!m) return null;
      const n = parseFloat(m[1]);
      return Number.isFinite(n) ? n : null;
    }

[ ] Step 5: Create lib/scraper/zillow.ts and lib/scraper/trulia.ts as thin wrappers that try domain-specific selectors and fall back to parseOgFallback. Pattern is the same as apartments-com.ts; selectors will need refinement after seeing real fixtures. Initial body:

    import { parseOgFallback } from "./og";
    import type { ScrapeResult } from "./og";

    export function parseZillow(html: string): ScrapeResult {
      // TODO: refine with Zillow-specific selectors after capturing a fixture
      return parseOgFallback(html);
    }

    Note: this TODO is intentional — the scraper tightens up only after a real fixture is captured (Step 9 below). Until then the og fallback provides usable defaults.

    Same shape for trulia.ts with parseTrulia and the same TODO note.

[ ] Step 6: Create lib/scraper/index.ts (dispatch):

    import { parseApartmentsCom } from "./apartments-com";
    import { parseZillow } from "./zillow";
    import { parseTrulia } from "./trulia";
    import { parseOgFallback } from "./og";
    import type { ScrapeResult } from "./og";
    export type { ScrapeResult } from "./og";

    export async function scrapeListing(url: string): Promise<ScrapeResult> {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        return { address: null, price: null, beds: null, baths: null, square_feet: null, photo_url: null };
      }
      const html = await res.text();
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("apartments.com")) return parseApartmentsCom(html);
      if (host.includes("zillow.com")) return parseZillow(html);
      if (host.includes("trulia.com")) return parseTrulia(html);
      return parseOgFallback(html);
    }

[ ] Step 7: Create the unit test file lib/scraper/scraper.test.ts:

    import { readFileSync } from "node:fs";
    import { join } from "node:path";
    import { describe, expect, it } from "vitest";
    import { parseApartmentsCom } from "./apartments-com";
    import { parseOgFallback } from "./og";

    const fixture = (name: string) =>
      readFileSync(join(__dirname, "__fixtures__", name), "utf8");

    describe("parseOgFallback", () => {
      it("extracts address, price, beds, baths from a generic listing-style title", () => {
        const html = `
          <html><head>
            <meta property="og:title" content="123 Main St, Houston, TX 77004" />
            <meta property="og:description" content="2 bd 1.5 ba 870 sqft - $1,000/mo" />
            <meta property="og:image" content="https://example.com/photo.jpg" />
          </head><body></body></html>`;
        const r = parseOgFallback(html);
        expect(r.address).toBe("123 Main St, Houston, TX 77004");
        expect(r.price).toBe(1000);
        expect(r.beds).toBe(2);
        expect(r.baths).toBe(1.5);
        expect(r.square_feet).toBe(870);
        expect(r.photo_url).toBe("https://example.com/photo.jpg");
      });
    });

    describe("parseApartmentsCom", () => {
      it("falls back to og when domain selectors miss", () => {
        const html = fixture("apartments-com.html");
        const r = parseApartmentsCom(html);
        expect(r.photo_url).toBeTruthy();
      });
    });

[ ] Step 8: Create the fixture files. For now, write minimal HTML containing the og tags so tests pass; refinement comes in Step 9. Create lib/scraper/__fixtures__/apartments-com.html:

    <!doctype html>
    <html><head>
      <meta property="og:title" content="7510 Hornwood Dr Unit 1407, Houston, TX 77036" />
      <meta property="og:description" content="2 bd 2 ba 870 sqft - $1,000/mo" />
      <meta property="og:image" content="https://images.apartments.com/sample.jpg" />
    </head><body></body></html>

    Create the same shape for zillow.html and trulia.html with placeholder content matching their domain.

[ ] Step 9: (Optional but recommended) Replace each fixture with real captured HTML. To capture: open a listing in your browser, right-click → View page source, save the source to the corresponding fixture file. Then refine the domain-specific parser in apartments-com.ts / zillow.ts / trulia.ts to extract address/price/beds/baths/sqft from the real DOM. Run tests after each refinement.

[ ] Step 10: Run the tests:

    npm run test

    Expected: all tests pass.

[ ] Step 11: Commit:

    git add vitest.config.ts package.json lib/scraper
    git commit -m "feat: listing scraper module with og fallback and unit tests"


TASK 10: POST /api/properties/scrape

Files:
    Create: app/api/properties/scrape/route.ts

Steps:

[ ] Step 1: Create app/api/properties/scrape/route.ts:

    import { NextResponse } from "next/server";
    import { z } from "zod";
    import { createClient } from "@/lib/supabase/server";
    import { scrapeListing } from "@/lib/scraper";
    import { geocodeAddress } from "@/lib/geocode";

    const bodySchema = z.object({ url: z.string().url() });

    export async function POST(req: Request) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const body = bodySchema.safeParse(await req.json());
      if (!body.success) return NextResponse.json({ error: "invalid url" }, { status: 400 });

      const scraped = await scrapeListing(body.data.url);

      let latitude: number | null = null;
      let longitude: number | null = null;
      let geocode_confidence: "high" | "low" | "none" = "none";
      if (scraped.address) {
        const g = await geocodeAddress(scraped.address);
        if (g) {
          latitude = g.latitude;
          longitude = g.longitude;
          geocode_confidence = g.confidence;
        }
      }

      return NextResponse.json({
        scraped,
        latitude,
        longitude,
        geocode_confidence,
      });
    }

[ ] Step 2: Create lib/geocode.ts (used by scrape route):

    interface GeocodeResult {
      latitude: number;
      longitude: number;
      confidence: "high" | "low";
    }

    export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", address);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("addressdetails", "1");

      const res = await fetch(url, {
        headers: {
          "User-Agent": "CondoSearch/1.0 (personal project)",
          "Accept-Language": "en-US,en",
        },
      });
      if (!res.ok) return null;
      const arr = (await res.json()) as Array<{
        lat: string;
        lon: string;
        importance: number;
        class?: string;
      }>;
      if (!arr.length) return null;
      const top = arr[0];
      const latitude = parseFloat(top.lat);
      const longitude = parseFloat(top.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const confidence = top.importance >= 0.4 ? "high" : "low";
      return { latitude, longitude, confidence };
    }

[ ] Step 3: Manual verification with an apartments.com URL:

    In a separate terminal while npm run dev is running, sign in via the browser to set the auth cookie, then visit /api/properties/scrape with a POST. Easiest: open browser DevTools console at any signed-in page and run:

    fetch("/api/properties/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.apartments.com/7510-hornwood-dr-houston-tx/abcdef/" }),
    }).then(r => r.json()).then(console.log);

    Expected: an object with scraped fields populated (some may be null), and latitude/longitude either populated or null.

[ ] Step 4: Commit:

    git add app/api/properties/scrape lib/geocode.ts
    git commit -m "feat: POST /api/properties/scrape with Nominatim geocoding"


TASK 11: POST /api/properties (save) with photo caching

Files:
    Modify: app/api/properties/route.ts (add POST handler)
    Create: lib/photos.ts (download and upload helper)

Steps:

[ ] Step 1: Create lib/photos.ts:

    import { createAdminClient } from "@/lib/supabase/admin";

    export async function cachePhotoToStorage(
      sourceUrl: string,
      userId: string,
      propertyId: string,
    ): Promise<string | null> {
      try {
        const res = await fetch(sourceUrl, {
          headers: { "User-Agent": "CondoSearch/1.0" },
        });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const ext = contentType.includes("png") ? "png" : "jpg";
        const path = `${userId}/${propertyId}.${ext}`;

        const admin = createAdminClient();
        const { error } = await admin.storage
          .from("property-photos")
          .upload(path, buf, { contentType, upsert: true });
        if (error) return null;
        return path;
      } catch {
        return null;
      }
    }

    export function publicPhotoUrl(path: string): string {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      return `${base}/storage/v1/object/public/property-photos/${path}`;
    }

[ ] Step 2: Update app/api/properties/route.ts to add a POST handler. Replace the existing file with:

    import { NextResponse } from "next/server";
    import { createClient } from "@/lib/supabase/server";
    import { propertyInsertSchema } from "@/lib/types/property";
    import { cachePhotoToStorage } from "@/lib/photos";

    export async function GET() {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ properties: data });
    }

    export async function POST(req: Request) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const parsed = propertyInsertSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid body", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { photo_source_url, ...row } = parsed.data;

      const { data: inserted, error } = await supabase
        .from("properties")
        .insert({ ...row, user_id: user.id })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      let photo_path: string | null = inserted.photo_path;
      if (!photo_path && photo_source_url) {
        photo_path = await cachePhotoToStorage(photo_source_url, user.id, inserted.id);
        if (photo_path) {
          await supabase
            .from("properties")
            .update({ photo_path })
            .eq("id", inserted.id);
        }
      }

      return NextResponse.json({ property: { ...inserted, photo_path } });
    }

[ ] Step 3: Manual verification:
    Sign in. In the DevTools console:

    fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_url: "https://example.com/listing/1",
        address: "7510 Hornwood Dr, Houston, TX 77036",
        latitude: 29.7180,
        longitude: -95.5180,
        price: 1000,
        beds: 2,
        baths: 2,
        square_feet: 870,
        photo_source_url: "https://images.apartments.com/sample.jpg",
      }),
    }).then(r => r.json()).then(console.log);

    Expected: a property object with an id and photo_path that resolves to a real Supabase Storage URL.
    Then visit /api/properties (GET) — confirm the new property is in the array.

[ ] Step 4: Commit:

    git add app/api/properties lib/photos.ts
    git commit -m "feat: POST /api/properties with photo caching"


TASK 12: PATCH and DELETE /api/properties/:id

Files:
    Create: app/api/properties/[id]/route.ts

Steps:

[ ] Step 1: Create app/api/properties/[id]/route.ts:

    import { NextResponse } from "next/server";
    import { createClient } from "@/lib/supabase/server";
    import { createAdminClient } from "@/lib/supabase/admin";
    import { propertyPatchSchema } from "@/lib/types/property";

    export async function PATCH(
      req: Request,
      { params }: { params: Promise<{ id: string }> },
    ) {
      const { id } = await params;
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const parsed = propertyPatchSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid body", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from("properties")
        .update(parsed.data)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ property: data });
    }

    export async function DELETE(
      _req: Request,
      { params }: { params: Promise<{ id: string }> },
    ) {
      const { id } = await params;
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const { data: existing } = await supabase
        .from("properties")
        .select("photo_path")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (existing?.photo_path) {
        const admin = createAdminClient();
        await admin.storage.from("property-photos").remove([existing.photo_path]);
      }
      return NextResponse.json({ ok: true });
    }

[ ] Step 2: Manual verification:
    Use the property id from Task 11 in DevTools:

    fetch("/api/properties/<id>", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_status: "scheduled", star_rating: 4 }),
    }).then(r => r.json()).then(console.log);

    Then DELETE the property. Confirm via /api/properties (GET) that it is gone.

[ ] Step 3: Commit:

    git add app/api/properties/\[id\]
    git commit -m "feat: PATCH and DELETE /api/properties/:id"


==========================================
PHASE 3 — MAP PAGE
==========================================


TASK 13: Replace home page with the authenticated map shell

Files:
    Replace: app/page.tsx
    Create: app/map.module.css (Leaflet container styles)

Steps:

[ ] Step 1: Add Leaflet's CSS import. Create app/page.tsx:

    import dynamic from "next/dynamic";
    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";

    const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

    export default async function Home() {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");
      return <MapView />;
    }

[ ] Step 2: Create components/MapView.tsx:

    "use client";

    import "leaflet/dist/leaflet.css";
    import { MapContainer, TileLayer } from "react-leaflet";
    import { useEffect, useState } from "react";
    import type { Property } from "@/lib/types/property";

    const HOUSTON_CENTER: [number, number] = [29.76, -95.37];

    export default function MapView() {
      const [properties, setProperties] = useState<Property[]>([]);

      useEffect(() => {
        fetch("/api/properties")
          .then((r) => r.json())
          .then((d) => setProperties(d.properties ?? []));
      }, []);

      return (
        <div className="relative w-screen h-screen">
          <MapContainer
            center={HOUSTON_CENTER}
            zoom={11}
            scrollWheelZoom
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
        </div>
      );
    }

[ ] Step 3: Manual verification:
    npm run dev → /. Confirm the Leaflet map renders centered on Houston with zoom controls.

[ ] Step 4: Commit:

    git add app/page.tsx components/MapView.tsx
    git commit -m "feat: render Houston Leaflet map on home page"


TASK 14: Crime overlay layer with toggle and auto-hide

Files:
    Create: public/overlays/crimegrade-houston.png (placeholder for now; real screenshot captured in Task 15)
    Create: lib/overlay-config.ts (lat/lng bounds; default placeholder values to be replaced)
    Create: components/CrimeOverlay.tsx
    Modify: components/MapView.tsx

Steps:

[ ] Step 1: Create lib/overlay-config.ts:

    // Bounds are [southWestLat, southWestLng, northEastLat, northEastLng]
    // Replace these with real values produced by the overlay-setup helper (Task 15).
    export const CRIME_OVERLAY = {
      imageUrl: "/overlays/crimegrade-houston.png",
      bounds: [29.55, -95.75, 29.95, -95.05] as [number, number, number, number],
      autoHideZoomThreshold: 15,
    };

[ ] Step 2: Create a placeholder PNG so the page does not 404. Any 1x1 transparent PNG works for now. From the project root:

    node -e "require('fs').writeFileSync('public/overlays/crimegrade-houston.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=', 'base64'))"

    (Make sure the public/overlays directory exists first: mkdir -p public/overlays)

[ ] Step 3: Create components/CrimeOverlay.tsx:

    "use client";

    import { ImageOverlay, useMap, useMapEvents } from "react-leaflet";
    import { useState, useEffect } from "react";
    import { CRIME_OVERLAY } from "@/lib/overlay-config";

    export function CrimeOverlay({ forceVisible }: { forceVisible: boolean | null }) {
      const map = useMap();
      const [zoom, setZoom] = useState(map.getZoom());
      useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

      const auto = zoom <= CRIME_OVERLAY.autoHideZoomThreshold;
      const visible = forceVisible ?? auto;
      if (!visible) return null;

      const [s, w, n, e] = CRIME_OVERLAY.bounds;
      return (
        <ImageOverlay
          url={CRIME_OVERLAY.imageUrl}
          bounds={[[s, w], [n, e]]}
          opacity={0.65}
        />
      );
    }

[ ] Step 4: Update components/MapView.tsx to add the overlay and a toggle button:

    "use client";

    import "leaflet/dist/leaflet.css";
    import { MapContainer, TileLayer } from "react-leaflet";
    import { useEffect, useState } from "react";
    import type { Property } from "@/lib/types/property";
    import { CrimeOverlay } from "./CrimeOverlay";

    const HOUSTON_CENTER: [number, number] = [29.76, -95.37];

    export default function MapView() {
      const [properties, setProperties] = useState<Property[]>([]);
      const [overlayMode, setOverlayMode] = useState<"auto" | "on" | "off">("auto");

      useEffect(() => {
        fetch("/api/properties")
          .then((r) => r.json())
          .then((d) => setProperties(d.properties ?? []));
      }, []);

      const forceVisible =
        overlayMode === "auto" ? null : overlayMode === "on";

      return (
        <div className="relative w-screen h-screen">
          <MapContainer
            center={HOUSTON_CENTER}
            zoom={11}
            scrollWheelZoom
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CrimeOverlay forceVisible={forceVisible} />
          </MapContainer>
          <button
            onClick={() =>
              setOverlayMode(
                overlayMode === "auto" ? "off" : overlayMode === "off" ? "on" : "auto",
              )
            }
            className="absolute top-4 right-4 z-[1000] bg-white shadow rounded px-3 py-2 text-sm"
          >
            Crime overlay: {overlayMode}
          </button>
        </div>
      );
    }

[ ] Step 5: Manual verification: page loads with overlay visible at the default zoom (placeholder PNG is invisible — that is fine). Click the toggle: cycles auto → off → on → auto. Zoom to street level: in auto mode the overlay layer is hidden.

[ ] Step 6: Commit:

    git add public lib/overlay-config.ts components/CrimeOverlay.tsx components/MapView.tsx
    git commit -m "feat: crime overlay layer with auto-hide and manual toggle"


TASK 15: Overlay-setup helper page + real CrimeGrade screenshot

Files:
    Create: app/admin/overlay-setup/page.tsx

Steps:

[ ] Step 1: Manually capture the screenshot. Open https://crimegrade.org/ and navigate to the Houston map for ZIP 77004 (or whichever Houston view shows the colored grades). Frame the area you care about. Take a screenshot of just the map portion (no UI chrome). Save it as public/overlays/crimegrade-houston.png, replacing the placeholder.

[ ] Step 2: Note two reference points visible in your screenshot. The easiest are major intersections — for example "I-610 and I-69 interchange" and "Westheimer + Kirby". For each, look up its real lat/lng (Google Maps right-click → "What's here?" gives coordinates). Note them down.

[ ] Step 3: Create app/admin/overlay-setup/page.tsx — a helper that lets you click two points on the screenshot to record their pixel coordinates, then computes the image bounds:

    "use client";

    import { useRef, useState } from "react";
    import { CRIME_OVERLAY } from "@/lib/overlay-config";

    interface RefPoint {
      pxX: number;
      pxY: number;
      lat: number;
      lng: number;
    }

    export default function OverlaySetup() {
      const imgRef = useRef<HTMLImageElement>(null);
      const [points, setPoints] = useState<RefPoint[]>([]);
      const [latInput, setLatInput] = useState("");
      const [lngInput, setLngInput] = useState("");
      const [pending, setPending] = useState<{ x: number; y: number } | null>(null);

      const onClick = (e: React.MouseEvent<HTMLImageElement>) => {
        const rect = (e.currentTarget as HTMLImageElement).getBoundingClientRect();
        const x = (e.clientX - rect.left) * (e.currentTarget.naturalWidth / rect.width);
        const y = (e.clientY - rect.top) * (e.currentTarget.naturalHeight / rect.height);
        setPending({ x, y });
      };

      const confirm = () => {
        if (!pending) return;
        const lat = parseFloat(latInput);
        const lng = parseFloat(lngInput);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setPoints([...points, { pxX: pending.x, pxY: pending.y, lat, lng }]);
        setPending(null);
        setLatInput("");
        setLngInput("");
      };

      const bounds = computeBounds(points, imgRef.current);

      return (
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold mb-4">Overlay Setup</h1>
          <p className="mb-4 text-sm text-gray-600">
            Click two reference points on the screenshot, entering each one's real lat/lng. Two points are enough to compute bounds (Web Mercator near a city is well-approximated as axis-aligned over ~30 miles).
          </p>
          <img
            ref={imgRef}
            src={CRIME_OVERLAY.imageUrl}
            alt="Crime overlay"
            onClick={onClick}
            className="border max-w-full cursor-crosshair"
          />
          {pending && (
            <div className="mt-4 p-4 border rounded space-y-2">
              <div>Pixel: ({pending.x.toFixed(0)}, {pending.y.toFixed(0)})</div>
              <input
                placeholder="Latitude"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="border rounded px-2 py-1 mr-2"
              />
              <input
                placeholder="Longitude"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="border rounded px-2 py-1 mr-2"
              />
              <button onClick={confirm} className="bg-black text-white rounded px-3 py-1">
                Add point
              </button>
            </div>
          )}
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Points: {points.length}/2</h2>
            <ul className="text-sm">
              {points.map((p, i) => (
                <li key={i}>
                  ({p.pxX.toFixed(0)}, {p.pxY.toFixed(0)}) → {p.lat}, {p.lng}
                </li>
              ))}
            </ul>
          </div>
          {bounds && (
            <pre className="mt-6 bg-gray-100 p-4 rounded text-sm">
    Paste this into lib/overlay-config.ts as the bounds field:

    bounds: [{bounds.s.toFixed(6)}, {bounds.w.toFixed(6)}, {bounds.n.toFixed(6)}, {bounds.e.toFixed(6)}] as [number, number, number, number],
            </pre>
          )}
        </main>
      );
    }

    function computeBounds(points: RefPoint[], img: HTMLImageElement | null) {
      if (points.length < 2 || !img) return null;
      const [a, b] = points;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      // Linear mapping: lat = m*py + c, lng = m*px + c
      const dLatPerPy = (b.lat - a.lat) / (b.pxY - a.pxY);
      const dLngPerPx = (b.lng - a.lng) / (b.pxX - a.pxX);
      const latAtTop = a.lat - dLatPerPy * a.pxY;
      const latAtBottom = a.lat + dLatPerPy * (H - a.pxY);
      const lngAtLeft = a.lng - dLngPerPx * a.pxX;
      const lngAtRight = a.lng + dLngPerPx * (W - a.pxX);
      const n = Math.max(latAtTop, latAtBottom);
      const s = Math.min(latAtTop, latAtBottom);
      const e = Math.max(lngAtLeft, lngAtRight);
      const w = Math.min(lngAtLeft, lngAtRight);
      return { n, s, e, w };
    }

[ ] Step 4: Open http://localhost:3000/admin/overlay-setup. Click on a known point in the screenshot, paste its lat/lng, click Add point. Repeat for a second point. Copy the printed bounds line.

[ ] Step 5: Open lib/overlay-config.ts and paste the new bounds line, replacing the placeholder.

[ ] Step 6: Reload the home page. The overlay should now align with the OSM streets underneath. Sanity-check: a CrimeGrade green/red boundary should land on the same neighborhood it is meant to.

[ ] Step 7: Commit:

    git add public/overlays/crimegrade-houston.png lib/overlay-config.ts app/admin
    git commit -m "feat: overlay-setup helper and real CrimeGrade screenshot"


TASK 16: Pin layer (markers + popups)

Files:
    Create: components/PropertyPins.tsx
    Modify: components/MapView.tsx (add the layer)

Steps:

[ ] Step 1: Create components/PropertyPins.tsx:

    "use client";

    import { CircleMarker, Popup } from "react-leaflet";
    import Link from "next/link";
    import type { Property, TourStatus } from "@/lib/types/property";
    import { publicPhotoUrl } from "./photo-url";

    const STATUS_COLOR: Record<TourStatus, string> = {
      not_toured: "#6b7280",
      scheduled: "#2563eb",
      toured: "#16a34a",
      rejected: "#dc2626",
      top_pick: "#eab308",
    };

    export function PropertyPins({ properties }: { properties: Property[] }) {
      return (
        <>
          {properties.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.latitude, p.longitude]}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: STATUS_COLOR[p.tour_status],
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="space-y-2 w-56">
                  {p.photo_path && (
                    <img
                      src={publicPhotoUrl(p.photo_path)}
                      alt={p.address}
                      className="w-full h-32 object-cover rounded"
                    />
                  )}
                  <div className="font-semibold">{p.address}</div>
                  <div className="text-sm">
                    {p.price ? `$${p.price.toLocaleString()}/mo` : "Price unknown"}
                    {p.beds != null && ` · ${p.beds}bd`}
                    {p.baths != null && ` ${p.baths}ba`}
                  </div>
                  {p.star_rating && (
                    <div className="text-sm">{"★".repeat(p.star_rating)}</div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <a
                      href={p.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-center bg-black text-white rounded px-2 py-1 text-xs"
                    >
                      Open listing
                    </a>
                    <Link
                      href={`/properties/${p.id}`}
                      className="flex-1 text-center border rounded px-2 py-1 text-xs"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </>
      );
    }

[ ] Step 2: Create components/photo-url.ts (small helper used by both pins and sidebar):

    export function publicPhotoUrl(path: string): string {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      return `${base}/storage/v1/object/public/property-photos/${path}`;
    }

[ ] Step 3: Update components/MapView.tsx — add the PropertyPins layer inside the MapContainer (after CrimeOverlay):

    import { PropertyPins } from "./PropertyPins";

    // ...inside the JSX, after <CrimeOverlay ... />:
    <PropertyPins properties={properties} />

[ ] Step 4: Manual verification:
    Add a property via the API as in Task 11 if you don't already have one. Refresh /. Confirm a colored circle appears at the right location and clicking it opens the popup.

[ ] Step 5: Commit:

    git add components/PropertyPins.tsx components/photo-url.ts components/MapView.tsx
    git commit -m "feat: property pin layer with popup actions"


TASK 17: Add-property modal (URL paste → scrape → confirm → save)

Files:
    Create: components/AddPropertyButton.tsx
    Create: components/AddPropertyModal.tsx
    Create: components/ManualGeoPicker.tsx (small map for low-confidence geocode fallback)
    Modify: components/MapView.tsx (mount AddPropertyButton, refresh list on save)

Steps:

[ ] Step 1: Create components/AddPropertyModal.tsx:

    "use client";

    import { useState } from "react";
    import dynamic from "next/dynamic";

    const ManualGeoPicker = dynamic(() => import("./ManualGeoPicker"), { ssr: false });

    interface ScrapeResp {
      scraped: {
        address: string | null;
        price: number | null;
        beds: number | null;
        baths: number | null;
        square_feet: number | null;
        photo_url: string | null;
      };
      latitude: number | null;
      longitude: number | null;
      geocode_confidence: "high" | "low" | "none";
    }

    export function AddPropertyModal({
      onClose,
      onSaved,
    }: {
      onClose: () => void;
      onSaved: () => void;
    }) {
      const [step, setStep] = useState<"url" | "review">("url");
      const [url, setUrl] = useState("");
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [data, setData] = useState<ScrapeResp | null>(null);
      const [address, setAddress] = useState("");
      const [price, setPrice] = useState<string>("");
      const [beds, setBeds] = useState<string>("");
      const [baths, setBaths] = useState<string>("");
      const [sqft, setSqft] = useState<string>("");
      const [lat, setLat] = useState<string>("");
      const [lng, setLng] = useState<string>("");

      const doScrape = async () => {
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/properties/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "scrape failed");
          const d: ScrapeResp = await res.json();
          setData(d);
          setAddress(d.scraped.address ?? "");
          setPrice(d.scraped.price?.toString() ?? "");
          setBeds(d.scraped.beds?.toString() ?? "");
          setBaths(d.scraped.baths?.toString() ?? "");
          setSqft(d.scraped.square_feet?.toString() ?? "");
          setLat(d.latitude?.toString() ?? "");
          setLng(d.longitude?.toString() ?? "");
          setStep("review");
        } catch (e) {
          setError((e as Error).message);
          // Still allow manual entry
          setStep("review");
        } finally {
          setBusy(false);
        }
      };

      const save = async () => {
        const latN = parseFloat(lat);
        const lngN = parseFloat(lng);
        if (!address || !Number.isFinite(latN) || !Number.isFinite(lngN)) {
          setError("Address and a valid lat/lng are required");
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/properties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listing_url: url,
              address,
              latitude: latN,
              longitude: lngN,
              price: price ? parseInt(price, 10) : null,
              beds: beds ? parseInt(beds, 10) : null,
              baths: baths ? parseFloat(baths) : null,
              square_feet: sqft ? parseInt(sqft, 10) : null,
              photo_path: null,
              photo_source_url: data?.scraped.photo_url ?? null,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "save failed");
          onSaved();
          onClose();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      };

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Add property</h2>
              <button onClick={onClose} className="text-gray-500">✕</button>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}

            {step === "url" && (
              <div className="space-y-3">
                <input
                  placeholder="Paste listing URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={doScrape}
                    disabled={busy || !url}
                    className="flex-1 bg-black text-white rounded py-2 disabled:opacity-50"
                  >
                    {busy ? "Scraping..." : "Continue"}
                  </button>
                  <button
                    onClick={() => setStep("review")}
                    className="flex-1 border rounded py-2"
                  >
                    Skip and enter manually
                  </button>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-3">
                {data?.geocode_confidence === "low" || !lat || !lng ? (
                  <div className="text-sm text-amber-700">
                    Geocode confidence is low or missing. Drag the pin to the correct location.
                  </div>
                ) : null}
                <Field label="Address">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded px-3 py-2" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price ($/mo)">
                    <input value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border rounded px-3 py-2" />
                  </Field>
                  <Field label="Sq ft">
                    <input value={sqft} onChange={(e) => setSqft(e.target.value)} className="w-full border rounded px-3 py-2" />
                  </Field>
                  <Field label="Beds">
                    <input value={beds} onChange={(e) => setBeds(e.target.value)} className="w-full border rounded px-3 py-2" />
                  </Field>
                  <Field label="Baths">
                    <input value={baths} onChange={(e) => setBaths(e.target.value)} className="w-full border rounded px-3 py-2" />
                  </Field>
                </div>
                <Field label="Latitude / Longitude">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full border rounded px-3 py-2" />
                    <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-full border rounded px-3 py-2" />
                  </div>
                </Field>
                <ManualGeoPicker
                  lat={parseFloat(lat) || 29.76}
                  lng={parseFloat(lng) || -95.37}
                  onChange={(la, ln) => { setLat(la.toString()); setLng(ln.toString()); }}
                />
                <button
                  onClick={save}
                  disabled={busy}
                  className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save property"}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    function Field({ label, children }: { label: string; children: React.ReactNode }) {
      return (
        <label className="block text-sm">
          <span className="text-gray-700">{label}</span>
          <div className="mt-1">{children}</div>
        </label>
      );
    }

[ ] Step 2: Create components/ManualGeoPicker.tsx:

    "use client";

    import "leaflet/dist/leaflet.css";
    import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
    import { useState, useEffect } from "react";
    import L from "leaflet";

    // Default Leaflet marker icons break with bundlers; set them up once.
    const defaultIcon = new L.Icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    interface Props {
      lat: number;
      lng: number;
      onChange: (lat: number, lng: number) => void;
    }

    export default function ManualGeoPicker({ lat, lng, onChange }: Props) {
      return (
        <div className="h-48 w-full rounded overflow-hidden border">
          <MapContainer center={[lat, lng]} zoom={13} className="w-full h-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DraggableMarker lat={lat} lng={lng} onChange={onChange} />
          </MapContainer>
        </div>
      );
    }

    function DraggableMarker({ lat, lng, onChange }: Props) {
      const [position, setPosition] = useState<[number, number]>([lat, lng]);
      useEffect(() => setPosition([lat, lng]), [lat, lng]);
      useMapEvents({
        click(e) {
          setPosition([e.latlng.lat, e.latlng.lng]);
          onChange(e.latlng.lat, e.latlng.lng);
        },
      });
      return (
        <Marker
          position={position}
          icon={defaultIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const ll = m.getLatLng();
              setPosition([ll.lat, ll.lng]);
              onChange(ll.lat, ll.lng);
            },
          }}
        />
      );
    }

[ ] Step 3: Create components/AddPropertyButton.tsx:

    "use client";

    import { useState } from "react";
    import { AddPropertyModal } from "./AddPropertyModal";

    export function AddPropertyButton({ onSaved }: { onSaved: () => void }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            onClick={() => setOpen(true)}
            className="absolute bottom-6 right-6 z-[1000] bg-black text-white rounded-full w-14 h-14 text-2xl shadow-lg"
            aria-label="Add property"
          >
            +
          </button>
          {open && <AddPropertyModal onClose={() => setOpen(false)} onSaved={onSaved} />}
        </>
      );
    }

[ ] Step 4: Update components/MapView.tsx — extract the property fetch into a refreshable function, mount the button:

    "use client";

    import "leaflet/dist/leaflet.css";
    import { MapContainer, TileLayer } from "react-leaflet";
    import { useCallback, useEffect, useState } from "react";
    import type { Property } from "@/lib/types/property";
    import { CrimeOverlay } from "./CrimeOverlay";
    import { PropertyPins } from "./PropertyPins";
    import { AddPropertyButton } from "./AddPropertyButton";

    const HOUSTON_CENTER: [number, number] = [29.76, -95.37];

    export default function MapView() {
      const [properties, setProperties] = useState<Property[]>([]);
      const [overlayMode, setOverlayMode] = useState<"auto" | "on" | "off">("auto");

      const refresh = useCallback(() => {
        fetch("/api/properties")
          .then((r) => r.json())
          .then((d) => setProperties(d.properties ?? []));
      }, []);

      useEffect(() => { refresh(); }, [refresh]);

      const forceVisible =
        overlayMode === "auto" ? null : overlayMode === "on";

      return (
        <div className="relative w-screen h-screen">
          <MapContainer
            center={HOUSTON_CENTER}
            zoom={11}
            scrollWheelZoom
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CrimeOverlay forceVisible={forceVisible} />
            <PropertyPins properties={properties} />
          </MapContainer>
          <button
            onClick={() =>
              setOverlayMode(
                overlayMode === "auto" ? "off" : overlayMode === "off" ? "on" : "auto",
              )
            }
            className="absolute top-4 right-4 z-[1000] bg-white shadow rounded px-3 py-2 text-sm"
          >
            Crime overlay: {overlayMode}
          </button>
          <AddPropertyButton onSaved={refresh} />
        </div>
      );
    }

[ ] Step 5: Manual verification: click + button → modal opens → paste a listing URL → click Continue → review screen → adjust pin if needed → Save. New pin should appear on the map after the modal closes.

[ ] Step 6: Commit:

    git add components
    git commit -m "feat: add-property modal with scrape, manual fallback, and pin picker"


==========================================
PHASE 4 — SIDEBAR, DETAIL, COMPARE
==========================================


TASK 18: Right sidebar with filter/sort and click-to-pan

Files:
    Create: components/Sidebar.tsx
    Modify: components/MapView.tsx (add ref to map for pan; integrate Sidebar)

Steps:

[ ] Step 1: Create components/Sidebar.tsx:

    "use client";

    import Link from "next/link";
    import type { Property, TourStatus } from "@/lib/types/property";
    import { publicPhotoUrl } from "./photo-url";

    const STATUS_COLOR: Record<TourStatus, string> = {
      not_toured: "#6b7280",
      scheduled: "#2563eb",
      toured: "#16a34a",
      rejected: "#dc2626",
      top_pick: "#eab308",
    };
    const STATUS_LABEL: Record<TourStatus, string> = {
      not_toured: "Not toured",
      scheduled: "Scheduled",
      toured: "Toured",
      rejected: "Rejected",
      top_pick: "Top pick",
    };
    const STATUS_RANK: Record<TourStatus, number> = {
      top_pick: 0, scheduled: 1, toured: 2, not_toured: 3, rejected: 4,
    };

    type SortKey = "default" | "price_asc" | "price_desc" | "rating" | "date";

    export function Sidebar({
      properties,
      onSelect,
      filter,
      setFilter,
      sort,
      setSort,
    }: {
      properties: Property[];
      onSelect: (p: Property) => void;
      filter: Set<TourStatus>;
      setFilter: (s: Set<TourStatus>) => void;
      sort: SortKey;
      setSort: (s: SortKey) => void;
    }) {
      const filtered = properties.filter((p) =>
        filter.size === 0 ? true : filter.has(p.tour_status),
      );
      const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
          case "price_asc": return (a.price ?? Infinity) - (b.price ?? Infinity);
          case "price_desc": return (b.price ?? -Infinity) - (a.price ?? -Infinity);
          case "rating": return (b.star_rating ?? 0) - (a.star_rating ?? 0);
          case "date": return b.created_at.localeCompare(a.created_at);
          default: {
            const sd = STATUS_RANK[a.tour_status] - STATUS_RANK[b.tour_status];
            if (sd !== 0) return sd;
            return (b.star_rating ?? 0) - (a.star_rating ?? 0);
          }
        }
      });

      const toggleStatus = (s: TourStatus) => {
        const next = new Set(filter);
        if (next.has(s)) next.delete(s); else next.add(s);
        setFilter(next);
      };

      return (
        <aside className="bg-white border-l flex flex-col h-full w-80">
          <div className="p-3 border-b space-y-2">
            <div className="text-sm font-semibold">{filtered.length} properties</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(STATUS_LABEL) as TourStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`text-xs px-2 py-1 rounded border ${
                    filter.has(s) ? "bg-black text-white border-black" : "bg-white"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="default">Sort: status, then rating</option>
              <option value="price_asc">Price ascending</option>
              <option value="price_desc">Price descending</option>
              <option value="rating">Rating</option>
              <option value="date">Date added</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex gap-3 p-3 border-b cursor-pointer hover:bg-gray-50"
              >
                {p.photo_path ? (
                  <img
                    src={publicPhotoUrl(p.photo_path)}
                    alt=""
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.address}</div>
                  <div className="text-xs text-gray-600">
                    {p.price ? `$${p.price.toLocaleString()}` : "—"}
                    {p.beds != null && ` · ${p.beds}bd`}
                    {p.baths != null && ` ${p.baths}ba`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: STATUS_COLOR[p.tour_status] }}
                    />
                    <span className="text-xs text-gray-600">
                      {STATUS_LABEL[p.tour_status]}
                    </span>
                    {p.star_rating && (
                      <span className="text-xs">{"★".repeat(p.star_rating)}</span>
                    )}
                  </div>
                </div>
                <a
                  href={p.listing_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-gray-500 self-start"
                >
                  ↗
                </a>
              </div>
            ))}
            {sorted.length === 0 && (
              <div className="p-6 text-sm text-gray-500 text-center">
                No properties match the current filter.
              </div>
            )}
          </div>
        </aside>
      );
    }

[ ] Step 2: Update components/MapView.tsx to integrate the Sidebar and pan-on-select. Replace its body:

    "use client";

    import "leaflet/dist/leaflet.css";
    import { MapContainer, TileLayer } from "react-leaflet";
    import { useCallback, useEffect, useRef, useState } from "react";
    import L from "leaflet";
    import type { Property, TourStatus } from "@/lib/types/property";
    import { CrimeOverlay } from "./CrimeOverlay";
    import { PropertyPins } from "./PropertyPins";
    import { AddPropertyButton } from "./AddPropertyButton";
    import { Sidebar } from "./Sidebar";

    const HOUSTON_CENTER: [number, number] = [29.76, -95.37];

    export default function MapView() {
      const [properties, setProperties] = useState<Property[]>([]);
      const [overlayMode, setOverlayMode] = useState<"auto" | "on" | "off">("auto");
      const [filter, setFilter] = useState<Set<TourStatus>>(new Set());
      const [sort, setSort] = useState<"default" | "price_asc" | "price_desc" | "rating" | "date">("default");
      const mapRef = useRef<L.Map | null>(null);

      const refresh = useCallback(() => {
        fetch("/api/properties")
          .then((r) => r.json())
          .then((d) => setProperties(d.properties ?? []));
      }, []);
      useEffect(() => { refresh(); }, [refresh]);

      const onSelect = (p: Property) => {
        mapRef.current?.flyTo([p.latitude, p.longitude], 16, { duration: 0.6 });
      };

      const forceVisible = overlayMode === "auto" ? null : overlayMode === "on";

      return (
        <div className="relative w-screen h-screen flex">
          <div className="relative flex-1">
            <MapContainer
              center={HOUSTON_CENTER}
              zoom={11}
              scrollWheelZoom
              className="w-full h-full"
              ref={(m) => { mapRef.current = m; }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CrimeOverlay forceVisible={forceVisible} />
              <PropertyPins properties={properties} />
            </MapContainer>
            <button
              onClick={() =>
                setOverlayMode(
                  overlayMode === "auto" ? "off" : overlayMode === "off" ? "on" : "auto",
                )
              }
              className="absolute top-4 right-4 z-[1000] bg-white shadow rounded px-3 py-2 text-sm"
            >
              Crime overlay: {overlayMode}
            </button>
            <AddPropertyButton onSaved={refresh} />
          </div>
          <Sidebar
            properties={properties}
            onSelect={onSelect}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
          />
        </div>
      );
    }

[ ] Step 3: Manual verification: sidebar appears on the right, list items clickable, map pans/zooms to the selected pin.

[ ] Step 4: Commit:

    git add components/Sidebar.tsx components/MapView.tsx
    git commit -m "feat: right sidebar with filter, sort, and click-to-pan"


TASK 19: Property detail page

Files:
    Create: app/properties/[id]/page.tsx (server component)
    Create: components/PropertyEditor.tsx (client editor)

Steps:

[ ] Step 1: Create app/properties/[id]/page.tsx:

    import { notFound, redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";
    import { PropertyEditor } from "@/components/PropertyEditor";
    import type { Property } from "@/lib/types/property";

    export default async function PropertyDetail({
      params,
    }: { params: Promise<{ id: string }> }) {
      const { id } = await params;
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) notFound();
      return <PropertyEditor initial={data as Property} />;
    }

[ ] Step 2: Create components/PropertyEditor.tsx:

    "use client";

    import Link from "next/link";
    import { useEffect, useRef, useState } from "react";
    import { useRouter } from "next/navigation";
    import type { Property, TourStatus } from "@/lib/types/property";
    import { publicPhotoUrl } from "./photo-url";

    const STATUSES: TourStatus[] = ["not_toured", "scheduled", "toured", "rejected", "top_pick"];

    export function PropertyEditor({ initial }: { initial: Property }) {
      const router = useRouter();
      const [p, setP] = useState<Property>(initial);
      const debounceRef = useRef<NodeJS.Timeout | null>(null);

      const patch = (patch: Partial<Property>) => {
        setP({ ...p, ...patch });
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
          await fetch(`/api/properties/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
        }, 500);
      };

      const remove = async () => {
        if (!confirm("Delete this property?")) return;
        await fetch(`/api/properties/${p.id}`, { method: "DELETE" });
        router.push("/");
      };

      const setProAt = (i: number, value: string) => {
        const next = [...p.pros];
        next[i] = value;
        patch({ pros: next });
      };
      const addPro = () => patch({ pros: [...p.pros, ""] });
      const removePro = (i: number) => patch({ pros: p.pros.filter((_, j) => j !== i) });

      const setConAt = (i: number, value: string) => {
        const next = [...p.cons];
        next[i] = value;
        patch({ cons: next });
      };
      const addCon = () => patch({ cons: [...p.cons, ""] });
      const removeCon = (i: number) => patch({ cons: p.cons.filter((_, j) => j !== i) });

      return (
        <main className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <Link href="/" className="text-sm text-gray-500">← Back to map</Link>
              <h1 className="text-2xl font-semibold mt-2">{p.address}</h1>
              <div className="text-gray-700 mt-1">
                {p.price ? `$${p.price.toLocaleString()}/mo` : "Price unknown"}
                {p.beds != null && ` · ${p.beds}bd`}
                {p.baths != null && ` ${p.baths}ba`}
                {p.square_feet != null && ` · ${p.square_feet.toLocaleString()} sqft`}
              </div>
            </div>
            <div className="flex gap-2">
              <a href={p.listing_url} target="_blank" rel="noreferrer" className="text-sm border rounded px-3 py-2">
                Open listing
              </a>
              <button onClick={remove} className="text-sm border border-red-300 text-red-700 rounded px-3 py-2">
                Delete
              </button>
            </div>
          </div>

          {p.photo_path ? (
            <img src={publicPhotoUrl(p.photo_path)} alt={p.address} className="w-full rounded" />
          ) : (
            <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center text-gray-500">
              No photo
            </div>
          )}

          <section className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-gray-700">Tour status</span>
              <select
                value={p.tour_status}
                onChange={(e) => patch({ tour_status: e.target.value as TourStatus })}
                className="w-full border rounded px-2 py-1 mt-1"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Star rating</span>
              <select
                value={p.star_rating ?? ""}
                onChange={(e) =>
                  patch({ star_rating: e.target.value ? parseInt(e.target.value, 10) : null })
                }
                className="w-full border rounded px-2 py-1 mt-1"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold text-green-700">Pros</h2>
              {p.pros.map((entry, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <input
                    value={entry}
                    onChange={(e) => setProAt(i, e.target.value)}
                    className="flex-1 border rounded px-2 py-1"
                  />
                  <button onClick={() => removePro(i)} className="text-gray-400">✕</button>
                </div>
              ))}
              <button onClick={addPro} className="mt-2 text-sm text-green-700">+ Add pro</button>
            </div>
            <div>
              <h2 className="font-semibold text-red-700">Cons</h2>
              {p.cons.map((entry, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <input
                    value={entry}
                    onChange={(e) => setConAt(i, e.target.value)}
                    className="flex-1 border rounded px-2 py-1"
                  />
                  <button onClick={() => removeCon(i)} className="text-gray-400">✕</button>
                </div>
              ))}
              <button onClick={addCon} className="mt-2 text-sm text-red-700">+ Add con</button>
            </div>
          </section>

          <section>
            <h2 className="font-semibold">Notes</h2>
            <textarea
              value={p.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={6}
              className="w-full border rounded px-3 py-2 mt-1"
              placeholder="Free-form thoughts..."
            />
          </section>
        </main>
      );
    }

[ ] Step 3: Manual verification:
    From the map, click any pin → Details. Edit each field — confirm changes persist on reload (PATCH succeeds within 500ms of last edit). Delete a property — confirm it disappears from the map.

[ ] Step 4: Commit:

    git add app/properties components/PropertyEditor.tsx
    git commit -m "feat: property detail page with auto-save editor"


TASK 20: Comparison page

Files:
    Create: app/compare/page.tsx
    Modify: components/MapView.tsx (add Compare link in top nav area)

Steps:

[ ] Step 1: Create app/compare/page.tsx:

    import Link from "next/link";
    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";
    import type { Property, TourStatus } from "@/lib/types/property";
    import { publicPhotoUrl } from "@/components/photo-url";

    const STATUS_LABEL: Record<TourStatus, string> = {
      not_toured: "Not toured",
      scheduled: "Scheduled",
      toured: "Toured",
      rejected: "Rejected",
      top_pick: "Top pick",
    };

    export default async function ComparePage() {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");

      const { data } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      const properties = (data ?? []) as Property[];

      return (
        <main className="p-6">
          <div className="flex justify-between mb-4">
            <h1 className="text-2xl font-semibold">Compare</h1>
            <Link href="/" className="text-sm border rounded px-3 py-2">← Back to map</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">Photo</th>
                  <th className="p-2">Address</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Bd/Ba</th>
                  <th className="p-2">Sqft</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Rating</th>
                  <th className="p-2">Top pros</th>
                  <th className="p-2">Top cons</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      {p.photo_path ? (
                        <img src={publicPhotoUrl(p.photo_path)} alt="" className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded" />
                      )}
                    </td>
                    <td className="p-2">
                      <Link href={`/properties/${p.id}`} className="hover:underline">
                        {p.address}
                      </Link>
                    </td>
                    <td className="p-2">{p.price ? `$${p.price.toLocaleString()}` : "—"}</td>
                    <td className="p-2">
                      {p.beds ?? "—"}/{p.baths ?? "—"}
                    </td>
                    <td className="p-2">{p.square_feet ?? "—"}</td>
                    <td className="p-2">{STATUS_LABEL[p.tour_status]}</td>
                    <td className="p-2">{p.star_rating ? "★".repeat(p.star_rating) : "—"}</td>
                    <td className="p-2 text-green-700">
                      <ul className="list-disc list-inside">
                        {p.pros.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </td>
                    <td className="p-2 text-red-700">
                      <ul className="list-disc list-inside">
                        {p.cons.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      );
    }

[ ] Step 2: Add a Compare link to MapView. In components/MapView.tsx, add a Link in the top-left corner of the map container:

    import Link from "next/link";

    // Inside the map's relative wrapper, add near the overlay toggle:
    <Link
      href="/compare"
      className="absolute top-4 left-4 z-[1000] bg-white shadow rounded px-3 py-2 text-sm"
    >
      Compare
    </Link>

[ ] Step 3: Manual verification: visit /compare, confirm one row per property with all the columns populated. Click a row's address → detail page.

[ ] Step 4: Commit:

    git add app/compare components/MapView.tsx
    git commit -m "feat: side-by-side comparison page"


==========================================
PHASE 5 — POLISH AND DEPLOY
==========================================


TASK 21: Mobile bottom-sheet sidebar

Files:
    Modify: components/Sidebar.tsx (responsive behavior)
    Modify: components/MapView.tsx (layout switch)

Steps:

[ ] Step 1: Update components/Sidebar.tsx so that on screens narrower than 768px it renders as a bottom-anchored sheet that can be expanded. Wrap the existing aside content in a responsive container. Replace the outer aside with:

    "use client";

    import { useState } from "react";
    // ... existing imports above

    export function Sidebar(props: SidebarProps) {
      const [expanded, setExpanded] = useState(false);

      return (
        <>
          {/* Desktop column */}
          <aside className="hidden md:flex bg-white border-l flex-col h-full w-80">
            <SidebarBody {...props} />
          </aside>

          {/* Mobile bottom sheet */}
          <div
            className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl rounded-t-xl transition-[height] duration-300 z-[1500] ${
              expanded ? "h-[80vh]" : "h-32"
            }`}
          >
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-2 flex justify-center"
              aria-label="Toggle property list"
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </button>
            <div className="h-[calc(100%-32px)] flex flex-col">
              <SidebarBody {...props} />
            </div>
          </div>
        </>
      );
    }

    function SidebarBody({ properties, onSelect, filter, setFilter, sort, setSort }: SidebarProps) {
      // The existing render code from the previous Sidebar implementation goes here,
      // unchanged except that the outer <aside> wrapper is removed (the parent provides it).
    }

    // Define SidebarProps as the same prop shape used previously.
    interface SidebarProps {
      properties: Property[];
      onSelect: (p: Property) => void;
      filter: Set<TourStatus>;
      setFilter: (s: Set<TourStatus>) => void;
      sort: SortKey;
      setSort: (s: SortKey) => void;
    }

    type SortKey = "default" | "price_asc" | "price_desc" | "rating" | "date";

[ ] Step 2: Update components/MapView.tsx — the existing flex layout works on desktop; on mobile the sidebar floats on top, so wrap the map area in flex-1 and let the mobile sheet position absolutely:

    Change the outer div className from "relative w-screen h-screen flex" to "relative w-screen h-screen md:flex".
    Make the map div take full height: "relative h-full md:flex-1".

[ ] Step 3: Manual verification: open in browser at desktop width — sidebar on the right, unchanged. Resize to phone width (DevTools device toolbar) — sidebar collapses to a bottom sheet with a peek; tap the handle to expand to 80vh.

[ ] Step 4: Commit:

    git add components/Sidebar.tsx components/MapView.tsx
    git commit -m "feat: mobile bottom-sheet sidebar"


TASK 22: Deploy to Vercel

Files:
    Create: vercel.json (optional, only if needed)

Steps:

[ ] Step 1: Push the project to GitHub:

    Create a new private repo on github.com (recommended name: condo-search).
    git remote add origin https://github.com/<your-handle>/condo-search.git
    git branch -M main
    git push -u origin main

[ ] Step 2: At https://vercel.com/new, import the GitHub repo. Choose Next.js as the framework (auto-detected).

[ ] Step 3: In the Vercel project settings → Environment Variables, add:
    NEXT_PUBLIC_SUPABASE_URL = https://qzhkwftjsqvwnogrqseb.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
    SUPABASE_SERVICE_ROLE_KEY = <service role key>
    Apply to Production, Preview, and Development.

[ ] Step 4: Click Deploy. Wait for the build to complete.

[ ] Step 5: In the Supabase dashboard → Authentication → URL Configuration, add the deployed Vercel URL (https://<project>.vercel.app) to "Site URL" and to the "Additional Redirect URLs" allow list.

[ ] Step 6: Manual verification:
    Open the Vercel URL on your laptop. Sign in. Confirm map loads, overlay shows, sidebar populates, add-property flow works.
    Open the same URL on your phone. Sign in. Confirm bottom sheet behaves, map is usable, add-property works on a touch device.

[ ] Step 7: Commit any vercel.json that was needed:

    git add vercel.json 2>/dev/null; git commit -m "chore: deployment config" --allow-empty


==========================================
DONE
==========================================

When all 22 tasks are complete you have a deployed app at https://<project>.vercel.app that satisfies every requirement in the spec. To track v2 ideas as they come up, append them to docs/brainstorm-working-doc.txt under "STILL TO DECIDE" or a new "v2 ideas" section.
