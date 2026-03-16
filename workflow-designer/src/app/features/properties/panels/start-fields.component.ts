import { Component, input, inject, computed, signal } from '@angular/core';
import { DragDropModule, type CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { SelectComponent } from '@polarity/components/select';
import { ToggleComponent } from '@polarity/components/toggle';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import type { SelectItem } from '@polarity/components/select';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, StartConfig, FormFieldDef, FormFieldType } from '../../../core/models/node.models';

const FIELD_TYPE_OPTIONS: SelectItem[] = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'boolean',  label: 'Boolean' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'textarea', label: 'Textarea' },
];

const FIELD_TYPE_ICONS: Record<FormFieldType, string> = {
  text: 'text-t',
  number: 'hash',
  boolean: 'toggle-left',
  dropdown: 'caret-circle-down',
  textarea: 'text-align-left',
};

@Component({
  selector: 'app-start-fields',
  standalone: true,
  imports: [
    DragDropModule,
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    SelectComponent,
    ToggleComponent,
    ButtonComponent,
    IconComponent,
  ],
  template: `
    <div class="start-fields">

      <div class="start-fields__hint">
        Define form fields shown when this workflow runs.
        Reference values in node configs with
        <code>{{'{{workflow.input.key}}'}}</code>
      </div>

      @if (fields().length === 0) {
        <div class="start-fields__empty">
          No input fields defined yet.
        </div>
      }

      <div
        cdkDropList
        [cdkDropListData]="fields()"
        (cdkDropListDropped)="onDrop($event)"
        class="start-fields__list"
      >
        @for (field of fields(); track field.id; let i = $index) {
          <div
            cdkDrag
            class="field-card"
            [class.field-card--selected]="selectedFieldId() === field.id"
          >
            <!-- Drag handle + summary row -->
            <div class="field-card__header" (click)="onSelectField(field.id)">
              <div class="field-card__handle" cdkDragHandle>
                <pol-icon [iconName]="'dots-six-vertical'" size="xsmall" [decorative]="true" />
              </div>
              <pol-icon [iconName]="$any(fieldTypeIcon(field.type))" size="xsmall" [decorative]="true" />
              <span class="field-card__label">{{ field.label || 'Untitled' }}</span>
              <span class="field-card__key">{{ field.key || '—' }}</span>
              @if (field.required) {
                <span class="field-card__required">*</span>
              }
              <button
                class="field-card__delete"
                (click)="onDeleteField(field.id, $event)"
                aria-label="Delete field"
              >
                <pol-icon [iconName]="'x'" size="xsmall" [decorative]="true" />
              </button>
            </div>

            <!-- Expanded editor -->
            @if (selectedFieldId() === field.id) {
              <div class="field-card__editor">
                <pol-form-field>
                  <label pol-label>Label</label>
                  <pol-input-text
                    [fixedWidth]="true"
                    [value]="field.label"
                    (valueChange)="onFieldChange(field.id, 'label', $event)"
                    [placeholder]="'e.g. Customer Name'"
                  />
                </pol-form-field>

                <pol-form-field>
                  <label pol-label>Key</label>
                  <pol-input-text
                    [fixedWidth]="true"
                    [value]="field.key"
                    (valueChange)="onKeyChange(field.id, $event)"
                    [placeholder]="'e.g. customer_name'"
                  />
                </pol-form-field>

                <pol-form-field>
                  <label pol-label>Type</label>
                  <pol-select
                    [options]="fieldTypeOptions"
                    [value]="field.type"
                    (selectionChange)="onFieldChange(field.id, 'type', $event)"
                  />
                </pol-form-field>

                <pol-form-field>
                  <label pol-label>Placeholder</label>
                  <pol-input-text
                    [fixedWidth]="true"
                    [value]="field.placeholder ?? ''"
                    (valueChange)="onFieldChange(field.id, 'placeholder', $event)"
                    [placeholder]="'Hint text...'"
                  />
                </pol-form-field>

                <div class="field-card__toggle-row">
                  <label class="field-card__toggle-label">Required</label>
                  <pol-toggle
                    [checked]="field.required ?? false"
                    (checkedChange)="onFieldChange(field.id, 'required', $event)"
                    [size]="'small'"
                  />
                </div>

                <pol-form-field>
                  <label pol-label>Default value</label>
                  <pol-input-text
                    [fixedWidth]="true"
                    [value]="formatDefault(field.default)"
                    (valueChange)="onFieldChange(field.id, 'default', $event)"
                  />
                </pol-form-field>

                @if (field.type === 'dropdown') {
                  <pol-form-field>
                    <label pol-label>Options (comma-separated)</label>
                    <pol-input-text
                      [fixedWidth]="true"
                      [value]="(field.options ?? []).join(', ')"
                      (valueChange)="onOptionsChange(field.id, $event)"
                      [placeholder]="'low, medium, high'"
                    />
                  </pol-form-field>
                }

                <div class="field-card__ref">
                  Reference: <code>{{'{{workflow.input.' + field.key + '}}'}}</code>
                </div>
              </div>
            }

            <!-- CDK drag placeholder -->
            <div class="field-card__placeholder" *cdkDragPlaceholder></div>
          </div>
        }
      </div>

      <button
        pol-button
        [variant]="'secondary'"
        [size]="'small'"
        (click)="onAddField()"
        class="start-fields__add-btn"
      >
        <pol-icon [iconName]="'plus'" size="small" [decorative]="true" />
        Add Field
      </button>

    </div>
  `,
  styles: [`
    .start-fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .start-fields__hint {
      font-size: 11px;
      color: var(--base-text-subtle);
      line-height: 1.5;
      padding: 0 0 4px;

      code {
        font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 3px;
        background: var(--base-bg-weak-default);
        color: var(--base-text-default);
      }
    }

    .start-fields__empty {
      font-size: 12px;
      color: var(--base-text-weak-default);
      font-style: italic;
      padding: 12px 0;
    }

    .start-fields__list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 24px;
    }

    .start-fields__add-btn {
      align-self: flex-start;
      margin-top: 4px;
    }

    /* ── Field card ─────────────────────────────── */

    .field-card {
      border: 1px solid var(--base-border-default);
      border-radius: 6px;
      background: var(--base-bg-default);
      transition: border-color 150ms ease;

      &--selected {
        border-color: var(--control-border-active);
      }
    }

    .field-card__header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 8px 8px 4px;
      cursor: pointer;
      min-height: 36px;
    }

    .field-card__handle {
      cursor: grab;
      display: flex;
      align-items: center;
      padding: 0 2px;
      color: var(--base-text-weak-default);
    }

    .field-card__label {
      font-size: 12px;
      font-weight: 500;
      color: var(--base-text-default);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .field-card__key {
      font-size: 10px;
      font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
      color: var(--base-text-subtle);
      flex-shrink: 0;
    }

    .field-card__required {
      color: var(--negative-text-default);
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }

    .field-card__delete {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;
      color: var(--base-text-weak-default);
      flex-shrink: 0;

      &:hover {
        color: var(--negative-text-default);
        background: var(--base-bg-hover);
      }
    }

    /* ── Expanded editor ───────────────────────── */

    .field-card__editor {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 10px 12px;
      border-top: 1px solid var(--base-border-default);
    }

    .field-card__toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 0;
    }

    .field-card__toggle-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--base-text-default);
    }

    .field-card__ref {
      font-size: 10px;
      color: var(--base-text-subtle);
      padding: 4px 0 0;

      code {
        font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 3px;
        background: var(--base-bg-weak-default);
        color: var(--positive-text-default);
      }
    }

    /* ── CDK Drag styles ───────────────────────── */

    .field-card__placeholder {
      border: 2px dashed var(--control-border-default);
      border-radius: 6px;
      min-height: 36px;
      background: var(--base-bg-weak-default);
    }

    .cdk-drag-preview {
      border: 1px solid var(--control-border-active);
      border-radius: 6px;
      background: var(--base-bg-default);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }

    .start-fields__list.cdk-drop-list-dragging .field-card:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `],
})
export class StartFieldsComponent {
  readonly node = input.required<CanvasNode>();

