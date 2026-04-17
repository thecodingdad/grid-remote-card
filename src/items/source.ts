/**
 * SourceItem — a button that opens a popup with a list of sources
 * (media player sources or `select` options). The popup is rendered
 * in the parent card's shadow DOM (via `renderSourcePopup(card)`)
 * because overlays would be clipped if they lived in the item's own
 * shadow DOM.
 *
 * Source-Item opens the popup by dispatching a custom event that the
 * card listens for in its `connectedCallback`. Media tiles reuse the
 * same mechanism, so source resolution/rendering is shared here.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCard } from '../card';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import { VARIANT_CSS_CLASS } from '../constants';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';
import {
  btnTextStyles,
  remoteBtnStyles,
  rippleStyles,
  variantRadiusStyles,
} from './shared-styles';

export const OPEN_SOURCE_POPUP_EVENT = 'grc-open-source-popup';

export interface OpenSourcePopupDetail {
  itemIndex: number;
  anchorEl: HTMLElement;
}

const SCHEMA_SOURCE_ENTITY = [
  { name: 'source_entity', selector: { entity: { include_domains: ['select', 'media_player'] } } },
];

@customElement('grc-source-item')
export class SourceItem extends ItemBase {
  static override readonly label = 'Source button';

  static override applyPresetEntity(item: Item, entityId: string): void { item.source_entity = entityId; }
  static override readonly editorIcon = 'mdi:import';
  static override readonly defaultSize = { cols: 1, rows: 1 };
  static override readonly defaultIcon = 'mdi:import';

  static override styles = [
    remoteBtnStyles,
    variantRadiusStyles,
    rippleStyles,
    btnTextStyles,
    css`
      :host { display: block; width: 100%; height: 100%; }
    `,
  ];

  /** Open the source popup on tap when no custom tap_action is set. */
  override handleItemAction(
    actionType: string,
    anchorEl: HTMLElement,
    _subButton: string | null,
  ): boolean {
    if (actionType !== 'tap') return false;
    const ta = this.item.tap_action as any;
    if (ta && ta.action && ta.action !== 'none') return false;
    this.dispatchEvent(new CustomEvent<OpenSourcePopupDetail>(OPEN_SOURCE_POPUP_EVENT, {
      detail: { itemIndex: this.index, anchorEl },
      bubbles: true,
      composed: true,
    }));
    return true;
  }

  protected override render(): TemplateResult {
    const item = this.item;
    const cfg = this.card._config;
    const icon = item.icon ?? (item.text ? null : SourceItem.defaultIcon);
    const text = item.text ?? (item.icon ? null : '');
    const iconColor = resolveColor(item.icon_color || cfg.icon_color || '');
    const textColor = resolveColor(item.text_color || cfg.text_color || '');
    const bgColor = resolveColor(item.background_color || cfg.button_background_color || '');
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    const variantClass = VARIANT_CSS_CLASS[item.variant || 'pill'] || '';

    return html`
      <button class="remote-btn ${variantClass}" style="${style}"
              @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, null)}
              @pointerup=${(e: PointerEvent) => this._onPointerUp(e, null)}
              @pointermove=${(e: PointerEvent) => this._onPointerMove(e)}
              @pointerleave=${(e: PointerEvent) => this._onPointerCancel(e)}
              @pointercancel=${(e: PointerEvent) => this._onPointerCancel(e)}
              @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="ripple-container"></span>
        ${icon
          ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
          : html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text || ''}</span>`}
      </button>
    `;
  }
}

// -- Popup runtime (rendered into card's shadow DOM) -------------------------

/** Resolve the effective source list for an item — merging automatic
 *  sources from the entity (media_player source_list or select options)
 *  with manual overrides, respecting source_order and hidden flags. */
export function getResolvedSources(card: GridRemoteCard, itemIndex: number | null): any[] {
  if (itemIndex == null) return [];
  const item = card._items[itemIndex] as any;
  if (!item) return [];
  const manualSources: any[] = item.sources ?? [];
  const entityId = item.source_entity || (item.type === 'media' ? item.entity_id : null);
  if (!entityId || !card.hass) return manualSources;

  const entity = card.hass.states[entityId];
  if (!entity) return manualSources;

  const domain = entityId.split('.')[0];
  let options: string[] = [];
  if (domain === 'select') options = entity.attributes.options ?? [];
  else if (domain === 'media_player') options = entity.attributes.source_list ?? [];
  if (!options.length) return manualSources;

  const manualByName: Record<string, any> = {};
  const extraManual: any[] = [];
  for (const m of manualSources) {
    if (m.name && options.includes(m.name)) manualByName[m.name] = m;
    else extraManual.push(m);
  }

  const autoSources = options.map((option) => {
    const tapAction = domain === 'select'
      ? { action: 'perform-action', perform_action: 'select.select_option', target: { entity_id: entityId }, data: { option } }
      : { action: 'perform-action', perform_action: 'media_player.select_source', target: { entity_id: entityId }, data: { source: option } };
    const base: any = { name: option, tap_action: tapAction };
    const manual = manualByName[option];
    if (manual) {
      const { tap_action: manualTap, ...manualRest } = manual;
      const merged = { ...base, ...manualRest };
      if (manualTap?.action && manualTap.action !== 'none') merged.tap_action = manualTap;
      return merged;
    }
    return base;
  });

  const allSources = [...autoSources, ...extraManual];
  const order: string[] | undefined = item.source_order;
  if (Array.isArray(order) && order.length > 0) {
    const orderMap = new Map(order.map((name, i) => [name, i]));
    allSources.sort((a, b) => {
      const ai = orderMap.has(a.name) ? orderMap.get(a.name)! : order.length;
      const bi = orderMap.has(b.name) ? orderMap.get(b.name)! : order.length;
      return ai - bi;
    });
  }
  return allSources.filter((s) => !s.hidden);
}

export function getActiveSourceName(card: GridRemoteCard, itemIndex: number | null): string | null {
  if (itemIndex == null) return null;
  const item = card._items[itemIndex] as any;
  if (!item) return null;
  const entityId = item.source_entity || (item.type === 'media' ? item.entity_id : null);
  if (!entityId || !card.hass) return null;
  const entity = card.hass.states[entityId];
  if (!entity) return null;
  const domain = entityId.split('.')[0];
  if (domain === 'select') return entity.state;
  if (domain === 'media_player') return entity.attributes.source ?? null;
  return null;
}

export function openSourcePopup(card: GridRemoteCard, itemIndex: number, anchorEl: HTMLElement): void {
  card._sourcePopupItemIdx = itemIndex;
  card._sourcePopupOpen = true;
  card._addPopupOutsideListener();
  card.updateComplete.then(() => {
    const menu = card.shadowRoot?.getElementById('source-popup-menu') as HTMLElement | null;
    if (!menu || !anchorEl) return;
    const container = card.shadowRoot?.querySelector('.remote-grid');
    if (!container) return;
    const scale = (card._config.scale || 100) / 100;
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let top = (anchorRect.bottom - containerRect.top) / scale + 8;
    if (top + menuRect.height / scale > containerRect.height / scale) {
      top = (anchorRect.top - containerRect.top) / scale - menuRect.height / scale - 8;
      if (top < 0) top = 0;
    }
    menu.style.setProperty('--grc-popup-top', `${top}px`);
    menu.style.top = `${top}px`;
    const cw = containerRect.width / scale;
    const mw = menuRect.width / scale;
    let left: number;
    if (mw > cw) {
      left = (cw - mw) / 2;
    } else {
      left = (anchorRect.left + anchorRect.width / 2 - containerRect.left) / scale - mw / 2;
      left = Math.max(0, Math.min(left, cw - mw));
    }
    menu.style.left = `${left}px`;
  });
}

export function closeSourcePopup(card: GridRemoteCard): void {
  if (card._sourcePopupOpen) {
    card._sourcePopupOpen = false;
    card._removePopupOutsideListener();
  }
}

function handleSourceTap(card: GridRemoteCard, source: any): void {
  closeSourcePopup(card);
  if (!source.tap_action || source.tap_action.action === 'none') return;
  if (card._config.haptic_tap) {
    try { navigator.vibrate?.(50); } catch (_) { /* noop */ }
  }
  card._fireHassAction({ tap_action: source.tap_action }, 'tap');
}

function renderPopupMenuItem(card: GridRemoteCard, source: any, isActive: boolean): TemplateResult {
  const hasImage = source.image;
  const iconOrImage = hasImage
    ? html`<img class="source-img popup-item-img" src="${source.image}" alt="${source.name || ''}">`
    : html`<ha-icon .icon="${source.icon || 'mdi:video-input-hdmi'}"></ha-icon>`;
  return html`
    <button class="popup-item ${isActive ? 'active' : ''}" @click=${() => handleSourceTap(card, source)}>
      <div class="popup-item-icon-wrap">${iconOrImage}</div>
      <span class="popup-item-label">${source.label || source.name || ''}</span>
    </button>
  `;
}

/** Main entry called by the card's render() to render the source popup
 *  overlay. Returns an empty string when the popup is closed. */
export function renderSourcePopup(card: GridRemoteCard): TemplateResult | '' {
  if (!card._sourcePopupOpen) return '';
  const itemIdx = card._sourcePopupItemIdx;
  const sources = getResolvedSources(card, itemIdx);
  const activeName = getActiveSourceName(card, itemIdx);
  return html`
    <div class="popup-overlay" @click=${() => closeSourcePopup(card)}></div>
    <div class="popup-menu" id="source-popup-menu">
      ${sources.length === 0
        ? html`<div class="source-empty">${t(card.hass, 'No sources configured')}</div>`
        : sources.map((s) => renderPopupMenuItem(card, s, s.name === activeName))}
    </div>
  `;
}

// -- Editor ------------------------------------------------------------------

/** Source button editor form — basis + actions + source popup config.
 *  The source popup config (entity selector + source list editor) delegates
 *  to `editor._renderSourcePopupConfigForItem()` which stays in editor.ts
 *  because it uses a lot of editor-internal drag/drop and source-list
 *  management state. */
export function renderSourceEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const basisData = {
    variant: item.variant || 'pill',
    icon: item.icon ?? '',
    text: item.text ?? '',
    icon_color: item.icon_color ?? '',
    text_color: item.text_color ?? '',
    background_color: item.background_color ?? '',
  };
  const basisSchema = [editor._variantField(), ...editor._basisFields()];

  const actionsData = {
    tap_action: item.tap_action ?? {},
    hold_action: item.hold_action ?? {},
    hold_repeat: item.hold_repeat ?? false,
    hold_repeat_interval: item.hold_repeat_interval ?? '',
  };
  const actionsSchema = editor._actionFields();

  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(basisData, basisSchema, index))}
    ${editor._renderCollapsible(`item-${index}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderItemForm(actionsData, actionsSchema, index))}
    ${editor._renderCollapsible(`item-${index}-source-popup`, t(editor.hass, 'Source-Popup'), false, html`
      ${renderSourcePopupConfig(editor, item, index)}
    `)}
  `;
}

// -- Source popup config editor (moved from editor.ts) -----------------------

const SCHEMA_AUTO_SOURCE_ITEM = [
  { name: 'label', selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'image', selector: { text: {} } },
];

const SCHEMA_SOURCE_ITEM = [
  { name: 'name', selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'image', selector: { text: {} } },
];

const _uiActionSchema = (name: string) => [{ name, selector: { ui_action: {} } }];

/** Get merged editor sources (auto from entity + manual overrides). */
export function getEditorSourcesForItem(editor: GridRemoteCardEditor, itemIndex: number): any[] {
  const item = editor._items[itemIndex];
  if (!item) return [];
  const manualSources = item.sources ?? [];
  const entityId = item.source_entity || (item.type === 'media' ? item.entity_id : null);
  let autoOptions: string[] = [];
  if (entityId && editor.hass) {
    const entity = editor.hass.states[entityId];
    if (entity) {
      const domain = entityId.split('.')[0];
      if (domain === 'select') autoOptions = entity.attributes.options ?? [];
      else if (domain === 'media_player') autoOptions = entity.attributes.source_list ?? [];
    }
  }

  const manualByName: Record<string, number> = {};
  const usedManualIndices = new Set<number>();
  for (let i = 0; i < manualSources.length; i++) {
    const m = manualSources[i];
    if (m.name && autoOptions.includes(m.name)) {
      manualByName[m.name] = i;
      usedManualIndices.add(i);
    }
  }

  const result: any[] = [];
  for (const option of autoOptions) {
    const manualIdx = manualByName[option] ?? null;
    const manual = manualIdx != null ? manualSources[manualIdx] : null;
    const merged: any = { name: option };
    if (manual) {
      if (manual.label) merged.label = manual.label;
      if (manual.icon) merged.icon = manual.icon;
      if (manual.image) merged.image = manual.image;
      if (manual.hidden) merged.hidden = true;
      if (manual.tap_action) merged.tap_action = manual.tap_action;
    }
    result.push({ ...merged, _auto: true, _manualIdx: manualIdx });
  }
  for (let i = 0; i < manualSources.length; i++) {
    if (usedManualIndices.has(i)) continue;
    result.push({ ...manualSources[i], _auto: false, _manualIdx: i });
  }

  const order = item.source_order;
  if (Array.isArray(order) && order.length > 0) {
    const orderMap = new Map(order.map((name: string, i: number) => [name, i]));
    result.sort((a, b) => {
      const ai = orderMap.has(a.name) ? orderMap.get(a.name)! : order.length;
      const bi = orderMap.has(b.name) ? orderMap.get(b.name)! : order.length;
      return ai - bi;
    });
  }
  return result;
}

function getReorderedSourcesForRender(editor: GridRemoteCardEditor, sources: any[]): any[] {
  const tagged = sources.map((s: any, i: number) => ({ ...s, _renderIdx: i }));
  if (editor._dragFromIdx == null || editor._dragToIdx == null || editor._dragFromIdx === editor._dragToIdx) {
    return tagged;
  }
  const result = [...tagged];
  const [item] = result.splice(editor._dragFromIdx, 1);
  result.splice(editor._dragToIdx, 0, item);
  return result;
}

/** The full source popup config panel: entity selector + source list + add button. */
export function renderSourcePopupConfig(
  editor: GridRemoteCardEditor,
  item: Item,
  itemIndex: number,
): TemplateResult {
  const editorSources = getEditorSourcesForItem(editor, itemIndex);
  const hasEntity = !!item.source_entity;
  const autoCount = editorSources.filter((s: any) => s._auto).length;

  return html`
    <div>
      <ha-form .hass=${editor.hass}
        .data=${{ source_entity: item.source_entity ?? '' }}
        .schema=${SCHEMA_SOURCE_ENTITY}
        .computeLabel=${(s: any) => editor._label(s)} .computeHelper=${(s: any) => editor._helper(s)}
        @value-changed=${(e: CustomEvent) => onItemSourceEntityChanged(editor, e, itemIndex)}
      ></ha-form>
      ${hasEntity && autoCount > 0 ? html`
        <p class="source-entity-hint">
          ${t(editor.hass, '{n} sources loaded from entity.', { n: autoCount })}
          ${t(editor.hass, 'Changes to automatic sources are saved as overrides.')}
        </p>
      ` : ''}
      <div class="source-list">
        ${getReorderedSourcesForRender(editor, editorSources).map((s: any, i: number) =>
          renderSourceItemEditor(editor, s, i, itemIndex))}
      </div>
      <button class="add-btn" @click=${() => addSourceToItem(editor, itemIndex)}>+ ${t(editor.hass, 'Add source')}</button>
    </div>
  `;
}

function renderSourceItemEditor(
  editor: GridRemoteCardEditor,
  source: any,
  editorIndex: number,
  itemIndex: number,
): TemplateResult {
  const isOpen = editor._openSourceIdx === editorIndex;
  const isAuto = source._auto;
  const hasOverride = isAuto && source._manualIdx != null;
  const isHidden = !!source.hidden;
  const displayName = source.label || source.name || t(editor.hass, 'Source {n}', { n: editorIndex + 1 });
  const isDragging = editor._dragFromIdx != null && source._renderIdx === editor._dragFromIdx;

  return html`
    <div class="source-item-editor ${isDragging ? 'dragging' : ''} ${isHidden ? 'hidden-source' : ''}" data-sidx="${editorIndex}">
      <div class="source-item-header ${isOpen ? 'editor-open' : ''}">
        <div class="drag-handle" @pointerdown=${(e: PointerEvent) => onSourceDragStart(editor, e, editorIndex, itemIndex)}>
          <ha-icon icon="mdi:drag" style="--mdc-icon-size:18px;"></ha-icon>
        </div>
        <span class="source-item-label" @click=${() => { editor._openSourceIdx = isOpen ? null : editorIndex; }} style="cursor:pointer;">
          ${displayName}
        </span>
        ${isAuto ? html`<span class="source-item-auto-badge">${hasOverride ? 'auto*' : 'auto'}</span>` : ''}
        ${isAuto ? html`
          <button class="icon-btn" title="${t(editor.hass, isHidden ? 'Show' : 'Hide')}"
                  @click=${() => toggleSourceHiddenForItem(editor, source, itemIndex)}>
            <ha-icon icon="${isHidden ? 'mdi:eye-off' : 'mdi:eye'}" style="--mdc-icon-size:18px;"></ha-icon>
          </button>
        ` : ''}
        <button class="icon-btn" title="${t(editor.hass, 'Edit')}"
                @click=${() => { editor._openSourceIdx = isOpen ? null : editorIndex; }}>
          <ha-icon icon="mdi:pencil" style="--mdc-icon-size:18px;"></ha-icon>
        </button>
        ${isAuto
          ? (hasOverride ? html`
              <button class="icon-btn delete-btn" title="${t(editor.hass, 'Remove override')}"
                      @click=${() => deleteSourceFromItem(editor, source._manualIdx, itemIndex)}>
                <ha-icon icon="mdi:undo" style="--mdc-icon-size:18px;"></ha-icon>
              </button>
            ` : '')
          : html`
              <button class="icon-btn delete-btn" title="${t(editor.hass, 'Remove')}"
                      @click=${() => deleteSourceFromItem(editor, source._manualIdx, itemIndex)}>
                <ha-icon icon="mdi:delete" style="--mdc-icon-size:18px;"></ha-icon>
              </button>
            `}
      </div>
      ${isOpen ? html`
        <div class="source-item-editor-slot">
          <ha-form .hass=${editor.hass}
            .data=${isAuto
              ? { label: source.label ?? '', icon: source.icon ?? '', image: source.image ?? '' }
              : { name: source.name ?? '', icon: source.icon ?? '', image: source.image ?? '' }}
            .schema=${isAuto ? SCHEMA_AUTO_SOURCE_ITEM : SCHEMA_SOURCE_ITEM}
            .computeLabel=${(s: any) => editor._label(s)} .computeHelper=${(s: any) => editor._helper(s)}
            @value-changed=${(e: CustomEvent) => onEditorSourceChanged(editor, e, source, itemIndex)}
          ></ha-form>
          ${!isAuto ? html`
            <div class="action-field">
              <ha-form .hass=${editor.hass}
                .data=${{ tap_action: source.tap_action ?? {} }}
                .schema=${_uiActionSchema('tap_action')}
                .computeLabel=${(s: any) => editor._label(s)} .computeHelper=${(s: any) => editor._helper(s)}
                @value-changed=${(e: CustomEvent) => onEditorSourceActionChanged(editor, e, source, itemIndex)}
              ></ha-form>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// -- Source config handlers ---------------------------------------------------

function onItemSourceEntityChanged(editor: GridRemoteCardEditor, e: CustomEvent, itemIndex: number): void {
  e.stopPropagation();
  const val = e.detail.value.source_entity;
  editor._updateItemField(itemIndex, (item) => {
    if (val) item.source_entity = val;
    else delete item.source_entity;
    return item;
  });
}

function onEditorSourceChanged(editor: GridRemoteCardEditor, e: CustomEvent, editorSource: any, itemIndex: number): void {
  e.stopPropagation();
  const val = e.detail.value;
  editor._updateItemField(itemIndex, (item) => {
    const sources = [...(item.sources ?? [])];
    if (editorSource._auto) {
      const overrideData: any = { name: editorSource.name };
      if (val.label) overrideData.label = val.label;
      if (val.icon) overrideData.icon = val.icon;
      if (val.image) overrideData.image = val.image;
      if (editorSource._manualIdx != null) {
        sources[editorSource._manualIdx] = { ...sources[editorSource._manualIdx], ...overrideData };
        for (const key of ['label', 'icon', 'image']) {
          if (!sources[editorSource._manualIdx][key]) delete sources[editorSource._manualIdx][key];
        }
      } else {
        if (val.label || val.icon || val.image) sources.push(overrideData);
      }
    } else {
      const idx = editorSource._manualIdx;
      if (idx != null) {
        sources[idx] = { ...sources[idx], ...val };
        for (const key of ['icon', 'image']) {
          if (!sources[idx][key]) delete sources[idx][key];
        }
      }
    }
    if (sources.length > 0) item.sources = sources;
    else delete item.sources;
    return item;
  });
}

function onEditorSourceActionChanged(editor: GridRemoteCardEditor, e: CustomEvent, editorSource: any, itemIndex: number): void {
  e.stopPropagation();
  const val = e.detail.value.tap_action;
  const idx = editorSource._manualIdx;
  if (idx != null) {
    editor._updateItemField(itemIndex, (item) => {
      const sources = [...(item.sources ?? [])];
      sources[idx] = { ...sources[idx], tap_action: val };
      item.sources = sources;
      return item;
    });
  }
}

function toggleSourceHiddenForItem(editor: GridRemoteCardEditor, editorSource: any, itemIndex: number): void {
  editor._updateItemField(itemIndex, (item) => {
    const sources = [...(item.sources ?? [])];
    const newHidden = !editorSource.hidden;
    if (editorSource._manualIdx != null) {
      sources[editorSource._manualIdx] = { ...sources[editorSource._manualIdx], name: editorSource.name };
      if (newHidden) sources[editorSource._manualIdx].hidden = true;
      else delete sources[editorSource._manualIdx].hidden;
    } else {
      sources.push({ name: editorSource.name, hidden: true });
    }
    item.sources = sources;
    return item;
  });
}

function addSourceToItem(editor: GridRemoteCardEditor, itemIndex: number): void {
  editor._updateItemField(itemIndex, (item) => {
    const sources = [...(item.sources ?? [])];
    sources.push({ name: '', icon: 'mdi:video-input-hdmi' });
    item.sources = sources;
    editor._openSourceIdx = sources.length - 1;
    return item;
  });
}

function deleteSourceFromItem(editor: GridRemoteCardEditor, sourceIndex: number, itemIndex: number): void {
  if (editor._openSourceIdx === sourceIndex) editor._openSourceIdx = null;
  else if (editor._openSourceIdx != null && editor._openSourceIdx > sourceIndex) editor._openSourceIdx--;
  editor._updateItemField(itemIndex, (item) => {
    const sources = (item.sources ?? []).filter((_: any, i: number) => i !== sourceIndex);
    if (sources.length > 0) item.sources = sources;
    else delete item.sources;
    return item;
  });
}

// -- Source drag-and-drop ----------------------------------------------------

function onSourceDragStart(editor: GridRemoteCardEditor, e: PointerEvent, editorIndex: number, itemIndex: number): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const handle = e.currentTarget as HTMLElement;
  handle.setPointerCapture(e.pointerId);
  editor._dragFromIdx = editorIndex;
  editor._dragToIdx = editorIndex;
  editor._sourceDragPointerId = e.pointerId;
  editor._sourceDragItemIdx = itemIndex;

  handle.addEventListener('pointermove', editor._onSourceDragMoveBound ??= (ev: PointerEvent) => onSourceDragMove(editor, ev), { passive: true });
  handle.addEventListener('pointerup', editor._onSourceDragEndBound ??= (ev: PointerEvent) => onSourceDragEnd(editor, ev));
  handle.addEventListener('pointercancel', editor._onSourceDragCancelBound ??= (ev: PointerEvent) => onSourceDragCancelEvt(editor, ev));
}

