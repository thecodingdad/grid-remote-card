/**
 * Core type definitions for grid-remote-card.
 *
 * Philosophy: loose item types. The editor frequently builds partial items
 * while the user is clicking through forms, so strict discriminated unions
 * would force casts everywhere. Instead, Item is one flat interface with
 * optional fields and a `type` discriminator. Pure consumer code (rendering)
 * can still narrow via `if (item.type === 'slider')`.
 */

import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import type { HassEntity } from 'home-assistant-js-websocket';

export type { HomeAssistant, HassEntity };

/**
 * Loose action config. HA's own GrcAction type from custom-card-helpers
 * doesn't know about the newer `perform-action` form and would force `as any`
 * casts at every call site. We accept anything and rely on HA's handleAction
 * to validate at runtime.
 */
export type GrcAction = Record<string, any>;

export type ItemType =
  | 'button'
  | 'dpad'
  | 'color_buttons'
  | 'slider'
  | 'media'
  | 'source'
  | 'numbers'
  | 'entity';

export type ItemVariant =
  | 'round'
  | 'rounded'
  | 'square'
  | 'pill'
  | 'pill_top'
  | 'pill_bottom'
  | 'pill_left'
  | 'pill_right';

export type SliderVariant = ItemVariant | 'classic';

export type DpadDirection = 'up' | 'down' | 'left' | 'right' | 'ok';

export type ColorButtonKey = 'red' | 'green' | 'yellow' | 'blue';

export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'dash' | 'enter';

export interface SubButtonConfig {
  icon?: string;
  text?: string;
  icon_color?: string;
  text_color?: string;
  background_color?: string;
  color?: string; // color_buttons only
  tap_action?: GrcAction;
  hold_action?: GrcAction;
  hold_repeat?: boolean;
  hold_repeat_interval?: number;
  [key: string]: any;
}

export interface Item {
  type: ItemType;
  row: number;
  col: number;
  page?: number;

  // Span
  col_span?: number;
  row_span?: number;

  // Common visual
  variant?: ItemVariant | SliderVariant;
  icon?: string;
  text?: string;
  icon_color?: string;
  text_color?: string;
  background_color?: string;

  // Common actions
  tap_action?: GrcAction;
  hold_action?: GrcAction;
  hold_repeat?: boolean;
  hold_repeat_interval?: number;

  // Entity-linked items
  entity_id?: string;
  source_entity?: string;
  show_state_background?: boolean;

  // Slider
  orientation?: 'horizontal' | 'vertical';
  attribute?: string;
  min?: number;
  max?: number;
  step?: number;
  show_icon?: boolean;
  slider_live?: boolean;

  // Media tile
  show_info?: boolean;
  scroll_info?: boolean;
  fallback_icon?: string;

  // Numpad
  hide_dash?: boolean;
  hide_enter?: boolean;

  // Sub-buttons (dpad, color_buttons, numbers)
  buttons?: Record<string, SubButtonConfig>;

  // Source popup configuration
  sources?: SourceEntry[];
  source_order?: string[];

  // Slider service override (rare — auto-detected from entity domain)
  service?: string;
  service_field?: string;

  // Internal preset marker
  _secondary?: boolean;

  // Index signature — allows dynamic string access from the editor's
  // generic update handlers without type gymnastics. Keep last.
  [key: string]: any;
}

export interface SourceEntry {
  name?: string;
  label?: string;
  icon?: string;
  image?: string;
  hidden?: boolean;
  tap_action?: GrcAction;
  [key: string]: any;
}

export interface PageCondition {
  condition?: string;
  entity?: string;
  state?: string | string[];
  state_not?: string | string[];
  above?: number;
  below?: number;
  conditions?: PageCondition[];
}

export interface GridRemoteCardConfig extends LovelaceCardConfig {
  items?: Item[];
  columns?: number;
  rows?: number;
  scale?: number;
  sizing?: 'normal' | 'stretch';
  page_count?: number;
  page_conditions?: PageCondition[][];
  card_background_color?: string;
  icon_color?: string;
  text_color?: string;
  button_background_color?: string;
  haptic_tap?: boolean;
  haptic_hold?: boolean;
  hold_repeat_interval?: number;
  _editor_page?: number;
}

export interface ItemSize {
  cols: number;
  rows: number;
}

export interface SliderDefaults {
  attribute: string | null;
  service: string | null;
  service_field: string | null;
  min: number;
  max: number;
  step: number;
  icon: string;
}

export interface PresetDefinition {
  label: string;
  icon: string;
  columns?: number;
  rows?: number;
  items?: Item[];
  entity_domain?: string;
  entity_integration?: string;
  entity_label?: string;
  secondary_entity_domain?: string;
  secondary_entity_integration?: string;
  secondary_entity_label?: string;
  dynamic?: boolean;
}
