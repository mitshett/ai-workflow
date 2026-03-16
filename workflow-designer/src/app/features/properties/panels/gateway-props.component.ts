import { Component, input, inject, computed, signal, effect } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { SelectComponent } from '@polarity/components/select';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import type { SelectItem } from '@polarity/components/select';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type {
  CanvasNode,
  GatewayConfig,
  GatewayRule,
  NumericOperator,
  ConditionType,
} from '../../../core/models/node.models';

// ── Constants ──────────────────────────────────────────────────────────────

const CONDITION_TYPE_OPTIONS: SelectItem[] = [
  { value: 'string_match',       label: 'String Match' },
  { value: 'string_contains',    label: 'String Contains' },
  { value: 'regex_match',        label: 'Regex Match' },
  { value: 'numeric_comparison', label: 'Numeric Comparison' },
  { value: 'boolean_check',      label: 'Boolean Check' },
];

const OPERATOR_OPTIONS: SelectItem[] = [
  { value: 'eq',  label: '= (equals)' },
  { value: 'ne',  label: '≠ (not equals)' },
  { value: 'gt',  label: '> (greater than)' },
  { value: 'gte', label: '≥ (greater or equal)' },
  { value: 'lt',  label: '< (less than)' },
  { value: 'lte', label: '≤ (less or equal)' },
];

const BOOLEAN_OPTIONS: SelectItem[] = [
  { value: 'true',  label: 'True' },
  { value: 'false', label: 'False' },
];

// ── Internal row type (flat, easier to bind) ───────────────────────────────

interface RuleRow {
  value: string;
  operator: NumericOperator;
  target_node: string;
  label: string;
}

function ruleToRow(r: GatewayRule): RuleRow {
  return {
    value:       r.value ?? '',
    operator:    (r.operator ?? 'eq') as NumericOperator,
    target_node: r.target_node ?? '',
    label:       r.label ?? '',
  };
}

