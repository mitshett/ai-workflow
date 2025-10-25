import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Polarity Components
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { InputTextComponent } from '@polarity/components/input-text';
import { SelectComponent } from '@polarity/components/select';

// Models
import { WorkflowNode, AgentConfig, MCPConfig, JsonSchema, SchemaProperty } from '../../models/workflow.models';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    SelectComponent,
  ],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss'
})
export class PropertiesPanelComponent {
  
  // Inputs from parent component
  @Input() selectedNodeId: string | null = null;
  @Input() canvasNodes: WorkflowNode[] = [];
  @Input() showJsonSchemaModal: boolean = false;
  @Input() currentJsonSchema: JsonSchema = { name: '', properties: [] };
  @Input() schemaMode: string = 'simple';
  @Input() newEnumValue: string = '';
  
  // Output events to parent component
  @Output() closePanel = new EventEmitter<void>();
  @Output() nodeUpdate = new EventEmitter<WorkflowNode>();
  @Output() openJsonSchemaModal = new EventEmitter<void>();

  // ===============================
  // NODE SELECTION METHODS
  // ===============================

  // Get the currently selected node
  getSelectedNode(): WorkflowNode | null {
    if (!this.selectedNodeId) return null;
    return this.canvasNodes.find(node => node.id === this.selectedNodeId) || null;
  }

  // Close the properties panel
  onClosePanel(): void {
    console.log('🔴 CLOSE BUTTON CLICKED!!! Properties panel close button clicked - emitting closePanel event');
    console.log('🔴 About to emit closePanel event');
    this.closePanel.emit();
    console.log('🔴 closePanel event emitted');
  }

  // Get icon name with proper typing
  getIconName(iconName: string): any {
    return iconName as any;
  }

  // ===============================
  // NODE DATA INITIALIZATION
  // ===============================

  // Initialize agent data structure if it doesn't exist
  private ensureAgentData(node: WorkflowNode): void {
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.agentConfig) {
      node.data.agentConfig = {
        name: node.label,
        instructions: 'You are a helpful assistant. User request: ${user_request}',
        context: 'recent_messages',
        model: 'gpt-35-turbo',
        stateVariables: [
          {
            name: 'user_request',
            type: 'string',
            description: 'The user\'s input message or query'
          }
        ],
        tools: [],
        outputFormat: 'text'
      };
    }
    
    // Ensure stateVariables array exists
    if (!node.data.agentConfig.stateVariables) {
      node.data.agentConfig.stateVariables = [
        {
          name: 'user_request',
          type: 'string',
          description: 'The user\'s input message or query'
        }
      ];
    }
    
