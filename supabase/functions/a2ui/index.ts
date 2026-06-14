// =============================================================================
// a2ui Edge Function
//
// The server side of the generative-UI loop. It:
//   1. authenticates the caller (Supabase JWT),
//   2. on intent "generate", asks Gemini to emit an A2UI surface (a form or an
//      event view) using ONLY the renderer's component catalogue,
//   3. on intent "action", authorizes + writes to the database (events /
//      registrations) under row-level security, then returns a confirmation
//      surface built deterministically in code.
//
// The Gemini API key lives only here (Deno.env). If it is missing or Gemini
// returns something unusable, we fall back to a code-built surface so the UI
// never breaks.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CATALOG_ID = "https://techevents.local/catalogs/v1/catalog.json";
const A2UI_VERSION = "v0.9";

/**
 * Whether the calling user is an admin. Single source of truth is the database:
 * the `is_admin()` RPC reads the `user_roles` table under the caller's JWT, so a
 * forged client request cannot escalate.
 */
async function isAdmin(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.rpc("is_admin");
  return !error && data === true;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- A2UI message helpers ---------------------------------------------------

type Node = Record<string, unknown> & { id: string; component: string };
type Message = Record<string, unknown>;

function surface(
  surfaceId: string,
  components: Node[],
  dataModel?: Record<string, unknown>,
): Message[] {
  const messages: Message[] = [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: CATALOG_ID } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components } },
  ];
  if (dataModel) {
    messages.push({ version: A2UI_VERSION, updateDataModel: { surfaceId, value: dataModel } });
  }
  return messages;
}

interface BtnSpec {
  id: string;
  text: string;
  variant?: "primary" | "secondary" | "ghost";
  event?: { name: string; context?: Record<string, unknown> };
  functionCall?: { call: string; args?: Record<string, unknown> };
}

/** A simple "card with heading, message and a row of buttons" surface. */
function confirmation(
  surfaceId: string,
  heading: string,
  message: string,
  buttons: BtnSpec[],
): Message[] {
  const buttonNodes: Node[] = buttons.map((b) => ({
    id: b.id,
    component: "Button",
    text: b.text,
    variant: b.variant ?? "primary",
    action: b.event ? { event: b.event } : { functionCall: b.functionCall },
  }));
  const components: Node[] = [
    { id: "root", component: "Column", children: ["card"] },
    { id: "card", component: "Card", children: ["heading", "message", "actions"] },
    { id: "heading", component: "Heading", text: heading },
    { id: "message", component: "Text", text: message },
    { id: "actions", component: "Row", children: buttonNodes.map((b) => b.id) },
    ...buttonNodes,
  ];
  return surface(surfaceId, components);
}

// ---- Gemini -----------------------------------------------------------------

/** The component contract handed to Gemini so it only uses what we can render. */
const CATALOGUE_CONTRACT = `
You generate UI using the A2UI protocol. Output STRICT JSON:
{ "messages": [ <A2UI message envelopes> ] }

Message envelopes (one key each), all carrying "version": "${A2UI_VERSION}":
- { "version", "createSurface": { "surfaceId": "<ID>", "catalogId": "${CATALOG_ID}" } }
- { "version", "updateComponents": { "surfaceId": "<ID>", "components": [ <node>, ... ] } }
- { "version", "updateDataModel": { "surfaceId": "<ID>", "value": { ... } } }

A node is: { "id": string, "component": <name>, ...props }.
Containers reference children by id via "children": [ids] (or "child": id for Card).
There MUST be exactly one node with "id": "root".
A data binding is { "path": "/json/pointer" }. Input components MUST bind "value".

ALLOWED components and props (use ONLY these):
- Column   { children, gap? }
- Row      { children, gap? }
- Card     { child? | children }
- Heading  { text }
- Text     { text, variant?: "muted" }
- Badge    { text }
- Divider  { }
- Image    { src, alt }
- TextField   { label, value(binding), placeholder?, inputType?: "text"|"email"|"url" }
- TextArea    { label, value(binding), placeholder?, rows? }
- NumberField { label, value(binding), placeholder? }
- DateField   { label, value(binding), mode?: "datetime-local"|"date" }
- Select      { label, value(binding), options: [{value,label}] }
- Checkbox    { label, value(binding) }
- Button      { text, variant?: "primary"|"secondary"|"ghost",
                action: { "event": { "name": string, "context"?: {...} } }
                     OR { "functionCall": { "call": "navigate"|"openUrl", "args": { "url": string } } } }

Rules:
- Use the EXACT surfaceId given by the user in every message.
- Do not invent component names or props. No HTML, no code, no markdown.
- Keep it clean and minimal.
`.trim();

