import { Component, input, inject, computed } from '@angular/core';
import { FormFieldComponent, LabelComponent } from '@polarity/components/form';
import { InputTextComponent } from '@polarity/components/input-text';
import { ButtonComponent } from '@polarity/components/button';
import { DividerComponent } from '@polarity/components/divider';
import { WorkflowStore } from '../../../core/services/workflow.store';
import type { CanvasEdge } from '../../../core/models/node.models';

@Component({
  selector: 'app-edge-props',
  standalone: true,
  imports: [
    FormFieldComponent,
    LabelComponent,
    InputTextComponent,
    ButtonComponent,
    DividerComponent,
  ],
  template: `
    <div class="edge-props">

      <div class="edge-meta">
        <div class="edge-meta__row">
          <span class="edge-meta__key">Source</span>
          <span class="edge-meta__val">{{ sourceName() }}</span>
        </div>
        <div class="edge-meta__row">
          <span class="edge-meta__key">Target</span>
          <span class="edge-meta__val">{{ targetName() }}</span>
        </div>
        <div class="edge-meta__row">
          <span class="edge-meta__key">Port</span>
          <span class="edge-meta__val edge-meta__val--port">{{ edge().sourcePort }}</span>
        </div>
      </div>

      <pol-divider />

      <pol-form-field>
        <label pol-label>Edge Label</label>
        <pol-input-text
          [value]="edge().label ?? ''"
          (valueChange)="onLabelChange($event)"
          [placeholder]="'Optional label'"
        />
      </pol-form-field>

      <div class="edge-actions">
        <button pol-button
          [variant]="'tertiary'"
          [destructive]="true"
          (click)="deleteEdge()"
        >Delete Edge</button>
      </div>

    </div>
  `,
  styles: [`
    .edge-props {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .edge-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--base-bg-weak-default);
    }
    .edge-meta__row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .edge-meta__key {
      color: var(--base-text-weak-default);
    }
    .edge-meta__val {
      font-weight: 500;
      color: var(--base-text-default);
    }
    .edge-meta__val--port {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    pol-form-field { display: block; }
    .edge-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 4px;
    }
  `],
})
export class EdgePropsComponent {
  readonly edge = input.required<CanvasEdge>();

  private readonly store = inject(WorkflowStore);

  protected readonly sourceName = computed(() => {
    const e = this.edge();
    return this.store.nodes().find((n) => n.id === e.sourceNodeId)?.label ?? e.sourceNodeId;
  });

  protected readonly targetName = computed(() => {
    const e = this.edge();
    return this.store.nodes().find((n) => n.id === e.targetNodeId)?.label ?? e.targetNodeId;
  });

  protected onLabelChange(label: string): void {
    this.store.updateEdge(this.edge().id, { label });
  }

  protected deleteEdge(): void {
    this.store.removeEdge(this.edge().id);
  }
}
