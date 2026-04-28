CONDO SEARCH - DESIGN SPEC
Date: 2026-04-27


PURPOSE

A personal web app to consolidate Houston condo hunting onto a single map. Listings from any source (apartments.com, Zillow, Trulia, etc.) are added by pasting a URL. The map shows each property as a colored pin with a CrimeGrade.org overlay so the user can see at a glance which areas are safest. The app is used on both laptop and phone, especially while touring properties in person.


SCOPE

In scope for v1
    Add property by pasting a listing URL; auto-extract address, price, beds, baths, hero image; correct any field manually before saving.
    Display all saved properties as colored pins on an interactive map of Houston.
    Render a static CrimeGrade.org screenshot as a geo-referenced overlay above the base map, with auto-hide on zoom-in and a manual toggle.
    Right-side scrollable sidebar listing every property; clicking a list item pans the map to that pin.
    Per-property detail page with status, star rating, pros, cons, free-form notes, and a replace-photo control.
    Side-by-side comparison table of all saved properties.
    Single-user authentication (the user's own account).
    Reachable from both laptop and phone via the same Vercel URL.

Out of scope for v1
    Tour appointment tracking (date, time, agent contact).
    Multiple photos per property (gallery).
    Multi-user or family-shared accounts.
    Crime overlays for cities other than Houston.
    Native mobile app — the responsive web app covers phone use.


STACK AND HOSTING

Frontend and backend live in one Next.js project deployed on Vercel. Serverless API routes inside the same project handle work that cannot run in the browser. Supabase (free tier) provides Postgres, Auth, and object Storage. Leaflet renders the map using free OpenStreetMap tiles — no Mapbox account, no API keys.

Single user account, email plus password, managed by Supabase Auth. Postgres row-level security policies restrict every row to the owning user_id, so the database is private even though the URL is public.


ARCHITECTURE OVERVIEW

The app has three logical units, each with one clear purpose.

The map page is the main screen. It owns the Leaflet instance, the crime overlay layer, the pin layer, the right sidebar, and the "+ Add property" button. It reads the property list once on load and listens for live updates so newly added pins appear without a refresh.

The scrape and save service runs on the server (Next.js API routes). It owns all interaction with the outside world: fetching listing pages, parsing them, geocoding addresses, downloading hero images into Supabase Storage, and writing rows to Postgres. The frontend never talks to listing sites directly.

The property detail page is a separate route. It owns the per-property edit experience: status, rating, pros, cons, notes, photo replacement, deletion. All edits auto-save to the database. This is also where the comparison table lives, as a sibling page reachable from the top nav.

These three units talk only through the Postgres database (for property data), Supabase Storage (for photos), and the documented API routes (for scraping and saving). No shared client-side state beyond a thin data-fetching layer.


API ROUTES

POST /api/properties/scrape
    Body: a single listing URL.
    Behavior: fetches the URL server-side with a normal browser User-Agent, parses the HTML, returns address, price, beds, baths, square_feet (when available), and the og:image URL. Also runs the address through Nominatim and returns the resulting latitude and longitude with a confidence flag.
    Failure modes: timeout, non-200 response, parser found nothing, or geocoder low-confidence — all return a partial response so the client can let the user fill in the rest by hand.

POST /api/properties
    Body: a confirmed property record (any field the user filled in or corrected).
    Behavior: downloads the hero image into Supabase Storage (so the cached photo survives the listing being removed), inserts the row into the properties table, returns the saved record including its storage path.

GET /api/properties
    Returns every property belonging to the current user, used to render the map pins and the sidebar.

PATCH /api/properties/:id
    Updates one or more fields on an existing property. Used by the detail page for auto-saving status, rating, pros, cons, and notes.

DELETE /api/properties/:id
    Deletes the property and its cached photo from Storage.


DATA MODEL

One main table in Postgres.

properties
    id                 uuid, primary key
    user_id            uuid, foreign key to auth.users, indexed
    listing_url        text, not null
    address            text, not null
    latitude           double precision, not null
    longitude          double precision, not null
    price              integer, dollars per month, nullable
    beds               smallint, nullable
    baths              numeric(2,1), nullable (allows 1.5 baths)
    square_feet        integer, nullable
    photo_path         text, Supabase Storage key, nullable
    tour_status        enum: not_toured, scheduled, toured, rejected, top_pick. Default not_toured.
    star_rating        smallint between 1 and 5, nullable
    notes              text, default empty string
    pros               text array, default empty array
    cons               text array, default empty array
    created_at         timestamptz, default now()
    updated_at         timestamptz, default now()

Pros and cons stay as Postgres text arrays since they are short and only ever read or written together with the rest of the property record. If a future version wants per-item ordering metadata or photo attachments, this table gets normalized; for now arrays are simpler.

Row-level security: a single policy on properties — user_id must equal auth.uid() — applied to select, insert, update, and delete.


MAP PAGE DETAIL

Base layer
    Leaflet map centered on Houston with an OpenStreetMap tile layer. Default zoom level shows the entire 610 / 99 metro area.

Crime overlay layer
    A single PNG of the CrimeGrade.org Houston map, stored as a static asset in /public. Rendered with Leaflet's ImageOverlay using fixed lat/lng bounds. Default opacity 0.65 so streets remain readable underneath. Auto-hides when the map zoom level exceeds 15 (roughly individual-block zoom). A toggle button in the top-right corner overrides the auto-hide in either direction — forcing it on while zoomed in, or hiding it while zoomed out.

    Capturing the screenshot is a one-time setup step. A small helper page at /admin/overlay-setup loads the Houston map, lets the user click two known reference points (for example two intersections), and records their pixel positions plus their real lat/lng. From those two points the helper computes the bounds of the screenshot for the ImageOverlay. The user pastes the resulting bounds into a config file or saves them through the helper.

Pin layer
    Each property is a colored circle marker.
        gray   — not_toured
        blue   — scheduled
        green  — toured
        red    — rejected
        gold   — top_pick
    Click opens a popup containing the cached photo, address, price, beds/baths, star rating, and two buttons: Open listing (opens the original URL in a new browser tab) and Edit / view full details (navigates to the property detail page).

Add property modal
    Triggered by a floating "+ Add property" button in the bottom-right corner of the map. The modal asks for a listing URL, calls /api/properties/scrape, then displays the extracted fields (address, price, beds, baths, square feet, photo preview, latitude/longitude). The user reviews and corrects anything wrong, then clicks Save. If geocoding came back low-confidence, a small map appears inside the modal with a draggable pin so the user can place the property manually.


SIDEBAR DETAIL

Layout: fixed-width column on the right side of the map page, vertically scrollable.

List item
    Photo thumbnail on the left, then address, price, beds/baths, status badge, star rating. The status badge uses the same color as the corresponding pin so the eye links the two. A small "open" icon at the right of the row opens the listing URL in a new tab without navigating away.

Click behavior
    Clicking anywhere else on the row pans and zooms the map to the property's pin and opens its popup.

Filter and sort header at the top of the sidebar
    Filter by status: any combination of Top pick / Toured / Scheduled / Not toured / Rejected.
    Sort by: status (Top pick first), price ascending or descending, rating descending, date added descending. Default: status, then rating descending.

Mobile layout
    Below a viewport width threshold, the sidebar collapses into a draggable bottom sheet. Default state is peeked — about one and a half cards visible. Drag up to expand to a full list, drag down to dismiss. The map remains the dominant view since this app is most often used in motion.


PROPERTY DETAIL PAGE

Reached by clicking Edit / view full details on a pin popup or a sidebar item. URL pattern /properties/:id.

Sections, top to bottom

Header
    Address, price, beds and baths, square feet if known. A button to open the original listing in a new tab. A delete button protected by a confirmation dialog.

Photo
    The cached hero image, full-width on mobile, contained on desktop. Click to view at full size in a lightbox. A small Replace photo control lets the user upload a different image from their phone — useful when the scraped photo is wrong, low quality, or the listing has since changed.

Status and rating
    A status dropdown (Not toured / Scheduled / Toured / Rejected / Top pick) and a 1-5 star rating selector. Both auto-save the moment they change.

Pros and cons
    Two stacked or side-by-side lists (depending on viewport width). Pros tinted green, cons tinted red. Each entry is a one-line text input. An "+ Add" button under each list creates a new entry. Existing entries can be edited inline, deleted with a trash icon, or reordered by drag. All changes auto-save.

Notes
    A single multi-line text area at the bottom for free-form thoughts. Auto-saves on a 500 ms debounce while typing.


COMPARISON VIEW

A separate page at /compare, reached from a Compare link in the top nav. One row per property, columns for the most-compared fields:

    Photo thumbnail, Address, Price, Beds/Baths, Square feet, Status, Rating, Top three pros, Top three cons.

Columns are sortable by clicking the header. Top three pros and cons are simply the first three array entries — the user controls which by reordering on the detail page. Clicking a row navigates to that property's detail page.


ERROR HANDLING

Scrape failure (timeout, blocked, bad URL): the modal still opens; all fields start empty; the user fills in everything by hand. Photo can be uploaded manually or skipped.

Partial scrape: returned fields pre-fill the modal; missing fields are blank. The user reviews and corrects before saving.

Geocoding failure or low confidence: a draggable-pin map appears inside the add-property modal so the user can place the property manually. No save until lat/lng are set.

Listing-site HTML changes break the scraper for one site: the manual-fill path still works for every site at all times, so the app keeps functioning while the scraper is fixed for the affected site.

Image fetch failure when caching the hero image: the property still saves; photo_path stays null; the detail page shows a placeholder and the Replace photo control still works.


TESTING

Minimal, since this is a single-user personal tool.

Unit tests cover the scrape parser, with one fixture HTML file per supported site (apartments.com, Zillow, Trulia). When a site changes its markup, the test for that site fails and the user knows to update the parser before relying on it again.

Manual verification covers the rest: add a real property end-to-end, confirm it appears on the map and in the sidebar, edit it on the detail page, delete it. The app is small enough that end-to-end test infrastructure would cost more than it saves.


SECURITY AND PRIVACY

Single user. Supabase Auth gates every API route. Row-level security restricts data to the owning user. Listing URLs and addresses are stored in plaintext but contain no sensitive personal data. The scraper sends no credentials to listing sites and obeys reasonable rate limits.


SETUP NOTES

The CrimeGrade screenshot is a one-time manual step the user performs after deployment, using the /admin/overlay-setup helper. Subsequent deployments do not need to repeat it; the PNG and bounds live in the repo.

Supabase project and Vercel project must be created once each. Environment variables required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (server only). No third-party API keys required for v1.