  private readonly store = inject(WorkflowStore);

  protected readonly fieldTypeOptions = FIELD_TYPE_OPTIONS;
  protected readonly selectedFieldId = signal<string | null>(null);

  /** Ordered array of fields derived from the Start node's input_schema. */
  protected readonly fields = computed<(FormFieldDef & { key: string })[]>(() => {
    const cfg = this.node().config as StartConfig;
    const schema = cfg.input_schema ?? {};
    return Object.entries(schema).map(([key, def]) => ({ ...def, key }));
  });

  protected fieldTypeIcon(type: FormFieldType): string {
    return FIELD_TYPE_ICONS[type] ?? 'circle';
  }

  protected formatDefault(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  protected onSelectField(id: string): void {
    this.selectedFieldId.set(this.selectedFieldId() === id ? null : id);
  }

  protected onAddField(): void {
    const cfg = this.node().config as StartConfig;
    const schema = { ...(cfg.input_schema ?? {}) };
    const count = Object.keys(schema).length;
    const id = crypto.randomUUID();
    const key = `field_${count + 1}`;

    schema[key] = {
      id,
      label: '',
      type: 'text',
      required: false,
    };

    this.store.updateNode(this.node().id, {
      config: { ...cfg, input_schema: schema },
    });
    this.selectedFieldId.set(id);
  }

  protected onDeleteField(id: string, event: Event): void {
    event.stopPropagation();
    const cfg = this.node().config as StartConfig;
    const schema = { ...(cfg.input_schema ?? {}) };

    // Find key by field id
    const entry = Object.entries(schema).find(([, def]) => def.id === id);
    if (entry) {
      delete schema[entry[0]];
    }

    if (this.selectedFieldId() === id) {
      this.selectedFieldId.set(null);
    }

    this.store.updateNode(this.node().id, {
      config: { ...cfg, input_schema: schema },
    });
  }

  protected onFieldChange(id: string, prop: string, value: unknown): void {
    const cfg = this.node().config as StartConfig;
    const schema = { ...(cfg.input_schema ?? {}) };

    const entry = Object.entries(schema).find(([, def]) => def.id === id);
    if (!entry) return;

    const [key, def] = entry;
    schema[key] = { ...def, [prop]: value };

    this.store.updateNode(this.node().id, {
      config: { ...cfg, input_schema: schema },
    });
  }

  protected onKeyChange(id: string, newKey: string): void {
    // Sanitize: lowercase, replace spaces/special chars with underscores
    const sanitized = newKey.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_{2,}/g, '_');

    const cfg = this.node().config as StartConfig;
    const oldSchema = cfg.input_schema ?? {};

    // Find old key for this field id
    const entry = Object.entries(oldSchema).find(([, def]) => def.id === id);
    if (!entry) return;

    const [oldKey, def] = entry;

    // Rebuild schema preserving order but with new key
    const schema: Record<string, FormFieldDef> = {};
    for (const [k, v] of Object.entries(oldSchema)) {
      if (k === oldKey) {
        schema[sanitized] = def;
      } else {
        schema[k] = v;
      }
    }

    this.store.updateNode(this.node().id, {
      config: { ...cfg, input_schema: schema },
    });
  }

  protected onOptionsChange(id: string, value: string): void {
    const options = value.split(',').map((s) => s.trim()).filter(Boolean);
    this.onFieldChange(id, 'options', options);
  }

  protected onDrop(event: CdkDragDrop<(FormFieldDef & { key: string })[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const currentFields = [...this.fields()];
    moveItemInArray(currentFields, event.previousIndex, event.currentIndex);

    // Rebuild schema in new order
    const cfg = this.node().config as StartConfig;
    const schema: Record<string, FormFieldDef> = {};
    for (const field of currentFields) {
      const { key, ...def } = field;
      schema[key] = def;
    }

    this.store.updateNode(this.node().id, {
      config: { ...cfg, input_schema: schema },
    });
  }
}
