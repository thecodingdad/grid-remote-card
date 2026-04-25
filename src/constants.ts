/**
 * Static constants — sizes, variants, labels, defaults.
 * Pure data, no behavior. Imports only from ./types.
 */

import type { ItemSize, ItemType, ItemVariant } from './types';

export const HOLD_DELAY_MS = 500;
export const DEFAULT_REPEAT_INTERVAL_MS = 200;

export const ITEM_SIZES: Record<ItemType, ItemSize> = {
  dpad:          { cols: 3, rows: 3 },
  color_buttons: { cols: 3, rows: 1 },
  slider:        { cols: 3, rows: 1 },
  media:         { cols: 3, rows: 2 },
  button:        { cols: 1, rows: 1 },
  source:        { cols: 1, rows: 1 },
  numbers:       { cols: 1, rows: 1 },
  entity:        { cols: 1, rows: 1 },
  label:         { cols: 2, rows: 1 },
};

export const ITEM_TYPES: ItemType[] = Object.keys(ITEM_SIZES) as ItemType[];

export const ITEM_VARIANTS: ItemVariant[] = [
  'round', 'rounded', 'square', 'pill',
  'pill_top', 'pill_bottom', 'pill_left', 'pill_right',
];
export const BUTTON_VARIANTS = ITEM_VARIANTS;
export const SLIDER_VARIANTS: (ItemVariant | 'classic')[] = [...ITEM_VARIANTS, 'classic'];

export const VARIANT_LABELS: Record<string, string> = {
  round:       'Round',
  rounded:     'Rounded',
  square:      'Square',
  pill:        'Pill',
  pill_top:    'Pill top',
  pill_bottom: 'Pill bottom',
  pill_left:   'Pill left',
  pill_right:  'Pill right',
  classic:     'Classic',
};

export const VARIANT_CSS_CLASS: Record<string, string> = {
  round:       'round',
  rounded:     'rounded',
  square:      'square',
  pill:        'pill',
  pill_top:    'pill-top',
  pill_bottom: 'pill-bottom',
  pill_left:   'pill-left',
  pill_right:  'pill-right',
};

export const INACTIVE_STATES = new Set([
  'off', 'unavailable', 'unknown', 'idle', 'standby',
  'closed', 'not_home', 'below_horizon', 'docked', 'not_running',
]);