async function callGemini(
  system: string,
  user: string,
): Promise<{ messages?: unknown } | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    console.warn("[a2ui] GEMINI_API_KEY not set — using code fallback.");
    return null;
  }
  const model = Deno.env.get("A2UI_MODEL") ?? "gemini-2.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    });
    if (!res.ok) {
      console.error("[a2ui] Gemini error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    return JSON.parse(text);
  } catch (err) {
    console.error("[a2ui] Gemini call failed", err);
    return null;
  }
}

/** Validate Gemini output and force the surfaceId so it can't drift. */
function validate(parsed: { messages?: unknown } | null, surfaceId: string): Message[] | null {
  if (!parsed || !Array.isArray(parsed.messages)) return null;
  const messages = parsed.messages as Message[];
  let hasRoot = false;
  for (const m of messages) {
    const cs = m["createSurface"] as { surfaceId?: string } | undefined;
    const uc = m["updateComponents"] as { surfaceId?: string; components?: Node[] } | undefined;
    const ud = m["updateDataModel"] as { surfaceId?: string } | undefined;
    if (cs) cs.surfaceId = surfaceId;
    if (ud) ud.surfaceId = surfaceId;
    if (uc) {
      uc.surfaceId = surfaceId;
      if (uc.components?.some((c) => c.id === "root")) hasRoot = true;
    }
  }
  return hasRoot ? messages : null;
}

// ---- Code fallbacks ---------------------------------------------------------

function createFormFallback(surfaceId: string): Message[] {
  const components: Node[] = [
    { id: "root", component: "Column", children: ["card"] },
    {
      id: "card",
      component: "Card",
      children: ["title", "f_title", "f_desc", "f_loc", "f_start", "f_end", "f_cap", "submit"],
    },
    { id: "title", component: "Heading", text: "New event" },
    { id: "f_title", component: "TextField", label: "Title", value: { path: "/event/title" } },
    { id: "f_desc", component: "TextArea", label: "Description", value: { path: "/event/description" }, rows: 4 },
    { id: "f_loc", component: "TextField", label: "Location", value: { path: "/event/location" } },
    { id: "f_start", component: "DateField", label: "Starts", value: { path: "/event/starts_at" }, mode: "datetime-local" },
    { id: "f_end", component: "DateField", label: "Ends", value: { path: "/event/ends_at" }, mode: "datetime-local" },
    { id: "f_cap", component: "NumberField", label: "Capacity", value: { path: "/event/capacity" } },
    { id: "submit", component: "Button", text: "Create event", action: { event: { name: "submit_event" } } },
  ];
  return surface(surfaceId, components, { event: {} });
}

