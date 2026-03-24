import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly navItems = [
    { label: 'Gear', path: '/gear' },
    { label: 'Abilities', path: '/abilities' },
    { label: 'Buffs', path: '/buffs' },
    { label: 'Rotation Planner', path: '/rotation-planner' },
    { label: 'Results', path: '/results' },
    { label: 'Import / Export', path: '/import-export' },
  ];
}
