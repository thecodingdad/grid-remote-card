/**
 * SliderItem — control slider for light brightness, volume, cover
 * position, fan speed, etc. Supports 8 visual variants (pill, rounded,
 * square, round, pill_top/bottom/left/right) plus a `classic` native
 * range input. Horizontal or vertical orientation.
 *
 * Unlike other items the slider has its own state machine for drag
 * detection, a live-update popup showing the current value, and a
 * debounced service call chain.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item, ItemSize } from '../types';
import { SLIDER_VARIANTS, VARIANT_CSS_CLASS, VARIANT_LABELS } from '../constants';
import { getSliderDefaults, resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';
import { variantRadiusStyles } from './shared-styles';

/** Slider options schema — variant is NOT included here; it lives in the
 *  Basis collapsible (like all other items with variants). */
const SLIDER_OPTIONS_FIELDS_RAW = [
  { name: 'orientation', selector: { select: { options: [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ], mode: 'dropdown' } } },
  { name: 'attribute', selector: { text: {} } },
  { name: 'min', selector: { number: { mode: 'box' } } },
  { name: 'max', selector: { number: { mode: 'box' } } },
  { name: 'step', selector: { number: { mode: 'box', step: 0.01 } } },
  { name: 'show_icon', selector: { boolean: {} } },
  { name: 'slider_live', selector: { boolean: {} } },
];

@customElement('grc-slider-item')
export class SliderItem extends ItemBase {
  static override readonly label = 'Slider';
  static override readonly wrapperClass = 'grid-item slider-wrapper';
  static override readonly editorIcon = 'mdi:tune-variant';
  static override readonly defaultSize = { cols: 3, rows: 1 };

  static override applyPresetEntity(item: Item, entityId: string): void { item.entity_id = entityId; }

  /** Vertical sliders are 1 col wide and multiple rows tall; horizontal
   *  sliders are multiple cols wide and 1 row tall. */
  static override getSize(item: Item): ItemSize {
    if (item.orientation === 'vertical') {
      return { cols: 1, rows: item.row_span || 3 };
    }
    return { cols: item.col_span || 3, rows: 1 };
  }

  /** When orientation changes, reset the unused span axis and keep the
   *  active one. Vertical uses row_span, horizontal uses col_span. */
  static override normalizeSpan(item: Item, colSpan: number, rowSpan: number): { col_span?: number; row_span?: number } {
    if (item.orientation === 'vertical') {
      return { col_span: undefined, row_span: rowSpan };
    }
    return { col_span: colSpan, row_span: undefined };
  }

