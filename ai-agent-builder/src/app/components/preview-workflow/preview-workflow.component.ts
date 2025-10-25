import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { IconComponent } from '@polarity/components/icon';
import { ButtonComponent } from '@polarity/components/button';
import { ChatMessageComponent, ChatMessageHeadingComponent } from '@polarity/ai-components/messages';
import { WorkflowNode, WorkflowConnection, AgentConfig, JsonSchema, ChatMessage } from '../../models/workflow.models';

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
    ChatMessageHeadingComponent
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

  constructor(
    private http: HttpClient, 
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
      // Export workflow definition
      const workflowDefinition = this.exportWorkflowDefinition(message);

      // Call workflow execution API
      const response = await this.executeWorkflow(workflowDefinition);

      // Add assistant response
      this.chatMessages.push({
        id: this.generateChatMessageId(),
        content: this.formatWorkflowResponse(response),
        type: 'assistant',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Workflow execution error:', error);
      
      // Add error message from AI Assistant
      this.chatMessages.push({
        id: this.generateChatMessageId(),
        content: `I apologize, but I encountered an error while processing your request. This might be because the workflow execution backend isn't running or there's a configuration issue. Please check that your workflow nodes are properly configured.`,
        type: 'assistant',
        timestamp: new Date()
      });
    } finally {
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

  // Create alias to node ID mapping for variable resolution
  private createAliasMapping(): { [alias: string]: string } {
    const aliasMap: { [alias: string]: string } = {};
    
    this.canvasNodes.forEach(node => {
      if (node.alias) {
        aliasMap[node.alias] = node.id;
      }
    });
    
    return aliasMap;
  }

  // Keep alias-based variables as-is since backend now supports aliases natively
  private resolveAliasVariables(text: string, aliasMap: { [alias: string]: string }): string {
    // Since backend now supports aliases natively, keep alias syntax as-is
    // No conversion needed: ${workflow.weather_agent.temperature} stays as ${workflow.weather_agent.temperature}
    return text;
  }

  // Resolve alias variables in object (recursively process all string values)
  private resolveAliasVariablesInObject(obj: any, aliasMap: { [alias: string]: string }): any {
    if (typeof obj === 'string') {
      return this.resolveAliasVariables(obj, aliasMap);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.resolveAliasVariablesInObject(item, aliasMap));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveAliasVariablesInObject(value, aliasMap);
      }
      return result;
    }
    return obj;
  }

  // Export workflow definition for API execution
  private exportWorkflowDefinition(userInput: string): any {
    // Create alias to node ID mapping for variable resolution
    const aliasMap = this.createAliasMapping();
    
    // Build workflow from actual canvas nodes and connections
    const workflowNodes = this.canvasNodes.map(canvasNode => {
      const workflowNode: any = {
        id: canvasNode.id,
        type: canvasNode.type,
        name: canvasNode.label,
        alias: canvasNode.alias,
        config: {},
        next: [],
        dependencies: []
      };

      // Configure based on node type
      if (canvasNode.type === 'start') {
        workflowNode.config = {
          name: canvasNode.label,
          description: 'Start workflow execution'
        };
      } 
      else if (canvasNode.type === 'agent' && canvasNode.data?.agentConfig) {
        const agentConfig = canvasNode.data.agentConfig;
        workflowNode.config = {
          provider: 'azure_openai',
          model: agentConfig.model || 'gpt-35-turbo',
          prompt: this.resolveAliasVariables(this.processAgentInstructions(agentConfig.instructions || 'You are a helpful AI assistant. User request: ${workflow.input.user_request}', agentConfig), aliasMap),
          system_prompt: this.resolveAliasVariables(this.processAgentInstructions(agentConfig.instructions || 'You are a helpful AI assistant with expertise across multiple domains. Provide detailed, accurate, and practical responses to user queries.', agentConfig), aliasMap),
          temperature: 0.7,
          max_tokens: 500,
          timeout: 60
        };

        // Add JSON output configuration for structured output (Azure OpenAI compatible)
        if (agentConfig.outputFormat === 'json' && agentConfig.jsonSchema) {
          workflowNode.config.response_format = {
            type: 'json_object'  // ✅ Azure OpenAI supported format
          };
          
          // Add output mapping for workflow variable access
          workflowNode.output_mapping = this.generateOutputMapping(agentConfig.jsonSchema, canvasNode.id);
        }
      }
      else if (canvasNode.type === 'mcp' && canvasNode.data?.mcpConfig) {
        const mcpConfig = canvasNode.data.mcpConfig;
        workflowNode.type = 'mcp_tool'; // API expects mcp_tool not mcp
        workflowNode.config = {
          server: {
            type: mcpConfig.server.type || 'http',
            url: mcpConfig.server.url || 'http://localhost:8080',
            timeout: mcpConfig.server.timeout || 30
          },
          tool_name: mcpConfig.toolName || 'get_oauth_token',
          tool_arguments: this.resolveAliasVariablesInObject(mcpConfig.toolArguments || {}, aliasMap),
          timeout: mcpConfig.timeout || 60,
          retry_attempts: mcpConfig.retryAttempts || 3
        };
      }
      else if (canvasNode.type === 'end') {
        workflowNode.config = {
          name: canvasNode.label,
          description: 'End workflow execution',
          collect_outputs: true
        };
      }

      // Build next array from connections
      const outgoingConnections = this.connections.filter(conn => conn.sourceNodeId === canvasNode.id);
      workflowNode.next = outgoingConnections.map(conn => conn.targetNodeId);

      // Build dependencies array from connections  
      const incomingConnections = this.connections.filter(conn => conn.targetNodeId === canvasNode.id);
      workflowNode.dependencies = incomingConnections.map(conn => conn.sourceNodeId);

      return workflowNode;
    });

    // Create workflow definition from actual canvas
    const workflowDefinition = {
      definition: {
        id: 'canvas_preview_workflow',
        name: 'Canvas Workflow',
        description: 'Interactive workflow generated from visual canvas designer',
        nodes: workflowNodes
      },
      input_data: {
        user_request: userInput
      }
    };

    return workflowDefinition;
  }

  // Execute workflow via API
  private async executeWorkflow(workflowDefinition: any): Promise<any> {
    const apiUrl = 'http://localhost:8000/api/v1/workflows/execute';
    
    console.log('🚀 Calling workflow API:', apiUrl);

    try {
      const response = await this.http.post(apiUrl, workflowDefinition).toPromise();
      return response;
    } catch (error) {
      console.error('❌ API Error:', error);
      throw new Error(`Failed to execute workflow: ${error}`);
    }
  }

  // Format workflow response for display
  private formatWorkflowResponse(response: any): string {
    try {
      // Primary path: response.output.agent.full.response
      if (response?.output?.agent?.full?.response) {
        return response.output.agent.full.response;
      }
      
      // Alternative path: response.node_results.agent.output.response  
      if (response?.node_results?.agent?.output?.response) {
        return response.node_results.agent.output.response;
      }
      
      // Legacy path: response.execution_result.node_outputs.agent.output.response
      if (response?.execution_result?.node_outputs?.agent?.output?.response) {
        return response.execution_result.node_outputs.agent.output.response;
      }
      
      // Final fallback: check if there's any response field
      if (response?.response) {
        return response.response;
      }
      
      // Error fallback
      console.warn('Could not find AI response in expected locations:', response);
      return 'I received your message but had trouble formatting the response. Please try again.';
    } catch (error) {
      console.error('Error formatting response:', error);
      return 'Error processing AI response. Please try again.';
    }
  }

  // Generate unique chat message ID
  private generateChatMessageId(): string {
    return 'msg_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate output mapping for workflow variable access
  private generateOutputMapping(jsonSchema: JsonSchema, nodeId: string): any {
    const outputMapping: any = {
      node_id: nodeId,
      output_variables: {}
    };

    jsonSchema.properties.forEach(property => {
      // Create workflow variable paths for each schema property
      // Format: workflow.nodes.{nodeId}.output.{propertyName}
      outputMapping.output_variables[property.name] = {
        path: `nodes.${nodeId}.output.${property.name}`,
        type: property.type,
        description: property.description || `Output property: ${property.name}`
      };
    });

    return outputMapping;
  }

  // Enhanced instruction processing to handle structured output references
  private processAgentInstructions(instructions: string, agentConfig?: AgentConfig): string {
    if (!instructions) return instructions;
    
    // Replace state variable references with workflow variable format
    let processedInstructions = instructions.replace(/\$\{(\w+)\}/g, (match, variableName) => {
      // Map common variables to their workflow paths
      switch (variableName) {
        case 'user_request':
          return '${workflow.input.user_request}';
        default:
          // For custom state variables, assume they come from workflow state or previous node outputs
          return '${workflow.state.' + variableName + '}';
      }
    });

    // Add instruction for structured output when JSON schema is being used
    if (agentConfig?.outputFormat === 'json' && agentConfig?.jsonSchema) {
      processedInstructions += '\n\nIMPORTANT: You must respond with a valid JSON object that matches the specified schema exactly. Do not include any text outside the JSON object.';
    }

    return processedInstructions;
  }
}