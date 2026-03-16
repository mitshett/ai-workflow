import { Component, input, inject, computed } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { TextAreaComponent } from '@polarity/components/textarea';
import { SelectComponent } from '@polarity/components/select';
import type { SelectItem } from '@polarity/components/select';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, TriggerRule } from '../../../core/models/node.models';

const TRIGGER_RULE_OPTIONS: SelectItem[] = [
  { value: 'all_success', label: 'All Success' },
  { value: 'any_success', label: 'Any Success' },
  { value: 'all_done',    label: 'All Done' },
];

/** Node types that have no incoming edges — Trigger Rule and Description are not applicable */
const SIMPLE_NODES = new Set(['start', 'end']);

@Component({
  selector: 'app-node-info',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    TextAreaComponent,
    SelectComponent,
  ],
  template: `
    <div class="node-info">

      <pol-form-field>
        <label pol-label>Label</label>
        <pol-input-text
          [fixedWidth]="false"
          [value]="node().label"
          (valueChange)="updateNode('label', $event)"
          [placeholder]="'Display name'"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Variable Name</label>
        <pol-input-text
          [fixedWidth]="false"
          [value]="node().alias"
          (valueChange)="updateNode('alias', $event)"
          [placeholder]="'e.g. agent_1'"
        />
      </pol-form-field>

      @if (showExtendedFields()) {

        <pol-form-field>
          <label pol-label>Description</label>
          <textarea pol-textarea
            [fixedWidth]="false"
            [value]="node().description ?? ''"
            (input)="onDescriptionInput($event)"
            placeholder="Optional description"
            rows="3"
          ></textarea>
        </pol-form-field>

        <pol-form-field>
          <label pol-label>Trigger Rule</label>
          <pol-select
            [fixedWidth]="false"
            [options]="triggerRuleOptions"
            [placeholder]="'Select trigger rule'"
            [clearable]="true"
            [value]="node().trigger_rule ?? undefined"
            (valueChange)="updateTriggerRule($event)"
          />
        </pol-form-field>

      }

    </div>
  `,
  styles: [`
    .node-info {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    pol-form-field {
      display: block;
    }
  `],
})
export class NodeInfoComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly triggerRuleOptions = TRIGGER_RULE_OPTIONS;

  private readonly store = inject(WorkflowStore);

  /** True for all node types except start and end */
  protected readonly showExtendedFields = computed(
    () => !SIMPLE_NODES.has(this.node().type)
  );

  protected updateNode(field: keyof CanvasNode, value: unknown): void {
    this.store.updateNode(this.node().id, { [field]: value } as Partial<CanvasNode>);
  }

  protected updateTriggerRule(value: unknown): void {
    this.store.updateNode(this.node().id, { trigger_rule: value as TriggerRule | undefined });
  }

  protected onDescriptionInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.store.updateNode(this.node().id, { description: value });
  }
}
