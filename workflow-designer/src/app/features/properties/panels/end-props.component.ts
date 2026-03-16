import { Component, input, inject, computed } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { TextAreaComponent } from '@polarity/components/textarea';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasNode, EndConfig } from '../../../core/models/node.models';

@Component({
  selector: 'app-end-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="end-props">

      <pol-form-field>
        <label pol-label>Result</label>
        <textarea pol-textarea
          [fixedWidth]="false"
          [value]="cfg().result ?? ''"
          (input)="onResult($event)"
          placeholder="{{ '{{ workflow.agent_1.response }}' }}"
          rows="4"
        ></textarea>
        <span class="end-props__hint">
          Jinja2 reference resolved at runtime. The resolved value is shown in
          the Workflow Output section after execution.
        </span>
      </pol-form-field>

    </div>
  `,
  styles: [`
    .end-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    pol-form-field { display: block; }
    .end-props__hint {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: var(--base-text-weak-default);
      line-height: 1.4;
    }
  `],
})
export class EndPropsComponent {
  readonly node = input.required<CanvasNode>();

  protected readonly cfg = computed(() => this.node().config as EndConfig);

  private readonly store = inject(WorkflowStore);

  protected onResult(event: Event): void {
    this.store.updateNodeConfig(this.node().id, {
      result: (event.target as HTMLTextAreaElement).value,
    });
  }
}
