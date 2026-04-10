/**
 * Item registry. Each concrete item type is defined as a custom
 * element in its own file and auto-registers via the `@customElement`
 * decorator side-effect. This file pulls them all in (via side-effect
 * imports) and exposes a type→metadata lookup for the card and editor.
 */

import type { ItemType } from '../types';
import type { ItemBase } from './base';

// Side-effect imports: registers the custom elements
import './button';
import './entity';
import './dpad';
import './color-buttons';
import './slider';
import './media';
import './source';
import './numbers';

import { ButtonItem, renderButtonEditor } from './button';
import { EntityItem, renderEntityEditor } from './entity';
import { DpadItem, renderDpadEditor } from './dpad';
import { ColorButtonsItem, renderColorButtonsEditor } from './color-buttons';
import { SliderItem, renderSliderEditor } from './slider';
import { MediaItem, renderMediaEditor } from './media';
import { SourceItem, renderSourceEditor } from './source';
import { NumbersItem, renderNumbersEditor } from './numbers';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import type { TemplateResult } from 'lit';

/** Static metadata + class reference for an item type. The `cls` field
 *  carries the LitElement class (used for tag lookup via `tagName` and
 *  static methods like `getSize()` / `normalizeSpan()`). */
export interface ItemMeta {
  tagName: string;
  cls: typeof ItemBase;
  renderEditor: (editor: GridRemoteCardEditor, item: Item, index: number) => TemplateResult;
}

export const ITEMS: Record<ItemType, ItemMeta> = {
  button:        { tagName: 'grc-button-item',        cls: ButtonItem,        renderEditor: renderButtonEditor },
  entity:        { tagName: 'grc-entity-item',        cls: EntityItem,        renderEditor: renderEntityEditor },
  dpad:          { tagName: 'grc-dpad-item',          cls: DpadItem,          renderEditor: renderDpadEditor },
  color_buttons: { tagName: 'grc-color-buttons-item', cls: ColorButtonsItem,  renderEditor: renderColorButtonsEditor },
  slider:        { tagName: 'grc-slider-item',        cls: SliderItem,        renderEditor: renderSliderEditor },
  media:         { tagName: 'grc-media-item',         cls: MediaItem,         renderEditor: renderMediaEditor },
  source:        { tagName: 'grc-source-item',        cls: SourceItem,        renderEditor: renderSourceEditor },
  numbers:       { tagName: 'grc-numbers-item',       cls: NumbersItem,       renderEditor: renderNumbersEditor },
};

export { ItemBase } from './base';
export {
  ButtonItem, EntityItem, DpadItem, ColorButtonsItem,
  SliderItem, MediaItem, SourceItem, NumbersItem,
};