function onSourceDragMove(editor: GridRemoteCardEditor, e: PointerEvent): void {
  if (editor._dragFromIdx == null) return;
  const list = editor.shadowRoot?.querySelector('.source-list');
  if (!list) return;
  const items = [...list.querySelectorAll('.source-item-editor')];
  const y = e.clientY;
  const current = editor._dragToIdx;
  let newIdx = current;
  for (let i = (current ?? 0) - 1; i >= 0; i--) {
    if (y < items[i].getBoundingClientRect().bottom) newIdx = i;
    else break;
  }
  if (newIdx === current) {
    for (let i = (current ?? 0) + 1; i < items.length; i++) {
      if (y > items[i].getBoundingClientRect().top) newIdx = i;
      else break;
    }
  }
  if (newIdx !== editor._dragToIdx) editor._dragToIdx = newIdx;
}

function onSourceDragEnd(editor: GridRemoteCardEditor, e: PointerEvent): void {
  if (editor._dragFromIdx == null) return;
  const from = editor._dragFromIdx;
  const to = editor._dragToIdx;
  const itemIdx = editor._sourceDragItemIdx;
  sourceDragCleanup(editor, e);
  if (from !== to) commitSourceMove(editor, from!, to!, itemIdx!);
}

function onSourceDragCancelEvt(editor: GridRemoteCardEditor, e: PointerEvent): void {
  sourceDragCleanup(editor, e);
}

