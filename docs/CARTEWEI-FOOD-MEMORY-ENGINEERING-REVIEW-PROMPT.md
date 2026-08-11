# Engineering Review Prompt: Cartewei Food Memory Connector

Copy the prompt below into a new engineering-review task. This is a review request, not an implementation request.

---

You are reviewing a proposed owner-only integration between the open-source Transcriber Chrome extension and a global Cartewei Food Memory service.

## Review question

Is this the smallest secure, cost-controlled, and reversible architecture for helping one user add restaurants and dishes through Codex or Claude, and harvest them while watching YouTube videos or reading public web pages, into a global, time-aware list answering:

> Where and what do I want to eat next?

"Next" may mean tonight, next month, or a future trip. The same account must span the USA and Europe, including an August–September 2026 collection for Amsterdam, London, and Spain.

Do not implement, deploy, migrate a database, change environment variables, create tickets, or commit code. Review the proposal against the current repositories and return a written engineering assessment.

## Repository roots

- Transcriber workspace: `/Users/tofumajure/Dev/projects/Transcriber`
- Current extension/local app: `/Users/tofumajure/Dev/projects/Transcriber/transcriber-local`
- Hosted Transcriber backend: `/Users/tofumajure/Dev/projects/Transcriber/youtube-transcriber-cloud`
- Cartewei workspace: `/Users/tofumajure/Dev/projects/Cartewei`
- Cartewei provider/backend: `/Users/tofumajure/Dev/projects/Cartewei/Menu-scrape`

These worktrees may contain unrelated user changes. Treat them as read-only for this review and do not reset, clean, reformat, or overwrite anything.

## Required reading order

Read repository instructions before evaluating code:

1. `/Users/tofumajure/Dev/projects/Transcriber/CLAUDE.md`
2. `/Users/tofumajure/Dev/projects/Transcriber/transcriber-local/AGENTS.md`
3. `/Users/tofumajure/Dev/projects/Transcriber/transcriber-local/CLAUDE.md`
4. `/Users/tofumajure/Dev/projects/Cartewei/AGENTS.md`
5. `/Users/tofumajure/Dev/projects/Cartewei/CLAUDE.md`
6. `/Users/tofumajure/Dev/projects/Cartewei/Menu-scrape/CLAUDE.md`
7. `/Users/tofumajure/Dev/projects/Cartewei/Menu-scrape/docs/CURRENT-WORKING-MODEL.md`

Then read the two proposal documents:

1. `/Users/tofumajure/Dev/projects/Cartewei/Strategy/26-global-food-memory-and-transcriber-harvest.md`
2. `/Users/tofumajure/Dev/projects/Transcriber/transcriber-local/docs/CARTEWEI-FOOD-MEMORY-CONNECTOR.md`

Useful prior context:

- `/Users/tofumajure/Dev/projects/Cartewei/Strategy/19-personal-food-memory-channel-workflow.md`
- `/Users/tofumajure/Dev/projects/Cartewei/Strategy/20-personal-food-memory-build-plan-and-review.md`
- `/Users/tofumajure/Dev/projects/Cartewei/Strategy/21-cross-site-food-intent-exploration-brief.md`
- `/Users/tofumajure/Dev/Personal/James/restaurant-list-model.md`, if available

## Proposed decision

The proposal currently recommends:

1. Keep the connector inside the existing open-source Transcriber extension instead of creating a separate Cartewei extension.
2. Add a narrow direct-intent command to the existing agent-friendly Cartewei CLI so Codex or Claude can turn an explicit request into a food-intent API call without using media extraction. Consider MCP only after that contract is stable.
3. Keep Cartewei Food Memory as the canonical global store. Transcriber owns source capture, triage, extraction orchestration, review, and delivery—not a second wishlist.
4. Start the harvesting path with completed YouTube transcripts, then add user-initiated public web-page capture.
5. Use a staged harvesting flow:

```txt
capture source
  -> cheap source triage
  -> choose extraction scope when broad or expensive
  -> paid structured extraction
  -> review candidates
  -> commit approved food intentions
```

6. Allow saving a source as an unresolved lead without paying for full extraction.
7. Restrict all billable operations to a server-enforced owner allowlist during dogfood.
8. Track cost by job and stage, with per-run, daily, and monthly budgets, explicit higher-cost confirmation, caching, and no uncontrolled paid retries.
9. Keep every service credential out of the extension and conversation. The extension authenticates only to Transcriber; the owner CLI reads authentication from environment or protected local configuration rather than a prompt or visible command argument.
10. Treat `dishes.nyc` as an NYC-specific reference consumer, not the canonical global account or onboarding service.
11. Build account-linking in a way that can later support onboarding other users, but do not make the workflow publicly available yet.

