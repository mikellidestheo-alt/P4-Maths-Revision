import type { Answer } from '../../engine/types';
import type { PadController } from '../numpad';

export interface WidgetCtx {
  pad: PadController;
  onChange(): void;
}

export interface Widget {
  el: HTMLElement;
  /** show the number pad under this widget */
  usesPad: boolean;
  getAnswer(): Answer;
  setLocked(locked: boolean): void;
  /** draw the correct answer (after the worked solution is shown) */
  reveal?(expected: Answer): void;
  destroy?(): void;
}
