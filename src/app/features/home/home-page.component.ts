import { Component } from '@angular/core';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly assumptions = [
    'This is an ideal-theory calculator for ranged on a single target, built for players who want to optimize cleanly and push damage plans hard.',
    'The simulation assumes the rotation is executed well: no missed inputs, no movement loss, no interruptions, and no fight-specific downtime.',
    'Accuracy and target defence are not part of the model, so damage is evaluated as if every eligible hit connects.',
    'Minimum damage shows the lowest roll, and if a non-critical hit is possible it stays non-critical there.',
    'Maximum damage shows the highest roll, and if a critical hit is possible it assumes that top-end critical outcome.',
    'Average damage is the practical expected-value view, blending normal rolls and crit behaviour into one realistic planning number.',
  ];
}
