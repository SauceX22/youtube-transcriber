# Cartewei Food Memory Connector

Date: 2026-07-18  
Status: implementation contract for private owner dogfood; not yet shipped

## Purpose

Add a user-initiated workflow to the existing Transcriber extension:

> Harvest restaurants and dishes from a YouTube video or public web page, review them, and add the approved food intentions to a global Cartewei Food Memory.

The connector helps answer "where and what do I want to eat next?" across an open-ended time horizon and multiple countries. It is not limited to nearby places, this week, New York, or `dishes.nyc`.

This extension path is one of two first-class inputs. The sibling direct-input path lets Codex, Claude, or another tool-using LLM add an explicitly stated restaurant/dish through a proposed `cw food add` command and the same Cartewei food-intent API. Direct input should bypass paid source extraction.

The Cartewei product decision and global model are documented in:

`/Users/tofumajure/Dev/projects/Cartewei/Strategy/26-global-food-memory-and-transcriber-harvest.md`

The read-only engineering review prompt is:

`/Users/tofumajure/Dev/projects/Transcriber/transcriber-local/docs/CARTEWEI-FOOD-MEMORY-ENGINEERING-REVIEW-PROMPT.md`

## Extension Decision

Implement this as an optional connector in the current open-source Transcriber extension. Do not create a separate Cartewei extension for the MVP.

Use the existing Connectors settings and authenticated cloud path already used for cloud-backed destinations. Keep Cartewei-specific credentials and service behavior out of the extension.

The first implementation must be restricted to an explicit owner allowlist. A client-side flag is not an access control: triage, extraction, and commit routes must all enforce eligibility on the server. Do not expose the variable-cost workflow publicly until dogfood establishes a reliable quality and cost envelope.

The connector is more than a generic "send transcript" destination. It needs a domain-specific action and review step:

- settings label: **Cartewei Food Memory**;
- settings description: **Save dishes and restaurants for home and upcoming trips**;
- transcript/page action: **Find dishes & places**;
- final action: **Add to food memory**.

## Current Foundation

The repos already contain a hidden, incomplete connector path:

- cloud adapter: `youtube-transcriber-cloud/lib/destinations/cartewei.ts`;
- feature flag: `youtube-transcriber-cloud/lib/feature-flags.ts` using `ENABLE_CARTEWEI_DESTINATION`;
- server-only configuration: `CARTEWEI_INGEST_URL` and `CARTEWEI_INGEST_TOKEN`;
- Cartewei receiver: `Cartewei/Menu-scrape/src/web/server.ts`, `POST /api/ingest/creator-video`;
- ingestion logic: `Cartewei/Menu-scrape/src/creator-video-ingest.ts`;
- extension connector settings: `extension/popup.html` and `extension/popup.js`;
- extension cloud requests: `extension/background.js`, under `/api/destinations`.

The current adapter sends a creator-video artifact and is hidden by default. It is useful plumbing, but it does not yet implement the personal food-memory onboarding, candidate preview, global intent model, or confirmed commit described here.

## Ownership Boundary

### Transcriber owns

- user-initiated source capture;
- transcript or page content needed for extraction;
- the connector setting and consent entry point;
- candidate extraction orchestration;
- preview/edit/reject UI;
- idempotent delivery to Cartewei;
- a receipt linking to the resulting Cartewei view.

### Cartewei owns

- food-memory profile creation and connector consent record;
- canonical global food-intent storage;
- trip/collection membership and time context;
- restaurant and dish resolution;
- evidence and provenance state;
- retrieval, planning, export, deletion, and revocation surfaces;
- later menu enrichment and activation.

Transcriber should not grow a second canonical restaurant wishlist. It may cache an in-progress preview or delivery receipt, but Cartewei is the system of record after confirmation.

The Transcriber extension should not shell out to the Cartewei CLI. The extension and CLI are independent clients of the same final food-intent API: the extension needs source triage and preview, while an LLM-assisted direct add usually needs only validation and commit.

## MVP Source Scope

### YouTube

