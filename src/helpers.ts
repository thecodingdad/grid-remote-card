/**
 * Pure helper functions: color resolution, slider defaults per domain,
 * item size calculation, condition evaluator.
 */

import type { HassEntity, HomeAssistant, Item, ItemSize, PageCondition, SliderDefaults } from './types';
import { ITEM_SIZES } from './constants';

/** Resolve HA ui_color names (e.g. "deep-purple") to CSS color values. */
export function resolveColor(value: string | undefined | null): string {
  if (!value) return '';
  if (
    value.startsWith('#') ||
    value.startsWith('rgb') ||
    value.startsWith('hsl') ||
    value.startsWith('var(')
  ) {
    return value;
  }
  return `var(--${value}-color, ${value})`;
}

/** Auto-detect slider config based on entity domain. */
export function getSliderDefaults(
  entityId: string | undefined,
  stateObj: HassEntity | null | undefined,
): SliderDefaults | null {
  if (!entityId || !stateObj) return null;
  const domain = entityId.split('.')[0];
  const attrs = stateObj.attributes || {};
  switch (domain) {
    case 'light':
      return {
        attribute: 'brightness',
        service: 'light.turn_on',
        service_field: 'brightness',
        min: 0, max: 255, step: 1,
        icon: 'mdi:brightness-6',
      };
    case 'media_player':
      return {
        attribute: 'volume_level',
        service: 'media_player.volume_set',
        service_field: 'volume_level',
        min: 0, max: 1, step: 0.01,
        icon: 'mdi:volume-high',
      };
    case 'cover':
      return {
        attribute: 'current_position',
        service: 'cover.set_cover_position',
        service_field: 'position',
        min: 0, max: 100, step: 1,
        icon: 'mdi:window-shutter',
      };
    case 'fan':
      return {
        attribute: 'percentage',
        service: 'fan.set_percentage',
        service_field: 'percentage',
        min: 0, max: 100, step: 1,
        icon: 'mdi:fan',
      };
    case 'input_number':
    case 'number':
      return {
        attribute: null,
        service: `${domain}.set_value`,
        service_field: 'value',
        min: attrs.min ?? 0,
        max: attrs.max ?? 100,
        step: attrs.step ?? 1,
        icon: 'mdi:numeric',
      };
    default:
      return {
        attribute: null,
        service: null,
        service_field: null,
        min: 0, max: 100, step: 1,
        icon: 'mdi:tune-variant',
      };
  }
}

/** Compute the grid span of an item based on its type and user overrides. */
export function getItemSize(item: Item): ItemSize {
  const base = ITEM_SIZES[item.type] || { cols: 1, rows: 1 };
  if (item.type === 'dpad') {
    const s = item.col_span || base.cols;
    return { cols: s, rows: s }; // dpad always square
  }
  if (item.type === 'slider') {
    if (item.orientation === 'vertical') {
      return { cols: 1, rows: item.row_span || base.cols };
    }
    return { cols: item.col_span || base.cols, rows: 1 };
  }
  if (item.type === 'color_buttons') {
    return { cols: item.col_span || base.cols, rows: 1 };
  }
  return {
    cols: item.col_span || base.cols,
    rows: item.row_span || base.rows,
  };
}

// -- Page condition evaluator --------------------------------------------------

export function collectConditionEntities(cond: PageCondition | undefined, set: Set<string>): void {
  if (!cond) return;
  if (cond.entity) set.add(cond.entity);
  if (Array.isArray(cond.conditions)) {
    for (const sub of cond.conditions) collectConditionEntities(sub, set);
  }
}

export function checkConditionsMet(
  conditions: PageCondition[] | undefined,
  hass: HomeAssistant,
): boolean {
  if (!conditions?.length) return true;
  return conditions.every((c) => checkSingleCondition(c, hass));
}

function checkSingleCondition(c: PageCondition, hass: HomeAssistant): boolean {
  if (!c?.condition) return true;
  switch (c.condition) {
    case 'state': {
      if (!c.entity) return false;
      const s = hass.states[c.entity];
      if (!s) return false;
      if ('state' in c && c.state !== undefined) {
        const vals = Array.isArray(c.state) ? c.state : [String(c.state)];
        return vals.includes(s.state);
      }
      if ('state_not' in c && c.state_not !== undefined) {
        const vals = Array.isArray(c.state_not) ? c.state_not : [String(c.state_not)];
        return !vals.includes(s.state);
      }
      return false;
    }
    case 'numeric_state': {
      if (!c.entity) return false;
      const s = hass.states[c.entity];
      if (!s) return false;
      const val = parseFloat(s.state);
      if (isNaN(val)) return false;
      if ('above' in c && c.above !== undefined && val <= c.above) return false;
      if ('below' in c && c.below !== undefined && val >= c.below) return false;
      return true;
    }
    case 'and':
      return c.conditions?.every((sub) => checkSingleCondition(sub, hass)) ?? true;
    case 'or':
      return c.conditions?.some((sub) => checkSingleCondition(sub, hass)) ?? false;
    case 'not':
      return !c.conditions?.some((sub) => checkSingleCondition(sub, hass));
    default:
      return true;
  }
}
