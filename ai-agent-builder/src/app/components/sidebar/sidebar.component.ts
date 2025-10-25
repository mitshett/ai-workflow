import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { WorkflowNode, NodeType } from '../../models/workflow.models';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { WorkflowHeaderComponent } from './workflow-header/workflow-header.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    ButtonComponent,
    IconComponent,
    SearchBarComponent,
    WorkflowHeaderComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  
  // Input from parent component
  @Input() canvasNodes: WorkflowNode[] = [];
  
  // Output events to parent component
  @Output() previewChatRequested = new EventEmitter<void>();

  // Handle publish button click
  onPublish(): void {
    // TODO: Implement publish functionality
  }

  // Handle preview chat button click
  onPreviewChat(): void {
    this.previewChatRequested.emit();
  }

  // Get drag data for CDK drag
  getDragData(nodeType: NodeType): NodeType {
    return nodeType;
  }

  // Handle drag start
  onDragStart(event: any, nodeType: NodeType): void {
    // Add visual feedback that dragging is active
    document.body.classList.add('dragging-node');
  }

  // Handle drag end
  onDragEnd(event: any): void {
    // Remove visual feedback
    document.body.classList.remove('dragging-node');
  }

}