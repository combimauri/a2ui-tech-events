# Component catalogue

The catalogue is the renderer's set of **trusted, pre-approved components**. The
agent may only reference these names; anything else renders as a harmless
"Unknown component" note.

- **Registry**: [`web/src/app/a2ui/catalogue.providers.ts`](../web/src/app/a2ui/catalogue.providers.ts)
  maps each A2UI name → an Angular component, provided via the `A2UI_CATALOGUE`
  injection token.
- **Dispatch**: [`a2ui-node.component.ts`](../web/src/app/a2ui/a2ui-node.component.ts)
  looks up the component for a node and renders it with `NgComponentOutlet`,
  passing `surfaceId` + `nodeId`. Containers recurse via `<app-a2ui-node>`.
- **Base**: every component extends
  [`a2ui-base.directive.ts`](../web/src/app/a2ui/a2ui-base.directive.ts), which
  provides `prop(key, fallback)` (resolves literals + bindings) and `path(key)`
  (the JSON Pointer behind a bound prop, for write-back).

Every node has `id` (string) and `component` (one of the names below).

## Layout

| Component | Props                | Notes                                  |
| --------- | -------------------- | -------------------------------------- |
| `Column`  | `children: id[]`, `gap?` | Vertical stack.                    |
| `Row`     | `children: id[]`, `gap?` | Horizontal, wraps on small screens.|
| `Card`    | `child: id` **or** `children: id[]` | Bordered surface.       |

## Display

| Component | Props                         | Notes                         |
| --------- | ----------------------------- | ----------------------------- |
| `Heading` | `text`                        | Section title.                |
| `Text`    | `text`, `variant?: "muted"`   | Body text.                    |
| `Badge`   | `text`                        | Small pill (tag/status).      |
| `Divider` | —                             | Horizontal rule.              |
| `Image`   | `src`, `alt`                  | Remote image.                 |

## Inputs (two-way bound — `value` must be a binding)

| Component     | Props                                               | Writes        |
| ------------- | --------------------------------------------------- | ------------- |
| `TextField`   | `label`, `value`, `placeholder?`, `inputType?` (`text`/`email`/`url`) | string |
| `TextArea`    | `label`, `value`, `placeholder?`, `rows?`           | string        |
| `NumberField` | `label`, `value`, `placeholder?`                    | number / null |
| `DateField`   | `label`, `value`, `mode?` (`datetime-local`/`date`) | string        |
| `Select`      | `label`, `value`, `options: [{value,label}]`        | string        |
| `Checkbox`    | `label`, `value`                                    | boolean       |

## Actions

| Component | Props                                                                 |
| --------- | -------------------------------------------------------------------- |
| `Button`  | `text`, `variant?` (`primary`/`secondary`/`ghost`), `disabled?`, `action` |

`action` is one of:

```jsonc
{ "event": { "name": "submit_event", "context": { /* optional, may use bindings */ } } }
{ "functionCall": { "call": "navigate", "args": { "url": "/events/123" } } }
```

`event` actions round-trip through the Edge Function; `functionCall` runs in the
client (`navigate`, `openUrl`).

## Example: a minimal form surface

```jsonc
{ "version": "v0.9", "updateComponents": { "surfaceId": "create-event", "components": [
  { "id": "root",  "component": "Column", "children": ["card"] },
  { "id": "card",  "component": "Card",   "children": ["h", "name", "save"] },
  { "id": "h",     "component": "Heading","text": "New event" },
  { "id": "name",  "component": "TextField", "label": "Title", "value": { "path": "/event/title" } },
  { "id": "save",  "component": "Button", "text": "Create event",
                   "action": { "event": { "name": "submit_event" } } }
] } }
```

## Adding a component

1. Create the standalone component (extend `A2uiBase`) under `web/src/app/a2ui/catalogue/`.
2. Register it in `catalogue.providers.ts` (`Name: YourComponent`).
3. Document it here **and** in the Edge Function's `CATALOGUE_CONTRACT`
   (`supabase/functions/a2ui/index.ts`) so the agent knows it exists.
