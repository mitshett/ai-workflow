import { Component, HostListener, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '@polarity/components/header';
import { ButtonComponent } from '@polarity/components/button';
import { HeaderUtilityButtonComponent } from '@polarity/components/header';
import { IconComponent } from '@polarity/components/icon';
import { InputTextComponent } from '@polarity/components/input-text';
import { WorkflowNode, NodeTemplate, NodeType, WorkflowConnection, AgentConfig, Tool, JsonSchema, SchemaProperty, ChatMessage } from './models/workflow.models';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CanvasComponent } from './components/canvas/canvas.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { PreviewWorkflowComponent } from './components/preview-workflow/preview-workflow.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    HttpClientModule,
    HeaderComponent,
    ButtonComponent,
    HeaderUtilityButtonComponent,
    IconComponent,
    InputTextComponent,
    SidebarComponent,
    CanvasComponent,
    PropertiesPanelComponent,
    PreviewWorkflowComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'AI Agent Builder';

  constructor(private http: HttpClient, private el: ElementRef, private renderer: Renderer2) {
  }

  // Canvas nodes and connections state
  canvasNodes: WorkflowNode[] = [];
  connections: WorkflowConnection[] = [];

  // Canvas dimensions
  private originalCanvasWidth = 2000;
  canvasWidth = 2000;
  canvasHeight = 1500;
  private propertiesPanelWidth = 340; // Properties panel width (matches CSS)
  private previewPanelWidth = 400; // Preview panel width

  // Canvas node dragging state - to disable drop zone during internal drags
  isCanvasNodeDragging = false;

  // Track if we're currently dragging to prevent click events
  isDragging = false;


  // Selection state for nodes and connections
  selectedNodeId: string | null = null;
  selectedConnectionId: string | null = null;

  // Connection dragging state
  isConnecting = false;
  connectingFrom: { nodeId: string; handleType: 'input' | 'output' } | null = null;
  tempConnection: { path: string } | null = null;

  // JSON Schema modal state
  showJsonSchemaModal = false;
  currentJsonSchema: JsonSchema = {
    name: 'response_schema',
    properties: []
  };
  schemaMode: 'simple' | 'advanced' = 'simple';
  newEnumValue = '';

  // Preview workflow state
  showPreviewWorkflow = false;
  showPreviewWorkflowVisual = false; // Controls visual display with delay



  // Node templates configuration
  nodeTemplates: NodeTemplate[] = [
    {
      type: 'start',
      label: 'Start',
      icon: 'play-circle',
      color: '#22c55e',
      description: 'Start workflow execution'
    },
    {
      type: 'agent',
      label: 'Agent',
      icon: 'robot',
      color: '#3b82f6',
      description: 'AI agent processing node'
    },
    {
      type: 'end',
      label: 'End',
      icon: 'stop-circle',
      color: '#ef4444',
      description: 'End workflow execution'
    },
    {
      type: 'mcp',
      label: 'MCP',
      icon: 'lightning',
      color: '#8b5cf6',
      description: 'Model Context Protocol integration'
    },
    {
      type: 'if-else',
      label: 'If / else',
      icon: 'flow-arrow',
      color: '#06b6d4',
      description: 'Conditional logic branching'
    },
    {
      type: 'sequential',
      label: 'Sequential',
      icon: 'minus',
      color: '#06b6d4',
      description: 'Execute tasks in sequence'
    },
    {
      type: 'parallel',
      label: 'Parallel',
      icon: 'list',
      color: '#06b6d4',
      description: 'Execute tasks in parallel'
    }
  ];

  // Get template by node type
  getNodeTemplate(type: NodeType): NodeTemplate {
    return this.nodeTemplates.find(t => t.type === type) || this.nodeTemplates[0];
  }

  // Generate unique ID for nodes
  private generateNodeId(): string {
    return 'node_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate unique alias for nodes based on type
  private generateUniqueAlias(nodeType: NodeType): string {
    const baseAliases: Record<NodeType, string> = {
      'start': 'start',
      'agent': 'agent',
      'end': 'end', 
      'mcp': 'tool',
      'if-else': 'condition',
      'sequential': 'sequence',
      'parallel': 'parallel'
    };

    const baseAlias = baseAliases[nodeType] || 'node';
    let alias = baseAlias;
    let counter = 1;

    // Find a unique alias by appending numbers
    while (this.isAliasInUse(alias)) {
      alias = `${baseAlias}${counter}`;
      counter++;
    }

    return alias;
  }

  // Check if alias is already in use
  private isAliasInUse(alias: string): boolean {
    return this.canvasNodes.some(node => node.alias === alias);
  }

  // Validate alias format and uniqueness
  validateAlias(alias: string, currentNodeId?: string): { valid: boolean; error?: string } {
    // Check required
    if (!alias || alias.trim().length === 0) {
      return { valid: false, error: 'Alias is required' };
    }

    alias = alias.trim().toLowerCase();

    // Check format (lowercase letters, numbers, underscores only)
    const aliasPattern = /^[a-z][a-z0-9_]*$/;
    if (!aliasPattern.test(alias)) {
      return { valid: false, error: 'Alias must start with a letter and contain only lowercase letters, numbers, and underscores' };
    }

    // Check length
    if (alias.length < 2 || alias.length > 20) {
      return { valid: false, error: 'Alias must be 2-20 characters long' };
    }

    // Check reserved words
    const reservedWords = ['input', 'output', 'workflow', 'runtime', 'system'];
    if (reservedWords.includes(alias)) {
      return { valid: false, error: 'This alias is reserved and cannot be used' };
    }

    // Check uniqueness (exclude current node if editing)
    const existingNode = this.canvasNodes.find(node => node.alias === alias);
    if (existingNode && existingNode.id !== currentNodeId) {
      return { valid: false, error: 'This alias is already in use by another node' };
    }

    return { valid: true };
  }

  // Sanitize and suggest alias from text
  sanitizeAlias(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_')        // Replace spaces with underscores
      .replace(/^[^a-z]+/, '')     // Remove leading non-letters
      .substring(0, 20)            // Limit length
      .replace(/_+$/, '');         // Remove trailing underscores
  }

  // CDK drag position constrainer to prevent drift
  constrainPosition = (point: {x: number, y: number}, dragRef: any) => {
    // Allow free movement within canvas bounds
    return point;
  };

  // Handle drop event on canvas (only from sidebar)
  onCanvasDrop(event: any): void {
    console.log('Canvas drop event:', {
      item: event.item,
      container: event.container,
      currentIndex: event.currentIndex,
      data: event.item?.data
    });

    // If a canvas node is being dragged, ignore this drop event completely
    if (this.isCanvasNodeDragging) {
      return;
    }

    // This should only be external drops from sidebar now
    const nodeType = event.item.data as NodeType;
    const template = this.getNodeTemplate(nodeType);

    // Get the canvas content element for position calculation
    const canvasContent = document.querySelector('.canvas-content');
    if (!canvasContent) {
      console.error('Canvas content not found');
      return;
    }

    // Get drop position - calculate from the drop event
    let x = 100; // Default position
    let y = 100; // Default position

    // Try different ways to get the drop position
    if (event.dropPoint) {
      const canvasRect = canvasContent.getBoundingClientRect();
      x = event.dropPoint.x - canvasRect.left - 50; // Center node
      y = event.dropPoint.y - canvasRect.top - 25; // Center node
    } else if (event.event) {
      // Use the underlying mouse event
      const canvasRect = canvasContent.getBoundingClientRect();
      x = event.event.clientX - canvasRect.left - 50; // Center node
      y = event.event.clientY - canvasRect.top - 25; // Center node
    } else {
      // Generate a semi-random position to avoid overlap
      const nodeCount = this.canvasNodes.length;
      x = 100 + (nodeCount * 20) % 400;
      y = 100 + Math.floor(nodeCount / 20) * 80;
    }

    // Ensure position is within reasonable bounds
    x = Math.max(10, Math.min(x, 800));
    y = Math.max(10, Math.min(y, 600));

    // Create new workflow node
    const newNode: WorkflowNode = {
      id: this.generateNodeId(),
      type: nodeType,
      label: template.label,
      alias: this.generateUniqueAlias(nodeType),
      icon: template.icon,
      position: { x, y },
      data: {}
    };

    // Add to canvas nodes
    this.canvasNodes.push(newNode);
  }

  // Handle node updates from properties panel
  onNodeUpdated(updatedNode: WorkflowNode): void {
    const index = this.canvasNodes.findIndex(node => node.id === updatedNode.id);
    if (index !== -1) {
      this.canvasNodes[index] = { ...updatedNode };
    }
  }

  // Get drag data for node type
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

  // Get icon name with proper typing
  getIconName(iconName: string): any {
    return iconName as any;
  }

  // Connection handling methods
  startConnection(event: MouseEvent, nodeId: string, handleType: 'input' | 'output'): void {
    event.preventDefault();
    event.stopPropagation();

    this.isConnecting = true;
    this.connectingFrom = { nodeId, handleType };

    // Add mouse move and mouse up listeners
    document.addEventListener('mousemove', this.onConnectionDrag.bind(this));
    document.addEventListener('mouseup', this.endConnection.bind(this));
  }

  onConnectionDrag(event: MouseEvent): void {
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

    this.tempConnection = {
      path: this.createBezierPath(fromPoint, toPoint)
    };

  }

  endConnection(event: MouseEvent): void {
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

  canConnectNodes(from: { nodeId: string; handleType: 'input' | 'output' }, to: { nodeId: string; handleType: 'input' | 'output' }): boolean {
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

  createConnection(from: { nodeId: string; handleType: 'input' | 'output' }, to: { nodeId: string; handleType: 'input' | 'output' }): void {
    const connection: WorkflowConnection = {
      id: this.generateConnectionId(),
      sourceNodeId: from.nodeId,
      targetNodeId: to.nodeId,
      sourceHandle: 'output',
      targetHandle: 'input'
    };

    this.connections.push(connection);
    console.log('Created connection:', connection);
  }

  private generateConnectionId(): string {
    return 'conn_' + Math.random().toString(36).substr(2, 9);
  }

  // Handle connection created from canvas component
  onConnectionCreated(connection: WorkflowConnection): void {
    console.log('Connection created:', connection);
    this.connections.push(connection);
    this.resetConnectionState();
  }

  // Handle connection state changes from canvas component
  onConnectionStateChange(state: {isConnecting: boolean, connectingFrom: { nodeId: string; handleType: 'input' | 'output' } | null, tempConnection: { path: string } | null}): void {
    this.isConnecting = state.isConnecting;
    this.connectingFrom = state.connectingFrom;
    this.tempConnection = state.tempConnection;
  }

  private resetConnectionState(): void {
    this.isConnecting = false;
    this.connectingFrom = null;
    this.tempConnection = null;
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

  getConnectionPath(connection: WorkflowConnection): string {
    const sourceNode = this.canvasNodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = this.canvasNodes.find(n => n.id === connection.targetNodeId);

    if (!sourceNode || !targetNode) return '';

    const sourcePoint = this.getHandlePosition(sourceNode, 'output');
    const targetPoint = this.getHandlePosition(targetNode, 'input');

    return this.createBezierPath(sourcePoint, targetPoint);
  }

  private createBezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const controlPointOffset = Math.abs(to.x - from.x) * 0.5;

    const cp1x = from.x + controlPointOffset;
    const cp1y = from.y;
    const cp2x = to.x - controlPointOffset;
    const cp2y = to.y;

    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  }

  // Node dragging functionality
  onNodeDragStart(event: any, node: WorkflowNode): void {
    console.group('🎯 DRAG START for node:', node.id);

    // IMMEDIATELY disable drop zone to prevent interference
    this.isCanvasNodeDragging = true;
    this.isDragging = true; // Prevent click events during drag

    // Get the element and log its initial state
    const element = event.source.element.nativeElement;
    const canvasContentElement = document.querySelector('.canvas-content');

    console.log('📍 Node position in model:', node.position);

    if (canvasContentElement) {
      const canvasContentRect = canvasContentElement.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calculate where the element actually is relative to canvas-content
      const actualRelativeX = elementRect.left - canvasContentRect.left;
      const actualRelativeY = elementRect.top - canvasContentRect.top;

      console.log('🔍 POSITION MISMATCH CHECK:');
      console.log('   Model position:', node.position);
      console.log('   Actual DOM position relative to canvas:', { x: actualRelativeX, y: actualRelativeY });
      console.log('   Difference X:', actualRelativeX - node.position.x, 'Y:', actualRelativeY - node.position.y);

      // If there's a significant mismatch, this explains the "jump"
      const deltaX = Math.abs(actualRelativeX - node.position.x);
      const deltaY = Math.abs(actualRelativeY - node.position.y);

      if (deltaX > 5 || deltaY > 5) {
        console.warn('⚠️ SIGNIFICANT POSITION MISMATCH DETECTED!');
        console.warn('   This will cause the "jump down" behavior you see');
        console.warn('   Delta X:', deltaX, 'Delta Y:', deltaY);
      }
    }


    // Don't override CSS cursor - the CSS already handles grab/grabbing with !important
    // The .cdk-drag-dragging class will automatically apply grabbing cursor



    console.groupEnd();
  }

  onNodeDragEnd(event: any, node: WorkflowNode): void {

    // Re-enable drop zone only
    this.isCanvasNodeDragging = false;
    this.isDragging = false;

  }

  private resetElementDragState(element: HTMLElement, node: WorkflowNode): void {
    console.group('🔄 RESET ELEMENT STATE for node:', node.id);



    // Clear all CDK transforms and positioning
    element.style.transform = '';
    element.style.transformOrigin = '';

    // Force absolute positioning update
    element.style.left = node.position.x + 'px';
    element.style.top = node.position.y + 'px';
    element.style.position = 'absolute';

    console.log('📍 Setting element position to:', { x: node.position.x, y: node.position.y });

    // Remove any drag-related classes
    const classesRemoved = [];
    if (element.classList.contains('cdk-drag-dragging')) {
      element.classList.remove('cdk-drag-dragging');
      classesRemoved.push('cdk-drag-dragging');
    }
    if (element.classList.contains('cdk-drag-preview')) {
      element.classList.remove('cdk-drag-preview');
      classesRemoved.push('cdk-drag-preview');
    }
    if (element.classList.contains('node-drag-preview')) {
      element.classList.remove('node-drag-preview');
      classesRemoved.push('node-drag-preview');
    }
    if (element.classList.contains('cdk-drag-animating')) {
      element.classList.remove('cdk-drag-animating');
      classesRemoved.push('cdk-drag-animating');
    }


    // CRITICAL FIX: Don't override CSS cursor - let CSS handle it
    // Remove any inline cursor that might conflict with CSS !important
    element.style.removeProperty('cursor');

    // Clear any cursor styles on child elements
    const childElements = element.querySelectorAll('*');
    childElements.forEach(child => {
      if (child instanceof HTMLElement) {
        child.style.removeProperty('cursor');
      }
    });


    // Force DOM update and reflow
    element.offsetHeight;

    // CRITICAL: After reflow, sync model position with actual DOM position
    setTimeout(() => {
      const canvasContentElement = document.querySelector('.canvas-content');
      if (canvasContentElement) {
        const canvasContentRect = canvasContentElement.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Get the actual position where the element ended up
        const actualX = elementRect.left - canvasContentRect.left;
        const actualY = elementRect.top - canvasContentRect.top;

        console.log('   Model position:', node.position);
        console.log('   Actual DOM position:', { x: actualX, y: actualY });

        // If there's a mismatch, update the model to match DOM
        const deltaX = Math.abs(actualX - node.position.x);
        const deltaY = Math.abs(actualY - node.position.y);

        if (deltaX > 5 || deltaY > 5) {
          console.warn('⚠️ SYNCING MODEL TO ACTUAL DOM POSITION');
          node.position.x = actualX;
          node.position.y = actualY;
        }

      }
    }, 0);


    console.groupEnd();
  }


  // ===============================
  // SELECTION AND DELETION SYSTEM
  // ===============================

  // Node selection methods
  selectNode(nodeId: string, event?: MouseEvent): void {
    // Prevent selection during drag operations
    if (this.isDragging) {
      return;
    }

    if (event) {
      event.stopPropagation(); // Prevent canvas deselection
    }

    this.selectedNodeId = nodeId;
    this.selectedConnectionId = null; // Clear connection selection

    // Adjust canvas width to accommodate properties panel
    this.adjustCanvasForPropertiesPanel(true);

    // Initialize data based on node type
    const selectedNode = this.getSelectedNode();
    if (selectedNode && selectedNode.type === 'mcp') {
      this.ensureMCPData(selectedNode);
    }

  }

  // Connection line selection
  selectConnection(connectionId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    this.selectedConnectionId = connectionId;
    this.selectedNodeId = null; // Clear node selection
  }

  // Close properties panel (dedicated method like preview workflow)
  closePropertiesPanel(): void {
    console.log('🔥 CLOSE PROPERTIES PANEL - DEDICATED METHOD CALLED!!!');
    this.selectedNodeId = null;
    this.selectedConnectionId = null;
    this.adjustCanvasForPropertiesPanel(false);
    console.log('✅ Properties panel closed via dedicated method');
  }

  // Clear all selections
  deselectAll(event?: MouseEvent): void {

    console.log('🔥 DESELECT ALL CALLED FROM PROPERTIES PANEL!!! deselectAll() called - clearing all selections', {
      currentSelectedNode: this.selectedNodeId,
      currentSelectedConnection: this.selectedConnectionId,
      event: event ? {
        type: event.type,
        target: event.target,
        currentTarget: event.currentTarget,
        clientX: event.clientX,
        clientY: event.clientY
      } : 'no event (called programmatically)'
    });

    console.log('🔴 Setting selectedNodeId from', this.selectedNodeId, 'to null');
    this.selectedNodeId = null;
    this.selectedConnectionId = null;

    // Restore canvas to original width when properties panel closes
    this.adjustCanvasForPropertiesPanel(false);
    
    console.log('✅ Properties panel should now be hidden');

  }

  // Keyboard event handler
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    console.log('🎹 KEY PRESSED:', event.key, {
      selectedNodeId: this.selectedNodeId,
      selectedConnectionId: this.selectedConnectionId,
      target: event.target
    });

    // Check if user is typing in a form field
    const target = event.target as HTMLElement;
    const isTypingInForm = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select')
    );

    switch(event.key) {
      case 'Delete':
      case 'Backspace': // Mac users expect backspace to delete
        // Only handle delete/backspace if NOT typing in a form field
        if (!isTypingInForm) {
          if (this.selectedNodeId) {
            this.deleteSelectedNode();
            event.preventDefault();
          } else if (this.selectedConnectionId) {
            this.deleteSelectedConnection();
            event.preventDefault();
          } else {
          }
        } else {
          console.log('🔤 Backspace in form field - allowing normal text editing');
        }
        break;
      case 'Escape':
        // Only deselect if NOT in a form field (let form fields handle escape normally)
        if (!isTypingInForm) {
          this.deselectAll();
        } else {
          console.log('🔤 Escape in form field - allowing normal form behavior');
        }
        break;
      default:
        console.log('🎹 Other key pressed:', event.key);
    }
  }

  // Delete selected node and all its connections
  deleteSelectedNode(): void {

    if (!this.selectedNodeId) {
      console.log('❌ No selected node to delete');
      return;
    }


    // Find and remove all connections involving this node
    const removedConnections = this.connections.filter(conn =>
      conn.sourceNodeId === this.selectedNodeId ||
      conn.targetNodeId === this.selectedNodeId
    );

    console.log('🔗 Connections to remove:', removedConnections);

    this.connections = this.connections.filter(conn =>
      conn.sourceNodeId !== this.selectedNodeId &&
      conn.targetNodeId !== this.selectedNodeId
    );

    // Remove the node
    const nodesBefore = this.canvasNodes.length;
    this.canvasNodes = this.canvasNodes.filter(node =>
      node.id !== this.selectedNodeId
    );
    const nodesAfter = this.canvasNodes.length;

    this.selectedNodeId = null;
  }

  // Delete only the selected connection line
  deleteSelectedConnection(): void {

    if (!this.selectedConnectionId) {
      console.log('❌ No selected connection to delete');
      return;
    }


    const connectionsBefore = this.connections.length;
    this.connections = this.connections.filter(conn =>
      conn.id !== this.selectedConnectionId
    );
    const connectionsAfter = this.connections.length;

    this.selectedConnectionId = null;
  }

  // Helper method to adjust canvas width based on properties panel state
  private adjustCanvasForPropertiesPanel(isPropertiesPanelOpen: boolean): void {
    console.log('⚙️ ADJUST CANVAS FOR PROPERTIES PANEL');
    console.log('  - isPropertiesPanelOpen =', isPropertiesPanelOpen);
    console.log('  - showPreviewWorkflow =', this.showPreviewWorkflow);
    
    let cssValue = '';
    
    if (isPropertiesPanelOpen) {
      // Properties panel is open - check if preview panel is also open
      if (this.showPreviewWorkflow) {
        // Both panels open: sidebar (300px) + properties (340px + margin) + preview (400px)
        cssValue = `calc(100vw - 300px - ${this.propertiesPanelWidth}px - ${this.previewPanelWidth}px - 2rem)`;
        console.log('  - Case: BOTH PANELS OPEN');
      } else {
        // Only properties panel open: sidebar (300px) + properties (340px + margin)
        cssValue = `calc(100vw - 300px - ${this.propertiesPanelWidth}px - 2rem)`;
        console.log('  - Case: ONLY PROPERTIES PANEL OPEN');
      }
    } else {
      // Properties panel closed - check if preview panel is open
      if (this.showPreviewWorkflow) {
        // Only preview panel open: sidebar (300px) + preview (400px)
        cssValue = `calc(100vw - 300px - ${this.previewPanelWidth}px)`;
        console.log('  - Case: ONLY PREVIEW PANEL OPEN');
      } else {
        // Both panels closed: only sidebar (300px)
        cssValue = 'calc(100vw - 300px)';
        console.log('  - Case: BOTH PANELS CLOSED');
      }
    }
    
    console.log('  - Setting --canvas-computed-width to:', cssValue);
    
    // Try multiple methods to set the CSS variable
    this.renderer.setStyle(document.documentElement, '--canvas-computed-width', cssValue);
    
    // Also try direct DOM manipulation as backup
    document.documentElement.style.setProperty('--canvas-computed-width', cssValue);
    
    console.log('  - CSS variable set via both renderer and direct DOM');
    
    // Also log the current computed style to verify it was applied
    setTimeout(() => {
      const computedValue = getComputedStyle(document.documentElement).getPropertyValue('--canvas-computed-width');
      console.log('  - Verified CSS value set to:', computedValue);
      
      // Also check if the canvas component is getting the variable
      const canvasElement = document.querySelector('app-canvas');
      if (canvasElement) {
        const canvasComputedStyle = getComputedStyle(canvasElement);
        const canvasWidth = canvasComputedStyle.width;
        console.log('  - Canvas element actual width:', canvasWidth);
        console.log('  - Canvas element computed --canvas-computed-width:', canvasComputedStyle.getPropertyValue('--canvas-computed-width'));
        
        // Debug canvas positioning
        const canvasRect = canvasElement.getBoundingClientRect();
        console.log('  - Canvas element position:', { top: canvasRect.top, left: canvasRect.left, right: canvasRect.right });
        
        // Check canvas-content positioning
        const canvasContent = document.querySelector('.canvas-content');
        if (canvasContent) {
          const contentRect = canvasContent.getBoundingClientRect();
          console.log('  - Canvas-content position:', { top: contentRect.top, left: contentRect.left, right: contentRect.right });
        }
      } else {
        console.log('  - Canvas element not found!');
      }
    }, 100);
  }


  // ===============================
  // PROPERTIES PANEL METHODS
  // ===============================

  // Get the currently selected node
  getSelectedNode(): WorkflowNode | null {
    if (!this.selectedNodeId) return null;
    return this.canvasNodes.find(node => node.id === this.selectedNodeId) || null;
  }

  // Initialize node data structure if it doesn't exist
  private ensureNodeData(node: WorkflowNode): void {
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.inputVariables) {
      node.data.inputVariables = [];
    }
    if (!node.data.stateVariables) {
      node.data.stateVariables = [];
    }
  }

  // Add input variable
  addInputVariable(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;

    this.ensureNodeData(selectedNode);
    selectedNode.data!.inputVariables!.push({
      name: '',
      type: 'string'
    });

    console.log('Added input variable to node:', selectedNode.id);
  }

  // Remove input variable
  removeInputVariable(index: number): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.inputVariables) return;

    selectedNode.data.inputVariables.splice(index, 1);
    console.log('Removed input variable at index:', index);
  }

  // Add state variable
  addStateVariable(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;

    this.ensureNodeData(selectedNode);
    selectedNode.data!.stateVariables!.push({
      name: '',
      type: 'string'
    });

    console.log('Added state variable to node:', selectedNode.id);
  }

  // Remove state variable
  removeStateVariable(index: number): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.stateVariables) return;

    selectedNode.data.stateVariables.splice(index, 1);
    console.log('Removed state variable at index:', index);
  }

  // ===============================
  // AGENT CONFIGURATION METHODS
  // ===============================


  // Initialize MCP data structure if it doesn't exist
  private ensureMCPData(node: WorkflowNode): void {
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.mcpConfig) {
      node.data.mcpConfig = {
        name: node.label,
        description: 'MCP tool integration',
        server: {
          type: 'http',
          url: 'http://localhost:8080',
          timeout: 30
        },
        toolName: '',
        toolArguments: {},
        timeout: 60,
        retryAttempts: 3,
        availableTools: []
      };
    }
  }

  // Tool management
  addTool(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    // For now, add a placeholder tool - in a real app, this would open a tool selector
    const newTool: Tool = {
      id: this.generateToolId(),
      name: 'New Tool',
      description: 'Tool description',
      enabled: true
    };

    selectedNode.data!.agentConfig!.tools!.push(newTool);
    console.log('Added tool to agent:', newTool);
  }

  removeTool(index: number): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.agentConfig?.tools) return;

    selectedNode.data.agentConfig.tools.splice(index, 1);
    console.log('Removed tool at index:', index);
  }

  private generateToolId(): string {
    return 'tool_' + Math.random().toString(36).substr(2, 9);
  }

  // Agent state variable management
  addAgentStateVariable(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    selectedNode.data!.agentConfig!.stateVariables!.push({
      name: '',
      type: 'string',
      description: ''
    });

    console.log('Added agent state variable to node:', selectedNode.id);
  }

  removeAgentStateVariable(index: number): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.agentConfig?.stateVariables) return;

    // Prevent removing the required user_request variable
    const variable = selectedNode.data.agentConfig.stateVariables[index];
    if (variable && variable.name === 'user_request') {
      alert('Cannot remove the required user_request variable. This variable is needed to pass user input to the agent.');
      return;
    }

    selectedNode.data.agentConfig.stateVariables.splice(index, 1);
    console.log('Removed agent state variable at index:', index);
  }

  // Output format handling
  onOutputFormatChange(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    const outputFormat = selectedNode.data!.agentConfig!.outputFormat;

    console.log('Output format changed to:', outputFormat);

    // Clear JSON schema if switching away from JSON
    if (outputFormat !== 'json') {
      selectedNode.data!.agentConfig!.jsonSchema = undefined;
    }
  }

  // JSON Schema management
  setupJsonSchema(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    // Initialize new schema
    this.currentJsonSchema = {
      name: 'response_schema',
      properties: []
    };

    this.showJsonSchemaModal = true;
  }

  editJsonSchema(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.agentConfig?.jsonSchema) return;

    // Load existing schema for editing
    this.currentJsonSchema = JSON.parse(JSON.stringify(selectedNode.data.agentConfig.jsonSchema));
    this.showJsonSchemaModal = true;
  }

  closeJsonSchemaModal(): void {
    this.showJsonSchemaModal = false;
  }

  applyJsonSchema(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    // Save the schema to the agent config
    selectedNode.data!.agentConfig!.jsonSchema = JSON.parse(JSON.stringify(this.currentJsonSchema));

    console.log('Applied JSON schema:', this.currentJsonSchema);
    this.closeJsonSchemaModal();
  }

  generateJsonSchema(): void {
    // Placeholder for AI-powered schema generation
    console.log('Generate JSON schema - would use AI to create schema');

    // For demo purposes, add a sample property
    this.addSchemaProperty();
    const newProperty = this.currentJsonSchema.properties[this.currentJsonSchema.properties.length - 1];
    newProperty.name = 'classification';
    newProperty.type = 'enum';
    newProperty.description = 'Classification result';
    newProperty.required = true;
    newProperty.enumValues = ['flight_info', 'itinerary'];
  }

  // Schema property management
  addSchemaProperty(): void {
    const newProperty: SchemaProperty = {
      name: '',
      type: 'string',
      description: '',
      required: false,
      enumValues: []
    };

    this.currentJsonSchema.properties.push(newProperty);
    console.log('Added schema property');
  }

  removeSchemaProperty(index: number): void {
    this.currentJsonSchema.properties.splice(index, 1);
    console.log('Removed schema property at index:', index);
  }

  // Enum value management
  addEnumValue(propertyIndex: number, value: string): void {
    if (!value.trim()) return;

    const property = this.currentJsonSchema.properties[propertyIndex];
    if (!property.enumValues) {
      property.enumValues = [];
    }

    property.enumValues.push(value.trim());
    console.log('Added enum value:', value);
  }

  removeEnumValue(propertyIndex: number, valueIndex: number): void {
    const property = this.currentJsonSchema.properties[propertyIndex];
    if (property.enumValues) {
      property.enumValues.splice(valueIndex, 1);
      console.log('Removed enum value at index:', valueIndex);
    }
  }

  // Property type change handler
  onPropertyTypeChange(property: SchemaProperty): void {
    // Clear enum values when switching away from enum type
    if (property.type !== 'enum') {
      property.enumValues = [];
    } else {
      // Initialize enum values array for enum type
      if (!property.enumValues) {
        property.enumValues = [];
      }
    }
    console.log('Property type changed to:', property.type);
  }

  // Enum input keydown handler
  onEnumInputKeydown(event: KeyboardEvent, propertyIndex: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addEnumValueFromInput(propertyIndex);
    }
  }

  // Add enum value from input field
  addEnumValueFromInput(propertyIndex: number): void {
    if (!this.newEnumValue.trim()) return;

    const property = this.currentJsonSchema.properties[propertyIndex];
    if (!property.enumValues) {
      property.enumValues = [];
    }

    property.enumValues.push(this.newEnumValue.trim());
    console.log('Added enum value:', this.newEnumValue);
    
    // Clear the input after adding
    this.newEnumValue = '';
  }

  // Generate schema from AI
  generateSchemaFromAI(): void {
    // Placeholder for AI-powered schema generation
    console.log('🤖 Generate schema from AI - this would analyze the agent instructions and generate an appropriate schema');
    
    // For demo purposes, add a sample property if none exist
    if (this.currentJsonSchema.properties.length === 0) {
      this.addSchemaProperty();
      const newProperty = this.currentJsonSchema.properties[0];
      newProperty.name = 'classification';
      newProperty.type = 'enum';
      newProperty.description = 'Classification of user intent';
      newProperty.required = true;
      newProperty.enumValues = ['return_item', 'cancel_subscription', 'get_information'];
      
    }
  }

  // ===============================
  // MCP CONFIGURATION METHODS
  // ===============================

  // MCP Server Type Change Handler
  onMCPServerTypeChange(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    const serverConfig = selectedNode.data!.mcpConfig!.server;
    
    console.log('MCP Server type changed to:', serverConfig.type);
    
    // Clear type-specific fields when switching
    if (serverConfig.type === 'http') {
      serverConfig.command = undefined;
      serverConfig.args = undefined;
    } else if (serverConfig.type === 'stdio') {
      serverConfig.url = undefined;
    }
  }

  // Agent name change handler - sync with canvas node label
  onAgentNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;
    
    // Update the agent config name
    selectedNode.data!.agentConfig!.name = newName;
    
    // Sync with canvas node label - use name if provided, fallback to default
    selectedNode.label = newName && newName.trim() ? newName.trim() : 'Agent';
    
    console.log('Agent name changed:', { newName, nodeLabel: selectedNode.label });
  }

  // MCP name change handler - sync with canvas node label  
  onMCPNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    
    // Update the MCP config name
    selectedNode.data!.mcpConfig!.name = newName;
    
    // Sync with canvas node label - use name if provided, fallback to default
    selectedNode.label = newName && newName.trim() ? newName.trim() : 'MCP';
    
    console.log('MCP name changed:', { newName, nodeLabel: selectedNode.label });
  }

  // Alias change handler - validate and update
  onAliasChange(newAlias: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;

    // Clean and validate the alias
    const cleanAlias = newAlias.trim().toLowerCase();
    const validation = this.validateAlias(cleanAlias, selectedNode.id);

    if (validation.valid) {
      selectedNode.alias = cleanAlias;
      console.log('Alias changed successfully:', { nodeId: selectedNode.id, newAlias: cleanAlias });
    }
  }

  // Check if current node has alias error
  hasAliasError(): boolean {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return false;

    const validation = this.validateAlias(selectedNode.alias, selectedNode.id);
    return !validation.valid;
  }

  // Get alias error message
  getAliasErrorMessage(): string {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return '';

    const validation = this.validateAlias(selectedNode.alias, selectedNode.id);
    return validation.error || '';
  }

  // Workflow Variables Panel state
  variablesPanelExpanded = false;

  // Toggle variables panel expansion
  toggleVariablesPanel(): void {
    this.variablesPanelExpanded = !this.variablesPanelExpanded;
  }

  // Get workflow input variables
  getWorkflowInputs(): { path: string; type: string; description?: string }[] {
    return [
      {
        path: 'workflow.input.user_request',
        type: 'string',
        description: 'User input message'
      },
      {
        path: 'workflow.input.location', 
        type: 'string',
        description: 'Location input (if provided)'
      }
    ];
  }

  // Get runtime variables
  getRuntimeVariables(): { path: string; type: string; description?: string }[] {
    return [
      {
        path: 'workflow.run_id',
        type: 'string', 
        description: 'Unique workflow execution ID'
      },
      {
        path: 'workflow.timestamp',
        type: 'string',
        description: 'Workflow execution timestamp'
      }
    ];
  }

  // Get node icon for variables panel
  getNodeIcon(nodeType: NodeType): string {
    const iconMap: Record<NodeType, string> = {
      'agent': 'robot',
      'mcp': 'lightning',
      'start': 'play-circle',
      'end': 'stop-circle',
      'if-else': 'flow-arrow',
      'sequential': 'minus',
      'parallel': 'list'
    };
    return iconMap[nodeType] || 'gear';
  }

  // Get basic node output variables
  getNodeOutputs(node: WorkflowNode): { path: string; type: string; description?: string }[] {
    if (!node.alias) return [];

    const outputs = [
      {
        path: `workflow.${node.alias}.output`,
        type: node.type === 'agent' ? 'string|object' : 'object',
        description: 'Full node response'
      },
      {
        path: `workflow.${node.alias}.status`,
        type: 'string',
        description: 'Execution status (success/failed)'
      }
    ];

    // Add MCP-specific outputs
    if (node.type === 'mcp') {
      outputs.push({
        path: `workflow.${node.alias}.success`,
        type: 'boolean',
        description: 'Tool execution success flag'
      });
      outputs.push({
        path: `workflow.${node.alias}.tool_name`,
        type: 'string', 
        description: 'Name of the executed tool'
      });
    }

    return outputs;
  }

  // Get JSON schema properties as variables
  getJsonSchemaProperties(node: WorkflowNode): { path: string; type: string; description?: string }[] {
    if (!node.alias || node.type !== 'agent') return [];

    const agentConfig = node.data?.agentConfig;
    if (!agentConfig?.jsonSchema?.properties) return [];

    return agentConfig.jsonSchema.properties.map(prop => ({
      path: `workflow.${node.alias}.${prop.name}`,
      type: prop.type,
      description: prop.description
    }));
  }

  // Copy variable to clipboard
  copyToClipboard(variablePath: string): void {
    const textToCopy = `\${${variablePath}}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        console.log('Variable copied to clipboard:', textToCopy);
        // TODO: Show toast notification
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('Variable copied to clipboard (fallback):', textToCopy);
    }
  }

  // Add MCP Tool Argument
  addMCPToolArgument(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    
    if (!selectedNode.data!.mcpConfig!.toolArguments) {
      selectedNode.data!.mcpConfig!.toolArguments = {};
    }
    
    const argName = `arg_${Object.keys(selectedNode.data!.mcpConfig!.toolArguments).length + 1}`;
    selectedNode.data!.mcpConfig!.toolArguments[argName] = '';
    
    console.log('Added MCP tool argument:', argName);
  }

  // Remove MCP Tool Argument
  removeMCPToolArgument(argName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.mcpConfig?.toolArguments) return;

    delete selectedNode.data.mcpConfig.toolArguments[argName];
    console.log('Removed MCP tool argument:', argName);
  }

  // Get MCP Tool Arguments as array for template iteration
  getMCPToolArgumentsArray(): { key: string; value: any }[] {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.mcpConfig?.toolArguments) return [];
    
    return Object.entries(selectedNode.data.mcpConfig.toolArguments).map(([key, value]) => ({
      key,
      value
    }));
  }

  // Update MCP Tool Argument Key
  updateMCPToolArgumentKey(oldKey: string, newKey: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.mcpConfig?.toolArguments) return;
    
    if (oldKey !== newKey && newKey.trim()) {
      const value = selectedNode.data.mcpConfig.toolArguments[oldKey];
      delete selectedNode.data.mcpConfig.toolArguments[oldKey];
      selectedNode.data.mcpConfig.toolArguments[newKey] = value;
      console.log('Updated MCP tool argument key:', oldKey, '->', newKey);
    }
  }

  // Update MCP Tool Argument Value
  updateMCPToolArgumentValue(key: string, value: any): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || !selectedNode.data?.mcpConfig?.toolArguments) return;
    
    selectedNode.data.mcpConfig.toolArguments[key] = value;
    console.log('Updated MCP tool argument value:', key, '=', value);
  }

  // Helper method to handle MCP argument key change from template
  onMCPArgumentKeyChange(event: any, oldKey: string): void {
    const newKey = event.target?.value || '';
    this.updateMCPToolArgumentKey(oldKey, newKey);
  }

  // Helper method to handle MCP argument value change from template  
  onMCPArgumentValueChange(event: any, key: string): void {
    const value = event.target?.value || '';
    this.updateMCPToolArgumentValue(key, value);
  }

  // Test MCP Connection (placeholder for future implementation)
  async testMCPConnection(): Promise<void> {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    const mcpConfig = selectedNode.data!.mcpConfig!;
    
    console.log('Testing MCP connection:', mcpConfig.server);
    
    // Placeholder - in a real implementation, this would test the actual connection
    alert('MCP Connection Test\n\nThis feature will be implemented to test the connection to your MCP server and discover available tools.');
  }

  // ===============================
  // PREVIEW WORKFLOW FUNCTIONALITY
  // ===============================

  // Open preview workflow
  openPreviewWorkflow(): void {
    console.log('🔵 OPENING PREVIEW WORKFLOW');
    console.log('  - Before: showPreviewWorkflow =', this.showPreviewWorkflow);
    console.log('  - selectedNodeId =', this.selectedNodeId);
    
    // Set internal state immediately for calculations
    this.showPreviewWorkflow = true;
    
    // Start canvas width adjustment immediately
    this.adjustCanvasForPropertiesPanel(this.selectedNodeId !== null);
    
    // Delay visual appearance to match canvas transition (0.3s)
    setTimeout(() => {
      this.showPreviewWorkflowVisual = true;
      console.log('  - Visual preview workflow shown');
    }, 300); // Match canvas transition duration
  }

  // Close preview workflow  
  closePreviewWorkflow(): void {
    console.log('🔴 CLOSING PREVIEW WORKFLOW');
    console.log('  - Before: showPreviewWorkflow =', this.showPreviewWorkflow);
    console.log('  - selectedNodeId =', this.selectedNodeId);
    
    // Hide visual immediately
    this.showPreviewWorkflowVisual = false;
    
    // Update internal state
    this.showPreviewWorkflow = false;
    
    console.log('  - After: showPreviewWorkflow =', this.showPreviewWorkflow);
    console.log('  - Calling adjustCanvasForPropertiesPanel with isPropertiesPanelOpen =', this.selectedNodeId !== null);
    
    // Restore canvas width using same logic as properties panel
    this.adjustCanvasForPropertiesPanel(this.selectedNodeId !== null);
  }





}