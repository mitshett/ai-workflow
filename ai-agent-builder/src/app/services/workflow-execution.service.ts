import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  WorkflowExecutionRequest, 
  WorkflowExecutionResponse, 
  NodeResult,
  WorkflowNode,
  WorkflowConnection 
} from '../models/workflow.models';

@Injectable({
  providedIn: 'root'
})
export class WorkflowExecutionService {
  
  private readonly apiUrl = 'http://localhost:8000/api/v1/workflows';
  
  // Subject to track current execution state
  private executionStateSubject = new BehaviorSubject<{
    isExecuting: boolean;
    currentResponse?: WorkflowExecutionResponse;
  }>({
    isExecuting: false
  });

  public executionState$ = this.executionStateSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===============================
  // WORKFLOW EXECUTION METHODS
  // ===============================

  /**
   * Execute a workflow with the standardized API format
   */
  executeWorkflow(request: WorkflowExecutionRequest): Observable<WorkflowExecutionResponse> {
    this.executionStateSubject.next({ isExecuting: true });

    return this.http.post<WorkflowExecutionResponse>(`${this.apiUrl}/execute`, request)
      .pipe(
        map(response => {
          // Update execution state with response
          this.executionStateSubject.next({ 
            isExecuting: false, 
            currentResponse: response 
          });
          return response;
        }),
        catchError(error => {
          this.executionStateSubject.next({ isExecuting: false });
          return this.handleError(error);
        })
      );
  }

  /**
   * Get execution result by run ID
   */
  getExecutionResult(runId: string): Observable<WorkflowExecutionResponse> {
    return this.http.get<WorkflowExecutionResponse>(`${this.apiUrl}/executions/${runId}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * List all executions
   */
  listExecutions(): Observable<{ executions: any[], total_count: number }> {
    return this.http.get<{ executions: any[], total_count: number }>(`${this.apiUrl}/executions`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Check API health
   */
  checkApiHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(catchError(this.handleError));
  }

  // ===============================
  // WORKFLOW CONVERSION METHODS
  // ===============================

  /**
   * Convert canvas nodes and connections to workflow execution request
   */
  convertCanvasToExecutionRequest(
    canvasNodes: WorkflowNode[], 
    connections: WorkflowConnection[], 
    userInput: string,
    workflowId?: string
  ): WorkflowExecutionRequest {
    
    // Create alias to node ID mapping for variable resolution
    const aliasMap = this.createAliasMapping(canvasNodes);
    
    // Build workflow nodes from canvas
    const workflowNodes = canvasNodes.map(canvasNode => {
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
      this.configureNodeByType(workflowNode, canvasNode, aliasMap);

      // Build next array from connections
      const outgoingConnections = connections.filter(conn => conn.sourceNodeId === canvasNode.id);
      workflowNode.next = outgoingConnections.map(conn => conn.targetNodeId);

      // Build dependencies array from connections  
      const incomingConnections = connections.filter(conn => conn.targetNodeId === canvasNode.id);
      workflowNode.dependencies = incomingConnections.map(conn => conn.sourceNodeId);

      return workflowNode;
    });

    return {
      definition: {
        id: workflowId || 'canvas_workflow',
        name: 'Canvas Workflow',
        description: 'Workflow generated from visual canvas designer',
        nodes: workflowNodes
      },
      input_data: {
        user_request: userInput
      }
    };
  }

  /**
   * Extract AI response from execution result
   */
  extractAIResponse(response: WorkflowExecutionResponse): string {
    try {
      // Look for agent nodes in nodes array
      const agentResults = response.nodes
        .filter(result => result.node_type === 'agent');

      if (agentResults.length > 0) {
        const agentResult = agentResults[0];
        
        // Return the response field from the agent node
        if (agentResult.response) {
          return agentResult.response;
        }
      }
      
      // Look for any node with a response
      const nodeWithResponse = response.nodes.find(node => node.response);
      if (nodeWithResponse?.response) {
        return nodeWithResponse.response;
      }
      
      // Final fallback
      console.warn('Could not find AI response in nodes:', response);
      return 'I received your message but had trouble formatting the response. Please try again.';
      
    } catch (error) {
      console.error('Error extracting AI response:', error);
      return 'Error processing AI response. Please try again.';
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Create alias to node ID mapping
   */
  private createAliasMapping(canvasNodes: WorkflowNode[]): { [alias: string]: string } {
    const aliasMap: { [alias: string]: string } = {};
    
    canvasNodes.forEach(node => {
      if (node.alias) {
        aliasMap[node.alias] = node.id;
      }
    });
    
    return aliasMap;
  }

  /**
   * Configure node based on its type
   */
  private configureNodeByType(workflowNode: any, canvasNode: WorkflowNode, aliasMap: { [alias: string]: string }): void {
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
        prompt: this.resolveAliasVariables(
          this.processAgentInstructions(
            agentConfig.instructions || 'You are a helpful AI assistant. User request: ${workflow.input.user_request}', 
            agentConfig
          ), 
          aliasMap
        ),
        temperature: 0.7,
        max_tokens: 500,
        timeout: 60
      };

      // Add JSON output configuration for structured output
      if (agentConfig.outputFormat === 'json' && agentConfig.jsonSchema) {
        workflowNode.config.response_format = {
          type: 'json_object'
        };
      }
    }
    else if (canvasNode.type === 'mcp' && canvasNode.data?.mcpConfig) {
      const mcpConfig = canvasNode.data.mcpConfig;
      workflowNode.type = 'mcp_tool';
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
  }

  /**
   * Resolve alias variables in text
   */
  private resolveAliasVariables(text: string, aliasMap: { [alias: string]: string }): string {
    // Keep alias syntax as-is since backend supports aliases natively
    return text;
  }

  /**
   * Resolve alias variables in object (recursively)
   */
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

  /**
   * Process agent instructions
   */
  private processAgentInstructions(instructions: string, agentConfig?: any): string {
    if (!instructions) return instructions;
    
    // Replace state variable references with workflow variable format
    let processedInstructions = instructions.replace(/\$\{(\w+)\}/g, (match, variableName) => {
      switch (variableName) {
        case 'user_request':
          return '${workflow.input.user_request}';
        default:
          return '${workflow.state.' + variableName + '}';
      }
    });

    // Add instruction for structured output when JSON schema is being used
    if (agentConfig?.outputFormat === 'json' && agentConfig?.jsonSchema) {
      processedInstructions += '\n\nIMPORTANT: You must respond with a valid JSON object that matches the specified schema exactly. Do not include any text outside the JSON object.';
    }

    return processedInstructions;
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      if (error.error?.detail) {
        errorMessage += ` - ${error.error.detail}`;
      }
    }
    
    console.error('Workflow Execution Service Error:', errorMessage);
    return throwError(errorMessage);
  };
}