function detailFallback(
  surfaceId: string,
  ev: EventRow,
  registered: boolean,
  count: number,
): Message[] {
  const children = ["title", "when", "where", "cap", "desc", "action"];
  const components: Node[] = [
    { id: "root", component: "Column", children: ["card"] },
    { id: "card", component: "Card", children },
    { id: "title", component: "Heading", text: ev.title },
    { id: "when", component: "Text", text: ev.starts_at ? `When: ${ev.starts_at}` : "When: TBA" },
    { id: "where", component: "Text", text: ev.location ? `Where: ${ev.location}` : "Where: TBA", variant: "muted" },
    { id: "cap", component: "Text", text: ev.capacity ? `${count}/${ev.capacity} registered` : `${count} registered`, variant: "muted" },
    { id: "desc", component: "Text", text: ev.description ?? "" },
    registered
      ? { id: "action", component: "Button", text: "Cancel registration", variant: "secondary", action: { event: { name: "cancel_registration", context: { eventId: ev.id } } } }
      : { id: "action", component: "Button", text: "Register", action: { event: { name: "register_event", context: { eventId: ev.id } } } },
  ];
  return surface(surfaceId, components, { eventId: ev.id });
}

// ---- Database types ---------------------------------------------------------

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  status: string;
}

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return s === "" ? null : s;
}
function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---- Intent handlers --------------------------------------------------------