Start with completed cloud transcripts because the source URL, title, creator, transcript text, and timestamps are already available.

The action should extract only food-relevant candidates and return:

```ts
type FoodMemoryCandidate = {
  clientCandidateId: string;
  placeName: string | null;
  dishNames: string[];
  city: string | null;
  region: string | null;
  country: string | null;
  sourceQuote: string;
  sourceStartSeconds: number | null;
  whyItMattered: string | null;
  confidence: number | null;
  resolutionStatus: "partial" | "resolved" | "needs_review";
};
```

### Public web pages

Add user-initiated active-page capture as the next source adapter, using the same candidate contract. Capture only the content needed for the user's explicit action, such as URL, title, publisher/author when visible, selected or relevant passage, and section heading.

Do not collect browsing history or continuously scrape pages in the background. If broad host access would be required, prefer an `activeTab`/one-shot path and document any new permission before implementation.

Page capture should be feature-flagged independently if it is not ready for the first YouTube dogfood build.

## Proposed User Flow

### Settings and onboarding

1. Show **Cartewei Food Memory** beside the existing connector rows.
2. If signed out of Transcriber cloud, use the existing cloud sign-in gate.
3. If signed in but unlinked, show **Set up**.
4. Explain the fields that can be sent: source URL/title, supporting quote or passage, proposed restaurant/dish, geography, user edits, and collection.
5. On explicit consent, create or link the user's Cartewei Food Memory profile.
6. Return a connected state plus **Open food memory** and **Disconnect** actions.

Suggested initial settings after connection:

- default collection: `Europe Walkabout 2026`;
- current destination: Amsterdam, London, Spain, infer, or none;
- ask when location is uncertain: on;
- review before saving: on and required for MVP;
- open saved memory: link.

The collection is optional metadata. USA and Europe items belong to the same global account.

### Source triage

Harvesting a source should not imply full paid extraction. Before extraction, classify the source cheaply using cached metadata, deterministic text signals, user-selected text or chapters, or a deliberately low-cost triage model.

Return a source plan such as:

```ts
type FoodHarvestPlan = {
  relevant: boolean;
  sourceShape: "single_review" | "roundup" | "directory" | "incidental" | "unknown";
  likelyPlaceCount: number | null;
  likelyDishCount: number | null;
  geographyHints: string[];
  suggestedRanges: Array<{
    label: string;
    startSeconds?: number;
    endSeconds?: number;
    sectionId?: string;
  }>;
  cachedExtractionAvailable: boolean;
  estimatedCostUsd: { low: number; high: number } | null;
};
```

For a focused review, default to the featured restaurant and recommended dishes. For a roundup, directory, or long video, require a scope choice:

- featured or strong recommendations only;
- selected chapters, timestamps, sections, or highlighted passage;
- all mentions, with a higher-cost confirmation;
- save the source only as an unresolved lead.

### Extract, review, and commit

1. User invokes **Find dishes & places** on a completed transcript or supported page.
2. Run or load source triage and show relevance, shape, suggested scope, and estimated cost band.
3. Require scope confirmation for broad or expensive sources.
4. Run structured extraction without committing anything.
5. Render each candidate with place, dishes, probable location, source quote/passage, timestamp or section link, and uncertainty.
6. Allow editing, rejecting, choosing `want_to_eat`, `want_to_go`, `maybe`, or `needs_review`, and selecting a collection.
7. Commit only checked candidates after **Add to food memory**.
8. Show a receipt with saved count, unresolved count, run cost, and link to the global or collection view.

No automatic write should occur when the connector is enabled or extraction finishes.

## Proposed API Shape

The exact route names may follow the existing destination router, but the workflow needs distinct eligibility, triage, extraction, and commit operations.

### 1. Connect or inspect connection

```txt
GET  /api/destinations
POST /api/destinations/cartewei/connect
POST /api/destinations/cartewei/disconnect
```

The extension receives connection state, owner eligibility, budget status, and safe public configuration only. It never receives a Cartewei service credential.

