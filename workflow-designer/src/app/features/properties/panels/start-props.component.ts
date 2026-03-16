import { Component, input, inject, computed } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { TextAreaComponent } from '@polarity/components/textarea';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, StartConfig } from '../../../core/models/node.models';

@Component({
  selector: 'app-start-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="start-props">

      <pol-form-field>
        <label pol-label>Workflow Name</label>
        <pol-input-text
          [fixedWidth]="false"
          [value]="workflowName()"
          (valueChange)="onWorkflowNameChange($event)"
          [placeholder]="'e.g. Customer Onboarding'"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Workflow ID</label>
        <pol-input-text
          [fixedWidth]="false"
          [value]="workflowId()"
          (valueChange)="onWorkflowIdChange($event)"
          [placeholder]="'e.g. customer_onboarding_v1'"
        />
      </pol-form-field>

      <pol-form-field>
        <label pol-label>Description</label>
        <textarea pol-textarea
          [fixedWidth]="false"
          [value]="workflowDescription()"
          (input)="onDescriptionInput($event)"
          placeholder="Describe what this workflow does…"
          rows="4"
        ></textarea>
      </pol-form-field>

    </div>
  `,
  styles: [`
    .start-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    pol-form-field {
      display: block;
    }
  `],
})
export class StartPropsComponent {
  readonly node = input.required<CanvasNode>();

  private readonly store = inject(WorkflowStore);

  private readonly cfg = computed(() => this.node().config as StartConfig);

  protected readonly workflowName = computed(
    () => this.cfg().workflow_name ?? this.store.workflowName()
  );

  protected readonly workflowId = computed(
    () => this.cfg().workflow_id ?? ''
  );

  protected readonly workflowDescription = computed(
    () => this.cfg().workflow_description ?? ''
  );

  protected onWorkflowNameChange(value: string): void {
    const cfg: StartConfig = { ...this.cfg(), workflow_name: value };
    this.store.updateNode(this.node().id, { config: cfg });
    this.store.setWorkflowName(value);
  }

  protected onWorkflowIdChange(value: string): void {
    const cfg: StartConfig = { ...this.cfg(), workflow_id: value };
    this.store.updateNode(this.node().id, { config: cfg });
  }

  protected onDescriptionInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    const cfg: StartConfig = { ...this.cfg(), workflow_description: value };
    this.store.updateNode(this.node().id, { config: cfg });
  }
}
