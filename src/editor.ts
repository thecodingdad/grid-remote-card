/**
 * GridRemoteCardEditor — visual configuration UI for the card.
 *
 * This file contains the editor schemas, editor-specific CSS, and the
 * LitElement class that drives drag-drop layout editing, per-item forms,
 * and preset loading. Kept as a single file for the initial TS port;
 * may be split further in a later phase (see memory: grid-remote-card
 * Phase 5.2).
 */

import { LitElement, html, type TemplateResult } from 'lit';
import type { GridRemoteCardConfig, HomeAssistant, Item, ItemType, ItemSize } from './types';
import {
  BUTTON_VARIANTS,
  DEFAULT_REPEAT_INTERVAL_MS,
  ITEM_TYPES,
  SLIDER_VARIANTS,
  VARIANT_LABELS,
} from './constants';
import { MP_FEATURE, REMOTE_PRESETS } from './presets';
import { getItemSize } from './helpers';
import { editorStyles } from './styles';
import { t } from './i18n';
import { ITEMS } from './items';

// -- Editor schemas (only card-global ones remain; item-specific schemas
//    live in the item files under src/items/) ---------------------------------

const SCHEMA_BUTTON_BASIS = [
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
  { name: 'background_color', selector: { ui_color: {} } },
];

const SVG_SIZING_NORMAL = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 44" width="72" height="44">
    <rect x="1" y="1" width="70" height="42" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" fill="none" opacity="0.4"/>
    <rect x="22" y="4" width="28" height="36" rx="4" fill="currentColor" opacity="0.75"/>
  </svg>`;

const SVG_SIZING_STRETCH = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 44" width="72" height="44">
    <rect x="1" y="1" width="70" height="42" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" fill="none" opacity="0.4"/>
    <rect x="4" y="4" width="64" height="36" rx="4" fill="currentColor" opacity="0.75"/>
  </svg>`;

