import { Component, inject, signal, computed } from '@angular/core';
import {
  ModalComponent,
  ModalTitleDirective,
  ModalBodyDirective,
  ModalFooterDirective,
  ModalCloseDirective,
  MODAL_DATA,
  MODAL_REF,
} from '@polarity/components/modal';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { InputNumberComponent } from '@polarity/components/input-number';
import { SelectComponent } from '@polarity/components/select';
import { ToggleComponent } from '@polarity/components/toggle';
import { TextAreaComponent } from '@polarity/components/textarea';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import type { SelectItem } from '@polarity/components/select';
import type { FormFieldDef, FormFieldType } from '../../core/models/node.models';

export interface RunField extends FormFieldDef {
  key: string;
}

@Component({
  selector: 'app-run-modal',
  standalone: true,
  imports: [
    ModalComponent,
    ModalTitleDirective,
    ModalBodyDirective,
    ModalFooterDirective,
    ModalCloseDirective,
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    InputNumberComponent,
    SelectComponent,
    ToggleComponent,
    TextAreaComponent,
    ButtonComponent,
    IconComponent,
  ],
  template: `
    <pol-modal [title]="'Run Workflow'">
      <ng-container polModalTitle>
        <pol-icon [iconName]="'play-circle'" [size]="'small'" [decorative]="true" />
        Run Workflow
      </ng-container>

      <div polModalBody class="run-form">
        @if (fields.length === 0) {
          <div class="run-form__empty">No input fields configured.</div>
        }

        @for (field of fields; track field.id) {
          <pol-form-field>
            <label pol-label>
              {{ field.label || field.key }}
              @if (field.required) {
                <span class="run-form__required">*</span>
              }
            </label>

            @switch (field.type) {
              @case ('text') {
                <pol-input-text
                  [fixedWidth]="true"
                  [value]="getStringValue(field.key)"
                  (valueChange)="setValue(field.key, $event)"
                  [placeholder]="field.placeholder ?? ''"
                />
              }
              @case ('number') {
                <pol-input-number
                  [fixedWidth]="true"
                  [value]="getNumberValue(field.key)"
                  (valueChange)="setValue(field.key, $event)"
                  [placeholder]="field.placeholder ?? ''"
                  [decimal]="true"
                />
              }
              @case ('boolean') {
                <pol-toggle
                  [checked]="getBooleanValue(field.key)"
                  (checkedChange)="setValue(field.key, $event)"
                  [size]="'small'"
                />
              }
              @case ('dropdown') {
                <pol-select
                  [options]="getDropdownOptions(field)"
                  [value]="getStringValue(field.key)"
                  (selectionChange)="setValue(field.key, $event)"
                />
              }
              @case ('textarea') {
                <textarea
                  pol-textarea
                  [value]="getStringValue(field.key)"
                  (input)="onTextareaInput(field.key, $event)"
                  [placeholder]="field.placeholder ?? ''"
                ></textarea>
              }
            }

            @if (field.description) {
              <div class="run-form__description">{{ field.description }}</div>
            }
          </pol-form-field>
        }

        @if (validationError()) {
          <div class="run-form__error">{{ validationError() }}</div>
        }
      </div>

      <div polModalFooter class="run-form__footer">
        <button pol-button [variant]="'tertiary'" [size]="'small'" polModalClose (click)="onCancel()">
          Cancel
        </button>
        <button pol-button [variant]="'primary'" [size]="'small'" (click)="onRun()">
          <pol-icon [iconName]="'play'" [size]="'xsmall'" [decorative]="true" />
          Run
        </button>
      </div>
    </pol-modal>
  `,
  styles: [`
    .run-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
      min-width: 360px;
    }

    .run-form__empty {
      font-size: 13px;
      color: var(--base-text-subtle);
      font-style: italic;
    }

    .run-form__required {
      color: var(--negative-text-default);
      font-weight: 600;
    }

    .run-form__description {
      font-size: 11px;
      color: var(--base-text-subtle);
      margin-top: 2px;
    }

    .run-form__error {
      font-size: 12px;
      color: var(--negative-text-default);
      padding: 8px 12px;
      background: var(--negative-bg-weak-default);
      border-radius: 6px;
    }

    .run-form__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `],
})
export class RunModalComponent {
  readonly fields: RunField[] = inject(MODAL_DATA) as RunField[];
  private readonly modalRef = inject(MODAL_REF);

  /** Live form values keyed by field key. */
  private readonly values = signal<Record<string, unknown>>({});
  protected readonly validationError = signal<string | null>(null);

  constructor() {
    // Initialize defaults
    const initial: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (field.default !== undefined && field.default !== null) {
        initial[field.key] = field.default;
      } else if (field.type === 'boolean') {
        initial[field.key] = false;
      } else if (field.type === 'number') {
        initial[field.key] = 0;
      } else {
        initial[field.key] = '';
      }
    }
    this.values.set(initial);
  }

  // ── Value accessors ─────────────────────────────────────────────────────────

  protected getStringValue(key: string): string {
    const v = this.values()[key];
    return v == null ? '' : String(v);
  }

  protected getNumberValue(key: string): number {
    const v = this.values()[key];
    return typeof v === 'number' ? v : 0;
  }

  protected getBooleanValue(key: string): boolean {
    return !!this.values()[key];
  }

  protected getDropdownOptions(field: RunField): SelectItem[] {
    return (field.options ?? []).map((opt) => ({ value: opt, label: opt }));
  }

  protected setValue(key: string, value: unknown): void {
    this.values.update((v) => ({ ...v, [key]: value }));
    this.validationError.set(null);
  }

  protected onTextareaInput(key: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.setValue(key, target.value);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  protected onCancel(): void {
    this.modalRef.close(undefined);
  }

  protected onRun(): void {
    // Validate required fields
    const missing: string[] = [];
    for (const field of this.fields) {
      if (!field.required) continue;
      const val = this.values()[field.key];
      if (val === undefined || val === null || val === '') {
        missing.push(field.label || field.key);
      }
    }

    if (missing.length > 0) {
      this.validationError.set(`Required fields: ${missing.join(', ')}`);
      return;
    }

    this.modalRef.close(this.values());
  }
}
