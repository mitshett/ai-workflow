import { Component, Input, Output, EventEmitter, ChangeDetectorRef, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { IconComponent } from '@polarity/components/icon';
import { ButtonComponent } from '@polarity/components/button';
import { ChatMessageComponent, ChatMessageHeadingComponent } from '@polarity/ai-components/messages';
import { marked } from 'marked';
import { 
  WorkflowNode, 
  WorkflowConnection, 
  AgentConfig, 
  JsonSchema, 
  ChatMessage,
  WorkflowExecutionResponse 
} from '../../models/workflow.models';
import { WorkflowExecutionService } from '../../services/workflow-execution.service';
import { ActivityTimelineComponent } from '../activity-timeline/activity-timeline.component';

@Component({
  selector: 'app-preview-workflow',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    IconComponent,
    ButtonComponent,
    ChatMessageComponent,
    ChatMessageHeadingComponent,
    ActivityTimelineComponent
  ],
  templateUrl: './preview-workflow.component.html',
  styleUrl: './preview-workflow.component.scss'
})
export class PreviewWorkflowComponent {
  @Input() canvasNodes: WorkflowNode[] = [];
  @Input() connections: WorkflowConnection[] = [];
  @Input() isVisible = false;
  @Input() sidebarCollapsed = false;
  
  @Output() closePreview = new EventEmitter<void>();
  
  // Bind CSS class to host element based on sidebar state
  @HostBinding('class.sidebar-collapsed') get isSidebarCollapsed() {
    return this.sidebarCollapsed;
  }

  // Chat state
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  isExecutingWorkflow = false;
  
  // Execution results for activity timeline
  currentExecutionResponse?: WorkflowExecutionResponse;
  
  // Timeline collapse state - tracks which message timelines are expanded
  expandedTimelines = new Set<string>();
  
  // Cache for rendered markdown to avoid re-parsing on every change detection
  private markdownCache = new Map<string, string>();
  
  // View state - no longer needed since timeline is embedded in chat


