import { Component, Output, EventEmitter } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { NodeType } from '../../../../models/workflow.models';

@Component({
  selector: 'app-agent-node',
  standalone: true,
  imports: [
    DragDropModule,
    ButtonComponent,
    IconComponent
  ],
  templateUrl: './agent-node.component.html',
  styleUrl: './agent-node.component.scss'
})
export class AgentNodeComponent {
  
  // Node properties
  readonly nodeType: NodeType = 'agent';
  readonly iconName = 'robot';
  readonly label = 'Agent';
  
  // Output events
  @Output() nodeDragStart = new EventEmitter<{event: any, nodeType: NodeType}>();
  @Output() nodeDragEnd = new EventEmitter<any>();
  
  // Get drag data for this node
  getDragData(): NodeType {
    return this.nodeType;
  }
  
  // Handle drag start
  onDragStart(event: any): void {
    console.log('Agent node drag started');
    document.body.classList.add('dragging-node');
    this.nodeDragStart.emit({ event, nodeType: this.nodeType });
  }
  
  // Handle drag end
  onDragEnd(event: any): void {
    console.log('Agent node drag ended');
    document.body.classList.remove('dragging-node');
    this.nodeDragEnd.emit(event);
  }
}