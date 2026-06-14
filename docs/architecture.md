# Architecture

## The generative-UI loop

The defining idea: **the UI is data, generated on demand**. The Angular app
contains no event-form template. Instead it asks an agent for one, and the agent
replies with a JSON description that the app renders using a fixed catalogue of
trusted components.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser — Angular SPA                                                      │
│                                                                           │
│  pages/  create-event ─┐         ┌─ event-detail                          │
│                        ▼         ▼                                         │
│  a2ui/  A2uiService ──── invoke('a2ui', {intent, ...}) ───────────────┐   │
│         │  surfaces: signal<Record<surfaceId, SurfaceState>>          │   │
│         │  apply(createSurface|updateComponents|updateDataModel|...)   │   │
│         ▼                                                              │   │
│  A2uiRenderer → A2uiNode (recursive) → catalogue component (per node)  │   │
│         ▲                                   │ user types / clicks      │   │
│         └──── two-way binding / actions ────┘                          │   │
└───────────────────────────────────────────────────────────────────────┼───┘
                                                                          │
                       supabase-js (session JWT attached automatically)   │
                                                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Supabase Edge Function "a2ui" (Deno)                                      │
│   auth: getUser() from JWT; user-scoped client → RLS applies              │
│                                                                           │
│   intent "generate":                                                      │
│     build system prompt (catalogue contract) + context                    │
│       → Gemini generateContent (responseMimeType: application/json)        │
│       → validate → A2UI messages   (fallback: code-built surface)         │
│                                                                           │
│   intent "action":                                                        │
│     submit_event       → (admin) insert events                            │
│     register_event     → insert registrations                             │
│     cancel_registration→ delete registration                              │
│       → return a code-built confirmation surface                          │
└───────────────────────────────────────────────────────────────────────┬───┘
                                                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Supabase Postgres + Auth                                                   │
│   events, registrations  (RLS: admin writes events; users own regs)       │
│   auth.users             (magic-link / OTP email)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Why Gemini runs in an Edge Function

The Gemini API key must stay secret, so it can't live in the browser. The Edge
Function is the trust boundary: it holds the key, calls Gemini, **and** performs
all privileged database writes. The same function therefore both *renders intent*
(generate) and *commits effects* (action), which keeps the client a pure renderer.

## Request / response shapes

Client → function (`supabase.functions.invoke('a2ui', { body })`):

```jsonc
// generate a form
{ "intent": "generate", "mode": "create_event_form", "surfaceId": "create-event",
  "prompt": "Free Angular workshop in Berlin on Oct 14" }

// generate an event view
{ "intent": "generate", "mode": "event_detail", "surfaceId": "event-<uuid>",
  "eventId": "<uuid>" }

// a user action (full data model is sent along, A2UI "sendDataModel" style)
{ "intent": "action", "surfaceId": "create-event",
  "action": { "name": "submit_event", "sourceComponentId": "submit", "context": {} },
  "dataModel": { "event": { "title": "...", "starts_at": "..." } } }
```

Function → client:

```jsonc
{ "messages": [ /* A2UI envelopes the renderer applies in order */ ],
  "result":   { "eventId": "<uuid>" }   // optional, e.g. after submit_event
}
```

## Security model

- **Auth**: Supabase magic link (passwordless OTP email). The session JWT is
  attached to every Supabase call and to the Edge Function (`verify_jwt: true`).
- **Authorization**: Postgres **row-level security** is the source of truth.
  - `events`: anyone authenticated can read; only `is_admin()` can write.
  - `registrations`: a user reads/writes only rows where `user_id = auth.uid()`
    (admin can read all).
  - `is_admin()` compares `auth.jwt() ->> 'email'` to the admin address — so the
    admin needs no special provisioning beyond signing in with that email.
- The Edge Function uses a **user-scoped** Supabase client (forwards the caller's
  JWT), so even server-side writes are constrained by RLS. The admin email is
  also checked explicitly for clearer error messages — defense in depth.
- The agent can only emit **catalogue component names**; unknown names render as
  a harmless "Unknown component" note. No HTML or code is ever executed.

## Resilience

If `GEMINI_API_KEY` is unset, Gemini errors, or its output fails validation
(must be `{ messages: [...] }` with a `root` node), the function returns a
**deterministic, code-built** surface for the same intent. The UI degrades to a
plain (non-AI) form/view but never breaks.