  constructor(
    private workflowExecutionService: WorkflowExecutionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.isVisible) {
      this.initializePreview();
    }
  }

  // Initialize preview chat
  initializePreview(): void {
    // Validate workflow has minimum nodes (start, agent, end)
    if (!this.validateWorkflowForPreview()) {
      return;
    }

    // Reset chat state - clear any cached messages
    this.chatMessages = [];
    this.chatInput = '';
    this.isExecutingWorkflow = false;

    // Force a small delay to ensure clean state
    setTimeout(() => {
      // Add welcome message from AI Assistant
      this.chatMessages.push({
        id: this.generateChatMessageId(),
        content: 'Hello! I\'m your AI Assistant. This is a preview of your workflow. Send me a message to test how your workflow responds.',
        type: 'assistant',
        timestamp: new Date()
      });
      this.cdr.detectChanges();
    }, 100);
  }

  // Close preview workflow
  closePreviewWorkflow(): void {
    // Emit close event to parent
    this.closePreview.emit();
  }

  // Validate workflow has minimum required nodes and all nodes are connected
  private validateWorkflowForPreview(): boolean {
    // Check if there are any nodes
    if (this.canvasNodes.length === 0) {
      alert('Workflow must have at least one node for preview.');
      return false;
    }

    // Check if all nodes are connected (form a connected graph)
    if (!this.areAllNodesConnected()) {
      alert('All nodes in the workflow must be connected to each other for preview.');
      return false;
    }

    return true;
  }

  // Check if all nodes in the workflow are connected to each other
  private areAllNodesConnected(): boolean {
    // If there's only one node, it's considered connected
    if (this.canvasNodes.length <= 1) {
      return true;
    }

    // If there are no connections but multiple nodes, they're not connected
    if (this.connections.length === 0) {
      return false;
    }

    // Build adjacency list for undirected graph
    const adjacencyList = new Map<string, Set<string>>();
    
    // Initialize adjacency list with all node IDs
    this.canvasNodes.forEach(node => {
      adjacencyList.set(node.id, new Set<string>());
    });

    // Add connections (treating as undirected graph)
    this.connections.forEach(connection => {
      adjacencyList.get(connection.sourceNodeId)?.add(connection.targetNodeId);
      adjacencyList.get(connection.targetNodeId)?.add(connection.sourceNodeId);
    });

    // Perform BFS/DFS to check if all nodes are reachable from the first node
    const visited = new Set<string>();
    const queue = [this.canvasNodes[0].id];
    visited.add(this.canvasNodes[0].id);

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      const neighbors = adjacencyList.get(currentNodeId) || new Set();
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // All nodes should be visited if they're all connected
    return visited.size === this.canvasNodes.length;
  }

  // Send chat message and execute workflow
  async sendChatMessage(): Promise<void> {
    const message = this.chatInput.trim();
    if (!message || this.isExecutingWorkflow) {
      return;
    }

    console.log('💬 Sending chat message:', message);

    // Add user message
    this.chatMessages.push({
      id: this.generateChatMessageId(),
      content: message,
      type: 'user',
      timestamp: new Date()
    });

    // Clear input
    this.chatInput = '';
    this.isExecutingWorkflow = true;

    try {
      // Convert canvas to execution request using the service
      const executionRequest = this.workflowExecutionService.convertCanvasToExecutionRequest(
        this.canvasNodes,
        this.connections,
        message,
        'preview_workflow'
      );

      // Execute workflow using the service
      this.workflowExecutionService.executeWorkflow(executionRequest).subscribe({
        next: (response: WorkflowExecutionResponse) => {
          // Store execution response for activity timeline
          this.currentExecutionResponse = response;

          // Add chat message with execution response for timeline display
          this.chatMessages.push({
            id: this.generateChatMessageId(),
            content: '', // No text content - we'll show timeline instead
            type: 'assistant',
            timestamp: new Date(),
            executionResponse: response // Store execution data for timeline
          });

          this.isExecutingWorkflow = false;
          this.cdr.detectChanges();
        },
        error: (error: string) => {
          console.error('❌ Workflow execution error:', error);
          
          // Add error message to chat
          this.chatMessages.push({
            id: this.generateChatMessageId(),
            content: `I apologize, but I encountered an error while processing your request. This might be because the workflow execution backend isn't running or there's a configuration issue. Error: ${error}`,
            type: 'assistant',
            timestamp: new Date()
          });

          this.isExecutingWorkflow = false;
          this.cdr.detectChanges();
        }
      });

    } catch (error) {
      console.error('❌ Workflow setup error:', error);
      
      // Add error message from AI Assistant
      this.chatMessages.push({
        id: this.generateChatMessageId(),
        content: `I apologize, but I encountered an error while setting up your workflow request. Please check that your workflow nodes are properly configured.`,
        type: 'assistant',
        timestamp: new Date()
      });
      
      this.isExecutingWorkflow = false;
      this.cdr.detectChanges();
    }
  }

  // Handle Enter key in chat input
  onChatKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }


  // Generate unique chat message ID
  private generateChatMessageId(): string {
    return 'msg_' + Math.random().toString(36).substr(2, 9);
  }

  // ===============================
  // TIMELINE COLLAPSE METHODS
  // ===============================
  
  toggleTimelineVisibility(messageId: string): void {
    if (this.expandedTimelines.has(messageId)) {
      this.expandedTimelines.delete(messageId);
    } else {
      this.expandedTimelines.add(messageId);
    }
  }

  isTimelineExpanded(messageId: string): boolean {
    return this.expandedTimelines.has(messageId);
  }

  // ===============================
  // MAPPED NODE RESPONSE DISPLAY
  // ===============================

  public getMappedNodeResponse(executionResponse: WorkflowExecutionResponse): string | null {
    // Find the end node and its configured node name
    const endNode = this.canvasNodes.find(node => node.type === 'end');
    if (!endNode?.data?.endConfig?.nodeName) {
      return null;
    }

    const nodeName = endNode.data.endConfig.nodeName.trim();
    if (!nodeName) {
      return null;
    }

    // Find the corresponding canvas node to get its ID
    const canvasNode = this.canvasNodes.find(node => 
      node.label === nodeName || 
      node.alias === nodeName ||
      node.id === nodeName
    );

    if (!canvasNode) {
      return null;
    }

    // Find the node result with the matching ID
    const nodeResult = executionResponse.nodes.find(node => 
      node.node_id === canvasNode.id ||
      node.node_name === canvasNode.id ||
      node.node_name === canvasNode.label ||
      node.node_name === canvasNode.alias
    );

    if (!nodeResult || !nodeResult.response) {
      return null;
    }

    // Always return the response text - let the template decide when to show it
    return nodeResult.response.trim() || null;
  }

  // Get structured output for display after timeline
  public getMappedNodeStructuredOutput(executionResponse: WorkflowExecutionResponse): any {
    // Find the end node and its configured node name
    const endNode = this.canvasNodes.find(node => node.type === 'end');
    if (!endNode?.data?.endConfig?.nodeName) {
      return null;
    }

    const nodeName = endNode.data.endConfig.nodeName.trim();
    if (!nodeName) {
      return null;
    }

    // Find the corresponding canvas node to get its ID
    const canvasNode = this.canvasNodes.find(node => 
      node.label === nodeName || 
      node.alias === nodeName ||
      node.id === nodeName
    );

    if (!canvasNode) {
      return null;
    }

    // Find the node result with the matching ID
    const nodeResult = executionResponse.nodes.find(node => 
      node.node_id === canvasNode.id ||
      node.node_name === canvasNode.id ||
      node.node_name === canvasNode.label ||
      node.node_name === canvasNode.alias
    );

    if (!nodeResult) {
      return null;
    }

    // First try structured_output field
    if (nodeResult.structured_output && Object.keys(nodeResult.structured_output).length > 0) {
      // Clean up the structured output if it contains escaped JSON
      return this.cleanStructuredOutput(nodeResult.structured_output);
    }

    // If no structured_output, try to parse response as JSON
    if (nodeResult.response) {
      try {
        // Clean the response by removing markdown JSON blocks and escape characters
        let cleanResponse = nodeResult.response;
        cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Try to parse as JSON
        const parsed = JSON.parse(cleanResponse);
        return this.cleanStructuredOutput(parsed);
      } catch {
        // Not valid JSON, return null
        return null;
      }
    }

    return null;
  }

  // Clean structured output by removing escape characters and fixing formatting
  private cleanStructuredOutput(data: any): any {
    if (!data) return null;
    
    // If it's a string that looks like JSON, try to parse it
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    
    // If it's an object, clean up any string values that might have escape characters
    if (typeof data === 'object' && data !== null) {
      const cleaned: any = Array.isArray(data) ? [] : {};
      
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          // Remove escape characters from string values
          let cleanValue = value;
          try {
            // If the string contains JSON, parse it
            if (cleanValue.includes('{') && cleanValue.includes('}')) {
              cleanValue = JSON.parse(cleanValue);
            }
          } catch {
            // Not JSON, just remove common escape characters
            cleanValue = cleanValue.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          cleaned[key] = cleanValue;
        } else {
          cleaned[key] = this.cleanStructuredOutput(value);
        }
      }
      
      return cleaned;
    }
    
    return data;
  }

  // Render markdown text to sanitized HTML
  renderMarkdown(text: string | null): string {
    if (!text) return '';

    // Check cache first
    const cached = this.markdownCache.get(text);
    if (cached) return cached;

    // Configure marked for safe rendering
    const rendered = marked.parse(text, {
      breaks: true,  // Convert \n to <br>
      gfm: true      // GitHub-flavored markdown (tables, strikethrough, etc.)
    });

    // marked.parse can return string | Promise<string>; we only use sync mode
    const html = typeof rendered === 'string' ? rendered : '';

    this.markdownCache.set(text, html);
    return html;
  }
}