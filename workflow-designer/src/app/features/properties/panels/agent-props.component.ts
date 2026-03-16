import { Component, input, inject, computed } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputNumberComponent } from '@polarity/components/input-number';
import { TextAreaComponent } from '@polarity/components/textarea';
import { SelectComponent } from '@polarity/components/select';
import type { SelectItem } from '@polarity/components/select';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, AgentConfig } from '../../../core/models/node.models';

const MODEL_OPTIONS: SelectItem[] = [
  { value: 'gpt-4o',              label: 'GPT-4o' },
  { value: 'gpt-4o-mini',         label: 'GPT-4o Mini' },
  { value: 'gpt-3.5-turbo',       label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-5-sonnet',   label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku',      label: 'Claude 3 Haiku' },
];

const FORMAT_OPTIONS: SelectItem[] = [
  { value: 'text',        label: 'Text' },
  { value: 'json_object', label: 'JSON Object' },
  { value: 'json_schema', label: 'JSON Schema' },
];

@Component({
  selector: 'app-agent-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputNumberComponent,
    TextAreaComponent,
    SelectComponent,
  ],
  template: `
    <div class="agent-props">

      <pol-form-field>
        <label pol-label>Model</label>
        <pol-select
          [fixedWidth]="false"
          [options]="modelOptions"
          [placeholder]="'Select model'"
          [value]="cfg().model ?? undefined"
          (valueChange)="update('model', $event)"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Temperature</label>
        <pol-input-number
          [value]="cfg().temperature ?? 0.7"
          (valueChange)="update('temperature', $event)"
          [minimum]="0"
          [maximum]="2"
          [step]="0.1"
          [decimal]="true"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>User Prompt</label>
        <textarea pol-textarea
          [fixedWidth]="false"
          [value]="cfg().user_prompt ?? ''"
          (input)="onTextArea('user_prompt', $event)"
          placeholder="{{'{{'}}input{{'}}'}}"
          rows="4"
        ></textarea>
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Response Format</label>
        <pol-select
          [fixedWidth]="false"
          [options]="formatOptions"
          [placeholder]="'Select format'"
          [value]="cfg().response_format ?? undefined"
          (valueChange)="update('response_format', $event)"
        />
      </pol-form-field>

    </div>
  `,
  styles: [`
    .agent-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    pol-form-field { display: block; }
  `],
})
export class AgentPropsComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly modelOptions  = MODEL_OPTIONS;
  protected readonly formatOptions = FORMAT_OPTIONS;

  protected readonly cfg = computed(() => this.node().config as AgentConfig);

  private readonly store = inject(WorkflowStore);

  protected update(field: keyof AgentConfig, value: unknown): void {
    this.store.updateNodeConfig(this.node().id, { [field]: value });
  }

  protected onTextArea(field: keyof AgentConfig, event: Event): void {
    this.store.updateNodeConfig(this.node().id, {
      [field]: (event.target as HTMLTextAreaElement).value,
    });
  }
}