const SCHEMA_GLOBAL_APPEARANCE = [
  { name: 'card_background_color', selector: { ui_color: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
  { name: 'button_background_color', selector: { ui_color: {} } },
  { name: 'scale', selector: { number: { min: 50, max: 200, step: 5, mode: 'slider', unit_of_measurement: '%' } } },
];

const SCHEMA_GLOBAL_HAPTIC = [
  { name: 'haptic_tap', selector: { boolean: {} } },
  { name: 'haptic_double_tap', selector: { boolean: {} } },
  { name: 'haptic_hold', selector: { boolean: {} } },
  { name: 'hold_repeat_interval', selector: { number: { min: 50, max: 1000, step: 10, mode: 'box', unit_of_measurement: 'ms' } } },
];

// -- Editor labels / helpers --------------------------------------------------

const EDITOR_LABELS: Record<string, string> = {
  color: 'Color', hide_dash: 'Hide "-/--"', hide_enter: 'Hide "Enter"',
  icon: 'Icon', text: 'Text',
  icon_color: 'Icon color', text_color: 'Text color',
  background_color: 'Background color',
  card_background_color: 'Card background color',
  button_background_color: 'Button background color',
  scale: 'Scale', width: 'Width', height: 'Height',
  tap_action: 'Tap action', double_tap_action: 'Double-tap action',
  hold_action: 'Hold action',
  haptic_tap: 'On tap', haptic_double_tap: 'On double-tap',
  haptic_hold: 'On hold',
  hold_repeat_interval: 'Repeat interval',
  hold_repeat: 'Repeat on hold',
  col_span: 'Column width', row_span: 'Row height',
  name: 'Name', label: 'Display name', image: 'Image URL',
  entity_id: 'Entity',
  source_entity: 'Source entity',
  variant: 'Variant',
  columns: 'Columns', rows: 'Rows',
  orientation: 'Orientation',
  attribute: 'Attribute', min: 'Minimum', max: 'Maximum', step: 'Step size',
  show_icon: 'Show icon',
  slider_live: 'Send value while dragging',
  show_info: 'Show title/artist',
  scroll_info: 'Scroll text',
  fallback_icon: 'Fallback icon',
  show_state_background: 'Background when active',
};

const EDITOR_HELPERS: Record<string, string> = {
  color: 'Button color',
  icon: 'MDI icon (empty = default icon)',
  text: 'Text instead of icon (overrides icon)',
  icon_color: 'CSS color or variable',
  text_color: 'CSS color or variable',
  background_color: 'CSS color or variable',
  card_background_color: 'CSS color or variable',
  button_background_color: 'Global background color for all buttons',
  scale: 'Card size in percent (default: 100%)',
  width: 'CSS width value (e.g. fit-content, 100%, 300px). Default: fit-content',
  height: 'CSS height value (e.g. fit-content, 100%, 500px). Default: fit-content',
  label: 'Alternative display name (empty = original name)',
  image: 'URL to an image (e.g. /local/img.png)',
  entity_id: 'Entity for icon/image and default name',
  variant: 'Button shape',
  source_entity: 'Select or media player entity for automatic sources',
  hold_repeat_interval: 'Repeat interval in ms. Default: 200ms',
  hold_repeat: 'Repeat tap action while finger held',
  col_span: 'Number of columns the element spans',
  row_span: 'Number of rows the element spans',
  columns: 'Number of columns in the grid',
  rows: 'Number of rows in the grid',
  attribute: 'Attribute name (empty = auto from domain)',
  min: 'Minimum value (empty = auto)',
  max: 'Maximum value (empty = auto)',
  step: 'Step size (empty = auto)',
  show_icon: 'Show icon next to slider',
  slider_live: 'Send command while dragging instead of on release',
  show_info: 'Show title and artist at bottom',
  scroll_info: 'Scroll long text continuously instead of cutting off',
  fallback_icon: 'Icon if no cover available (default: mdi:music)',
  show_state_background: 'Subtly tint background when entity is active',
};

interface SchemaField { name: string; [k: string]: any }

const _label = (hass: HomeAssistant, s: SchemaField): string =>
  t(hass, EDITOR_LABELS[s.name] ?? s.name);
const _helper = (hass: HomeAssistant, s: SchemaField): string => {
  const h = EDITOR_HELPERS[s.name];
  return h ? t(hass, h) : '';
};

// Re-exported as a method on the editor class so item modules can call
// `editor._label(s)` without importing the module-private helpers.



export class GridRemoteCardEditor extends LitElement {
  static get properties() {
    return {
      hass:             { attribute: false },
      _config:          { state: true },
      _activePanel:     { state: true },
      _openItemIdx:     { state: true },
      _openSubButton:   { state: true },
      _openSourceIdx:   { state: true },
      _dragFromIdx:        { state: true },
      _dragToIdx:          { state: true },
      _currentEditorPage:  { state: true },
      _pendingPreset:      { state: true },
      _presetEntity:       { state: true },
      _presetSecondaryEntity: { state: true },
      _itemYamlMode:       { state: true },
      _conditionDialogOpen: { state: true },
    };
  }

  static styles = editorStyles;

  // Reactive + internal state (declared for TS strict mode)
  hass!: HomeAssistant;
  _config: GridRemoteCardConfig = {} as GridRemoteCardConfig;
  _activePanel: 'layout' | 'settings' = 'layout';
  _openItemIdx: number | null = null;
  _openSubButton: string | null = null;
  _openSourceIdx: number | null = null;
  _dragFromIdx: number | null = null;
  _dragToIdx: number | null = null;
  _currentEditorPage = 0;
  _itemYamlMode = false;
  _ignoreNextSetConfig = false;
  _pendingPreset: any = null;
  _presetEntity = '';
  _presetSecondaryEntity = '';
  _gridDragState: any = null;
  _addDragState: any = null;
  _dialogBoxHandler: any = null;
  _dialogBoxEditCard: any = null;
  _conditionDialogOpen = false;
  _sourceDragItemIdx: number | null = null;
  _sourceDragPointerId: number | null = null;
  _onSourceDragMoveBound: any = null;
  _onSourceDragEndBound: any = null;
  _onSourceDragCancelBound: any = null;

  constructor() {
    super();
    this._config = { type: 'custom:grid-remote-card' } as GridRemoteCardConfig;
    this._activePanel = 'layout';
    this._openItemIdx = null;
    this._openSubButton = null;
    this._openSourceIdx = null;
    this._dragFromIdx = null;
    this._dragToIdx = null;
    this._currentEditorPage = 0;
    this._itemYamlMode = false;
    this._ignoreNextSetConfig = false;
    this._pendingPreset = null;
    this._presetEntity = '';
    this._presetSecondaryEntity = '';
    this._gridDragState = null;
    this._addDragState = null;
    this._dialogBoxHandler = null;
    this._dialogBoxEditCard = null;
  }

  /** @returns {Array} Config items with fallback to empty array */
  get _items() { return this._config?.items || []; }

  get _pageCount() { return Math.max(this._config?.page_count || 1, 1); }

  setConfig(config: GridRemoteCardConfig) {
    if (this._ignoreNextSetConfig) {
      this._ignoreNextSetConfig = false;
      return;
    }
    if (!config) throw new Error('Grid Remote Card Editor: Configuration missing');
    this._config = { ...config };
  }

  connectedCallback() {
    super.connectedCallback();
    // Eagerly load dialog-box element for HA native confirmation dialogs
    if (!customElements.get('dialog-box')) {
      const ha = document.querySelector('home-assistant');
      this._dialogBoxEditCard = ha?.shadowRoot?.querySelector('hui-dialog-edit-card');
      if (this._dialogBoxEditCard?._confirmCancel) {
        this._dialogBoxHandler = (e: CustomEvent) => {
          if (e.detail?.dialogTag === 'dialog-box') {
            e.stopImmediatePropagation();
            this._dialogBoxEditCard?.removeEventListener('show-dialog', this._dialogBoxHandler, true);
            this._dialogBoxHandler = null;
            this._dialogBoxEditCard = null;
            e.detail.dialogImport?.();
          }
        };
        this._dialogBoxEditCard.addEventListener('show-dialog', this._dialogBoxHandler, { capture: true });
        this._dialogBoxEditCard._confirmCancel();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up dialog-box handler if still pending
    if (this._dialogBoxHandler && this._dialogBoxEditCard) {
      this._dialogBoxEditCard.removeEventListener('show-dialog', this._dialogBoxHandler, true);
      this._dialogBoxHandler = null;
      this._dialogBoxEditCard = null;
    }
  }

  _fireConfigChanged() {
    this._ignoreNextSetConfig = true;
    const config = { ...this._config };
    // Pass current editor page as transient property so the preview card stays on the right page
    if (this._pageCount > 1) {
      config._editor_page = this._currentEditorPage;
    }
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true, composed: true, detail: { config },
    }));
  }

  // -- Render -----------------------------------------------------------------

  render() {
    if (!this._config) return html``;
    return html`
      <div class="tabs">
        <button class="tab ${this._activePanel === 'layout' ? 'active' : ''}"
                @click=${() => { this._activePanel = 'layout'; }}>${t(this.hass, 'Layout')}</button>
        <button class="tab ${this._activePanel === 'settings' ? 'active' : ''}"
                @click=${() => { this._activePanel = 'settings'; }}>${t(this.hass, 'Settings')}</button>
      </div>
      <div class="tab-panel ${this._activePanel === 'layout' ? 'active' : ''}">
        ${this._renderLayoutPanel()}
      </div>
      <div class="tab-panel ${this._activePanel === 'settings' ? 'active' : ''}">
        ${this._renderSettingsPanel()}
      </div>
      ${this._renderConditionDialog()}
    `;
  }

  // -- Layout panel -----------------------------------------------------------

  _renderLayoutPanel() {
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const items = this._items;
    const multiPage = this._pageCount > 1;
    const pageItems: [Item, number][] = multiPage
      ? items.map((item, i): [Item, number] => [item, i]).filter(([item]: [Item, number]) => (item.page || 0) === this._currentEditorPage)
      : items.map((item, i): [Item, number] => [item, i]);
    const cellSize = 44;
    const gridStyle = `grid-template-columns:repeat(${cols},${cellSize}px);grid-template-rows:repeat(${rows},${cellSize}px);`;

    return html`
      ${this._renderGridSizeStepper('columns', cols, 1, 7, t(this.hass, 'Columns'), t(this.hass, 'Number of columns in the grid'))}
      ${this._renderGridSizeStepper('rows', rows, 1, 15, t(this.hass, 'Rows'), t(this.hass, 'Number of rows in the grid'))}

      ${this._renderPageTabs()}
      ${this._renderPresetSelector()}
      <div class="grid-editor-container">
        <div class="grid-editor" style="${gridStyle}">
          ${this._renderGridCells(cols, rows)}
          ${pageItems.map(([item, i]) => this._renderGridEditorItem(item, i))}
        </div>
        <button class="clear-all-btn" @click=${() => this._clearAllItems()} title="${t(this.hass, 'Remove all buttons')}">
          <ha-icon icon="mdi:delete-sweep-outline" style="--mdc-icon-size:20px;"></ha-icon>
        </button>
      </div>
      <div class="drag-trash-zone">
        <ha-icon icon="mdi:delete-outline" style="--mdc-icon-size:20px;"></ha-icon>
      </div>
      <div class="add-item-bar">
        <span class="add-item-label">${t(this.hass, 'Add:')}</span>
        ${ITEM_TYPES.map(type => html`
          <button class="add-type-btn" @pointerdown=${(e: PointerEvent) => this._onAddBtnPointerDown(e, type)} title="${t(this.hass, ITEMS[type].cls.label)}">
            <ha-icon icon="${ITEMS[type].cls.editorIcon}" style="--mdc-icon-size:16px;"></ha-icon>
            <span class="add-type-btn-label">${t(this.hass, ITEMS[type].cls.label).split(' ')[0]}</span>
          </button>
        `)}
      </div>
      ${this._renderSelectedItemEditor()}
    `;
  }

  _renderPresetSelector() {
    if (this._pendingPreset) {
      const preset = REMOTE_PRESETS[this._pendingPreset];
      const hasSecondary = !!preset.secondary_entity_domain;
      const canApply = this._presetEntity && (!hasSecondary || this._presetSecondaryEntity);
      return html`
        <div class="preset-bar preset-form">
          <ha-icon icon="${preset.icon}" style="--mdc-icon-size:18px;"></ha-icon>
          <span class="preset-form-label">${preset.label}</span>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: preset.entity_domain, ...(preset.entity_integration ? { integration: preset.entity_integration } : {}) } }}
            .value=${this._presetEntity}
            .label=${preset.entity_label}
            @value-changed=${(e: CustomEvent) => { this._presetEntity = e.detail.value || ''; }}
            style="flex:1;min-width:180px;"
          ></ha-selector>
          ${hasSecondary ? html`
            <ha-selector
              .hass=${this.hass}
              .selector=${{ entity: { domain: preset.secondary_entity_domain, ...(preset.secondary_entity_integration ? { integration: preset.secondary_entity_integration } : {}) } }}
              .value=${this._presetSecondaryEntity}
              .label=${preset.secondary_entity_label}
              @value-changed=${(e: CustomEvent) => { this._presetSecondaryEntity = e.detail.value || ''; }}
              style="flex:1;min-width:180px;"
            ></ha-selector>
          ` : ''}
          <button class="preset-apply-btn" @click=${() => this._confirmApplyPreset()}
                  ?disabled=${!canApply}>${t(this.hass, 'Load')}</button>
          <button class="preset-cancel-btn" @click=${() => { this._pendingPreset = null; this._presetEntity = ''; this._presetSecondaryEntity = ''; }}>${t(this.hass, 'Cancel')}</button>
        </div>
      `;
    }
    return html`
      <div class="preset-bar">
        <span class="preset-label">${t(this.hass, 'Template:')}</span>
        ${Object.entries(REMOTE_PRESETS).map(([key, preset]) => html`
          <button class="preset-btn" @click=${() => { if (preset.entity_domain) { this._pendingPreset = key; this._presetEntity = ''; this._presetSecondaryEntity = ''; } else { this._confirmApplyPresetSimple(key); } }} title="${preset.label}">
            <ha-icon icon="${preset.icon}" style="--mdc-icon-size:16px;"></ha-icon>
            <span>${preset.label}</span>
          </button>
        `)}
      </div>
    `;
  }

  _buildMediaPlayerItems(entityId: string) {
    const entity = this.hass?.states?.[entityId];
    const features = entity?.attributes?.supported_features ?? 0;
    const has = (flag: number) => (features & flag) !== 0;

    const items: any[] = [];
    let row = 0;

    // Row: Power + Source
    const hasPower = has(MP_FEATURE.TURN_ON) || has(MP_FEATURE.TURN_OFF);
    const hasSource = has(MP_FEATURE.SELECT_SOURCE);
    if (hasPower || hasSource) {
      if (hasPower)
        items.push({ type: 'button', row, col: 0, icon: 'mdi:power',
          tap_action: { action: 'perform-action', perform_action: 'media_player.toggle' } });
      if (hasSource)
        items.push({ type: 'source', row, col: 2, icon: 'mdi:import' });
      row++;
    }

    // Media-Info (always, 3×2)
    items.push({ type: 'media', row, col: 0 });
    row += 2;

    // Transport Row: Prev, Play/Pause, Next
    const hasPrev = has(MP_FEATURE.PREVIOUS_TRACK);
    const hasNext = has(MP_FEATURE.NEXT_TRACK);
    const hasPlay = has(MP_FEATURE.PLAY) || has(MP_FEATURE.PAUSE);
    if (hasPrev || hasPlay || hasNext) {
      if (hasPrev)
        items.push({ type: 'button', row, col: 0, icon: 'mdi:skip-previous',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_previous_track' } });
      if (hasPlay)
        items.push({ type: 'button', row, col: 1, icon: 'mdi:play-pause',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_play_pause' } });
      if (hasNext)
        items.push({ type: 'button', row, col: 2, icon: 'mdi:skip-next',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_next_track' } });
      row++;
    }

    // Extras Row: Shuffle, Stop, Repeat
    const hasShuffle = has(MP_FEATURE.SHUFFLE_SET);
    const hasStop = has(MP_FEATURE.STOP);
    const hasRepeat = has(MP_FEATURE.REPEAT_SET);
    if (hasShuffle || hasStop || hasRepeat) {
      if (hasShuffle)
        items.push({ type: 'button', row, col: 0, icon: 'mdi:shuffle-variant',
          tap_action: { action: 'perform-action', perform_action: 'media_player.shuffle_set' } });
      if (hasStop)
        items.push({ type: 'button', row, col: 1, icon: 'mdi:stop',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_stop' } });
      if (hasRepeat)
        items.push({ type: 'button', row, col: 2, icon: 'mdi:repeat',
          tap_action: { action: 'perform-action', perform_action: 'media_player.repeat_set' } });
      row++;
    }

    // Volume: slider if VOLUME_SET supported, otherwise Vol+/Vol- pill buttons
    const hasVolumeSet = has(MP_FEATURE.VOLUME_SET);
    const hasVolumeStep = has(MP_FEATURE.VOLUME_STEP);
    const hasMute = has(MP_FEATURE.VOLUME_MUTE);
    if (hasVolumeSet) {
      items.push({ type: 'slider', row, col: 0, col_span: 3, show_icon: true,
        slider_attribute: 'volume_level' });
      row++;
    } else if (hasVolumeStep || hasMute) {
      if (hasVolumeStep) {
        items.push({ type: 'button', variant: 'pill_top', row, col: 1, icon: 'mdi:plus', hold_repeat: true,
          tap_action: { action: 'perform-action', perform_action: 'media_player.volume_up' } });
        row++;
        items.push({ type: 'button', variant: 'pill_bottom', row, col: 1, icon: 'mdi:minus', hold_repeat: true,
          tap_action: { action: 'perform-action', perform_action: 'media_player.volume_down' } });
      }
      if (hasMute)
        items.push({ type: 'button', row, col: hasVolumeStep ? 0 : 1, icon: 'mdi:volume-off',
          tap_action: { action: 'perform-action', perform_action: 'media_player.volume_mute', data: { is_volume_muted: true } } });
      row++;
    }

    return { items, rows: Math.max(row, 3), columns: 3 };
  }

  _confirmApplyPreset() {
    const key = this._pendingPreset;
    const entityId = this._presetEntity;
    const secondaryEntityId = this._presetSecondaryEntity;
    const preset = REMOTE_PRESETS[key];
    if (!preset || !entityId) return;

    const entityText = secondaryEntityId
      ? `${entityId} + ${secondaryEntityId}`
      : entityId;

    this.dispatchEvent(new CustomEvent('show-dialog', {
      bubbles: true, composed: true,
      detail: {
        dialogTag: 'dialog-box',
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          title: t(this.hass, 'Load template'),
          text: t(this.hass, '"{label}" with {entities}? The current layout will be replaced.', { label: preset.label, entities: entityText }),
          confirmText: t(this.hass, 'Load'),
          dismissText: t(this.hass, 'Cancel'),
          destructive: true,
          confirm: () => {
            let items, cols, rows;
            if (preset.dynamic) {
              const built = this._buildMediaPlayerItems(entityId);
              items = built.items;
              cols = built.columns;
              rows = built.rows;
            } else {
              items = JSON.parse(JSON.stringify(preset.items));
              cols = preset.columns;
              rows = preset.rows;
            }
            for (const item of items) {
              const eid = (item._secondary && secondaryEntityId) ? secondaryEntityId : entityId;
              delete item._secondary;
              // Apply entity to items that need it (media → entity_id, source → source_entity)
              ITEMS[item.type as ItemType]?.cls.applyPresetEntity(item, eid);
              // Apply entity to all perform-action tap/hold/double_tap actions via data.entity_id
              for (const actionKey of ['tap_action', 'hold_action', 'double_tap_action']) {
                if (item[actionKey]?.action === 'perform-action') {
                  item[actionKey].data = { ...item[actionKey].data, entity_id: eid };
                }
              }
              // Apply entity to sub-button actions (dpad, color_buttons, numbers)
              if (item.buttons) {
                for (const btn of Object.values(item.buttons) as any[]) {
                  for (const actionKey of ['tap_action', 'hold_action', 'double_tap_action']) {
                    if (btn[actionKey]?.action === 'perform-action') {
                      btn[actionKey].data = { ...btn[actionKey].data, entity_id: eid };
                    }
                  }
                }
              }
            }
            this._currentEditorPage = 0;
            this._openItemIdx = null;
            this._pendingPreset = null;
            this._presetEntity = '';
            this._presetSecondaryEntity = '';
            this._config = {
              ...this._config,
              columns: cols,
              rows,
              items,
              page_count: undefined,
            };
            this._fireConfigChanged();
          },
        },
      },
    }));
  }

  _confirmApplyPresetSimple(key: string) {
    const preset = REMOTE_PRESETS[key];
    if (!preset) return;
    this.dispatchEvent(new CustomEvent('show-dialog', {
      bubbles: true, composed: true,
      detail: {
        dialogTag: 'dialog-box',
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          title: t(this.hass, 'Load template'),
          text: t(this.hass, '"{label}"? The current layout will be replaced.', { label: preset.label }),
          confirmText: t(this.hass, 'Load'),
          dismissText: t(this.hass, 'Cancel'),
          destructive: true,
          confirm: () => {
            const items = JSON.parse(JSON.stringify(preset.items));
            this._currentEditorPage = 0;
            this._openItemIdx = null;
            this._pendingPreset = null;
            this._presetEntity = '';
            this._presetSecondaryEntity = '';
            this._config = {
              ...this._config,
              columns: preset.columns,
              rows: preset.rows,
              items,
              page_count: undefined,
            };
            this._fireConfigChanged();
          },
        },
      },
    }));
  }

  _renderPageTabs() {
    const count = this._pageCount;
    const tabs = [];
    for (let i = 0; i < count; i++) {
      tabs.push(html`
        <button class="page-tab ${i === this._currentEditorPage ? 'active' : ''}"
                @click=${() => { this._currentEditorPage = i; this._openItemIdx = null; this._fireConfigChanged(); }}>
          ${t(this.hass, 'Page {n}', { n: i + 1 })}
          ${count > 1 ? html`
            <span class="page-tab-delete" @click=${(e: MouseEvent) => { e.stopPropagation(); this._deletePage(i); }}
                  title="${t(this.hass, 'Delete page')}">&times;</span>
          ` : ''}
        </button>
      `);
    }
    const currentConds = this._config.page_conditions?.[this._currentEditorPage];
    const hasCondition = currentConds?.length > 0;
    return html`
      <div class="page-tabs-bar">
        ${tabs}
        <button class="page-tab page-tab-add" @click=${this._addPage} title="${t(this.hass, 'New page')}">+</button>
      </div>
      ${count > 1 ? html`
        <button class="page-condition-btn ${hasCondition ? 'active' : ''}"
                @click=${() => { this._conditionDialogOpen = true; }}>
          <ha-icon icon="mdi:swap-horizontal" style="--mdc-icon-size:16px;"></ha-icon>
          ${t(this.hass, 'Conditions')}${hasCondition ? ' ' + t(this.hass, '(active)') : ''}
        </button>
      ` : ''}
    `;
  }

  _addPage() {
    const newCount = this._pageCount + 1;
    this._config = { ...this._config, page_count: newCount };
    this._currentEditorPage = newCount - 1;
    this._openItemIdx = null;
    this._fireConfigChanged();
  }

  _onPageConditionChanged(e: CustomEvent) {
    e.stopPropagation();
    const conditions = e.detail.value;
    const pageIdx = this._currentEditorPage;
    const conds = [...(this._config.page_conditions || [])];
    while (conds.length <= pageIdx) conds.push(null);
    conds[pageIdx] = conditions?.length ? conditions : null;
    while (conds.length > 0 && !conds[conds.length - 1]) conds.pop();
    const newConfig = { ...this._config };
    if (conds.length) newConfig.page_conditions = conds;
    else delete newConfig.page_conditions;
    this._config = newConfig;
    this._fireConfigChanged();
  }

  _renderConditionDialog() {
    if (!this._conditionDialogOpen) return '';
    const currentConds = this._config.page_conditions?.[this._currentEditorPage] ?? [];
    return html`
      <ha-dialog
        open
        @closed=${(e: Event) => { e.stopPropagation(); this._conditionDialogOpen = false; }}
      >
        <ha-icon-button slot="headerNavigationIcon"
          @click=${(e: MouseEvent) => { ((e.target as HTMLElement).closest('ha-dialog') as any).open = false; }}
        >
          <ha-icon icon="mdi:close"></ha-icon>
        </ha-icon-button>
        <span slot="headerTitle">${t(this.hass, 'Conditions — Page {n}', { n: this._currentEditorPage + 1 })}</span>
        <div style="padding:0 24px 24px;">
          <ha-alert alert-type="info" style="display:block;margin-bottom:16px;">
            ${t(this.hass, 'When the condition is met, the card will automatically switch to this page.')}
          </ha-alert>
          <ha-card-conditions-editor
            .hass=${this.hass}
            .conditions=${currentConds}
            @value-changed=${this._onPageConditionChanged}
          ></ha-card-conditions-editor>
        </div>
      </ha-dialog>
    `;
  }

  _deletePage(pageIdx: number) {
    const count = this._pageCount;
    if (count <= 1) return;
    const hasItems = this._items.some(item => (item.page || 0) === pageIdx);
    if (hasItems) {
      const event = new CustomEvent('show-dialog', {
        bubbles: true,
        composed: true,
        detail: {
          dialogTag: 'dialog-box',
          dialogImport: () => Promise.resolve(),
          dialogParams: {
            title: t(this.hass, 'Delete page'),
            text: t(this.hass, 'Page {n} still contains buttons. Delete page and all its buttons?', { n: pageIdx + 1 }),
            confirmText: t(this.hass, 'Delete'),
            dismissText: t(this.hass, 'Cancel'),
            destructive: true,
            confirm: () => this._doDeletePage(pageIdx),
          },
        },
      });
      this.dispatchEvent(event);
    } else {
      this._doDeletePage(pageIdx);
    }
  }

  _doDeletePage(pageIdx: number) {
    const count = this._pageCount;
    // Remove items on deleted page, shift higher pages down
    const items = this._items
      .filter(item => (item.page || 0) !== pageIdx)
      .map(item => {
        const p = item.page || 0;
        if (p > pageIdx) return { ...item, page: p - 1 };
        return item;
      });
    // Clean up page:0 since it's the default
    for (const item of items) {
      if (item.page === 0) delete item.page;
    }
    const newCount = count - 1;
    const config = { ...this._config, items, page_count: newCount > 1 ? newCount : undefined };
    // Update page_conditions: remove entry for deleted page, shift higher indices
    if (config.page_conditions) {
      const conds = [...config.page_conditions];
      conds.splice(pageIdx, 1);
      while (conds.length > 0 && !conds[conds.length - 1]) conds.pop();
      if (conds.length) config.page_conditions = conds;
      else delete config.page_conditions;
    }
    this._config = config;
    if (this._currentEditorPage >= newCount) this._currentEditorPage = newCount - 1;
    this._openItemIdx = null;
    this._fireConfigChanged();
  }

  _renderSpanEditor(item: Item, index: number) {
    const meta = ITEMS[item.type];
    if (!meta) return '';
    const { data, schema } = meta.cls.spanSchema(item);
    return html`
      ${this._renderCollapsible(`item-${index}-span`, t(this.hass, 'Size'), false, html`
        <ha-form .hass=${this.hass}
          .data=${data}
          .schema=${schema}
          .computeLabel=${(s: any) => _label(this.hass, s)} .computeHelper=${(s: any) => _helper(this.hass, s)}
          @value-changed=${(e: CustomEvent) => this._onSpanChanged(e, index)}
        ></ha-form>
      `)}
    `;
  }

  _onSpanChanged(e: CustomEvent, index: number) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item: Item = { ...items[index] };
    const meta = ITEMS[item.type];
    if (!meta) return;

    // Let the item class compute the normalized span values
    const normalized = meta.cls.normalizeSpan(item,
      val.col_span ?? meta.cls.defaultSize.cols,
      val.row_span ?? meta.cls.defaultSize.rows);
    const colSpan = normalized.col_span ?? meta.cls.defaultSize.cols;
    const rowSpan = normalized.row_span ?? meta.cls.defaultSize.rows;

    // Clamp to grid bounds
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const clampedCol = Math.min(colSpan, cols - item.col);
    const clampedRow = Math.min(rowSpan, rows - item.row);

    // Check overlap — only apply if valid
    const testItem = { ...item, col_span: clampedCol, row_span: clampedRow };
    const testSize = getItemSize(testItem);
    const page = item.page || 0;
    if (!this._canPlaceAt(items, index, testSize, item.row, item.col, cols, rows, undefined, page)) return;

    // Let the item class decide which fields to persist vs. delete
    const persisted = meta.cls.persistSpan(item, { col_span: clampedCol, row_span: clampedRow });
    if (persisted.col_span != null) item.col_span = persisted.col_span;
    else delete item.col_span;
    if (persisted.row_span != null) item.row_span = persisted.row_span;
    else delete item.row_span;

    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _renderSelectedItemEditor() {
    const items = this._items;
    const selectedItem = this._openItemIdx != null ? items[this._openItemIdx] : null;
    if (!selectedItem) return '';
    return html`
      <div class="button-editor-below">
        <div class="button-editor-below-header">
          <ha-icon .icon="${this._resolveEditorIcon(selectedItem)}" style="--mdc-icon-size:18px;"></ha-icon>
          <span>${t(this.hass, ITEMS[selectedItem.type]?.cls.label || selectedItem.type)}${selectedItem.variant ? ` (${t(this.hass, VARIANT_LABELS[selectedItem.variant] || selectedItem.variant)})` : ''} - ${t(this.hass, 'R{row}, C{col}', { row: selectedItem.row, col: selectedItem.col })}</span>
          <button class="yaml-toggle-btn ${this._itemYamlMode ? 'active' : ''}"
                  @click=${() => { this._itemYamlMode = !this._itemYamlMode; }}
                  title="${this._itemYamlMode ? t(this.hass, 'Show UI editor') : t(this.hass, 'Edit as YAML')}">
            <ha-icon icon="mdi:code-braces" style="--mdc-icon-size:18px;"></ha-icon>
          </button>
        </div>
        ${this._itemYamlMode
          ? this._renderItemYamlEditor(selectedItem, this._openItemIdx)
          : html`
            ${this._renderSpanEditor(selectedItem, this._openItemIdx)}
            ${(() => {
              const renderer = ITEMS[selectedItem.type]?.renderEditor;
              return renderer ? renderer(this, selectedItem, this._openItemIdx) : '';
            })()}
          `}
      </div>
    `;
  }

  _renderItemYamlEditor(item: Item, index: number) {
    const yaml = this._itemToYaml(item);
    return html`
      <div class="item-yaml-editor">
        <ha-code-editor
          .hass=${this.hass}
          .value=${yaml}
          mode="yaml"
          autocompleteEntities
          autocompleteIcons
          @value-changed=${(e: CustomEvent) => this._onItemYamlChanged(e, index)}
        ></ha-code-editor>
      </div>
    `;
  }

  _itemToYaml(item: Item): string {
    const obj = { ...item };
    delete obj.row;
    delete obj.col;
    try {
      const dump = (o: any, indent = 0): string => {
        const pad = '  '.repeat(indent);
        if (o === null || o === undefined) return 'null';
        if (typeof o === 'boolean') return o ? 'true' : 'false';
        if (typeof o === 'number') return String(o);
        if (typeof o === 'string') return /[\n:#{}\[\],&*?|>!%@`]/.test(o) || o === '' || o === 'true' || o === 'false' || o === 'null' || o !== o.trim() ? `"${o.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : o;
        if (Array.isArray(o)) {
          if (o.length === 0) return '[]';
          return o.map(v => `${pad}- ${dump(v, indent + 1).trimStart()}`).join('\n');
        }
        if (typeof o === 'object') {
          const keys = Object.keys(o);
          if (keys.length === 0) return '{}';
          return keys.map(k => {
            const v = o[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return `${pad}${k}:\n${dump(v, indent + 1)}`;
            }
            if (Array.isArray(v)) {
              return `${pad}${k}:\n${dump(v, indent + 1)}`;
            }
            return `${pad}${k}: ${dump(v, indent)}`;
          }).join('\n');
        }
        return String(o);
      };
      return dump(obj);
    } catch (_) { return ''; }
  }

  _yamlToItem(yaml: string, origItem: Item): Item | null {
    try {
      const lines = yaml.split('\n');
      const result: any = {};
      const stack: any[] = [{ obj: result, indent: -1 }];
      for (const rawLine of lines) {
        if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue;
        const indent = rawLine.search(/\S/);
        const line = rawLine.trim();
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        const parent = stack[stack.length - 1].obj;
        if (line.startsWith('- ')) {
          if (!Array.isArray(parent)) continue;
          const val = this._parseYamlValue(line.slice(2).trim());
          if (val && typeof val === 'object' && val.__needsNest) {
            const o: any = {}; o[val.key] = val.value;
            parent.push(o);
            stack.push({ obj: o, indent });
          } else { parent.push(val); }
          continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const rest = line.slice(colonIdx + 1).trim();
        if (rest === '' || rest === '|' || rest === '>') {
          const nextNonEmpty = lines.slice(lines.indexOf(rawLine) + 1).find(l => l.trim() !== '');
          if (nextNonEmpty && nextNonEmpty.trim().startsWith('- ')) {
            parent[key] = [];
            stack.push({ obj: parent[key], indent });
          } else {
            parent[key] = {};
            stack.push({ obj: parent[key], indent });
          }
        } else {
          parent[key] = this._parseYamlValue(rest);
        }
      }
      result.row = origItem.row;
      result.col = origItem.col;
      if (origItem.col_span && !result.col_span) result.col_span = origItem.col_span;
      if (origItem.row_span && !result.row_span) result.row_span = origItem.row_span;
      return result as Item;
    } catch (_) { return null; }
  }

  _parseYamlValue(s: string): any {
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (s === '[]') return [];
    if (s === '{}') return {};
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
    const colonIdx = s.indexOf(':');
    if (colonIdx > 0 && !s.startsWith('{')) {
      return { __needsNest: true, key: s.slice(0, colonIdx).trim(), value: this._parseYamlValue(s.slice(colonIdx + 1).trim()) };
    }
    return s;
  }

  _onItemYamlChanged(e: CustomEvent, index: number) {
    e.stopPropagation();
    const yaml = e.detail.value;
    if (!yaml) return;
    const items = [...this._items];
    const origItem = items[index];
    const newItem = this._yamlToItem(yaml, origItem);
    if (!newItem || !newItem.type) return;
    items[index] = newItem;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _renderGridCells(cols: number, rows: number) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push(html`
          <div class="grid-bg-cell" style="grid-row:${r + 1};grid-column:${c + 1};" data-row="${r}" data-col="${c}"></div>
        `);
      }
    }
    return cells;
  }

  _resolveEditorIcon(item: Item): string {
    const meta = ITEMS[item.type];
    return meta ? meta.cls.resolveEditorIcon(item, this.hass) : 'mdi:help';
  }

  _renderGridEditorItem(item: Item, idx: number) {
    const meta = ITEMS[item.type];
    if (!meta) return html``;
    const size = meta.cls.getSize(item);
    const icon = this._resolveEditorIcon(item);
    const text = meta.cls.showTextInGrid && item.text ? item.text : '';
    const isSelected = this._openItemIdx === idx;

    return html`
      <div class="grid-editor-item ${isSelected ? 'selected' : ''} type-${item.type}"
           style="grid-row:${item.row + 1}/span ${size.rows};grid-column:${item.col + 1}/span ${size.cols};"
           @pointerdown=${(e: PointerEvent) => this._onGridItemPointerDown(e, idx)}>
        ${text
          ? html`<span class="grid-item-text">${text}</span>`
          : html`<ha-icon icon="${icon}"></ha-icon>`}
        <button class="grid-item-delete"
                @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                @click=${(e: MouseEvent) => { e.stopPropagation(); this._deleteItem(idx); }}>
          <ha-icon icon="mdi:close" style="--mdc-icon-size:12px;"></ha-icon>
        </button>
      </div>
    `;
  }

  // -- Grid drag-and-drop -----------------------------------------------------

  _onGridItemPointerDown(e: PointerEvent, idx: number) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        this._startGridDrag(el, idx, ev);
      }
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      // Simple click => open editor
      const opening = this._openItemIdx !== idx;
      this._openItemIdx = opening ? idx : null;
      if (opening) {
        this.updateComplete.then(() => {
          setTimeout(() => {
            const ed = this.shadowRoot?.querySelector('.button-editor-below');
            if (ed) ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 150);
        });
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  _startGridDrag(el: HTMLElement, idx: number, e: PointerEvent) {
    const gridEl = this.shadowRoot?.querySelector('.tab-panel.active .grid-editor') as HTMLElement | null;
    if (!gridEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;

    const item = this._items[idx];
    const cellW = gridRect.width / cols;
    const cellH = gridRect.height / rows;
    const grabCol = Math.floor((e.clientX - gridRect.left) / cellW) - item.col;
    const grabRow = Math.floor((e.clientY - gridRect.top) / cellH) - item.row;
    const size = getItemSize(item);
    const anchorCol = Math.max(0, Math.min(grabCol, size.cols - 1));
    const anchorRow = Math.max(0, Math.min(grabRow, size.rows - 1));

    const trashEl = this.shadowRoot?.querySelector('.drag-trash-zone') as HTMLElement | null;
    if (trashEl) trashEl.classList.add('visible');

    this._gridDragState = {
      itemIdx: idx, el, startX: e.clientX, startY: e.clientY,
      gridRect, cols, rows, targetRow: null, targetCol: null, targetValid: false,
      anchorCol, anchorRow, trashEl, overTrash: false,
    };
    el.classList.add('dragging');

    const onMove = (ev: PointerEvent) => this._onGridDragMove(ev);
    const onUp = (ev: PointerEvent) => { this._onGridDragEnd(ev); cleanup(); };
    const onCancel = () => { this._onGridDragCancel(); cleanup(); };
    const cleanup = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  }

  _onGridDragMove(e: PointerEvent) {
    const d = this._gridDragState;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.el.style.transform = `translate(${dx}px, ${dy}px)`;

    const pointerCol = Math.floor((e.clientX - d.gridRect.left) / (d.gridRect.width / d.cols));
    const pointerRow = Math.floor((e.clientY - d.gridRect.top) / (d.gridRect.height / d.rows));
    const col = pointerCol - d.anchorCol;
    const row = pointerRow - d.anchorRow;

    // Clear highlights
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid', 'swap'));

    if (pointerCol >= 0 && pointerCol < d.cols && pointerRow >= 0 && pointerRow < d.rows) {
      const items = this._items;
      const item = items[d.itemIdx];
      const size = getItemSize(item);
      const page = items[d.itemIdx]?.page || 0;
      let valid = this._canPlaceAt(items, d.itemIdx, size, row, col, d.cols, d.rows, undefined, page);
      let swapPlacements = null;

      if (!valid) {
        swapPlacements = this._canSwapWith(items, d.itemIdx, row, col, d.cols, d.rows, page);
        if (swapPlacements) valid = true;
      }

      // Highlight target cells
      for (let r = row; r < Math.min(row + size.rows, d.rows); r++) {
        for (let c = col; c < Math.min(col + size.cols, d.cols); c++) {
          const cell = this.shadowRoot.querySelector(`.grid-bg-cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) cell.classList.add('highlight', valid ? 'valid' : 'invalid');
        }
      }
      // Highlight swap partner cells
      if (swapPlacements) {
        for (const p of swapPlacements) {
          const swapItem = items[p.idx];
          const ss = getItemSize(swapItem);
          for (let r = swapItem.row; r < swapItem.row + ss.rows; r++) {
            for (let c = swapItem.col; c < swapItem.col + ss.cols; c++) {
              const cell = this.shadowRoot.querySelector(`.grid-bg-cell[data-row="${r}"][data-col="${c}"]`);
              if (cell) cell.classList.add('highlight', 'swap');
            }
          }
        }
      }
      d.targetRow = row;
      d.targetCol = col;
      d.targetValid = valid;
      d.swapPlacements = swapPlacements;
    }

    // Check trash zone
    if (d.trashEl) {
      const tr = d.trashEl.getBoundingClientRect();
      const over = e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
      d.trashEl.classList.toggle('hover', over);
      d.overTrash = over;
    }
  }

  _onGridDragEnd(e: PointerEvent) {
    const d = this._gridDragState;
    if (!d) return;
    d.el.style.transform = '';
    d.el.classList.remove('dragging');
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid', 'swap'));
    if (d.trashEl) { d.trashEl.classList.remove('visible', 'hover'); }

    if (d.overTrash) {
      this._deleteItem(d.itemIdx);
    } else if (d.targetValid && d.targetRow != null) {
      const items = [...this._items];
      items[d.itemIdx] = { ...items[d.itemIdx], row: d.targetRow, col: d.targetCol };
      if (d.swapPlacements) {
        for (const p of d.swapPlacements) {
          items[p.idx] = { ...items[p.idx], row: p.row, col: p.col };
        }
      }
      this._config = { ...this._config, items };
      this._fireConfigChanged();
    }
    this._gridDragState = null;
  }

  _onGridDragCancel() {
    const d = this._gridDragState;
    if (!d) return;
    d.el.style.transform = '';
    d.el.classList.remove('dragging');
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid', 'swap'));
    if (d.trashEl) { d.trashEl.classList.remove('visible', 'hover'); }
    this._gridDragState = null;
  }

  // -- Drag-to-add from add-item-bar ------------------------------------------

  _onAddBtnPointerDown(e: PointerEvent, type: ItemType) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const btnEl = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    btnEl.setPointerCapture(pointerId);

    const isTouch = e.pointerType === 'touch';
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
        btnEl.removeEventListener('pointermove', onMove);
        btnEl.removeEventListener('pointerup', onUp);
        btnEl.releasePointerCapture(pointerId);
        this._startAddDrag(type, ev, isTouch);
      }
    };
    const onUp = () => {
      btnEl.removeEventListener('pointermove', onMove);
      btnEl.removeEventListener('pointerup', onUp);
      this._addItem(type);
    };
    btnEl.addEventListener('pointermove', onMove);
    btnEl.addEventListener('pointerup', onUp);
  }

  _startAddDrag(type: ItemType, e: PointerEvent, isTouch: boolean) {
    const gridEl = this.shadowRoot?.querySelector('.tab-panel.active .grid-editor') as HTMLElement | null;
    if (!gridEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const size = ITEMS[type].cls.defaultSize;
    const cellW = gridRect.width / cols;
    const cellH = gridRect.height / rows;
    const touchOffsetY = isTouch ? cellH * size.rows + 20 : 0;

    // Create ghost element
    const ghost = document.createElement('div');
    ghost.className = `grid-editor-item type-${type} dragging`;
    ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${cellW * size.cols - 4}px;height:${cellH * size.rows - 4}px;left:0;top:0;`;
    const icon = ITEMS[type].cls.editorIcon;
    ghost.innerHTML = `<ha-icon icon="${icon}" style="--mdc-icon-size:20px;pointer-events:none;"></ha-icon>`;
    this.shadowRoot?.appendChild(ghost);
    // Measure containing block offset (fixed positioning inside transformed parents)
    const ghostRect = ghost.getBoundingClientRect();
    const offsetX = ghostRect.left;
    const offsetY = ghostRect.top;
    ghost.style.left = `${e.clientX - (cellW * size.cols) / 2 - offsetX}px`;
    ghost.style.top = `${e.clientY - (cellH * size.rows) / 2 - offsetY - touchOffsetY}px`;

    this._addDragState = {
      type, ghost, gridRect, cols, rows, size, offsetX, offsetY, touchOffsetY,
      targetRow: null, targetCol: null, targetValid: false,
    };

    const onMove = (ev: PointerEvent) => this._onAddDragMove(ev);
    const onUp = () => { this._onAddDragEnd(); cleanup(); };
    const onCancel = () => { this._onAddDragCancel(); cleanup(); };
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  }

  _onAddDragMove(e: PointerEvent) {
    const d = this._addDragState;
    if (!d) return;
    const cellW = d.gridRect.width / d.cols;
    const cellH = d.gridRect.height / d.rows;
    d.ghost.style.left = `${e.clientX - (cellW * d.size.cols) / 2 - d.offsetX}px`;
    d.ghost.style.top = `${e.clientY - (cellH * d.size.rows) / 2 - d.offsetY - d.touchOffsetY}px`;

    const centerCol = (e.clientX - d.gridRect.left) / cellW;
    const centerRow = (e.clientY - d.touchOffsetY - d.gridRect.top) / cellH;
    const col = Math.round(centerCol - d.size.cols / 2);
    const row = Math.round(centerRow - d.size.rows / 2);

    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid'));

    if (centerCol >= 0 && centerCol < d.cols && centerRow >= 0 && centerRow < d.rows) {
      const items = this._items;
      const page = this._pageCount > 1 ? this._currentEditorPage : undefined;
      const valid = this._canPlaceAt(items, -1, d.size, row, col, d.cols, d.rows, undefined, page);

      for (let r = row; r < Math.min(row + d.size.rows, d.rows); r++) {
        for (let c = col; c < Math.min(col + d.size.cols, d.cols); c++) {
          const cell = this.shadowRoot.querySelector(`.grid-bg-cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) cell.classList.add('highlight', valid ? 'valid' : 'invalid');
        }
      }
      d.targetRow = row;
      d.targetCol = col;
      d.targetValid = valid;
    } else {
      d.targetValid = false;
    }
  }

  _onAddDragEnd() {
    const d = this._addDragState;
    if (!d) return;
    d.ghost.remove();
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid'));

    if (d.targetValid && d.targetRow != null) {
      const items = [...this._items];
      const type = d.type as ItemType;
      const newItem: any = { type, row: d.targetRow, col: d.targetCol };
      if (ITEMS[type].cls.defaultIcon) newItem.icon = ITEMS[type].cls.defaultIcon;
      const page = this._pageCount > 1 ? this._currentEditorPage : 0;
      if (page > 0) newItem.page = page;
      items.push(newItem);
      this._openItemIdx = items.length - 1;
      this._config = { ...this._config, items };
      this._fireConfigChanged();
    }
    this._addDragState = null;
  }

  _onAddDragCancel() {
    const d = this._addDragState;
    if (!d) return;
    d.ghost.remove();
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid'));
    this._addDragState = null;
  }

  _canPlaceAt(items: Item[], excludeIdx: number, size: ItemSize, row: number, col: number, cols: number, rows: number, excludeIdx2: number | undefined, page: number | undefined) {
    if (row < 0 || col < 0 || row + size.rows > rows || col + size.cols > cols) return false;
    for (let i = 0; i < items.length; i++) {
      if (i === excludeIdx || i === excludeIdx2) continue;
      const other = items[i];
      // If page filtering is active, skip items on different pages
      if (page !== undefined && (other.page || 0) !== page) continue;
      const os = getItemSize(other);
      if (!(row + size.rows <= other.row || row >= other.row + os.rows ||
            col + size.cols <= other.col || col >= other.col + os.cols)) {
        return false;
      }
    }
    return true;
  }

  _canSwapWith(items: Item[], dragIdx: number, targetRow: number, targetCol: number, cols: number, rows: number, page: number | undefined): { idx: number; row: number; col: number }[] | null {
    const dragItem = items[dragIdx];
    const dragSize = getItemSize(dragItem);
    // Bounds check for dragged item at target
    if (targetRow < 0 || targetCol < 0 || targetRow + dragSize.rows > rows || targetCol + dragSize.cols > cols) return null;
    // Find all items overlapping with the target position (excluding dragged item)
    const overlapping: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i === dragIdx) continue;
      const other = items[i];
      if (page !== undefined && (other.page || 0) !== page) continue;
      const os = getItemSize(other);
      if (!(targetRow + dragSize.rows <= other.row || targetRow >= other.row + os.rows ||
            targetCol + dragSize.cols <= other.col || targetCol >= other.col + os.cols)) {
        overlapping.push(i);
      }
    }
    if (overlapping.length === 0) return null;

    // Build set of freed cells (old position of dragged item)
    const freedCells = [];
    for (let r = dragItem.row; r < dragItem.row + dragSize.rows; r++) {
      for (let c = dragItem.col; c < dragItem.col + dragSize.cols; c++) {
        freedCells.push({ r, c });
      }
    }

    // Exclude dragged item + all overlapping items from collision checks
    const excludeSet = new Set([dragIdx, ...overlapping]);

    // Build occupancy grid of cells taken by non-excluded items (same page only)
    const occupied = new Set();
    for (let i = 0; i < items.length; i++) {
      if (excludeSet.has(i)) continue;
      const it = items[i];
      if (page !== undefined && (it.page || 0) !== page) continue;
      const sz = getItemSize(it);
      for (let r = it.row; r < it.row + sz.rows; r++) {
        for (let c = it.col; c < it.col + sz.cols; c++) {
          occupied.add(`${r},${c}`);
        }
      }
    }
    // Also mark the target cells (where dragged item will go) as occupied
    for (let r = targetRow; r < targetRow + dragSize.rows; r++) {
      for (let c = targetCol; c < targetCol + dragSize.cols; c++) {
        occupied.add(`${r},${c}`);
      }
    }

    // Greedily place each overlapping item into the freed cells (larger items first)
    const sorted = [...overlapping].sort((a, b) => {
      const sa = getItemSize(items[a]), sb = getItemSize(items[b]);
      return (sb.rows * sb.cols) - (sa.rows * sa.cols);
    });

    const placements = [];
    for (const idx of sorted) {
      const sz = getItemSize(items[idx]);
      let placed = false;
      // Try each freed cell as top-left corner
      for (const { r: fr, c: fc } of freedCells) {
        if (fr + sz.rows > rows || fc + sz.cols > cols) continue;
        // Check all cells this item would occupy are free
        let fits = true;
        for (let r = fr; r < fr + sz.rows && fits; r++) {
          for (let c = fc; c < fc + sz.cols && fits; c++) {
            if (occupied.has(`${r},${c}`)) fits = false;
          }
        }
        if (fits) {
          placements.push({ idx, row: fr, col: fc });
          // Mark cells as occupied
          for (let r = fr; r < fr + sz.rows; r++) {
            for (let c = fc; c < fc + sz.cols; c++) {
              occupied.add(`${r},${c}`);
            }
          }
          placed = true;
          break;
        }
      }
      if (!placed) return null;
    }
    return placements;
  }

  _addItem(type: ItemType) {
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const items = [...this._items];
    const size = ITEMS[type].cls.defaultSize;
    const page = this._pageCount > 1 ? this._currentEditorPage : 0;

    for (let r = 0; r <= rows - size.rows; r++) {
      for (let c = 0; c <= cols - size.cols; c++) {
        if (this._canPlaceAt(items, -1, size, r, c, cols, rows, -1, page)) {
          const newItem: any = { type, row: r, col: c };
          if (ITEMS[type].cls.defaultIcon) newItem.icon = ITEMS[type].cls.defaultIcon;
          if (page > 0) newItem.page = page;
          items.push(newItem);
          this._openItemIdx = items.length - 1;
          this._config = { ...this._config, items };
          this._fireConfigChanged();
          return;
        }
      }
    }
  }

  _deleteItem(idx: number) {
    const items = this._items.filter((_, i) => i !== idx);
    if (this._openItemIdx === idx) this._openItemIdx = null;
    else if (this._openItemIdx != null && this._openItemIdx > idx) this._openItemIdx--;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _clearAllItems() {
    const event = new CustomEvent('show-dialog', {
      bubbles: true,
      composed: true,
      detail: {
        dialogTag: 'dialog-box',
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          title: t(this.hass, 'Confirmation'),
          text: this._pageCount > 1 ? t(this.hass, 'Remove all buttons from page {n}?', { n: this._currentEditorPage + 1 }) : t(this.hass, 'Remove all buttons from layout?'),
          confirmText: t(this.hass, 'Remove'),
          dismissText: t(this.hass, 'Cancel'),
          destructive: true,
          confirm: () => {
            this._openItemIdx = null;
            const page = this._currentEditorPage;
            const items = this._pageCount > 1
              ? this._items.filter(item => (item.page || 0) !== page)
              : [];
            this._config = { ...this._config, items };
            this._fireConfigChanged();
          },
        },
      },
    });
    this.dispatchEvent(event);
  }


  // -- Shared schema builders (called from item editor render functions) ----

  /** Schema-label translator. Used by item editor render functions via
   *  `editor._label(s)` instead of the module-private `_label`. */
  _label = (s: any) => _label(this.hass, s);
  _helper = (s: any) => _helper(this.hass, s);

  /** Variant field with translated select labels. Prepended as the first
   *  field of the basis schema for button/entity/source/numbers/slider. */
  _variantField(sliderVariants = false): any {
    const variants = sliderVariants ? SLIDER_VARIANTS : BUTTON_VARIANTS;
    return {
      name: 'variant',
      selector: {
        select: {
          mode: 'dropdown',
          options: variants.map((v: any) => ({ value: v, label: t(this.hass, VARIANT_LABELS[v]) })),
        },
      },
    };
  }

  /** Common basis fields (icon, text, colors). */
  _basisFields(): any[] {
    return SCHEMA_BUTTON_BASIS;
  }

  /** Common action fields (tap/double_tap/hold + hold_repeat). Pass
   *  `withDoubleTap: false` for items that don't use double-tap (source,
   *  numbers, media only fire tap/hold). */
  _actionFields(opts: { withDoubleTap?: boolean; withHoldRepeat?: boolean } = {}): any[] {
    const { withDoubleTap = true, withHoldRepeat = true } = opts;
    const fields: any[] = [
      { name: 'tap_action', selector: { ui_action: {} } },
    ];
    if (withDoubleTap) {
      fields.push({ name: 'double_tap_action', selector: { ui_action: {} } });
    }
    fields.push({ name: 'hold_action', selector: { ui_action: {} } });
    if (withHoldRepeat) {
      fields.push(
        { name: 'hold_repeat', selector: { boolean: {} } },
        { name: 'hold_repeat_interval', selector: { number: { min: 50, max: 1000, step: 10, mode: 'box', unit_of_measurement: 'ms' } } },
      );
    }
    return fields;
  }

  /** Render a single unified ha-form that is routed through
   *  `_onItemFieldsChanged`. This is the preferred form for every
   *  collapsible in an item editor — guarantees one ha-form per
   *  collapsible and uniform field spacing. */
  _renderItemForm(data: any, schema: any[], index: number): TemplateResult {
    return html`
      <ha-form .hass=${this.hass} .data=${data} .schema=${schema}
        .computeLabel=${(s: any) => _label(this.hass, s)}
        .computeHelper=${(s: any) => _helper(this.hass, s)}
        @value-changed=${(e: CustomEvent) => this._onItemFieldsChanged(e, index)}
      ></ha-form>
    `;
  }

  /** Sub-button variant (dpad direction / color-button slot / numpad key). */
  _renderSubBtnForm(data: any, schema: any[], index: number, key: string): TemplateResult {
    return html`
      <ha-form .hass=${this.hass} .data=${data} .schema=${schema}
        .computeLabel=${(s: any) => _label(this.hass, s)}
        .computeHelper=${(s: any) => _helper(this.hass, s)}
        @value-changed=${(e: CustomEvent) => this._onSubBtnFieldsChanged(e, index, key)}
      ></ha-form>
    `;
  }

  // -- Settings panel ---------------------------------------------------------

  _renderSettingsPanel() {
    const appearanceData = {
      card_background_color: this._config.card_background_color ?? '',
      icon_color: this._config.icon_color ?? '',
      text_color: this._config.text_color ?? '',
      button_background_color: this._config.button_background_color ?? '',
      scale: this._config.scale ?? 100,
    };
    const sizing = this._config.sizing || 'normal';
    const hapticData = {
      haptic_tap: this._config.haptic_tap ?? false,
      haptic_double_tap: this._config.haptic_double_tap ?? false,
      haptic_hold: this._config.haptic_hold ?? false,
      hold_repeat_interval: this._config.hold_repeat_interval ?? DEFAULT_REPEAT_INTERVAL_MS,
    };

    return html`
      ${this._renderCollapsible('settings-appearance', t(this.hass, 'Appearance'), true, html`
        <ha-form .hass=${this.hass} .data=${appearanceData} .schema=${SCHEMA_GLOBAL_APPEARANCE}
          .computeLabel=${(s: any) => _label(this.hass, s)} .computeHelper=${(s: any) => _helper(this.hass, s)}
          @value-changed=${this._onGlobalAppearanceChanged}
        ></ha-form>
        <div class="visual-selector-label">${t(this.hass, 'Size')}</div>
        <div class="visual-selector-row">
          ${this._renderVisualOption('sizing', 'normal', sizing, t(this.hass, 'Normal'), SVG_SIZING_NORMAL)}
          ${this._renderVisualOption('sizing', 'stretch', sizing, t(this.hass, 'Stretch'), SVG_SIZING_STRETCH)}
        </div>
      `)}
      ${this._renderCollapsible('settings-haptic', t(this.hass, 'Haptic & behavior'), false, html`
        <ha-form .hass=${this.hass} .data=${hapticData} .schema=${SCHEMA_GLOBAL_HAPTIC}
          .computeLabel=${(s: any) => _label(this.hass, s)} .computeHelper=${(s: any) => _helper(this.hass, s)}
          @value-changed=${this._onGlobalHapticChanged}
        ></ha-form>
      `)}
    `;
  }

  // -- Collapsible helper -----------------------------------------------------

  _renderCollapsible(key: string, title: string, defaultOpen: boolean, content: TemplateResult) {
    const ICONS: Record<string, string> = {
      span: 'mdi:resize', basis: 'mdi:tune', actions: 'mdi:gesture-tap',
      options: 'mdi:cog-outline', 'numpad-actions': 'mdi:gesture-tap-button',
      'source-popup': 'mdi:menu', 'slider-opts': 'mdi:tune-vertical',
      appearance: 'mdi:palette-outline', haptic: 'mdi:vibrate',
    };
    const parts = key.split('-');
    const icon = ICONS[parts.slice(-2).join('-')] || ICONS[parts[parts.length - 1]] || '';
    return html`
      <ha-expansion-panel .header=${title} leftChevron outlined ?expanded=${defaultOpen}>
        ${icon ? html`<ha-icon slot="leading-icon" icon="${icon}"></ha-icon>` : ''}
        ${content}
      </ha-expansion-panel>
    `;
  }

  // -- Event handlers (item config) -------------------------------------------

  /**
   * Universal handler for item-level field changes. All per-collapsible
   * ha-forms (basis, actions, options) route their `@value-changed` through
   * here so that a single collapsible can contain a single ha-form with
   * any mix of fields — no more double margins between multiple forms.
   *
   * The handler iterates the fields present in `e.detail.value` and
   * applies the appropriate persistence rule (set vs. delete-on-default)
   * for each known key. Unknown keys are set verbatim.
   */
  _onItemFieldsChanged(e: CustomEvent, index: number) {
    e.stopPropagation();
    const val = e.detail.value || {};
    const items = [...this._items];
    const item: Item = { ...items[index] };

    for (const key of Object.keys(val)) {
      const v = val[key];
      switch (key) {
        // Variant: default 'pill' is not persisted
        case 'variant':
          if (v && v !== 'pill') item.variant = v;
          else delete item.variant;
          break;

        // Entity references (set when truthy, delete when empty)
        case 'entity_id':
        case 'source_entity':
          if (v) item[key] = v;
          else delete item[key];
          break;

        // String basis fields (delete when empty)
        case 'icon':
        case 'text':
        case 'icon_color':
        case 'text_color':
        case 'background_color':
        case 'attribute':
        case 'fallback_icon':
          if (v) item[key] = v;
          else delete item[key];
          break;

        // Numeric slider options (delete when empty/null)
        case 'min':
        case 'max':
        case 'step':
          if (v != null && v !== '') item[key] = v;
          else delete item[key];
          break;

        // Boolean toggles where the default is false (delete when not set)
        case 'hold_repeat':
        case 'slider_live':
        case 'scroll_info':
        case 'hide_dash':
        case 'hide_enter':
        case 'show_state_background':
          if (v) item[key] = true;
          else delete item[key];
          break;

        // Boolean toggles where the default is true (delete when on)
        case 'show_icon':
        case 'show_info':
          if (v === false) item[key] = false;
          else delete item[key];
          break;

        // Hold repeat interval (delete when empty)
        case 'hold_repeat_interval':
          if (v != null && v !== '') item.hold_repeat_interval = v;
          else delete item.hold_repeat_interval;
          break;

        // Slider orientation (with span reset side-effect)
        case 'orientation':
          if (v === 'vertical') {
            item.orientation = 'vertical';
            delete item.col_span;
          } else {
            delete item.orientation;
            delete item.row_span;
          }
          break;

        // Action fields: persist only if action is set and not 'none'
        case 'tap_action':
        case 'double_tap_action':
        case 'hold_action':
          if (v && v.action && v.action !== 'none') item[key] = v;
          else delete item[key];
          break;

        default:
          // Unknown fields: set verbatim if truthy, delete otherwise
          if (v) item[key] = v;
          else delete item[key];
      }
    }

    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  /**
   * Universal handler for sub-button field changes (DPAD directions,
   * color-button slots, numpad keys). Mirrors `_onItemFieldsChanged` but
   * operates on `item.buttons[key]`.
   */
  _onSubBtnFieldsChanged(e: CustomEvent, index: number, key: string) {
    e.stopPropagation();
    const val = e.detail.value || {};
    const items = [...this._items];
    const item: Item = { ...items[index] };
    const buttons: Record<string, any> = { ...(item.buttons || {}) };
    const btnCfg: any = { ...(buttons[key] || {}) };

    for (const fieldKey of Object.keys(val)) {
      const v = val[fieldKey];
      switch (fieldKey) {
        case 'color':
        case 'icon':
        case 'text':
        case 'icon_color':
        case 'text_color':
        case 'background_color':
          if (v) btnCfg[fieldKey] = v;
          else delete btnCfg[fieldKey];
          break;

        case 'hold_repeat':
          if (v) btnCfg.hold_repeat = true;
          else delete btnCfg.hold_repeat;
          break;

        case 'hold_repeat_interval':
          if (v != null && v !== '') btnCfg.hold_repeat_interval = v;
          else delete btnCfg.hold_repeat_interval;
          break;

        case 'tap_action':
        case 'double_tap_action':
        case 'hold_action':
          if (v && v.action && v.action !== 'none') btnCfg[fieldKey] = v;
          else delete btnCfg[fieldKey];
          break;

        default:
          if (v) btnCfg[fieldKey] = v;
          else delete btnCfg[fieldKey];
      }
    }

    if (Object.keys(btnCfg).length > 0) buttons[key] = btnCfg;
    else delete buttons[key];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;

    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }


  // -- Event handlers (global settings) ---------------------------------------

  _getMinGridSize(): { minCols: number; minRows: number } {
    const items = this._items;
    let minCols = 1;
    let minRows = 1;
    for (const item of items) {
      const meta = ITEMS[item.type];
      if (!meta) continue;
      const size = meta.cls.getSize(item);
      minCols = Math.max(minCols, item.col + size.cols);
      minRows = Math.max(minRows, item.row + size.rows);
    }
    return { minCols, minRows };
  }

  _renderGridSizeStepper(name: string, value: number, sliderMin: number, sliderMax: number, label: string, helper: string) {
    const { minCols, minRows } = this._getMinGridSize();
    const effectiveMin = name === 'columns' ? minCols : minRows;
    const clampedSliderMin = Math.max(sliderMin, effectiveMin);
    return html`
      <div class="slider-input-row">
        <div class="slider-input-label">${label}</div>
        <div class="slider-input-controls">
          <ha-slider
            .min=${clampedSliderMin} .max=${sliderMax} .step=${1}
            .value=${Math.max(Math.min(value, sliderMax), clampedSliderMin)}
            pin
            @change=${(e: Event) => this._onGridSizeChanged(name, Number((e.target as HTMLInputElement).value))}
          ></ha-slider>
          <ha-textfield
            .value=${String(value)}
            type="number" .min=${String(effectiveMin)} step="1"
            style="width:5em;"
            @change=${(e: Event) => this._onGridSizeChanged(name, parseInt((e.target as HTMLInputElement).value) || effectiveMin)}
          ></ha-textfield>
        </div>
        <div class="slider-input-helper">${helper}</div>
      </div>
    `;
  }

  _onGridSizeChanged(name: string, value: number) {
    const { minCols, minRows } = this._getMinGridSize();
    const effectiveMin = name === 'columns' ? minCols : minRows;
    value = Math.max(value, effectiveMin);
    const updated = { ...this._config, [name]: value };
    this._config = updated;
    this._fireConfigChanged();
  }

  _onGlobalAppearanceChanged(e: CustomEvent) {
    e.stopPropagation();
    const val = e.detail.value;
    const updated = { ...this._config };
    for (const key of ['card_background_color', 'icon_color', 'text_color', 'button_background_color']) {
      if (val[key]) updated[key] = val[key];
      else delete updated[key];
    }
    if (val.scale != null && val.scale !== 100) updated.scale = val.scale;
    else delete updated.scale;
    this._config = updated;
    this._fireConfigChanged();
  }

  _renderVisualOption(name: string, value: string, current: string, label: string, svgTemplate: TemplateResult) {
    const selected = value === current;
    return html`
      <label class="visual-option ${selected ? 'selected' : ''}"
             @click=${() => this._setVisualOption(name, value)}>
        <input type="radio" name="${name}" value="${value}" .checked=${selected}>
        <div class="visual-preview">${svgTemplate}</div>
        <span class="visual-option-label">${label}</span>
      </label>
    `;
  }

  _setVisualOption(name: string, value: string) {
    const updated = { ...this._config };
    if (name === 'sizing') {
      delete updated.width;
      delete updated.height;
      if (value === 'stretch') updated.sizing = 'stretch';
      else delete updated.sizing;
    }
    this._config = updated;
    this._fireConfigChanged();
  }

  _onGlobalHapticChanged(e: CustomEvent) {
    e.stopPropagation();
    const val = e.detail.value;
    const updated = { ...this._config, ...val };
    if (val.hold_repeat_interval == null || val.hold_repeat_interval === DEFAULT_REPEAT_INTERVAL_MS) {
      delete updated.hold_repeat_interval;
    }
    this._config = updated;
    this._fireConfigChanged();
  }

  // -- Event handlers (per-item source config) --------------------------------

  _updateItemField(itemIndex: number, updater: (item: Item) => Item | void) {
    const items = [...this._items];
    const copy = { ...items[itemIndex] };
    const result = updater(copy);
    items[itemIndex] = (result as Item | undefined) ?? copy;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }
}
