import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, Renderer2, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { IconComponent } from '@polarity/components/icon';
import { WorkflowNode, NodeType, WorkflowConnection } from '../../models/workflow.models';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    IconComponent
  ],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.scss'
})
export class CanvasComponent implements OnChanges {
  
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef;
  @ViewChild('canvasContent', { static: false }) canvasContent!: ElementRef;
  
  private resizeTimeout: any;
  
  constructor(private el: ElementRef, private renderer: Renderer2) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    // Canvas width is controlled by CSS custom property --canvas-computed-width
    // set at the app component level
  }
  
  // private updateCanvasWidth(width: number): void {
  //   this.renderer.setStyle(this.el.nativeElement, '--canvas-width', `${width}px`);
  // }
  
  // Inputs from parent component
  @Input() canvasNodes: WorkflowNode[] = [];
  @Input() connections: WorkflowConnection[] = [];
  @Input() selectedNodeId: string | null = null;
  @Input() selectedConnectionId: string | null = null;
  @Input() isCanvasNodeDragging = false;
  @Input() isDragging = false;
  
  // Canvas dimensions
  @Input() canvasWidth = 2000;
  @Input() canvasHeight = 1500;
  
  // Connection dragging state
  @Input() isConnecting = false;
  @Input() connectingFrom: { nodeId: string; handleType: 'input' | 'output' } | null = null;
  @Input() tempConnection: { path: string } | null = null;
  
  // Output events to parent component
  @Output() canvasDrop = new EventEmitter<any>();
  @Output() nodeSelect = new EventEmitter<{nodeId: string, event?: MouseEvent}>();
  @Output() connectionSelect = new EventEmitter<{connectionId: string, event?: MouseEvent}>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() nodeDragStart = new EventEmitter<{event: any, node: WorkflowNode}>();
  @Output() nodeDragEnd = new EventEmitter<{event: any, node: WorkflowNode}>();
  @Output() connectionStart = new EventEmitter<{event: MouseEvent, nodeId: string, handleType: 'input' | 'output'}>();
  @Output() connectionCreated = new EventEmitter<WorkflowConnection>();
  @Output() connectionStateChange = new EventEmitter<{isConnecting: boolean, connectingFrom: { nodeId: string; handleType: 'input' | 'output' } | null, tempConnection: { path: string } | null}>();
  
  // CDK drag position constrainer
  constrainPosition = (point: {x: number, y: number}, dragRef: any) => {
    return point;
  };
  
  // Node selection
  selectNode(nodeId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.isDragging) {
      this.nodeSelect.emit({ nodeId, event });
    }
  }
  
  // Connection selection
  selectConnection(connectionId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.connectionSelect.emit({ connectionId, event });
  }
  
  // Deselect all
  onDeselectAll(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.deselectAll.emit();
  }
  
  // Node drag handlers
  onNodeDragStart(event: any, node: WorkflowNode): void {
    this.nodeDragStart.emit({ event, node });
  }
  
  onNodeDragEnd(event: any, node: WorkflowNode): void {
    this.nodeDragEnd.emit({ event, node });
  }
  
  // Get icon name with proper typing
  getIconName(iconName: string): any {
    return iconName as any;
  }
  
  // Get connection path - Enhanced implementation
  getConnectionPath(connection: WorkflowConnection): string {
    const sourceNode = this.canvasNodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = this.canvasNodes.find(n => n.id === connection.targetNodeId);

    if (!sourceNode || !targetNode) return '';

    const sourcePoint = this.getHandlePosition(sourceNode, 'output');
    const targetPoint = this.getHandlePosition(targetNode, 'input');

    return this.createBezierPath(sourcePoint, targetPoint);
  }
  
  // Drop list event handlers
  onDropListEntered(event: any): void {
  }
  
  onDropListExited(event: any): void {
  }
  
  // Handle drop event on canvas (only from sidebar)
  onCanvasDrop(event: any): void {
    // If a canvas node is being dragged, ignore this drop event completely
    if (this.isCanvasNodeDragging) {
      return;
    }

    // Forward the entire drop event to the parent app component
    // The parent will handle the actual node creation
    this.canvasDrop.emit(event);
  }
  
  // ==================== CONNECTION MANAGEMENT METHODS ====================
  
  // Start connection from a node handle
  startConnection(event: MouseEvent, nodeId: string, handleType: 'input' | 'output'): void {
    event.preventDefault();
    event.stopPropagation();

    // Update connection state and notify parent
    const newState = {
      isConnecting: true,
      connectingFrom: { nodeId, handleType },
      tempConnection: null
    };
    
    this.connectionStateChange.emit(newState);

    // Add mouse move and mouse up listeners
    document.addEventListener('mousemove', this.onConnectionDrag.bind(this));
    document.addEventListener('mouseup', this.endConnection.bind(this));

  }

  private onConnectionDrag(event: MouseEvent): void {
    if (!this.isConnecting || !this.connectingFrom) return;

    const canvasContentRect = document.querySelector('.canvas-content')?.getBoundingClientRect();
    if (!canvasContentRect) return;

    const fromNode = this.canvasNodes.find(n => n.id === this.connectingFrom!.nodeId);
    if (!fromNode) return;

    const fromPoint = this.getHandlePosition(fromNode, this.connectingFrom.handleType);
    const toPoint = {
      x: event.clientX - canvasContentRect.left,
      y: event.clientY - canvasContentRect.top
    };

    const tempConnection = {
      path: this.createBezierPath(fromPoint, toPoint)
    };

    // Update connection state and notify parent
    const newState = {
      isConnecting: this.isConnecting,
      connectingFrom: this.connectingFrom,
      tempConnection
    };
    
    this.connectionStateChange.emit(newState);

  }

  private endConnection(event: MouseEvent): void {
    document.removeEventListener('mousemove', this.onConnectionDrag.bind(this));
    document.removeEventListener('mouseup', this.endConnection.bind(this));

    if (!this.isConnecting || !this.connectingFrom) {
      this.resetConnectionState();
      return;
    }

    // Check if we're over a connection handle
    const targetElement = event.target as HTMLElement;
    const handleElement = targetElement.closest('.connection-handle');

    if (handleElement) {
      const targetNodeId = handleElement.getAttribute('data-node-id');
      const targetHandleType = handleElement.getAttribute('data-handle-type') as 'input' | 'output';

      if (targetNodeId && this.canConnectNodes(this.connectingFrom, { nodeId: targetNodeId, handleType: targetHandleType })) {
        this.createConnection(this.connectingFrom, { nodeId: targetNodeId, handleType: targetHandleType });
      }
    }

    this.resetConnectionState();
  }

  private canConnectNodes(from: { nodeId: string; handleType: 'input' | 'output' }, to: { nodeId: string; handleType: 'input' | 'output' }): boolean {
    // Cannot connect to the same node
    if (from.nodeId === to.nodeId) return false;

    // Must connect output to input
    if (!(from.handleType === 'output' && to.handleType === 'input')) return false;

    // Check if connection already exists
    const existingConnection = this.connections.find(conn =>
      conn.sourceNodeId === from.nodeId && conn.targetNodeId === to.nodeId
    );

    return !existingConnection;
  }

  private createConnection(from: { nodeId: string; handleType: 'input' | 'output' }, to: { nodeId: string; handleType: 'input' | 'output' }): void {
    const connection: WorkflowConnection = {
      id: this.generateConnectionId(),
      sourceNodeId: from.nodeId,
      targetNodeId: to.nodeId,
      sourceHandle: 'output',
      targetHandle: 'input'
    };

    // Emit to parent to add the connection (since we don't directly modify the array)
    this.connectionCreated.emit(connection);
  }

  private generateConnectionId(): string {
    return 'conn_' + Math.random().toString(36).substr(2, 9);
  }

  private resetConnectionState(): void {
    const newState = {
      isConnecting: false,
      connectingFrom: null,
      tempConnection: null
    };
    
    this.connectionStateChange.emit(newState);
  }

  getHandlePosition(node: WorkflowNode, handleType: 'input' | 'output'): { x: number; y: number } {
    // Find the actual DOM element for this node
    const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!nodeElement) {
      // Fallback to model position if element not found
      const nodeWidth = 120;
      const nodeHeight = 50;
      return {
        x: node.position.x + (handleType === 'output' ? nodeWidth : 0),
        y: node.position.y + nodeHeight / 2
      };
    }

    const canvasContentElement = document.querySelector('.canvas-content');
    if (!canvasContentElement) {
      // Fallback if canvas content not found
      const nodeWidth = 120;
      const nodeHeight = 50;
      return {
        x: node.position.x + (handleType === 'output' ? nodeWidth : 0),
        y: node.position.y + nodeHeight / 2
      };
    }

    // Calculate position based on actual DOM element position relative to canvas-content
    const canvasContentRect = canvasContentElement.getBoundingClientRect();
    const nodeRect = nodeElement.getBoundingClientRect();

    const relativeX = nodeRect.left - canvasContentRect.left;
    const relativeY = nodeRect.top - canvasContentRect.top;

    return {
      x: relativeX + (handleType === 'output' ? nodeRect.width : 0),
      y: relativeY + nodeRect.height / 2
    };
  }

  private createBezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const controlPointOffset = Math.abs(to.x - from.x) * 0.5;

    const cp1x = from.x + controlPointOffset;
    const cp1y = from.y;
    const cp2x = to.x - controlPointOffset;
    const cp2y = to.y;

    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  }

  // Handle window resize events (basic version)
  @HostListener('window:resize', ['$event'])
  onWindowResize(): void {
    // Basic debounced resize handler
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = setTimeout(() => {
      // Just log for now - no zoom adjustments
      console.log('Canvas window resized');
    }, 150);
  }
}