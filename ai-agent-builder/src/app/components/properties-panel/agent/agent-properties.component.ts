import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Polarity Components
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { InputTextComponent } from '@polarity/components/input-text';
import { SelectComponent, SelectItem, SelectValue } from '@polarity/components/select';

// Models
import { WorkflowNode, AgentConfig, Variable, JsonSchema } from '../../../models/workflow.models';
import { BaseNodePropertiesComponent } from '../shared/base-node-properties.component';
import { AliasSectionComponent } from '../shared/alias-section.component';

@Component({
  selector: 'app-agent-properties',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    SelectComponent,
    AliasSectionComponent
  ],
  templateUrl: './agent-properties.component.html',
  styleUrl: './agent-properties.component.scss'
})
export class AgentPropertiesComponent extends BaseNodePropertiesComponent {
  
  @Output() openJsonSchemaModal = new EventEmitter<void>();

  // ===============================
  // AUTOCOMPLETE STATE
  // ===============================
  
  showAutocomplete = false;
  autocompleteVariables: { path: string; type: string; description?: string }[] = [];
  autocompletePosition = { top: 0, left: 0 };
  activeAutocompleteIndex = 0;

  // ===============================
  // POLARITY SELECT OPTIONS
  // ===============================
  
  readonly modelOptions: SelectItem[] = [
    { value: 'gpt-35-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'azure-gpt-35-turbo', label: 'Azure GPT-3.5 Turbo' },
    { value: 'azure-gpt-4', label: 'Azure GPT-4' },
    { value: 'azure-gpt-4-turbo', label: 'Azure GPT-4 Turbo' },
    { value: 'azure-gpt-4o', label: 'Azure GPT-4o' },
    { value: 'azure-gpt-4o-mini', label: 'Azure GPT-4o Mini' }
  ];
  
  readonly outputFormatOptions: SelectItem[] = [
    { value: 'text', label: 'Plain Text' },
    { value: 'json', label: 'Structured JSON' }
  ];

  readonly variableTypeOptions: SelectItem[] = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'object', label: 'Object' },
    { value: 'array', label: 'Array' }
  ];

  // ===============================
  // NODE DATA INITIALIZATION
  // ===============================

  // Initialize agent data structure if it doesn't exist
  protected initializeNodeData(node: WorkflowNode): void {
    if (node.type !== 'agent') return;
    
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.agentConfig) {
      node.data.agentConfig = {
        name: node.label,
        instructions: 'You are a helpful assistant. User request: ${workflow.input.user_request}',
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

  // ===============================
  // AGENT CONFIGURATION METHODS
  // ===============================

  // Agent name change handler - sync with canvas node label
  onAgentNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.initializeNodeData(selectedNode);
    
    // Update the agent config name
    selectedNode.data!.agentConfig!.name = newName;
    
    // Sync with canvas node label - use name if provided, fallback to default
    selectedNode.label = newName && newName.trim() ? newName.trim() : 'Agent';
    
    console.log('Agent name changed:', { newName, nodeLabel: selectedNode.label });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Output format change handler
  onOutputFormatChange(value?: SelectValue): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;
    
    this.initializeNodeData(selectedNode);
    
    console.log('Output format changed to:', selectedNode.data!.agentConfig!.outputFormat);

    // Clear JSON schema if switching away from JSON
    if (selectedNode.data!.agentConfig!.outputFormat !== 'json') {
      selectedNode.data!.agentConfig!.jsonSchema = undefined;
    }
    
    // Refresh variable cache since output format affects available variables
    this.refreshVariableCache();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Add agent state variable
  addAgentStateVariable(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.initializeNodeData(selectedNode);
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

    this.initializeNodeData(selectedNode);
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
  // JSON SCHEMA METHODS
  // ===============================

  // Setup JSON schema
  setupJsonSchema(): void {
    console.log('🎛️ Setup JSON schema button clicked');
    console.log('  - Emitting openJsonSchemaModal event');
    this.openJsonSchemaModal.emit();
  }

  // Edit JSON schema
  editJsonSchema(): void {
    console.log('Edit JSON schema for selected node');
    this.openJsonSchemaModal.emit();
  }

  // Handle JSON schema updates (call this after schema modal closes)
  onJsonSchemaUpdated(): void {
    console.log('🎛️ JSON schema updated - refreshing variable cache');
    // Refresh variable cache to include new JSON schema properties
    this.refreshVariableCache();
  }

  // ===============================
  // AUTOCOMPLETE METHODS
  // ===============================

  // Handle input in instructions textarea
  onInstructionsInput(event: Event, textareaElement: HTMLTextAreaElement): void {
    const target = event.target as HTMLTextAreaElement;
    const value = target.value;
    const cursorPosition = target.selectionStart;
    
    // Check if user is typing workflow variables (trigger on just "workflow.")
    const beforeCursor = value.substring(0, cursorPosition);
    const match = beforeCursor.match(/workflow\.([^}\s]*)$/);
    
    if (match) {
      const partialPath = match[1];
      this.showVariableAutocomplete(textareaElement, partialPath);
    } else {
      this.hideAutocomplete();
    }
  }

  // Show autocomplete dropdown with filtered variables
  private showVariableAutocomplete(textareaElement: HTMLTextAreaElement, partialPath: string): void {
    // Force refresh variable cache to ensure we have the latest JSON schema properties
    this.refreshVariableCache();
    
    // Get all available variables
    const allVariables = [
      ...this.getWorkflowInputs(),
      ...this.getRuntimeVariables(),
      ...this.canvasNodes.flatMap(node => this.getNodeOutputs(node))
    ];
    
    console.log('🔍 Autocomplete variables available:', allVariables);
    
    // Filter variables based on partial path
    this.autocompleteVariables = allVariables.filter(variable => 
      variable.path.toLowerCase().includes(partialPath.toLowerCase())
    );
    
    console.log('🔍 Filtered autocomplete variables:', this.autocompleteVariables);
    
    if (this.autocompleteVariables.length > 0) {
      // Calculate position for dropdown
      this.calculateAutocompletePosition(textareaElement);
      this.showAutocomplete = true;
      this.activeAutocompleteIndex = 0;
    } else {
      this.hideAutocomplete();
    }
  }

  // Calculate position for autocomplete dropdown
  private calculateAutocompletePosition(textareaElement: HTMLTextAreaElement): void {
    // Position dropdown near the textarea field
    const rect = textareaElement.getBoundingClientRect();
    
    // Position dropdown to the left of the textarea, aligned with its top
    const left = rect.left - 300; // 300px to the left of textarea (dropdown width + margin)
    const top = rect.top; // Aligned with textarea top
    
    // Ensure dropdown doesn't go off-screen
    const finalLeft = Math.max(20, left);
    const finalTop = Math.max(80, top);
    
    this.autocompletePosition = { top: finalTop, left: finalLeft };
  }

  // Handle keyboard navigation in autocomplete
  onInstructionsKeydown(event: KeyboardEvent, textareaElement: HTMLTextAreaElement): void {
    if (!this.showAutocomplete) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeAutocompleteIndex = Math.min(
          this.activeAutocompleteIndex + 1,
          this.autocompleteVariables.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeAutocompleteIndex = Math.max(this.activeAutocompleteIndex - 1, 0);
        break;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        this.insertAutocompleteVariable(textareaElement);
        break;
      case 'Escape':
        event.preventDefault();
        this.hideAutocomplete();
        break;
    }
  }

  // Insert selected variable into textarea
  insertAutocompleteVariable(textareaElement: HTMLTextAreaElement): void {
    if (!this.showAutocomplete || this.autocompleteVariables.length === 0) return;

    const selectedVariable = this.autocompleteVariables[this.activeAutocompleteIndex];
    const currentValue = textareaElement.value;
    const cursorPosition = textareaElement.selectionStart;
    
    // Find the start of the current workflow variable being typed (now matches just "workflow.")
    const beforeCursor = currentValue.substring(0, cursorPosition);
    const match = beforeCursor.match(/workflow\.([^}\s]*)$/);
    
    if (match) {
      const matchStart = cursorPosition - match[0].length;
      // Automatically wrap in ${} when inserting
      const wrappedVariable = `\${${selectedVariable.path}}`;
      const newValue = 
        currentValue.substring(0, matchStart) + 
        wrappedVariable +
        currentValue.substring(cursorPosition);
      
      // Update the model and textarea
      const selectedNode = this.getSelectedNode();
      if (selectedNode?.data?.agentConfig) {
        selectedNode.data.agentConfig.instructions = newValue;
        this.nodeUpdate.emit(selectedNode);
      }
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        const newCursorPos = matchStart + wrappedVariable.length;
        textareaElement.setSelectionRange(newCursorPos, newCursorPos);
        textareaElement.focus();
      });
    }
    
    this.hideAutocomplete();
  }

  // Select autocomplete variable by clicking
  selectAutocompleteVariable(index: number, textareaElement: HTMLTextAreaElement): void {
    this.activeAutocompleteIndex = index;
    this.insertAutocompleteVariable(textareaElement);
  }

  // Hide autocomplete dropdown
  hideAutocomplete(): void {
    this.showAutocomplete = false;
    this.autocompleteVariables = [];
    this.activeAutocompleteIndex = 0;
  }
}