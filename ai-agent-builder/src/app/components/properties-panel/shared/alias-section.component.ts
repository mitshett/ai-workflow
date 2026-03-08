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
          <div class="alias-hint" *ngIf="selectedNode!.alias && !hasError">
            <small>Use <code>workflow.{{selectedNode!.alias}}.*</code> to reference outputs</small>
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
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      margin-bottom: 0;
    }
    
    .section-header {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding: 8px 16px 6px;
      
      h4 {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
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
          background: linear-gradient(180deg, #3b82f6, #8b5cf6);
          border-radius: 2px;
        }
      }
    }
    
    .section-content {
      padding: 6px 14px 10px;
    }

    .form-group {
      margin-bottom: 0;

      label.form-label {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 1px;
        font-size: 12px;
        font-weight: 500;
        color: #a1aab5;

        pol-icon {
          color: #60a5fa;
          font-size: 14px;
        }
      }

      pol-input-text {
        display: block;
        width: 100%;
      }

      ::ng-deep {
        .pol-input-text {
          --base-border-width: 1px;
          height: 34px;
        }

        .pol-input-text__input-element {
          font-size: 14px;
          height: 34px;
          line-height: 34px;
          padding-top: 0;
          padding-bottom: 0;
        }
      }

      .alias-hint {
        margin-top: 4px;

        small {
          font-size: 11px;
          color: #64748b;

          code {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 11px;
            color: #60a5fa;
            background: rgba(59, 130, 246, 0.1);
            padding: 1px 4px;
            border-radius: 3px;
          }
        }
      }

      .alias-error {
        margin-top: 6px;
        padding: 8px 10px;
        background: rgba(239, 68, 68, 0.05);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 6px;

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