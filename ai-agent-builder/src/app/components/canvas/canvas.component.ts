import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, Renderer2, HostListener, OnDestroy } from '@angular/core';
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
export class CanvasComponent implements OnChanges, OnDestroy {
  
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef;
  @ViewChild('canvasContent', { static: false }) canvasContent!: ElementRef;
  
  private resizeTimeout: any;

  // Pan state
  private isPanning = false;
  private wasPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  panOffsetX = 0;
  panOffsetY = 0;
  private boundOnPanMove: (e: MouseEvent) => void;
  private boundOnPanEnd: (e: MouseEvent) => void;
  
  constructor(private el: ElementRef, private renderer: Renderer2) {
    this.boundOnPanMove = this.onPanMove.bind(this);
    this.boundOnPanEnd = this.onPanEnd.bind(this);
  }
  
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
  @Input() previewMode = false;
  
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
    if (this.previewMode) return;
    if (event) {
      event.stopPropagation();
    }
    if (!this.isDragging) {
      this.nodeSelect.emit({ nodeId, event });
    }
  }
  
  // Connection selection
  selectConnection(connectionId: string, event?: MouseEvent): void {
    if (this.previewMode) return;
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
    // Don't deselect if user was panning
    if (this.wasPanning) {
      this.wasPanning = false;
      return;
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

  // Triggers change detection so connection paths update during drag
  onNodeDragMoved(): void {}
  
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
    if (this.previewMode) return;
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

    const wrapperElement = document.querySelector('.canvas-content-wrapper');
    if (!wrapperElement) return;

    const fromNode = this.canvasNodes.find(n => n.id === this.connectingFrom!.nodeId);
    if (!fromNode) return;

    const fromPoint = this.getHandlePosition(fromNode, this.connectingFrom.handleType);
    const wrapperRect = wrapperElement.getBoundingClientRect();
    const toPoint = {
      x: event.clientX - wrapperRect.left,
      y: event.clientY - wrapperRect.top
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
    const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement;
    const nodeWidth = nodeElement ? nodeElement.offsetWidth : 90;
    const nodeHeight = nodeElement ? nodeElement.offsetHeight : 36;

    // During drag, use DOM positions so lines follow the dragged node
    if (this.isCanvasNodeDragging && nodeElement) {
      const wrapperElement = document.querySelector('.canvas-content-wrapper');
      if (wrapperElement) {
        const wrapperRect = wrapperElement.getBoundingClientRect();
        const nodeRect = nodeElement.getBoundingClientRect();
        return {
          x: nodeRect.left - wrapperRect.left + (handleType === 'output' ? nodeRect.width : 0),
          y: nodeRect.top - wrapperRect.top + nodeRect.height / 2
        };
      }
    }

    // Static: calculate from model position (always in sync, no repaint dependency)
    return {
      x: node.position.x + (handleType === 'output' ? nodeWidth : 0),
      y: node.position.y + nodeHeight / 2
    };
  }

  private createBezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const controlPointOffset = Math.max(50, Math.abs(to.x - from.x) * 0.5);

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

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundOnPanMove);
    document.removeEventListener('mouseup', this.boundOnPanEnd);
  }

  // ==================== CANVAS PANNING ====================

  onPanStart(event: MouseEvent): void {
    // In preview mode: pan from anywhere (including over nodes)
    // In normal mode: only pan from canvas background (not on nodes/handles/connections)
    if (!this.previewMode) {
      const target = event.target as HTMLElement;
      if (target.closest('.canvas-node') || target.closest('.connection-handle') || target.closest('.connection-line')) {
        return;
      }
    }
    // Only left mouse button
    if (event.button !== 0) return;

    this.isPanning = true;
    this.wasPanning = false;
    this.panStartX = event.clientX - this.panOffsetX;
    this.panStartY = event.clientY - this.panOffsetY;

    // Add panning class for cursor feedback
    const canvasContent = this.canvasContainer?.nativeElement;
    if (canvasContent) {
      canvasContent.classList.add('panning');
    }

    document.addEventListener('mousemove', this.boundOnPanMove);
    document.addEventListener('mouseup', this.boundOnPanEnd);
  }

  private onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    event.preventDefault();

    this.panOffsetX = event.clientX - this.panStartX;
    this.panOffsetY = event.clientY - this.panStartY;
    this.wasPanning = true;

    this.applyPanTransform();
  }

  private onPanEnd(event: MouseEvent): void {
    if (!this.isPanning) return;
    this.isPanning = false;

    const canvasContent = this.canvasContainer?.nativeElement;
    if (canvasContent) {
      canvasContent.classList.remove('panning');
    }

    document.removeEventListener('mousemove', this.boundOnPanMove);
    document.removeEventListener('mouseup', this.boundOnPanEnd);
    // wasPanning stays true until the next click event fires onDeselectAll
  }

  private applyPanTransform(): void {
    const wrapper = this.canvasContent?.nativeElement;
    if (wrapper) {
      wrapper.style.transform = `translate(${this.panOffsetX}px, ${this.panOffsetY}px)`;
    }
  }
}