## Current implementation claims to verify

Do not assume the proposal is accurate. Inspect the current code and cite exact files and lines for what you confirm.

At minimum, verify:

- The extension's current connector registry and Notion/Obsidian settings behavior in:
  - `transcriber-local/extension/popup.html`
  - `transcriber-local/extension/popup.js`
  - `transcriber-local/extension/background.js`
- The hosted Cartewei destination adapter and feature flag in:
  - `youtube-transcriber-cloud/lib/destinations/cartewei.ts`
  - `youtube-transcriber-cloud/lib/feature-flags.ts`
  - relevant `/api/destinations` routes and registry code
- The Cartewei receiver and ingest behavior in:
  - `Cartewei/Menu-scrape/src/web/server.ts`
  - `Cartewei/Menu-scrape/src/creator-video-ingest.ts`
- Authentication and user-identity boundaries on both hosted services.
- Whether the current extension can capture general web-page content, or whether that is a new capability requiring code and permission changes.
- Whether the current creator-video ingest path is suitable to evolve, or whether personal food-memory preview/commit requires a separate versioned API.
- Whether any proposed data shape already exists and should be reused instead of duplicated.
- The current Cartewei CLI and client boundaries in:
  - `Cartewei/cartewei-cli/packages/cli/src/commands`
  - `Cartewei/cartewei-cli/packages/core/src/client.ts`
  - `Cartewei/cartewei-cli/packages/core/src/endpoints.ts`
  - `Cartewei/cartewei-cli/packages/core/src/types.ts`
- Whether an owner-only `cw food add` command can safely reuse current authentication, or needs a distinct user-scoped token/account-linking mechanism.

Separate every finding into one of these categories:

- **Confirmed current behavior** — supported by code.
- **Proposal** — documented but not implemented.
- **Unknown** — cannot be established from current code/config.
- **Contradiction** — proposal conflicts with current architecture or behavior.

## Constraints

- Private owner dogfood comes before inviting other users.
- Extraction and discovery cost money and must be attributable.
- Public/open-source client code must not grant access to paid operations.
- No Cartewei service secret may enter the extension bundle, Chrome storage, request URLs, logs, or public environment variables.
- No automatic background harvesting or collection of browsing history.
- Preview and triage must not create canonical food intentions.
- Saving requires explicit review and confirmation.
- Repeated delivery must be idempotent.
- A repeated source should use a versioned cache or clearly disclose that rerunning costs more.
- Uncertain restaurant, dish, location, or timing data must stay unresolved rather than being invented.
- The same food memory must span USA and Europe; trip collections are views, not separate databases.
- A mentioned dish is not proof that it remains on the current menu.
- Existing Notion and Obsidian behavior must not regress.
- Direct LLM entry should not pay for source extraction when the user already supplied the restaurant or dish.
- Codex or Claude must never need a secret pasted into the prompt; authentication should be preconfigured outside the conversation.
- Prefer the smallest slice that can be dogfooded before August 2026.

## Architecture questions to answer

### 1. Product and ownership boundary

- Is Cartewei the correct canonical store for saved food intentions?
- Does Transcriber own the right amount of logic, or is extraction/resolution being placed in the wrong service?
- Is this genuinely a connector capability, or different enough that it should become a separate extension or capture surface?
- Does keeping the connector client open source create any material security, abuse, or support risk if server enforcement is correct?
- Is the existing Cartewei CLI the smallest safe direct-input surface for Codex and Claude, or is MCP necessary for the owner dogfood loop?
- Can the CLI and Transcriber extension converge on one final food-intent write contract without coupling their intake workflows?

### 2. Triage and extraction

- Should every harvest run an automatic triage stage?
- Can useful triage be deterministic or cached often enough to be materially cheaper than full extraction?
- When should the user be asked to choose scope instead of using a default?
- Is the proposed distinction between focused review, roundup, directory/listicle, and incidental mention sufficient?
- Should YouTube and web pages share one candidate contract while keeping source-specific provenance?
- What is the minimum extraction schema needed for owner dogfood?
- Which direct LLM requests can bypass extraction entirely, and what validation is still required before saving them?
- What evaluation fixtures are required to measure false positives, missed dishes, ambiguous places, and passing mentions?

### 3. Cost architecture

- Are job-level and stage-level cost records sufficient to explain spend?
- Which costs can be known exactly, which must be estimated, and when should the estimate be shown?
- Where should per-run, daily, and monthly limits be enforced?
- What cache key and invalidation/version strategy prevents surprise repeat charges without returning stale extraction forever?
- How should partial failures and paid retries behave?
- What metrics establish that the workflow is affordable enough for the first external tester?
- Identify the cheapest credible owner-only implementation and any cost-control work that can safely wait.

