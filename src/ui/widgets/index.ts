import type { Interaction } from '../../engine/types';
import type { Widget, WidgetCtx } from './types';
import { choiceWidget, fieldsWidget } from './fields';
import { placeValueWidget, slideWidget } from './placevalue';
import { numberLineWidget } from './numberline';
import { orderWidget } from './order';
import { clockWidget } from './clock';
import { gridWidget } from './grid';
import { columnWidget } from './column';
import { binsWidget } from './bins';
import { lineSelectWidget } from './lineselect';

export type { Widget, WidgetCtx } from './types';

export function createWidget(it: Interaction, ctx: WidgetCtx): Widget {
  switch (it.type) {
    case 'fields': return fieldsWidget(it, ctx);
    case 'choice': return choiceWidget(it, ctx);
    case 'placeValue': return placeValueWidget(it, ctx);
    case 'slide': return slideWidget(it, ctx);
    case 'numberLine': return numberLineWidget(it, ctx);
    case 'order': return orderWidget(it, ctx);
    case 'clock': return clockWidget(it, ctx);
    case 'grid': return gridWidget(it, ctx);
    case 'column': return columnWidget(it, ctx);
    case 'bins': return binsWidget(it, ctx);
    case 'lineSelect': return lineSelectWidget(it, ctx);
  }
}
