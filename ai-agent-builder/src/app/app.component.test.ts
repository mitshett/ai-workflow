import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div style="padding: 20px; font-family: Arial, sans-serif; background: white; color: black; min-height: 100vh;">
      <h1 style="color: green;">🚀 AI Agent Builder - Test Loading</h1>
      <p>If you can see this, the Angular app is working!</p>
      <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <h3>Component Status:</h3>
        <ul>
          <li>✅ Basic Angular app loads</li>
          <li>✅ TypeScript compilation works</li>
          <li>✅ CSS styling applies</li>
        </ul>
      </div>
      <p style="margin-top: 20px;">Current time: {{ currentTime }}</p>
    </div>
  `
})
export class TestAppComponent {
  title = 'AI Agent Builder - Test Mode';
  currentTime = new Date().toLocaleString();

  constructor() {
    console.log('🔥 TestAppComponent constructor called!');
    console.log('⏰ Time:', this.currentTime);
  }
}