### 4. API and data contract

- Are separate connect, triage, preview, and commit operations justified?
- Should this remain under the generic `/api/destinations` surface or use a domain-specific food-memory API?
- What are the idempotency boundaries for triage, preview, commit, and Cartewei persistence?
- What is the smallest durable food-intent model that handles restaurants, dishes, source provenance, geography, rough timing, and collections without overfitting to the Europe trip?
- Which service owns preview expiry, unresolved leads, candidate edits, and final resolution state?
- What needs to exist in Cartewei before the extension work can be tested end to end?
- What is the minimum `food add` request/receipt contract shared by the CLI and Transcriber's reviewed commit?

### 5. Authentication, authorization, and privacy

- Verify the proposed extension -> Transcriber -> Cartewei trust boundary.
- Recommend the exact server-side allowlist mechanism for owner dogfood without putting a private identifier in public client code.
- Recommend owner CLI authentication that works from Codex/Claude without exposing a secret in prompts, shell history, logs, or process arguments.
- Can shared Supabase identity safely support account linking, and what consent or service-boundary records are still needed?
- What data should cross into Cartewei during triage, preview, and commit?
- What should be redacted from logs and cost telemetry?
- What revocation, deletion, and export behavior is necessary for owner dogfood versus later beta access?

### 6. Extension permissions and UX

- Can YouTube dogfood ship without new extension permissions?
- What is the narrowest safe way to capture a user-selected public page: active tab, selected text, one-shot script injection, or another mechanism?
- Does general page harvesting materially change Chrome Web Store disclosure or review risk?
- Should Cartewei appear as a connector row before the owner is eligible, or should availability be returned entirely by the backend?
- How can triage remain mostly automatic so a focused review does not add unnecessary clicks?

### 7. Delivery and reversibility

- Is the proposed delivery order correct: contract fixtures, YouTube owner dogfood, web pages, retrieval/trip use, then external onboarding?
- Should direct CLI entry ship before or alongside the YouTube vertical slice because it is cheaper and provides the first end-to-end write test?
- Identify dependencies that could block an end-to-end owner test.
- Which decisions are easy to reverse, and which create lasting schema, privacy, or distribution commitments?
- What evidence would justify a separate Cartewei extension later?
- What should explicitly remain out of scope before the August–September walkabout?

## Required output

Return one concise but evidence-backed review using this structure:

### 1. Verdict

Choose exactly one:

- **Approve for owner dogfood**
- **Approve with required changes**
- **Rework before implementation**

Explain the verdict in no more than five sentences.

### 2. Confirmed current architecture

Summarize the verified current flow and cite exact repository-relative or absolute file paths with line numbers.

### 3. Strengths

List what the proposal gets right and why it fits the current constraints.

### 4. Findings

Use this table:

| Priority | Finding | Evidence | Impact | Required change |
|---|---|---|---|---|

Use:

- `P0` — security, privacy, uncontrolled spend, or data-loss blocker;
- `P1` — must resolve before owner dogfood;
- `P2` — valuable improvement that can follow the first working slice.

Do not manufacture findings to fill every priority.

### 5. Recommended minimum architecture

Describe the smallest end-to-end owner-only design. Include a compact data/control-flow diagram and name which repository owns each component.

### 6. Cost and triage recommendation

Specify:

- the cheapest useful triage path;
- when a user must choose extraction scope;
- the minimum cost ledger;
- initial budget controls;
- cache/idempotency behavior;
- metrics needed before inviting another user.

Do not invent dollar thresholds without evidence. Mark them as configuration decisions and explain how dogfood should determine them.

### 7. Delivery slices and acceptance criteria

Recommend the smallest sequence of independently testable slices. Give concrete acceptance criteria for the first owner-only vertical slice.

### 8. Decisions and unknowns

Provide:

- decisions that can be made now;
- decisions that should be deferred;
- assumptions that require a spike or measurement;
- questions that genuinely require product-owner input.

### 9. Proposed document corrections

List exact changes needed in either proposal document. Do not edit the files during this review.

## Review standard

Be skeptical but pragmatic. Evaluate suitability for one-person dogfood, not hypothetical internet scale. Do not recommend a broad connector platform, event architecture, mobile app, or new extension unless current evidence makes it necessary.

Prefer reversible design and one working vertical slice. Flag where the plan is overbuilt, but also flag shortcuts that could expose secrets, allow public paid usage, lose source provenance, duplicate canonical state, or produce untraceable costs.

End with the three most important actions to take before implementation begins.

---