### 2. Triage source

```txt
POST /api/destinations/cartewei/triage
```

Input identifies the authorized transcript or contains a bounded, user-initiated page payload. Output is a `FoodHarvestPlan`. Triage should prefer cache and deterministic signals before a paid model call.

### 3. Extract preview

```txt
POST /api/destinations/cartewei/preview
```

Input:

```json
{
  "source": {
    "type": "youtube_transcript",
    "url": "https://www.youtube.com/watch?v=...",
    "title": "...",
    "creator": "...",
    "transcriptId": "..."
  },
  "context": {
    "collectionId": "...",
    "destinationHint": "Amsterdam",
    "scope": {
      "mode": "featured_only",
      "rangeIds": []
    }
  }
}
```

The backend should load authorized transcript content by ID rather than accepting a complete transcript from an untrusted client when possible. For page capture, accept only the user-initiated page payload needed for extraction and apply explicit size limits.

Before starting, the server enforces owner eligibility and per-run, daily, and monthly budget limits. Output contains a `previewId`, candidates, provenance anchors, warnings, expiry, and metered run cost. Preview creates no Cartewei food intentions.

### 4. Commit reviewed candidates

```txt
POST /api/destinations/cartewei/commit
```

Input contains `previewId`, approved/edited candidates, intent, collection, and an idempotency key. The Transcriber backend validates ownership and preview expiry, then calls the Cartewei Food Memory API with a server-only credential.

Cartewei returns stable intent IDs, resolution states, and safe web URLs. Repeating the same commit must not duplicate saved intentions.

## Cost Ledger and Budgets

Every attempt should produce one harvest job with child stage-usage records. Track skipped, failed, cached, and successful work so the ledger explains both spend and avoided spend.

Minimum harvest-job fields:

```txt
job_id, owner_id, source_type, source_hash, source_size_or_duration
triage_outcome, selected_scope, extractor_schema_version
estimated_cost_usd, actual_cost_usd, cache_status
candidate_count, approved_count, saved_count
status, started_at, completed_at
```

Minimum stage-usage fields:

```txt
job_id, stage, provider, model_or_service_version
input_units, output_units, cost_usd, latency_ms, status
```

Stages may include transcription, triage, structured extraction, place resolution, and menu enrichment. Keep costs separate so an expensive stage is diagnosable.

Required controls:

- owner allowlist;
- maximum estimated cost per run;
- daily and monthly owner budgets;
- explicit confirmation above a configurable threshold;
- hard stop when a budget is exhausted;
- canonical-source and extractor-version cache key;
- no automatic retry of a billable stage without an idempotent job record;
- a private cost view or export grouped by source type and stage.

Dogfood metrics:

- cost per source triaged;
- cost per candidate extracted;
- cost per approved and saved intention;
- rejection and unresolved rates by source type;
- cache reuse rate;
- full extractions avoided or narrowed by triage;
- eventual cost per saved intention that becomes a meal.

## Authentication and Secrets

```txt
Extension --Transcriber session--> Transcriber cloud
Transcriber cloud --server credential--> Cartewei API
```

Rules:

- Never place `CARTEWEI_INGEST_TOKEN` or another Cartewei secret in extension source, the built bundle, `chrome.storage`, query parameters, logs, or public environment variables.
- Do not use a `NEXT_PUBLIC_` variable for the server credential.
- The extension authenticates only to Transcriber through the existing user session.
- Transcriber validates that the transcript belongs to the current user before preview or commit.
- Transcriber validates the owner allowlist and budget before triage, preview, or commit; hiding the connector in the UI is insufficient.
- Cartewei records explicit linking consent and supports disconnect/revocation.
- Disconnect stops future delivery; deletion/export of saved intentions is owned by Cartewei.
- Logs should use request/preview/intent IDs, not transcript bodies or tokens.

Shared Supabase identity may enable one-click account linking, but it does not replace consent or authorize bulk transcript sharing.

## Open-Source and Self-Hosted Behavior

The open-source extension may include:

- connector UI;
- candidate and receipt types;
- safe client request code;
- feature-state handling;
- tests and documentation.

It must not include a shared secret. The hosted Transcriber service supplies the configured connector. A self-hosted deployment should report one of these explicit states:

- **Available** — compatible backend routes and server credential are configured;
- **Not configured** — setup documentation link;
- **Unsupported by this host** — connector hidden from send actions, with no broken toggle.

This lets the extension remain open source while the hosted Cartewei service and server implementation retain their own deployment and licensing choices.

## Likely Implementation Surfaces

These are expected touch points, not authorization to implement without a reviewed ticket:

- `extension/popup.html` — connector row and candidate-review container;
- `extension/popup.js` — connector state, harvest action, preview/edit/commit, receipt;
- `extension/background.js` — authenticated requests and active-page one-shot capture;
- `youtube-transcriber-cloud/lib/destinations/cartewei.ts` — evolve from generic dry-run delivery to food-memory operations or split into a domain service;
- `youtube-transcriber-cloud/lib/feature-flags.ts` — staged enablement;
- cloud API routes under `/api/destinations`;
- Cartewei Food Memory API and global intent persistence.

Do not force the three-step domain workflow through a one-step generic `send()` abstraction if doing so hides preview, consent, or commit semantics. Reuse the registry for discovery and settings; allow a domain-specific capability behind it.

## Delivery Slices

### Slice 0 — Contract fixtures

- Define source, candidate, preview, commit, and receipt schemas.
- Add fixtures for one New York video, one Amsterdam video, one London page, and one ambiguous Spain item.
- Confirm the same user and collection model spans all four.

### Slice 1 — YouTube dogfood

- Feature-flag the connector for the owner account.
- Add setup/linking and explicit consent.
- Implement triage, scoped preview, and reviewed commit for completed cloud transcripts.
- Default optional collection to `Europe Walkabout 2026`.
- Add the harvest-job and stage-cost ledger plus per-run, daily, and monthly limits.
- Verify no credentials appear in the built extension.

### Slice 2 — Public page harvesting

- Add user-initiated active-page capture with minimal permissions.
- Reuse the preview and commit contract.
- Test article, restaurant review, and list-page ambiguity.

### Slice 3 — Retrieval and trip use

- Link receipts to a mobile-friendly global list.
- Filter by USA/Europe, country/city, collection, timing, unresolved state, restaurant, and dish.
- Dogfood during August–September 2026 and record which saves become meals.

### Slice 4 — Broader onboarding

- Add beta eligibility, clear service terms, export/deletion, and connector revocation.
- Measure first successful harvest rather than connector-toggle completion.

## Test Gate

Before enabling production dogfood:

- preview performs no writes;
- all billable routes reject non-allowlisted users server-side;
- each billable stage records actual or best-available estimated cost;
- budget exhaustion fails closed before another paid call;
- a repeat source uses the versioned cache or clearly asks to rerun at additional cost;
- broad sources require extraction-scope confirmation;
- commit requires an authenticated owner and reviewed candidates;
- replayed commits are idempotent;
- uncertain place/location remains `needs_review`;
- source URL and timestamp/passage survive round-trip;
- a USA item and Europe items coexist in one account;
- trip membership does not hide an item from the global memory;
- no secret appears in source, build output, Chrome storage, request URLs, or logs;
- disconnect prevents further commits;
- existing Notion and Obsidian connector behavior remains unchanged;
- self-hosted mode fails closed with a clear unavailable state.

## Deferred Decisions

- Exact consumer URL returned in the receipt.
- Whether extraction runs in Transcriber, Cartewei, or a versioned shared schema boundary. For MVP, prefer the service that already has authorized transcript access, then send reviewed structured candidates.
- Whether page capture ships in Slice 1 or Slice 2.
- Public beta limits and pricing.
- Exact owner dogfood budget thresholds and the evidence required to invite the first external tester.
- Whether a future standalone Cartewei capture surface is justified beyond Transcriber's transcription-oriented job.
