import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { InputNumberComponent } from '@polarity/components/input-number';
import { SelectComponent } from '@polarity/components/select';
import { SpinnerComponent } from '@polarity/components/spinner';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { TextAreaComponent } from '@polarity/components/textarea';
import { WorkflowStore } from '../../../core/services/workflow.store';
import { TemporalService, type McpToolInfo } from '../../../core/services/temporal.service';
import type { CanvasNode, McpConfig } from '../../../core/models/node.models';
import type { SelectItem, SelectValue } from '@polarity/components/select';

/** A single key-value argument row */
interface ArgRow {
  key: string;
  value: string;
}

/** Parse a Record into ArgRow[]. Nested values are serialised to JSON strings. */
function recordToRows(rec: Record<string, unknown> | undefined): ArgRow[] {
  if (!rec || Object.keys(rec).length === 0) return [];
  return Object.entries(rec).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

/** Build a Record from ArgRow[]. Empty-key rows are skipped. Values that look like JSON are parsed. */
function rowsToRecord(rows: ArgRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}

@Component({
  selector: 'app-mcp-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    InputNumberComponent,
    SelectComponent,
    SpinnerComponent,
    ButtonComponent,
    IconComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="mcp-props">

      <!-- ── Mode selector ── -->
      <pol-form-field>
        <label pol-label>Execution Mode</label>
        <pol-select
          [fixedWidth]="false"
          [options]="modeOptions"
          [value]="cfg().smart_mcp_enabled === false ? 'direct' : 'smart'"
          (valueChange)="onModeChange($event)"
        />
      </pol-form-field>

      <!-- ── Server URL (both modes) ── -->
      <pol-form-field>
        <label pol-label>Server URL</label>
        <pol-input-text
          [value]="cfg().server_url"
          (valueChange)="update('server_url', $event)"
          [placeholder]="'https://mcp.example.com or alias (e.g. cisco)'"
          [fixedWidth]="false"
        />
      </pol-form-field>

      <!-- ════════════════════════════════════════════════
           SMART MODE
           ════════════════════════════════════════════════ -->
      @if (isSmart()) {

        <!-- User Prompt -->
        <pol-form-field>
          <label pol-label>User Prompt</label>
          <textarea pol-textarea
            [fixedWidth]="false"
            [value]="cfg().user_prompt ?? ''"
            (input)="onTextArea('user_prompt', $event)"
            placeholder="Describe the task… Use {{'{{'}}variable{{'}}'}} to reference upstream outputs"
            rows="4"
          ></textarea>
        </pol-form-field>

        <!-- Max Tool Calls -->
        <pol-form-field>
          <label pol-label>Max Tool Calls</label>
          <p class="field-hint">Max LLM ↔ tool round-trips the agent can make</p>
          <pol-input-number
            [value]="cfg().max_tool_calls ?? 5"
            (valueChange)="update('max_tool_calls', $event)"
            [minimum]="1"
            [maximum]="20"
            [step]="1"
          />
        </pol-form-field>

        <!-- Preferred Tools -->
        <div class="section-header">
          <span class="section-label">Preferred Tools</span>
          <p class="field-hint">Limit which tools the agent can use (optional)</p>
        </div>

        <div class="fetch-row">
          <pol-select
            [fixedWidth]="false"
            [options]="toolOptions()"
            [multiple]="true"
            [value]="preferredToolsValue()"
            [placeholder]="toolFetchError() ? 'Fetch failed — type manually' : 'Fetch tools first…'"
            [disabled]="toolOptions().length === 0"
            (valueChange)="onPreferredToolsChange($event)"
          />
          <button
            pol-button
            [variant]="'secondary'"
            [size]="'small'"
            [disabled]="!cfg().server_url || fetchingTools()"
            (click)="onFetchTools()"
          >
            @if (fetchingTools()) {
              <pol-spinner [size]="'small'" [ariaLabel]="'Fetching tools'" />
            } @else {
              <pol-icon [iconName]="'arrows-clockwise'" [size]="'small'" [decorative]="true" />
            }
            Fetch
          </button>
        </div>
        @if (toolFetchError()) {
          <p class="fetch-error">{{ toolFetchError() }}</p>
        }

      }

      <!-- ════════════════════════════════════════════════
           DIRECT MODE
           ════════════════════════════════════════════════ -->
      @if (!isSmart()) {

        <!-- Tool Name + Fetch button -->
        <div class="field-block">
          <label class="field-label">Tool Name</label>
          <div class="fetch-row">
            @if (toolOptions().length > 0) {
              <pol-select
                [fixedWidth]="false"
                [options]="toolOptions()"
                [value]="cfg().tool_name ?? undefined"
                [placeholder]="'Select a tool'"
                (valueChange)="update('tool_name', $event)"
              />
            } @else {
              <pol-input-text
                [value]="cfg().tool_name ?? ''"
                (valueChange)="update('tool_name', $event)"
                [placeholder]="'e.g. search_documents'"
                [fixedWidth]="false"
              />
            }
            <button
              pol-button
              [variant]="'secondary'"
              [size]="'small'"
              [disabled]="!cfg().server_url || fetchingTools()"
              (click)="onFetchTools()"
            >
              @if (fetchingTools()) {
                <pol-spinner [size]="'small'" [ariaLabel]="'Fetching tools'" />
              } @else {
                <pol-icon [iconName]="'arrows-clockwise'" [size]="'small'" [decorative]="true" />
              }
              Fetch
            </button>
          </div>
          @if (toolFetchError()) {
            <p class="fetch-error">{{ toolFetchError() }}</p>
          }
        </div>

        <!-- Tool Arguments -->
        <div class="section-header">
          <span class="section-label">Tool Arguments</span>
          <div class="args-mode-toggle">
            <button
              class="toggle-btn"
              [class.toggle-btn--active]="argsViewMode() === 'kv'"
              (click)="setArgsViewMode('kv')"
              type="button"
            >Key-Value</button>
            <button
              class="toggle-btn"
              [class.toggle-btn--active]="argsViewMode() === 'json'"
              (click)="setArgsViewMode('json')"
              type="button"
            >JSON</button>
          </div>
        </div>

        @if (argsViewMode() === 'kv') {
          <!-- Key-value rows — driven by local _argRows signal so blank rows stay visible -->
          <div class="kv-list">
            @for (row of _argRows(); track $index) {
              <div class="kv-row">
                <pol-input-text
                  [value]="row.key"
                  (valueChange)="onArgKeyChange($index, $event)"
                  [placeholder]="'key'"
                  [fixedWidth]="false"
                />
                <pol-input-text
                  [value]="row.value"
                  (valueChange)="onArgValueChange($index, $event)"
                  [placeholder]="'value or \{\{variable\}\}'"
                  [fixedWidth]="false"
                />
                <button
                  pol-button
                  [variant]="'tertiary'"
                  [size]="'small'"
                  [iconOnly]="true"
                  [ariaLabel]="'Remove argument'"
                  (click)="onRemoveArg($index)"
                >
                  <pol-icon [iconName]="'minus-circle'" [size]="'small'" [decorative]="true" />
                </button>
              </div>
            }
          </div>
          <button
            pol-button
            [variant]="'tertiary'"
            [size]="'small'"
            (click)="onAddArg()"
            class="add-arg-btn"
          >
            <pol-icon [iconName]="'plus'" [size]="'small'" [decorative]="true" />
            Add argument
          </button>
        } @else {
          <!-- Raw JSON editor -->
          <pol-form-field>
            <textarea pol-textarea
              [fixedWidth]="false"
              [value]="rawJsonText()"
              (input)="onRawJsonInput($event)"
              placeholder="{}"
              rows="6"
            ></textarea>
          </pol-form-field>
          @if (jsonParseError()) {
            <p class="fetch-error">{{ jsonParseError() }}</p>
          }
        }

      }

    </div>
  `,
  styles: [`
    .mcp-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    pol-form-field { display: block; }

    /* ── Plain field block (replaces pol-form-field where flex children break it) ── */

    .field-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--base-text-default);
    }

    .field-hint {
      font-size: 11px;
      color: var(--base-text-weak-default);
      margin: 2px 0 6px;
    }

    /* ── Section headers ─────────────────────── */

    .section-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .section-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--base-text-default);
    }

    /* ── Fetch row ──────────────────────────── */

    .fetch-row {
      display: flex;
      align-items: flex-start;
      gap: 6px;

      pol-select,
      pol-input-text {
        flex: 1;
        min-width: 0;
      }
    }

    .fetch-error {
      font-size: 11px;
      color: var(--magnetic-color-red-60, #ef4444);
      margin: 2px 0 0;
    }

    /* ── Args mode toggle ───────────────────── */

    .args-mode-toggle {
      display: flex;
      border: 1px solid var(--base-border-weak-default);
      border-radius: 6px;
      overflow: hidden;
    }

    .toggle-btn {
      padding: 2px 10px;
      font-size: 11px;
      font-weight: 500;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--base-text-weak-default);
      transition: background 120ms ease, color 120ms ease;

      &--active {
        background: var(--control-bg-medium-default);
        color: var(--base-text-default);
      }

      &:focus-visible {
        outline: 2px solid var(--control-border-focus);
        outline-offset: -2px;
      }
    }

    /* ── Key-value list ─────────────────────── */

    .kv-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .kv-row {
      display: flex;
      align-items: center;
      gap: 6px;

      pol-input-text {
        flex: 1;
        min-width: 0;
      }
    }

    .add-arg-btn {
      align-self: flex-start;
    }
  `],
})
export class McpPropsComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly cfg = computed(() => this.node().config as McpConfig);

  private readonly store = inject(WorkflowStore);
  private readonly temporalService = inject(TemporalService);

  // ── Mode ──────────────────────────────────────────────────────────────────

  protected readonly isSmart = computed(() => this.cfg().smart_mcp_enabled !== false);

  protected readonly modeOptions: SelectItem[] = [
    { value: 'smart', label: 'Smart — LLM agent picks tools autonomously' },
    { value: 'direct', label: 'Direct — call one specific tool explicitly' },
  ];

  protected onModeChange(value: SelectValue): void {
    this.update('smart_mcp_enabled', value !== 'direct');
    // Reset tool state when switching modes
    this.fetchedTools.set([]);
    this.toolFetchError.set('');
  }

  // ── Tool fetch ────────────────────────────────────────────────────────────

  protected readonly fetchingTools = signal(false);
  protected readonly fetchedTools = signal<McpToolInfo[]>([]);
  protected readonly toolFetchError = signal('');

  protected readonly toolOptions = computed<SelectItem[]>(() =>
    this.fetchedTools().map((t) => ({
      value: t.name,
      label: t.name,
      description: t.description || undefined,
    }))
  );

  protected onFetchTools(): void {
    const url = this.cfg().server_url;
    if (!url) return;

    this.fetchingTools.set(true);
    this.toolFetchError.set('');

    this.temporalService.getMcpTools(url).subscribe({
      next: (res) => {
        this.fetchingTools.set(false);
        if (res.error) {
          this.toolFetchError.set(res.error);
          this.fetchedTools.set([]);
        } else {
          this.fetchedTools.set(res.tools);
        }
      },
      error: (err: Error) => {
        this.fetchingTools.set(false);
        this.toolFetchError.set(err.message);
        this.fetchedTools.set([]);
      },
    });
  }

  // ── Preferred tools (smart mode) ─────────────────────────────────────────

  protected readonly preferredToolsValue = computed(() =>
    this.cfg().preferred_tools ?? []
  );

  protected onPreferredToolsChange(value: unknown): void {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    this.update('preferred_tools', arr.length ? arr : undefined);
  }

  // ── Args editor (direct mode) ─────────────────────────────────────────────

  protected readonly argsViewMode = signal<'kv' | 'json'>('kv');
  protected readonly jsonParseError = signal('');

  /**
   * Local mutable rows — NOT derived from config so blank rows survive.
   * Seeded from config on first non-empty read; thereafter mutated directly.
   */
  protected readonly _argRows = signal<ArgRow[]>([]);
  private _seededForNodeId = '';

  constructor() {
    // Re-seed _argRows whenever the selected node changes, so switching between
    // two MCP Tool nodes doesn't carry one node's rows into the other.
    // Within the same node, the seed is skipped so in-progress blank rows survive.
    effect(() => {
      const nodeId = this.node().id;
      const args = this.cfg().tool_arguments;
      if (this._seededForNodeId !== nodeId) {
        this._seededForNodeId = nodeId;
        this._argRows.set(recordToRows(args));
      }
    });
  }

  /** JSON text shown in raw editor — formatted from config */
  protected readonly rawJsonText = computed(() =>
    JSON.stringify(this.cfg().tool_arguments ?? {}, null, 2)
  );

  protected setArgsViewMode(mode: 'kv' | 'json'): void {
    this.jsonParseError.set('');
    this.argsViewMode.set(mode);
  }

  protected onArgKeyChange(index: number, key: string): void {
    const rows = this._argRows().map((r, i) => i === index ? { ...r, key } : r);
    this._argRows.set(rows);
    this.update('tool_arguments', rowsToRecord(rows));
  }

  protected onArgValueChange(index: number, value: string): void {
    const rows = this._argRows().map((r, i) => i === index ? { ...r, value } : r);
    this._argRows.set(rows);
    this.update('tool_arguments', rowsToRecord(rows));
  }

  protected onAddArg(): void {
    this._argRows.update(rows => [...rows, { key: '', value: '' }]);
    // Don't flush to config — empty key would be dropped by rowsToRecord anyway
  }

  protected onRemoveArg(index: number): void {
    const rows = this._argRows().filter((_, i) => i !== index);
    this._argRows.set(rows);
    this.update('tool_arguments', rowsToRecord(rows));
  }

  protected onRawJsonInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    try {
      const parsed = JSON.parse(text || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.jsonParseError.set('Must be a JSON object {} — tool arguments are named key-value pairs');
        return;
      }
      this.jsonParseError.set('');
      this._argRows.set(recordToRows(parsed as Record<string, unknown>));
      this.update('tool_arguments', parsed);
    } catch {
      this.jsonParseError.set('Invalid JSON');
    }
  }

  // ── Textarea helper ───────────────────────────────────────────────────────

  protected onTextArea(field: keyof McpConfig, event: Event): void {
    this.update(field, (event.target as HTMLTextAreaElement).value);
  }

  // ── Generic update ────────────────────────────────────────────────────────

  protected update(field: keyof McpConfig, value: unknown): void {
    this.store.updateNodeConfig(this.node().id, { [field]: value });
  }
}
