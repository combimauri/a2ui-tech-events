# A2UI protocol — and the subset we implement

A2UI ("Agent-to-UI") is an open protocol where an agent streams **JSON that
describes UI intent**, and a client **renderer** maps that to native components.
Spec: <https://a2ui.org/specification/v0.9-a2ui/>. This app implements the parts
needed for forms and event views; this page documents exactly what's supported.

## Core ideas

1. **Structure vs. implementation are separate.** The agent says *what* (a
   "Button" bound to data); the client decides *how* it looks. The client owns a
   **catalogue** of trusted components — the agent can't introduce new ones.
2. **Flat component list + adjacency.** Components are a flat array of nodes,
   each with an `id`; parents reference children by id (`children` / `child`)
   rather than nesting. This is friendly to incremental/streamed generation.
3. **Data/UI separation via a data model.** Components bind to a per-surface JSON
   data model using **JSON Pointer** bindings `{ "path": "/event/title" }`.

## Message envelopes (server → client)

Every message carries `"version": "v0.9"` and exactly one operation key. The
renderer applies them in order (`A2uiService.apply`):

| Message            | Effect in this app                                            |
| ------------------ | ------------------------------------------------------------- |
| `createSurface`    | Starts a surface (`surfaceId`, `catalogId`).                  |
| `updateComponents` | Adds/replaces nodes in the surface's flat component map.      |
| `updateDataModel`  | Sets the data model at `path` (or whole model if `path` omitted; removing the key if `value` omitted). |
| `deleteSurface`    | Drops the surface.                                            |

```jsonc
{ "version": "v0.9", "createSurface": { "surfaceId": "create-event",
    "catalogId": "https://techevents.local/catalogs/v1/catalog.json" } }

{ "version": "v0.9", "updateComponents": { "surfaceId": "create-event",
    "components": [
      { "id": "root", "component": "Column", "children": ["card"] },
      { "id": "card", "component": "Card", "children": ["title", "f_title", "submit"] },
      { "id": "title", "component": "Heading", "text": "New event" },
      { "id": "f_title", "component": "TextField", "label": "Title",
        "value": { "path": "/event/title" } },
      { "id": "submit", "component": "Button", "text": "Create event",
        "action": { "event": { "name": "submit_event" } } }
    ] } }

{ "version": "v0.9", "updateDataModel": { "surfaceId": "create-event",
    "value": { "event": { "title": "Angular & AI workshop" } } } }
```

## Data binding

- A binding is an object `{ "path": "/json/pointer" }` (RFC 6901). Implemented in
  [`web/src/app/a2ui/json-pointer.ts`](../web/src/app/a2ui/json-pointer.ts).
- **Read**: a component prop set to a binding shows the value at that path.
- **Write (two-way)**: input components (`TextField`, `Checkbox`, …) write the
  user's edits straight back to the bound path in the data model. `setPointer`
  returns a new object so Angular signals re-render.

## Actions (client → server)

Interactive components declare an `action`:

```jsonc
// round-trip to the agent / backend
"action": { "event": { "name": "submit_event", "context": { "eventId": { "path": "/eventId" } } } }

// client-side only
"action": { "functionCall": { "call": "navigate", "args": { "url": "/events/123" } } }
```

When fired (`A2uiService.dispatch`), the client resolves any bindings in
`context`, then POSTs `{ intent: "action", surfaceId, action, dataModel }` to the
Edge Function — sending the **whole data model** (A2UI's `sendDataModel`
behavior) so the server has the form values. The function returns more A2UI
messages, which replace/extend the surface (e.g. a confirmation card).

Supported `functionCall`s in this renderer: `navigate` (in-app route) and
`openUrl` (new tab).

## What we deliberately left out

To keep the renderer small, this implementation does **not** include: list/array
iteration with relative bindings, streaming transports (we use a single request/
response over `functions.invoke` rather than SSE/WebSocket), server-driven
function-call helpers like `formatDate`, or theming beyond `createSurface.theme`
pass-through. These are part of the broader spec and could be added to the
catalogue and `A2uiService` without changing the overall shape.
