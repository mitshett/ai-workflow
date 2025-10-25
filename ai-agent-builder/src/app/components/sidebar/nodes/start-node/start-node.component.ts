import { Component } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { NodeType } from '../../../../models/workflow.models';

@Component({
  selector: 'app-start-node',
  standalone: true,
  imports: [
    DragDropModule,
    ButtonComponent,
    IconComponent
  ],
  templateUrl: './start-node.component.html',
  styleUrl: './start-node.component.scss'
})
export class StartNodeComponent {
  
  // Node properties
  readonly nodeType: NodeType = 'start';
  readonly iconName = 'play-circle';
  readonly label = 'Start';
}