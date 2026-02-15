import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextComponent } from '@polarity/components/input-text';
import { IconComponent } from '@polarity/components/icon';
import { WorkflowNode } from '../../../models/workflow.models';

@Component({
  selector: 'app-alias-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextComponent,
    IconComponent
  ],
  template: `
    <div class="property-section alias-section">
      <div class="section-header">
        <h4>Variable Access</h4>
      </div>
      <div class="section-content">
        <div class="form-group">
          <label for="node-alias" class="form-label">
            <pol-icon iconName="tag" size="small"></pol-icon>
            Alias *
          </label>
          <pol-input-text 
            id="node-alias"
            [(ngModel)]="selectedNode!.alias"
            (ngModelChange)="aliasChange.emit($event)"
            [placeholder]="placeholder"
            [class.error]="hasError">
          </pol-input-text>
          <div class="alias-preview" *ngIf="selectedNode!.alias && !hasError">
            <small>Variables: <code>workflow.{{selectedNode!.alias}}.*</code></small>
          </div>
          <div class="alias-error" *ngIf="hasError">
            <small class="error-text">{{errorMessage}}</small>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .property-section.alias-section {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%);
      border: 1px solid rgba(59, 130, 246, 0.1);
      border-radius: 12px;
      margin-bottom: 12px;
    }
    
    .section-header {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      border-bottom: 1px solid rgba(59, 130, 246, 0.15);
      padding: 12px 16px 8px;
      
      h4 {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        color: #60a5fa;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        position: relative;
        padding-left: 12px;
        
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 12px;
          background: linear-gradient(180deg, #3b82f6, #06b6d4);
          border-radius: 2px;
        }
      }
    }
    
    .section-content {
      padding: 14px 16px 16px;
    }

    .form-group {
      margin-bottom: 0;

      label.form-label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;

        pol-icon {
          color: #60a5fa;
          font-size: 16px;
        }
      }

      pol-input-text {
        display: block;
        width: 100%;
      }

      .alias-preview {
        margin-top: 6px;
        padding: 8px 10px;
        background: rgba(34, 197, 94, 0.05);
        border: 1px solid rgba(34, 197, 94, 0.2);
        border-radius: 6px;

        small {
          font-size: 12px;
          color: #10b981;
          font-weight: 500;

          code {
            background: rgba(34, 197, 94, 0.1);
            color: #059669;
            padding: 3px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 11px;
            border: 1px solid rgba(34, 197, 94, 0.3);
          }
        }
      }

      .alias-error {
        margin-top: 8px;
        padding: 10px 12px;
        background: rgba(239, 68, 68, 0.05);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 8px;

        .error-text {
          font-size: 12px;
          color: #ef4444;
          font-weight: 500;
        }
      }

      &.error {
        pol-input-text {
          ::ng-deep input {
            border-color: #ef4444;
            box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
          }
        }
      }
    }
  `]
})
export class AliasSectionComponent {
  @Input() selectedNode!: WorkflowNode;
  @Input() placeholder: string = 'e.g., node_alias';
  @Input() hasError: boolean = false;
  @Input() errorMessage: string = '';
  
  @Output() aliasChange = new EventEmitter<string>();
}