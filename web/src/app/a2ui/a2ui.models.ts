/**
 * TypeScript model of the A2UI v0.9 message format.
 * Spec: https://a2ui.org/specification/v0.9-a2ui/
 *
 * We implement the subset needed for this app. See docs/a2ui-protocol.md.
 */

/** A data binding: `{ "path": "/event/title" }` (RFC 6901 JSON Pointer). */
export interface Binding {
  path: string;
}

/** A value that may either be a literal or a binding to the data model. */
export type Bindable<T> = T | Binding;

/** Fired when an interactive component (e.g. a Button) is activated. */
export interface EventAction {
  name: string;
  context?: Record<string, unknown>;
}

/** A client-side function invocation, e.g. navigate / openUrl. */
export interface FunctionCall {
  call: string;
  args?: Record<string, unknown>;
}

export interface ComponentAction {
  event?: EventAction;
  functionCall?: FunctionCall;
}

/**
 * A single node in the flat component list. Children are referenced by id
 * (adjacency list) rather than nested, which is friendly to incremental
 * LLM output. Arbitrary presentational props (text, label, src, ...) live
 * alongside the reserved keys.
 */
export interface ComponentNode {
  id: string;
  component: string;
  child?: string;
  children?: string[];
  action?: ComponentAction;
  [prop: string]: unknown;
}

export interface SurfaceState {
  id: string;
  catalogId?: string;
  theme?: Record<string, unknown>;
  /** Flat map of id -> node. */
  components: Record<string, ComponentNode>;
  /** The data model backing all bindings on this surface. */
  dataModel: Record<string, unknown>;
}

// ---- Server -> client message envelopes ------------------------------------

export interface CreateSurfaceMsg {
  surfaceId: string;
  catalogId?: string;
  theme?: Record<string, unknown>;
}

export interface UpdateComponentsMsg {
  surfaceId: string;
  components: ComponentNode[];
}

export interface UpdateDataModelMsg {
  surfaceId: string;
  /** JSON Pointer; if omitted the whole data model is replaced by `value`. */
  path?: string;
  /** If omitted, the key at `path` is removed. */
  value?: unknown;
}

export interface DeleteSurfaceMsg {
  surfaceId: string;
}

export interface A2uiMessage {
  version?: string;
  createSurface?: CreateSurfaceMsg;
  updateComponents?: UpdateComponentsMsg;
  updateDataModel?: UpdateDataModelMsg;
  deleteSurface?: DeleteSurfaceMsg;
}

/** Shape returned by the `a2ui` Edge Function. */
export interface A2uiResponse {
  messages: A2uiMessage[];
  result?: Record<string, unknown>;
}
