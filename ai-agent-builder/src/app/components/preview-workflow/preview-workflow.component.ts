import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { IconComponent } from '@polarity/components/icon';
import { ButtonComponent } from '@polarity/components/button';
import { ChatMessageComponent, ChatMessageHeadingComponent } from '@polarity/ai-components/messages';
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
  
  @Output() closePreview = new EventEmitter<void>();

  // Chat state
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  isExecutingWorkflow = false;
  
  // Execution results for activity timeline
  currentExecutionResponse?: WorkflowExecutionResponse;
  
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

  // Validate workflow has minimum required nodes
  private validateWorkflowForPreview(): boolean {
    const hasStart = this.canvasNodes.some(node => node.type === 'start');
    const hasAgent = this.canvasNodes.some(node => node.type === 'agent');
    const hasEnd = this.canvasNodes.some(node => node.type === 'end');

    if (!hasStart || !hasAgent || !hasEnd) {
      alert('Workflow must have at least one Start node, one Agent node, and one End node for preview.');
      return false;
    }

    return true;
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
  // VIEW MANAGEMENT METHODS - REMOVED
  // Timeline is now embedded directly in chat messages
  // ===============================
}