function rowToRule(r: RuleRow): GatewayRule {
  return {
    value:       r.value,
    operator:    r.operator,
    target_node: r.target_node,
    label:       r.label,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-gateway-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    SelectComponent,
    ButtonComponent,
    IconComponent,
  ],
  template: `
    <div class="gw-props">

      <!-- Input Source -->
      <pol-form-field>
        <label pol-label>Input Source</label>
        <pol-input-text
          [value]="cfg().input_source"
          (valueChange)="updateCfg('input_source', $event)"
          [placeholder]="'e.g. {{workflow.agent.status}}'"
        />
        <span class="gw-hint">Jinja2 template — resolves to the value being tested.</span>
      </pol-form-field>

      <!-- Condition Type -->
      <pol-form-field>
        <label pol-label>Condition Type</label>
        <pol-select
          [fixedWidth]="false"
          [options]="conditionTypeOptions"
          [placeholder]="'Select condition type'"
          [value]="cfg().condition_type"
          (valueChange)="updateCfg('condition_type', $event)"
        />
      </pol-form-field>

      <!-- Rules -->
      <div class="gw-section">
        <div class="gw-section__header">
          <span class="gw-section__title">Rules</span>
          <button pol-button [variant]="'tertiary'" [size]="'small'" (click)="addRule()">
            <pol-icon [iconName]="'plus'" size="small" [decorative]="true" />
            Add Rule
          </button>
        </div>

        @if (downstreamNodes().length === 0) {
          <div class="gw-notice gw-notice--warning">
            <pol-icon [iconName]="'warning'" size="xsmall" [decorative]="true" />
            <span>Connect this gateway to downstream nodes first, then configure rules.</span>
          </div>
        }

        @if (downstreamNodes().length > 0 && rows().length === 0) {
          <div class="gw-notice gw-notice--info">
            <pol-icon [iconName]="'info'" size="xsmall" [decorative]="true" />
            <span>No rules defined — all traffic will route to the default target.</span>
          </div>
        }

        @for (row of rows(); track $index) {
          <div class="gw-rule">

            <!-- Value / Pattern -->
            <div class="gw-rule__field">
              <span class="gw-rule__label">
                @if (cfg().condition_type === 'regex_match') { Pattern }
                @else if (cfg().condition_type === 'boolean_check') { Equals }
                @else { If value }
              </span>

              @if (cfg().condition_type === 'boolean_check') {
                <pol-select
                  [fixedWidth]="false"
                  [options]="booleanOptions"
                  [value]="row.value || 'true'"
                  (valueChange)="updateRow($index, 'value', $event)"
                />
              } @else if (cfg().condition_type === 'numeric_comparison') {
                <div class="gw-rule__numeric">
                  <pol-select
                    [fixedWidth]="false"
                    [options]="operatorOptions"
                    [value]="row.operator"
                    (valueChange)="updateRow($index, 'operator', $event)"
                  />
                  <pol-input-text
                    [value]="row.value"
                    (valueChange)="updateRow($index, 'value', $event)"
                    [placeholder]="'0'"
                  />
                </div>
              } @else {
                <pol-input-text
                  [value]="row.value"
                  (valueChange)="updateRow($index, 'value', $event)"
                  [placeholder]="cfg().condition_type === 'regex_match' ? '^error.*' : 'success'"
                />
              }
            </div>

            <!-- Target Node -->
            <div class="gw-rule__field">
              <span class="gw-rule__label">Route to</span>
              @if (downstreamNodes().length > 0) {
                <pol-select
                  [fixedWidth]="false"
                  [options]="downstreamNodes()"
                  [placeholder]="'Select node'"
                  [value]="row.target_node"
                  (valueChange)="updateRow($index, 'target_node', $event)"
                />
              } @else {
                <pol-input-text
                  [value]="row.target_node"
                  (valueChange)="updateRow($index, 'target_node', $event)"
                  [placeholder]="'Node ID'"
                />
              }
            </div>

            <!-- Label (optional) + Remove -->
            <div class="gw-rule__footer">
              <pol-input-text
                [value]="row.label"
                (valueChange)="updateRow($index, 'label', $event)"
                [placeholder]="'Label (optional)'"
              />
              <button
                pol-button
                [variant]="'tertiary'"
                [size]="'small'"
                [iconOnly]="true"
                [ariaLabel]="'Remove rule'"
                (click)="removeRule($index)"
                class="gw-rule__remove"
              >
                <pol-icon [iconName]="'x'" size="small" [decorative]="true" />
              </button>
            </div>

          </div>
        }
      </div>

      <!-- Default Target -->
      <pol-form-field>
        <label pol-label>Default Target <span class="gw-optional">(fallback)</span></label>
        @if (downstreamNodes().length > 0) {
          <pol-select
            [fixedWidth]="false"
            [options]="downstreamNodesWithEmpty()"
            [placeholder]="'None — fail if no rule matches'"
            [value]="cfg().default_target ?? ''"
            (valueChange)="updateCfg('default_target', $event || undefined)"
          />
        } @else {
          <pol-input-text
            [value]="cfg().default_target ?? ''"
            (valueChange)="updateCfg('default_target', $event)"
            [placeholder]="'Node ID for fallback'"
          />
        }
        <span class="gw-hint">Used when no rule matches. Leave empty to fail the workflow.</span>
      </pol-form-field>

    </div>
  `,
  styles: [`
    .gw-props {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    pol-form-field { display: block; }

    .gw-hint {
      display: block;
      margin-top: 3px;
      font-size: 10px;
      color: var(--base-text-weak-default);
      line-height: 1.4;
    }

    .gw-optional {
      font-weight: 400;
      color: var(--base-text-weak-default);
      font-size: 10px;
    }

    /* ── Section header ── */
    .gw-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .gw-section__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .gw-section__title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--base-text-weak-default);
    }

    /* ── Notices ── */
    .gw-notice {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 11px;
      line-height: 1.45;

      pol-icon { flex-shrink: 0; margin-top: 1px; }

      &--warning {
        background: var(--warning-bg-weak-default);
        color: var(--warning-text-default);
        border: 1px solid var(--warning-border-default);
      }

      &--info {
        background: var(--info-bg-weak-default);
        color: var(--info-text-default);
        border: 1px solid var(--info-border-default);
      }
    }

    /* ── Rule card ── */
    .gw-rule {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 10px 8px;
      border: 1px solid var(--base-border-default);
      border-radius: 8px;
      background: var(--base-bg-weak-default);
    }

    .gw-rule__field {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .gw-rule__label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--base-text-weak-default);
    }

    .gw-rule__numeric {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .gw-rule__footer {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;

      pol-input-text { flex: 1; }
    }

    .gw-rule__remove {
      flex-shrink: 0;
      color: var(--negative-text-default);
    }
  `],
})
export class GatewayPropsComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly conditionTypeOptions = CONDITION_TYPE_OPTIONS;
  protected readonly operatorOptions      = OPERATOR_OPTIONS;
  protected readonly booleanOptions       = BOOLEAN_OPTIONS;

  protected readonly cfg = computed(() => this.node().config as GatewayConfig);

  // Local signal for rows — keeps UI reactive without fighting the store on every keystroke
  protected readonly rows = signal<RuleRow[]>([]);

  private readonly store = inject(WorkflowStore);

  constructor() {
    // Sync rows signal from node config whenever the node input changes
    effect(() => {
      const rules = this.cfg().rules ?? [];
      this.rows.set(rules.map(ruleToRow));
    });
  }

  // ── Downstream nodes ──────────────────────────────────────────────────────

  protected readonly downstreamNodes = computed<SelectItem[]>(() => {
    const nodeId  = this.node().id;
    const edges   = this.store.edges().filter(e => e.sourceNodeId === nodeId);
    const nodeMap = new Map(this.store.nodes().map(n => [n.id, n]));
    return edges
      .map(e => nodeMap.get(e.targetNodeId))
      .filter((n): n is CanvasNode => n !== undefined)
      .map(n => ({ value: n.id, label: n.alias ? `${n.alias}` : n.label }));
  });

  // Includes an empty "none" option for the default target dropdown
  protected readonly downstreamNodesWithEmpty = computed<SelectItem[]>(() => [
    { value: '', label: 'None — fail if no rule matches' },
    ...this.downstreamNodes(),
  ]);

  // ── Config updates ────────────────────────────────────────────────────────

  protected updateCfg(field: keyof GatewayConfig, value: unknown): void {
    this.store.updateNodeConfig(this.node().id, { [field]: value });
  }

  // ── Rule management ───────────────────────────────────────────────────────

  protected addRule(): void {
    const newRow: RuleRow = { value: '', operator: 'eq', target_node: '', label: '' };
    const updated = [...this.rows(), newRow];
    this.rows.set(updated);
    this.flushRules(updated);
  }

  protected removeRule(index: number): void {
    const updated = this.rows().filter((_, i) => i !== index);
    this.rows.set(updated);
    this.flushRules(updated);
  }

  protected updateRow(index: number, field: keyof RuleRow, value: unknown): void {
    const updated = this.rows().map((r, i) =>
      i === index ? { ...r, [field]: value } : r,
    );
    this.rows.set(updated);
    this.flushRules(updated);
  }

  // Write rows back to the store as GatewayRule[]
  private flushRules(rows: RuleRow[]): void {
    this.store.updateNodeConfig(this.node().id, { rules: rows.map(rowToRule) });
  }
}
