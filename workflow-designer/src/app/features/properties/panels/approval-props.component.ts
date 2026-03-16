import { Component, input, inject, computed } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { InputNumberComponent } from '@polarity/components/input-number';
import { TextAreaComponent } from '@polarity/components/textarea';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, ApprovalConfig } from '../../../core/models/node.models';

@Component({
  selector: 'app-approval-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    InputNumberComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="approval-props">

      <pol-form-field>
        <label pol-label>Approver</label>
        <pol-input-text
          [value]="cfg().approver ?? ''"
          (valueChange)="update('approver', $event)"
          [placeholder]="'e.g. manager@example.com'"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Message</label>
        <textarea pol-textarea
          [fixedWidth]="false"
          [value]="cfg().message ?? ''"
          (input)="onTextArea('message', $event)"
          placeholder="Please review and approve this workflow step."
          rows="3"
        ></textarea>
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Timeout (hours)</label>
        <pol-input-number
          [value]="cfg().timeout_hours ?? 24"
          (valueChange)="update('timeout_hours', $event)"
          [minimum]="1"
          [maximum]="720"
          [step]="1"
        />
      </pol-form-field>

    </div>
  `,
  styles: [`
    .approval-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    pol-form-field { display: block; }
  `],
})
export class ApprovalPropsComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly cfg = computed(() => this.node().config as ApprovalConfig);

  private readonly store = inject(WorkflowStore);

  protected update(field: keyof ApprovalConfig, value: unknown): void {
    this.store.updateNodeConfig(this.node().id, { [field]: value });
  }

  protected onTextArea(field: keyof ApprovalConfig, event: Event): void {
    this.store.updateNodeConfig(this.node().id, {
      [field]: (event.target as HTMLTextAreaElement).value,
    });
  }
}