  static override spanSchema(item: Item) {
    const size = this.getSize(item);
    const isVertical = item.orientation === 'vertical';
    return {
      data: isVertical ? { row_span: size.rows } : { col_span: size.cols },
      schema: isVertical
        ? [{ name: 'row_span', selector: { number: { min: 1, max: 15, step: 1, mode: 'box' } } }]
        : [{ name: 'col_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } }],
    };
  }

  static override persistSpan(item: Item, val: Record<string, number>): { col_span?: number; row_span?: number } {
    const base = this.defaultSize;
    if (item.orientation === 'vertical') {
      const rowSpan = val.row_span || base.cols;
      return { col_span: undefined, row_span: rowSpan !== base.cols ? rowSpan : undefined };
    }
    const colSpan = val.col_span || base.cols;
    return { col_span: colSpan !== base.cols ? colSpan : undefined, row_span: undefined };
  }

  private _sliderDebounce: ReturnType<typeof setTimeout> | undefined;

  static override styles = [
    variantRadiusStyles,
    css`
      :host { display: block; width: 100%; height: 100%; min-width: 0; overflow: visible; }

      .slider-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        position: relative;
      }
      .slider-item ha-icon {
        --mdc-icon-size: 20px;
        color: var(--grc-item-icon);
        flex-shrink: 0;
      }
      .slider-item.classic input[type=range] {
        flex: 1;
        min-width: 0;
        height: 4px;
        accent-color: var(--primary-color);
        cursor: pointer;
        margin: 0;
      }
      .slider-popup {
        position: absolute;
        top: -30px;
        left: 0;
        background: var(--card-background-color, var(--ha-card-background, #fff));
        color: var(--primary-text-color);
        border-width: var(--ha-card-border-width, 1px);
        border-style: solid;
        border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
        box-shadow: 0 4px 16px rgba(0,0,0,0.22);
        font-size: 12px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
        z-index: 10;
      }
      .slider-popup.visible { opacity: 1; }
      .slider-item.disabled {
        opacity: 0.4;
        pointer-events: none;
      }
      .slider-item.vertical {
        flex-direction: column;
      }
      .slider-item.classic.vertical input[type=range] {
        writing-mode: vertical-lr;
        direction: rtl;
        flex: 1;
        min-height: 0;
        width: 4px;
        height: auto;
      }
      .slider-item.vertical .slider-popup {
        top: auto;
        left: -40px;
        bottom: 50%;
      }

      /* Track-based slider variants */
      .slider-item:not(.classic) {
        gap: 0;
        padding: 0;
      }
      .slider-item:not(.classic) .pill-track {
        position: absolute;
        inset: 0;
        background-color: var(--grc-item-bg);
        background-image: var(--grc-slider-track-overlay, none);
        box-shadow: var(--grc-slider-track-shadow, none);
        overflow: hidden;
        border-radius: var(--grc-variant-radius, 9999px);
      }
      .slider-item:not(.classic) .pill-fill {
        position: absolute;
        background-color: var(--grc-slider-fill-color, color-mix(in srgb, var(--primary-text-color) 28%, transparent));
        background-image: var(--grc-slider-fill-overlay, none);
        box-shadow: var(--grc-slider-fill-shadow, none);
        transition: width 0.08s linear, height 0.08s linear;
      }
      .slider-item:not(.classic):not(.vertical) .pill-fill {
        left: 0; top: 0; bottom: 0;
        width: var(--slider-fill, 0%);
      }
      .slider-item:not(.classic).vertical .pill-fill {
        left: 0; right: 0; bottom: 0;
        height: var(--slider-fill, 0%);
      }
      .slider-item:not(.classic) .pill-icon {
        position: absolute;
        --mdc-icon-size: 22px;
        color: var(--grc-item-icon);
        pointer-events: none;
        z-index: 1;
      }
      .slider-item:not(.classic):not(.vertical) .pill-icon {
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
      }
      .slider-item:not(.classic).vertical .pill-icon {
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
      }
      .slider-item:not(.classic) .slider-range {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: transparent;
        opacity: 0;
        cursor: pointer;
        z-index: 2;
      }
      .slider-item:not(.classic).vertical .slider-range {
        writing-mode: vertical-lr;
        direction: rtl;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const item = this.item;
    const entityId = item.entity_id;
    const stateObj = entityId && this.hass ? this.hass.states[entityId] : null;
    const defaults = getSliderDefaults(entityId, stateObj);
    const attribute = item.attribute || defaults?.attribute;
    const min = item.min ?? defaults?.min ?? 0;
    const max = item.max ?? defaults?.max ?? 100;
    const step = item.step ?? defaults?.step ?? 1;
    const icon = item.icon || defaults?.icon || 'mdi:tune-variant';
    const iconColor = resolveColor(item.icon_color || this.card._config.icon_color || '');
    const disabled = !stateObj || stateObj.state === 'unavailable';
    const showIcon = item.show_icon !== false;
    const variant: string = SLIDER_VARIANTS.includes(item.variant as any) ? (item.variant as string) : 'pill';
    const vertical = item.orientation === 'vertical';

    let currentValue = 0;
    if (stateObj) {
      currentValue = attribute
        ? parseFloat(String(stateObj.attributes?.[attribute] ?? 0))
        : parseFloat(String(stateObj.state ?? 0));
    }
    if (isNaN(currentValue)) currentValue = min;
    const fillPct = max > min ? Math.max(0, Math.min(100, (currentValue - min) / (max - min) * 100)) : 0;

    const rangeInput = html`
      <input type="range" class="slider-range" .min="${min}" .max="${max}" .step="${step}"
             .value="${currentValue}" ?disabled="${disabled}"
             @input=${(e: Event) => this._onSliderInput(e)}
             @change=${(e: Event) => this._onSliderChange(e)}
             @pointerdown=${(e: PointerEvent) => this._onSliderStart(e)}
             @pointerup=${() => this._onSliderEnd()}
             @pointercancel=${() => this._onSliderEnd()}>
    `;

    const bgColor = resolveColor(item.background_color || '');
    const fillColor = resolveColor(item.fill_color || '');
    const styleParts = [`--slider-fill:${fillPct}%`];
    if (bgColor) styleParts.push(`--grc-item-bg:${bgColor}`);
    if (fillColor) styleParts.push(`--grc-slider-fill-color:${fillColor}`);

    if (variant !== 'classic') {
      const variantClass = VARIANT_CSS_CLASS[variant] || variant;
      return html`
        <div class="slider-item ${variantClass} ${disabled ? 'disabled' : ''} ${vertical ? 'vertical' : ''}"
             style="${styleParts.join(';')}">
          <div class="pill-track">
            <div class="pill-fill"></div>
            ${showIcon ? html`<ha-icon class="pill-icon" .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>` : ''}
          </div>
          ${rangeInput}
          <span class="slider-popup" id="slider-popup"></span>
        </div>
      `;
    }

    return html`
      <div class="slider-item classic ${disabled ? 'disabled' : ''} ${vertical ? 'vertical' : ''}">
        ${showIcon ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>` : ''}
        ${rangeInput}
        <span class="slider-popup" id="slider-popup"></span>
      </div>
    `;
  }

  private _sliderDisplayValue(value: number): string {
    const item = this.item;
    const entityId = item.entity_id;
    const stateObj = entityId && this.hass ? this.hass.states[entityId] : null;
    const defaults = getSliderDefaults(entityId, stateObj);
    const attribute = item.attribute || defaults?.attribute;
    const min = item.min ?? defaults?.min ?? 0;
    const max = item.max ?? defaults?.max ?? 100;
    if (attribute === 'brightness') return `${Math.round(value / 255 * 100)}%`;
    if (attribute === 'volume_level') return `${Math.round(value * 100)}%`;
    if (attribute === 'percentage' || attribute === 'current_position') return `${Math.round(value)}%`;
    if (min === 0 && max === 100) return `${Math.round(value)}%`;
    const step = item.step ?? defaults?.step ?? 1;
    return step < 1
      ? value.toFixed(Math.min(2, String(step).split('.')[1]?.length || 2))
      : String(Math.round(value));
  }

  private _updateSliderPopup(input: HTMLInputElement): void {
    const popup = this.shadowRoot?.getElementById('slider-popup');
    if (!popup || !input) return;
    const value = parseFloat(input.value);
    popup.textContent = this._sliderDisplayValue(value);
    const rect = input.getBoundingClientRect();
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const pct = (value - min) / (max - min);
    const parent = input.closest('.slider-item') as HTMLElement | null;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const thumbX = rect.left + pct * rect.width - parentRect.left;
    popup.style.left = `${thumbX - popup.offsetWidth / 2}px`;
  }

  private _updateSliderFill(input: HTMLInputElement): void {
    const host = input?.closest?.('.slider-item:not(.classic)') as HTMLElement | null;
    if (!host) return;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    if (!(max > min)) return;
    const pct = Math.max(0, Math.min(100, (val - min) / (max - min) * 100));
    host.style.setProperty('--slider-fill', `${pct}%`);
  }

  private _onSliderStart(e: PointerEvent): void {
    const popup = this.shadowRoot?.getElementById('slider-popup');
    if (popup) popup.classList.add('visible');
    this._updateSliderPopup(e.target as HTMLInputElement);
  }

  private _onSliderEnd(): void {
    const popup = this.shadowRoot?.getElementById('slider-popup');
    if (popup) popup.classList.remove('visible');
  }

  private _onSliderInput(e: Event): void {
    if (!this.item?.entity_id || !this.hass) return;
    const input = e.target as HTMLInputElement;
    this._updateSliderFill(input);
    this._updateSliderPopup(input);
    if (this.item.slider_live) {
      clearTimeout(this._sliderDebounce);
      this._sliderDebounce = setTimeout(() => this._sliderSendValue(parseFloat(input.value)), 150);
    }
  }

  private _onSliderChange(e: Event): void {
    if (!this.item?.entity_id || !this.hass || this.item.slider_live) return;
    this._sliderSendValue(parseFloat((e.target as HTMLInputElement).value));
  }

  private _sliderSendValue(value: number): void {
    const item = this.item;
    const entityId = item.entity_id;
    const stateObj = entityId && this.hass ? this.hass.states[entityId] : null;
    const defaults = getSliderDefaults(entityId, stateObj);
    const service = (item as any).service || defaults?.service;
    if (!service) return;
    const [domain, action] = service.split('.');
    const serviceField = (item as any).service_field || defaults?.service_field || 'value';
    this.hass.callService(domain, action, {
      entity_id: item.entity_id,
      [serviceField]: value,
    });
  }
}

// -- Editor ------------------------------------------------------------------

export function renderSliderEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  // Basis: variant + entity + icon/icon_color (no text, no background — sliders
  // render differently from buttons and don't use those fields).
  const basisData = {
    variant: item.variant || 'pill',
    entity_id: item.entity_id ?? '',
    icon: item.icon ?? '',
    icon_color: item.icon_color ?? '',
    background_color: item.background_color ?? '',
    fill_color: item.fill_color ?? '',
  };
  const basisSchema = [
    editor._variantField(true), // true = slider variants (includes 'classic')
    { name: 'entity_id', selector: { entity: {} } },
    { name: 'icon', selector: { icon: {} } },
    { name: 'icon_color', selector: { ui_color: {} } },
    { name: 'background_color', selector: { ui_color: {} } },
    { name: 'fill_color', selector: { ui_color: {} } },
  ];

  const optionsData = {
    orientation: item.orientation || 'horizontal',
    attribute: item.attribute ?? '',
    min: item.min ?? '',
    max: item.max ?? '',
    step: item.step ?? '',
    show_icon: item.show_icon !== false,
    slider_live: item.slider_live ?? false,
  };
  // Translate the orientation option labels on the fly
  const optionsSchema = SLIDER_OPTIONS_FIELDS_RAW.map((s: any) =>
    s.name === 'orientation'
      ? { ...s, selector: { select: { ...s.selector.select, options: s.selector.select.options.map((o: any) => ({ ...o, label: t(editor.hass, o.label) })) } } }
      : s,
  );

  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(basisData, basisSchema, index))}
    ${editor._renderCollapsible(`item-${index}-slider-opts`, t(editor.hass, 'Slider options'), false,
      editor._renderItemForm(optionsData, optionsSchema, index))}
  `;
}