function sourceDragCleanup(editor: GridRemoteCardEditor, e: PointerEvent): void {
  const handle = e?.currentTarget as HTMLElement | null;
  if (handle) {
    handle.releasePointerCapture?.(editor._sourceDragPointerId!);
    if (editor._onSourceDragMoveBound) handle.removeEventListener('pointermove', editor._onSourceDragMoveBound);
    if (editor._onSourceDragEndBound) handle.removeEventListener('pointerup', editor._onSourceDragEndBound);
    if (editor._onSourceDragCancelBound) handle.removeEventListener('pointercancel', editor._onSourceDragCancelBound);
  }
  editor._dragFromIdx = null;
  editor._dragToIdx = null;
  editor._sourceDragPointerId = null;
  editor._sourceDragItemIdx = null;
}

function commitSourceMove(editor: GridRemoteCardEditor, fromIdx: number, toIdx: number, itemIndex: number): void {
  if (itemIndex == null) return;
  const editorSources = getEditorSourcesForItem(editor, itemIndex);
  const order = editorSources.map((s: any) => s.name);
  const [name] = order.splice(fromIdx, 1);
  order.splice(toIdx, 0, name);
  if (editor._openSourceIdx === fromIdx) editor._openSourceIdx = toIdx;
  else if (editor._openSourceIdx != null) {
    if (fromIdx < editor._openSourceIdx && toIdx >= editor._openSourceIdx) editor._openSourceIdx--;
    else if (fromIdx > editor._openSourceIdx && toIdx <= editor._openSourceIdx) editor._openSourceIdx++;
  }
  editor._updateItemField(itemIndex, (item) => {
    item.source_order = order;
    return item;
  });
}