async function handleGenerate(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Message[]> {
  const surfaceId = String(body["surfaceId"] ?? "surface");
  const mode = String(body["mode"] ?? "");

  if (mode === "create_event_form") {
    if (!(await isAdmin(sb))) {
      return confirmation(surfaceId, "Not allowed", "Only the admin can create events.", [
        { id: "back", text: "Back to events", variant: "secondary", functionCall: { call: "navigate", args: { url: "/" } } },
      ]);
    }
    const prompt = String(body["prompt"] ?? "");
    const parsed = await callGemini(
      `${CATALOGUE_CONTRACT}

TASK: Build an event-creation FORM for an admin.
Bind every field under "/event": /event/title, /event/description, /event/location,
/event/starts_at, /event/ends_at, /event/capacity.
Use TextField for title & location, TextArea for description, DateField
(mode "datetime-local") for starts_at & ends_at, NumberField for capacity.
Pre-fill known values from the description in an updateDataModel with value
{ "event": { ... } } (use ISO "YYYY-MM-DDTHH:mm" for dates; current year if year
is omitted). Leave unknown fields as "".
Finish with a primary Button { text: "Create event", action:{ event:{ name:"submit_event" } } }.
SurfaceId to use: "${surfaceId}".`,
      `Event description from the admin: """${prompt}"""`,
    );
    return validate(parsed, surfaceId) ?? createFormFallback(surfaceId);
  }

  if (mode === "event_detail") {
    const eventId = String(body["eventId"] ?? "");
    const { data: ev } = await sb.from("events").select("*").eq("id", eventId).single();
    if (!ev) {
      return confirmation(surfaceId, "Event not found", "This event no longer exists.", [
        { id: "back", text: "Back to events", variant: "secondary", functionCall: { call: "navigate", args: { url: "/" } } },
      ]);
    }
    const event = ev as EventRow;
    const { count } = await sb
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { data: mine } = await sb
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();
    const registered = !!mine;
    const total = count ?? 0;

    const parsed = await callGemini(
      `${CATALOGUE_CONTRACT}

TASK: Present a single tech event nicely and let the user register.
Show the title (Heading), date/time, location, capacity ("${total}/<capacity> registered"
or "${total} registered" if no capacity), a status Badge, and the description.
Add ONE Button bound to the user's state:
- if registered=true: { text:"Cancel registration", variant:"secondary",
    action:{ event:{ name:"cancel_registration", context:{ eventId:"${event.id}" } } } }
- if registered=false: { text:"Register",
    action:{ event:{ name:"register_event", context:{ eventId:"${event.id}" } } } }
Also include updateDataModel value { "eventId": "${event.id}" }.
SurfaceId to use: "${surfaceId}".`,
      `Event JSON: ${JSON.stringify(event)}\nregistered: ${registered}\ntotalRegistered: ${total}`,
    );
    return validate(parsed, surfaceId) ?? detailFallback(surfaceId, event, registered, total);
  }

  return confirmation(surfaceId, "Unknown request", `Unsupported mode: ${mode}`, []);
}

async function handleAction(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  userId: string,
): Promise<{ messages: Message[]; result?: Record<string, unknown> }> {
  const surfaceId = String(body["surfaceId"] ?? "surface");
  const action = (body["action"] ?? {}) as { name?: string; context?: Record<string, unknown> };
  const dataModel = (body["dataModel"] ?? {}) as Record<string, unknown>;
  const name = action.name ?? "";

  if (name === "submit_event") {
    if (!(await isAdmin(sb))) {
      return { messages: confirmation(surfaceId, "Not allowed", "Only the admin can create events.", []) };
    }
    const ev = (dataModel["event"] ?? {}) as Record<string, unknown>;
    const title = str(ev["title"]);
    if (!title) {
      return { messages: confirmation(surfaceId, "Missing title", "Please give the event a title and try again.", [
        { id: "retry", text: "OK", variant: "secondary", functionCall: { call: "navigate", args: { url: "/create" } } },
      ]) };
    }
    const { data, error } = await sb
      .from("events")
      .insert({
        title,
        description: str(ev["description"]),
        location: str(ev["location"]),
        starts_at: str(ev["starts_at"]),
        ends_at: str(ev["ends_at"]),
        capacity: num(ev["capacity"]),
        created_by: userId,
        status: "published",
      })
      .select("id")
      .single();
    if (error || !data) {
      return { messages: confirmation(surfaceId, "Could not save", error?.message ?? "Insert failed.", []) };
    }
    const id = (data as { id: string }).id;
    return {
      result: { eventId: id },
      messages: confirmation(surfaceId, "Event created", `“${title}” is now live.`, [
        { id: "view", text: "View event", functionCall: { call: "navigate", args: { url: `/events/${id}` } } },
        { id: "home", text: "All events", variant: "secondary", functionCall: { call: "navigate", args: { url: "/" } } },
      ]),
    };
  }

  if (name === "register_event") {
    const eventId = str(action.context?.["eventId"]) ?? str(dataModel["eventId"]);
    if (!eventId) return { messages: confirmation(surfaceId, "Error", "Missing event id.", []) };
    const { error } = await sb.from("registrations").insert({ event_id: eventId, user_id: userId });
    // 23505 = unique violation = already registered; treat as success.
    if (error && error.code !== "23505") {
      return { messages: confirmation(surfaceId, "Could not register", error.message, []) };
    }
    return {
      messages: confirmation(surfaceId, "You're registered", "We've saved your spot for this event.", [
        { id: "cancel", text: "Cancel registration", variant: "secondary", event: { name: "cancel_registration", context: { eventId } } },
        { id: "home", text: "All events", variant: "ghost", functionCall: { call: "navigate", args: { url: "/" } } },
      ]),
    };
  }

  if (name === "cancel_registration") {
    const eventId = str(action.context?.["eventId"]) ?? str(dataModel["eventId"]);
    if (!eventId) return { messages: confirmation(surfaceId, "Error", "Missing event id.", []) };
    const { error } = await sb
      .from("registrations")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
    if (error) return { messages: confirmation(surfaceId, "Could not cancel", error.message, []) };
    return {
      messages: confirmation(surfaceId, "Registration cancelled", "You can register again any time.", [
        { id: "again", text: "Register", event: { name: "register_event", context: { eventId } } },
        { id: "home", text: "All events", variant: "ghost", functionCall: { call: "navigate", args: { url: "/" } } },
      ]),
    };
  }

  return { messages: confirmation(surfaceId, "Unknown action", `Unsupported action: ${name}`, []) };
}

// ---- HTTP entry -------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    // User-scoped client => row-level security applies to every query below.
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Record<string, unknown>;
    const intent = String(body["intent"] ?? "");

    if (intent === "generate") {
      const messages = await handleGenerate(sb, body);
      return json({ messages });
    }
    if (intent === "action") {
      const out = await handleAction(sb, body, user.id);
      return json(out);
    }
    return json({ error: `Unknown intent: ${intent}` }, 400);
  } catch (err) {
    console.error("[a2ui] fatal", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
