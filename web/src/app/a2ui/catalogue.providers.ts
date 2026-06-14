import { Provider, Type } from '@angular/core';
import { A2UI_CATALOGUE } from './catalogue.token';
import { CardComponent, ColumnComponent, RowComponent } from './catalogue/containers.component';
import {
  BadgeComponent,
  DividerComponent,
  HeadingComponent,
  ImageComponent,
  TextComponent,
} from './catalogue/display.component';
import {
  CheckboxComponent,
  DateFieldComponent,
  NumberFieldComponent,
  SelectComponent,
  TextAreaComponent,
  TextFieldComponent,
} from './catalogue/inputs.component';
import { ButtonComponent } from './catalogue/button.component';

/**
 * The component catalogue. The keys are the abstract A2UI component names the
 * agent may use; the values are the trusted Angular components that render
 * them. Adding a new component = implement it + add one line here + document
 * it in docs/component-catalogue.md (so the agent knows it exists).
 */
export const A2UI_CATALOGUE_MAP: Record<string, Type<unknown>> = {
  // Layout
  Column: ColumnComponent,
  Row: RowComponent,
  Card: CardComponent,
  // Display
  Text: TextComponent,
  Heading: HeadingComponent,
  Badge: BadgeComponent,
  Divider: DividerComponent,
  Image: ImageComponent,
  // Inputs
  TextField: TextFieldComponent,
  TextArea: TextAreaComponent,
  NumberField: NumberFieldComponent,
  DateField: DateFieldComponent,
  Select: SelectComponent,
  Checkbox: CheckboxComponent,
  // Actions
  Button: ButtonComponent,
};

export const catalogueProviders: Provider = {
  provide: A2UI_CATALOGUE,
  useValue: A2UI_CATALOGUE_MAP,
};
