import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';

@Component({
  selector: 'app-workflow-header',
  standalone: true,
  imports: [
    ButtonComponent,
    IconComponent
  ],
  templateUrl: './workflow-header.component.html',
  styleUrl: './workflow-header.component.scss'
})
export class WorkflowHeaderComponent {
  
  // Input properties
  @Input() workflowTitle: string = 'Untitled Workflow';
  
  // Output events
  @Output() publishClicked = new EventEmitter<void>();
  @Output() previewClicked = new EventEmitter<void>();
  
  // Handle publish button click
  onPublish(): void {
    this.publishClicked.emit();
  }
  
  // Handle preview button click
  onPreview(): void {
    this.previewClicked.emit();
  }
}