    // Auto-add user_request if not present
    const hasUserRequest = node.data.agentConfig.stateVariables.some(v => v.name === 'user_request');
    if (!hasUserRequest) {
      node.data.agentConfig.stateVariables.push({
        name: 'user_request',
        type: 'string',
        description: 'The user\'s input message or query'
      });
    }
  }

  // Initialize MCP data structure if it doesn't exist
  private ensureMCPData(node: WorkflowNode): void {
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.mcpConfig) {
      node.data.mcpConfig = {
        name: node.label,
        description: '',
        server: {
          type: 'http',
          url: 'http://localhost:8080',
          timeout: 30
        },
        toolName: '',
        toolArguments: {},
        timeout: 60,
        retryAttempts: 3
      };
    }
  }

  // ===============================
  // AGENT CONFIGURATION METHODS
  // ===============================

  // Agent name change handler - sync with canvas node label
  onAgentNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.ensureAgentData(selectedNode);
    
    // Update the agent config name
    selectedNode.data!.agentConfig!.name = newName;
    
    // Sync with canvas node label - use name if provided, fallback to default
    selectedNode.label = newName && newName.trim() ? newName.trim() : 'Agent';
    
    console.log('Agent name changed:', { newName, nodeLabel: selectedNode.label });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Output format change handler
  onOutputFormatChange(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;
    
    this.ensureAgentData(selectedNode);
    
    console.log('Output format changed to:', selectedNode.data!.agentConfig!.outputFormat);

    // Clear JSON schema if switching away from JSON
    if (selectedNode.data!.agentConfig!.outputFormat !== 'json') {
      selectedNode.data!.agentConfig!.jsonSchema = undefined;
    }
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Add agent state variable
  addAgentStateVariable(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.ensureAgentData(selectedNode);
    selectedNode.data!.agentConfig!.stateVariables!.push({
      name: '',
      type: 'string',
      description: ''
    });
    
    console.log('Added agent state variable to node:', selectedNode.id);
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Remove agent state variable
  removeAgentStateVariable(index: number): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.ensureAgentData(selectedNode);
    const agentConfig = selectedNode.data!.agentConfig!;
    
    if (!agentConfig.stateVariables) return;

    // Prevent removing the required user_request variable
    const variable = agentConfig.stateVariables[index];
    if (variable && variable.name === 'user_request') {
      alert('Cannot remove the required user_request variable. This variable is needed to pass user input to the agent.');
      return;
    }

    agentConfig.stateVariables.splice(index, 1);
    console.log('Removed agent state variable at index:', index);
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // ===============================
  // MCP CONFIGURATION METHODS
  // ===============================

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
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // MCP server type change handler
  onMCPServerTypeChange(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    console.log('MCP server type changed');
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Get MCP tool arguments as array for template iteration
  getMCPToolArgumentsArray(): Array<{key: string, value: string}> {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return [];

    this.ensureMCPData(selectedNode);
    const toolArguments = selectedNode.data!.mcpConfig!.toolArguments || {};
    
    return Object.entries(toolArguments).map(([key, value]) => ({
      key,
      value: value as string
    }));
  }

  // Handle MCP argument key change
  onMCPArgumentKeyChange(event: Event, oldKey: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newKey = (event.target as HTMLInputElement).value;
    if (newKey === oldKey) return;

    this.ensureMCPData(selectedNode);
    const toolArguments = selectedNode.data!.mcpConfig!.toolArguments!;
    
    // Update the key
    const value = toolArguments[oldKey];
    delete toolArguments[oldKey];
    toolArguments[newKey] = value;
    
    console.log('MCP argument key changed:', { oldKey, newKey });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Handle MCP argument value change
  onMCPArgumentValueChange(event: Event, key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newValue = (event.target as HTMLInputElement).value;
    
    this.ensureMCPData(selectedNode);
    selectedNode.data!.mcpConfig!.toolArguments![key] = newValue;
    
    console.log('MCP argument value changed:', { key, newValue });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Add MCP tool argument
  addMCPToolArgument(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    
    // Find a unique key name
    let newKey = 'arg';
    let counter = 1;
    const toolArguments = selectedNode.data!.mcpConfig!.toolArguments!;
    
    while (toolArguments.hasOwnProperty(newKey)) {
      newKey = `arg${counter}`;
      counter++;
    }
    
    toolArguments[newKey] = '';
    console.log('Added MCP tool argument:', newKey);
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Remove MCP tool argument
  removeMCPToolArgument(key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    delete selectedNode.data!.mcpConfig!.toolArguments![key];
    
    console.log('Removed MCP tool argument:', key);
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Test MCP connection
  testMCPConnection(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    console.log('🔌 Testing MCP connection...', selectedNode.data!.mcpConfig);
    // TODO: Implement actual MCP connection test
    alert('MCP connection test would be implemented here');
  }

  // ===============================
  // ALIAS VALIDATION METHODS
  // ===============================

  // Alias change handler - validate and update (no parameter version for template)
  onAliasChange(newAlias?: string): void {
    if (typeof newAlias === 'undefined') return;
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;

    // Clean and validate the alias
    const cleanAlias = newAlias.trim().toLowerCase();
    const validation = this.validateAlias(cleanAlias, selectedNode.id);

    if (validation.valid) {
      selectedNode.alias = cleanAlias;
      console.log('Alias changed successfully:', { nodeId: selectedNode.id, newAlias: cleanAlias });
      
      // Emit node update
      this.nodeUpdate.emit(selectedNode);
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
    return validation.message || '';
  }

  // Validate alias uniqueness and format
  private validateAlias(alias: string, nodeId: string): { valid: boolean; message?: string } {
    if (!alias) {
      return { valid: false, message: 'Alias is required' };
    }

    // Check format (alphanumeric + underscore)
    if (!/^[a-z][a-z0-9_]*$/.test(alias)) {
      return { valid: false, message: 'Alias must start with a letter and contain only lowercase letters, numbers, and underscores' };
    }

    // Check uniqueness
    const duplicateNode = this.canvasNodes.find(node => 
      node.id !== nodeId && node.alias === alias
    );

    if (duplicateNode) {
      return { valid: false, message: 'This alias is already used by another node' };
    }

    return { valid: true };
  }

  // ===============================
  // JSON SCHEMA METHODS
  // ===============================

  // Setup JSON schema
  setupJsonSchema(): void {
    console.log('Setup JSON schema for selected node');
    this.openJsonSchemaModal.emit();
  }

  // Edit JSON schema
  editJsonSchema(): void {
    console.log('Edit JSON schema for selected node');
    this.openJsonSchemaModal.emit();
  }
}