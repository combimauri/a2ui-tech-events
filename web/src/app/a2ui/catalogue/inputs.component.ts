import { ChangeDetectionStrategy, Component, computed, Directive } from '@angular/core';
import { A2uiBase } from '../a2ui-base.directive';

interface Option {
  value: string;
  label: string;
}

/**
 * Base for input components. Establishes two-way binding: the displayed value
 * comes from `prop('value')` (resolved against the data model) and edits are
 * written straight back to the bound JSON Pointer via `write()`.
 */
@Directive()
abstract class A2uiInput extends A2uiBase {
  protected readonly value = computed(() => this.prop<unknown>('value', ''));
  protected write(value: unknown): void {
    const path = this.path('value');
    if (path) this.a2ui.setValue(this.surfaceId(), path, value);
  }
}

/** Single-line text input. `inputType` (text/email/url) is supported. */
@Component({
  selector: 'a2ui-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-field">
      @if (prop('label', '')) { <span class="a2ui-label">{{ prop('label', '') }}</span> }
      <input
        class="a2ui-input"
        [type]="prop('inputType', 'text')"
        [value]="value() ?? ''"
        [placeholder]="prop('placeholder', '')"
        (input)="write($any($event.target).value)"
      />
    </label>
  `,
})
export class TextFieldComponent extends A2uiInput {}

/** Multi-line text input. */
@Component({
  selector: 'a2ui-text-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-field">
      @if (prop('label', '')) { <span class="a2ui-label">{{ prop('label', '') }}</span> }
      <textarea
        class="a2ui-input a2ui-textarea"
        [rows]="prop('rows', 4)"
        [value]="value() ?? ''"
        [placeholder]="prop('placeholder', '')"
        (input)="write($any($event.target).value)"
      ></textarea>
    </label>
  `,
})
export class TextAreaComponent extends A2uiInput {}

/** Numeric input. Writes a number (or null when cleared). */
@Component({
  selector: 'a2ui-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-field">
      @if (prop('label', '')) { <span class="a2ui-label">{{ prop('label', '') }}</span> }
      <input
        class="a2ui-input"
        type="number"
        [value]="value() ?? ''"
        [placeholder]="prop('placeholder', '')"
        (input)="onInput($any($event.target).value)"
      />
    </label>
  `,
})
export class NumberFieldComponent extends A2uiInput {
  protected onInput(raw: string): void {
    this.write(raw === '' ? null : Number(raw));
  }
}

/** Date / datetime input. `mode` = "datetime-local" (default) or "date". */
@Component({
  selector: 'a2ui-date-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-field">
      @if (prop('label', '')) { <span class="a2ui-label">{{ prop('label', '') }}</span> }
      <input
        class="a2ui-input"
        [type]="prop('mode', 'datetime-local')"
        [value]="value() ?? ''"
        (input)="write($any($event.target).value)"
      />
    </label>
  `,
})
export class DateFieldComponent extends A2uiInput {}

/** Dropdown. `options` is an array of strings or `{ value, label }`. */
@Component({
  selector: 'a2ui-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-field">
      @if (prop('label', '')) { <span class="a2ui-label">{{ prop('label', '') }}</span> }
      <select class="a2ui-input" [value]="value() ?? ''" (change)="write($any($event.target).value)">
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </label>
  `,
})
export class SelectComponent extends A2uiInput {
  protected readonly options = computed<Option[]>(() => {
    const raw = this.prop<unknown[]>('options', []);
    return (raw ?? []).map((o) =>
      typeof o === 'object' && o !== null
        ? { value: String((o as Option).value), label: String((o as Option).label ?? (o as Option).value) }
        : { value: String(o), label: String(o) },
    );
  });
}

/** Checkbox. Binds a boolean. */
@Component({
  selector: 'a2ui-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-checkbox">
      <input type="checkbox" [checked]="!!value()" (change)="write($any($event.target).checked)" />
      <span>{{ prop('label', '') }}</span>
    </label>
  `,
})
export class CheckboxComponent extends A2uiInput {}
