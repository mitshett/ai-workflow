import { Component, input, inject, computed, signal } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { TextAreaComponent } from '@polarity/components/textarea';
import { SelectComponent } from '@polarity/components/select';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import type { SelectItem } from '@polarity/components/select';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, RestClientConfig } from '../../../core/models/node.models';

const METHOD_OPTIONS: SelectItem[] = [
  { value: 'GET',    label: 'GET' },
  { value: 'POST',   label: 'POST' },
  { value: 'PUT',    label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH',  label: 'PATCH' },
];

@Component({
  selector: 'app-rest-client-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    TextAreaComponent,
    SelectComponent,
    ButtonComponent,
    IconComponent,
  ],
  template: `
    <div class="rest-props">

      <pol-form-field>
        <label pol-label>Method</label>
        <pol-select
          [fixedWidth]="false"
          [options]="methodOptions"
          [placeholder]="'Method'"
          [value]="cfg().method"
          (valueChange)="update('method', $event)"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>URL</label>
        <pol-input-text
          [value]="cfg().url"
          (valueChange)="update('url', $event)"
          [placeholder]="'https://api.example.com/endpoint'"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Request Body</label>
        <textarea pol-textarea
          [fixedWidth]="false"
          [value]="cfg().body ?? ''"
          (input)="onTextArea('body', $event)"
          placeholder='{"key": "value"}'
          rows="4"
        ></textarea>
      </pol-form-field>

      <!-- ── Headers ──────────────────────────────────────────────── -->
      <div class="rest-section">
        <div class="rest-section__header">
          <span class="rest-section__title">Headers</span>
          <div class="rest-kv-toggle">
            <button
              [class.rest-kv-toggle__btn--active]="headerViewMode() === 'kv'"
              class="rest-kv-toggle__btn"
              (click)="switchHeaderMode('kv')"
            >KV</button>
            <button
              [class.rest-kv-toggle__btn--active]="headerViewMode() === 'json'"
              class="rest-kv-toggle__btn"
              (click)="switchHeaderMode('json')"
            >JSON</button>
          </div>
        </div>

        @if (headerViewMode() === 'kv') {
          @for (row of headersAsArray(); track row.k + '_' + $index) {
            <div class="rest-kv-row">
              <pol-input-text
                [value]="row.k"
                (valueChange)="updateHeaderKey(row.k, $event, row.v)"
                [placeholder]="'Header name'"
              />
              <pol-input-text
                [value]="row.v"
                (valueChange)="updateHeaderValue(row.k, $event)"
                [placeholder]="'Value or \{\{ env.VAR \}\}'"
              />
              <button
                pol-button
                [variant]="'tertiary'"
                [size]="'small'"
                [iconOnly]="true"
                [ariaLabel]="'Remove header'"
                (click)="removeHeader(row.k)"
              >
                <pol-icon [iconName]="'trash'" size="small" [decorative]="true" />
              </button>
            </div>
          }
          <button
            pol-button
            [variant]="'tertiary'"
            [size]="'small'"
            (click)="addHeader()"
          >
            <pol-icon [iconName]="'plus'" size="small" [decorative]="true" />
            Add header
          </button>
        } @else {
          <textarea pol-textarea
            [fixedWidth]="false"
            [value]="headersAsJson()"
            (blur)="applyHeadersJson($any($event.target).value)"
            rows="5"
            placeholder="{}"
          ></textarea>
          @if (headerJsonError()) {
            <span class="rest-kv-error">{{ headerJsonError() }}</span>
          }
        }

        <span class="rest-kv-hint">Use {{ kvHint }}</span>
      </div>

      <!-- ── Query Params ─────────────────────────────────────────── -->
      <div class="rest-section">
        <div class="rest-section__header">
          <span class="rest-section__title">Query Params</span>
          <div class="rest-kv-toggle">
            <button
              [class.rest-kv-toggle__btn--active]="queryViewMode() === 'kv'"
              class="rest-kv-toggle__btn"
              (click)="switchQueryMode('kv')"
            >KV</button>
            <button
              [class.rest-kv-toggle__btn--active]="queryViewMode() === 'json'"
              class="rest-kv-toggle__btn"
              (click)="switchQueryMode('json')"
            >JSON</button>
          </div>
        </div>

        @if (queryViewMode() === 'kv') {
          @for (row of queryAsArray(); track row.k + '_' + $index) {
            <div class="rest-kv-row">
              <pol-input-text
                [value]="row.k"
                (valueChange)="updateQueryKey(row.k, $event, row.v)"
                [placeholder]="'Param name'"
              />
              <pol-input-text
                [value]="row.v"
                (valueChange)="updateQueryValue(row.k, $event)"
                [placeholder]="'Value or \{\{ workflow.node.field \}\}'"
              />
              <button
                pol-button
                [variant]="'tertiary'"
                [size]="'small'"
                [iconOnly]="true"
                [ariaLabel]="'Remove param'"
                (click)="removeQuery(row.k)"
              >
                <pol-icon [iconName]="'trash'" size="small" [decorative]="true" />
              </button>
            </div>
          }
          <button
            pol-button
            [variant]="'tertiary'"
            [size]="'small'"
            (click)="addQuery()"
          >
            <pol-icon [iconName]="'plus'" size="small" [decorative]="true" />
            Add param
          </button>
        } @else {
          <textarea pol-textarea
            [fixedWidth]="false"
            [value]="queryAsJson()"
            (blur)="applyQueryJson($any($event.target).value)"
            rows="5"
            placeholder="{}"
          ></textarea>
          @if (queryJsonError()) {
            <span class="rest-kv-error">{{ queryJsonError() }}</span>
          }
        }

        <span class="rest-kv-hint">Use {{ kvHint }}</span>
      </div>

    </div>
  `,
  styles: [`
    .rest-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    pol-form-field { display: block; }

    /* ── Section ──────────────────────────────────────────────────── */
    .rest-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .rest-section__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .rest-section__title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--base-text-weak-default);
    }

    /* ── KV / JSON toggle ─────────────────────────────────────────── */
    .rest-kv-toggle {
      display: flex;
      gap: 0;
      border: 1px solid var(--base-border-default);
      border-radius: 5px;
      overflow: hidden;
    }
    .rest-kv-toggle__btn {
      font-size: 10px;
      font-weight: 500;
      padding: 2px 9px;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--base-text-weak-default);
      transition: background 0.12s ease, color 0.12s ease;
      &:first-child { border-right: 1px solid var(--base-border-default); }
    }
    .rest-kv-toggle__btn--active {
      background: var(--base-bg-weak-default);
      color: var(--base-text-default);
      font-weight: 600;
    }

    /* ── KV rows ──────────────────────────────────────────────────── */
    .rest-kv-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 6px;
      align-items: center;
    }

    /* ── Hint + error ─────────────────────────────────────────────── */
    .rest-kv-hint {
      font-size: 10px;
      color: var(--base-text-weak-default);
      font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
    }
    .rest-kv-error {
      font-size: 10px;
      color: var(--negative-text-default);
    }
  `],
})
export class RestClientPropsComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly methodOptions = METHOD_OPTIONS;
  protected readonly cfg = computed(() => this.node().config as RestClientConfig);

  private readonly store = inject(WorkflowStore);

  // ── View mode state ──────────────────────────────────────────────────────
  protected readonly kvHint = '{{ env.VAR }} or {{ workflow.node.field }} as values';
  protected readonly headerViewMode  = signal<'kv' | 'json'>('kv');
  protected readonly queryViewMode   = signal<'kv' | 'json'>('kv');
  protected readonly headerJsonError = signal<string | null>(null);
  protected readonly queryJsonError  = signal<string | null>(null);

  // ── Computed array/JSON views ────────────────────────────────────────────
  protected readonly headersAsArray = computed(() =>
    Object.entries(this.cfg().headers ?? {}).map(([k, v]) => ({ k, v }))
  );
  protected readonly queryAsArray = computed(() =>
    Object.entries(this.cfg().query_params ?? {}).map(([k, v]) => ({ k, v }))
  );
  protected readonly headersAsJson = computed(() =>
    JSON.stringify(this.cfg().headers ?? {}, null, 2)
  );
  protected readonly queryAsJson = computed(() =>
    JSON.stringify(this.cfg().query_params ?? {}, null, 2)
  );

  // ── Generic update helpers ───────────────────────────────────────────────
  protected update(field: keyof RestClientConfig, value: unknown): void {
    this.store.updateNodeConfig(this.node().id, { [field]: value });
  }

  protected onTextArea(field: keyof RestClientConfig, event: Event): void {
    this.store.updateNodeConfig(this.node().id, {
      [field]: (event.target as HTMLTextAreaElement).value,
    });
  }

  // ── Header helpers ───────────────────────────────────────────────────────
  protected addHeader(): void {
    const existing = { ...(this.cfg().headers ?? {}) };
    // find a unique placeholder key
    let key = '';
    let i = 1;
    while (key === '' || key in existing) { key = `header_${i++}`; }
    existing[key] = '';
    this.store.updateNodeConfig(this.node().id, { headers: existing });
  }

  protected removeHeader(key: string): void {
    const updated = { ...(this.cfg().headers ?? {}) };
    delete updated[key];
    this.store.updateNodeConfig(this.node().id, { headers: updated });
  }

  protected updateHeaderKey(oldKey: string, newKey: string, value: string): void {
    const current = this.cfg().headers ?? {};
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(current)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    this.store.updateNodeConfig(this.node().id, { headers: updated });
  }

  protected updateHeaderValue(key: string, value: string): void {
    const updated = { ...(this.cfg().headers ?? {}), [key]: value };
    this.store.updateNodeConfig(this.node().id, { headers: updated });
  }

  protected applyHeadersJson(raw: string): void {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be a JSON object');
      this.headerJsonError.set(null);
      this.store.updateNodeConfig(this.node().id, { headers: parsed });
    } catch (e) {
      this.headerJsonError.set(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  protected switchHeaderMode(mode: 'kv' | 'json'): void {
    if (mode === 'kv' && this.headerJsonError()) return; // block if JSON invalid
    this.headerViewMode.set(mode);
  }

  // ── Query param helpers ──────────────────────────────────────────────────
  protected addQuery(): void {
    const existing = { ...(this.cfg().query_params ?? {}) };
    let key = '';
    let i = 1;
    while (key === '' || key in existing) { key = `param_${i++}`; }
    existing[key] = '';
    this.store.updateNodeConfig(this.node().id, { query_params: existing });
  }

  protected removeQuery(key: string): void {
    const updated = { ...(this.cfg().query_params ?? {}) };
    delete updated[key];
    this.store.updateNodeConfig(this.node().id, { query_params: updated });
  }

  protected updateQueryKey(oldKey: string, newKey: string, value: string): void {
    const current = this.cfg().query_params ?? {};
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(current)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    this.store.updateNodeConfig(this.node().id, { query_params: updated });
  }

  protected updateQueryValue(key: string, value: string): void {
    const updated = { ...(this.cfg().query_params ?? {}), [key]: value };
    this.store.updateNodeConfig(this.node().id, { query_params: updated });
  }

  protected applyQueryJson(raw: string): void {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be a JSON object');
      this.queryJsonError.set(null);
      this.store.updateNodeConfig(this.node().id, { query_params: parsed });
    } catch (e) {
      this.queryJsonError.set(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  protected switchQueryMode(mode: 'kv' | 'json'): void {
    if (mode === 'kv' && this.queryJsonError()) return; // block if JSON invalid
    this.queryViewMode.set(mode);
  }
}
