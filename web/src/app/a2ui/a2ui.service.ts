import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { environment } from '../../environments/environment';
import { getPointer, setPointer } from './json-pointer';
import {
  A2uiMessage,
  A2uiResponse,
  Binding,
  ComponentNode,
  EventAction,
  FunctionCall,
  SurfaceState,
} from './a2ui.models';

/**
 * The heart of the renderer. Holds all A2UI surfaces as signal state, applies
 * incoming protocol messages, resolves data bindings, and round-trips user
 * actions through the `a2ui` Edge Function (which talks to Gemini + the DB).
 */
@Injectable({ providedIn: 'root' })
export class A2uiService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly router = inject(Router);

  /** surfaceId -> surface. A single signal so any change re-renders cleanly. */
  readonly surfaces = signal<Record<string, SurfaceState>>({});

  // ---- Reads ---------------------------------------------------------------

  surface(surfaceId: string): SurfaceState | undefined {
    return this.surfaces()[surfaceId];
  }

  node(surfaceId: string, nodeId: string): ComponentNode | undefined {
    return this.surfaces()[surfaceId]?.components[nodeId];
  }

  private isBinding(value: unknown): value is Binding {
    return (
      !!value &&
      typeof value === 'object' &&
      typeof (value as Binding).path === 'string'
    );
  }

  /** Resolve a single (possibly bound) value against the surface data model. */
  resolve(surfaceId: string, value: unknown): unknown {
    if (this.isBinding(value)) {
      return getPointer(this.surface(surfaceId)?.dataModel ?? {}, value.path);
    }
    return value;
  }

  /** Recursively resolve bindings inside an action context object. */
  private resolveDeep(surfaceId: string, value: unknown): unknown {
    if (this.isBinding(value)) return this.resolve(surfaceId, value);
    if (Array.isArray(value)) {
      return value.map((v) => this.resolveDeep(surfaceId, v));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.resolveDeep(surfaceId, v);
      }
      return out;
    }
    return value;
  }

  /** The JSON Pointer behind a bound prop, or undefined if it's a literal. */
  bindingPath(surfaceId: string, nodeId: string, prop: string): string | undefined {
    const raw = this.node(surfaceId, nodeId)?.[prop];
    return this.isBinding(raw) ? raw.path : undefined;
  }

  // ---- Writes (protocol message application) -------------------------------

  applyAll(messages: A2uiMessage[] | undefined): void {
    for (const message of messages ?? []) this.apply(message);
  }

  apply(message: A2uiMessage): void {
    if (message.createSurface) {
      const { surfaceId, catalogId, theme } = message.createSurface;
      this.surfaces.update((s) => ({
        ...s,
        [surfaceId]: { id: surfaceId, catalogId, theme, components: {}, dataModel: {} },
      }));
      return;
    }

    if (message.updateComponents) {
      const { surfaceId, components } = message.updateComponents;
      this.surfaces.update((s) => {
        const surface = s[surfaceId] ?? this.emptySurface(surfaceId);
        const merged = { ...surface.components };
        for (const node of components) merged[node.id] = node;
        return { ...s, [surfaceId]: { ...surface, components: merged } };
      });
      return;
    }

    if (message.updateDataModel) {
      const { surfaceId, path, value } = message.updateDataModel;
      this.surfaces.update((s) => {
        const surface = s[surfaceId] ?? this.emptySurface(surfaceId);
        const dataModel =
          path === undefined
            ? ((value ?? {}) as Record<string, unknown>)
            : setPointer(surface.dataModel, path, value);
        return { ...s, [surfaceId]: { ...surface, dataModel } };
      });
      return;
    }

    if (message.deleteSurface) {
      this.clear(message.deleteSurface.surfaceId);
    }
  }

  private emptySurface(surfaceId: string): SurfaceState {
    return { id: surfaceId, components: {}, dataModel: {} };
  }

  /** Two-way binding write-back from an input component. */
  setValue(surfaceId: string, path: string, value: unknown): void {
    this.surfaces.update((s) => {
      const surface = s[surfaceId];
      if (!surface) return s;
      return {
        ...s,
        [surfaceId]: { ...surface, dataModel: setPointer(surface.dataModel, path, value) },
      };
    });
  }

  clear(surfaceId: string): void {
    this.surfaces.update((s) => {
      const { [surfaceId]: _removed, ...rest } = s;
      return rest;
    });
  }

  // ---- Round-trips to the Edge Function ------------------------------------

  /** Ask Gemini (via the Edge Function) to generate a surface. */
  async generate(params: Record<string, unknown>): Promise<A2uiResponse> {
    const res = await this.invoke({ intent: 'generate', ...params });
    this.applyAll(res.messages);
    return res;
  }

  /** Send a user action; apply whatever surface comes back. */
  async dispatch(
    surfaceId: string,
    action: EventAction,
    sourceComponentId: string,
  ): Promise<A2uiResponse> {
    const context = this.resolveDeep(surfaceId, action.context ?? {}) as Record<
      string,
      unknown
    >;
    const res = await this.invoke({
      intent: 'action',
      surfaceId,
      action: { name: action.name, sourceComponentId, context },
      // A2UI "sendDataModel": ship the full model so the server has form values.
      dataModel: this.surface(surfaceId)?.dataModel ?? {},
    });
    this.applyAll(res.messages);
    return res;
  }

  /** Client-side function calls declared by the agent (navigate / openUrl). */
  handleFunctionCall(surfaceId: string, fc: FunctionCall): void {
    const args = (this.resolveDeep(surfaceId, fc.args ?? {}) ?? {}) as Record<
      string,
      unknown
    >;
    switch (fc.call) {
      case 'navigate':
        if (typeof args['url'] === 'string') this.router.navigateByUrl(args['url']);
        break;
      case 'openUrl':
        if (typeof args['url'] === 'string') window.open(args['url'], '_blank');
        break;
      default:
        console.warn(`[a2ui] unknown functionCall: ${fc.call}`);
    }
  }

  private async invoke(body: Record<string, unknown>): Promise<A2uiResponse> {
    const { data, error } = await this.supabase.functions.invoke<A2uiResponse>(
      environment.a2uiFunction,
      { body },
    );
    if (error) throw error;
    return data ?? { messages: [] };
  }
}
