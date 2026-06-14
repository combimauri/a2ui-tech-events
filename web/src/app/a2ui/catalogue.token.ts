import { InjectionToken, Type } from '@angular/core';

/**
 * The renderer's trusted component catalogue: a map from an abstract A2UI
 * component name (e.g. "Button") to the concrete Angular component that draws
 * it. Provided in app.config.ts. The agent can only ask for names that exist
 * here — it can never inject arbitrary markup or code.
 */
export const A2UI_CATALOGUE = new InjectionToken<Record<string, Type<unknown>>>(
  'A2UI_CATALOGUE',
);
