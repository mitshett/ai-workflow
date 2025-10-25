import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SearchComponent } from '@polarity/components/search';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    SearchComponent
  ],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss'
})
export class SearchBarComponent {
  
  // Input properties
  @Input() placeholder: string = 'Insert node...';
  @Input() size: 'small' | 'medium' = 'small';
  
  // Output events (TODO: Wire up search functionality later)
  @Output() searchChanged = new EventEmitter<string>();
}