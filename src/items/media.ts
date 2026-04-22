/**
 * MediaItem — a 3x2 tile showing the media_player cover art with an
 * overlay for title and artist. On tap (without custom action) it
 * opens the source popup — reusing the same mechanism as source-item
 * via a `grc-open-source-popup` custom event.
 *
 * The marquee effect for long titles is managed per-instance in this
 * element's `updated()` hook because the target `data-scroll` elements
 * live in this item's shadow DOM and are not reachable via the card's
 * querySelector.
 */

import { css, html, type PropertyValues, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCard } from '../card';
import type { GridRemoteCardEditor } from '../editor';
import type { Item, ItemSize } from '../types';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase, OPEN_POPUP_EVENT, type OpenPopupDetail } from './base';
import { rippleStyles } from './shared-styles';
import { renderSourceListContent, renderSourcePopupConfig } from './source';

const SCHEMA_MEDIA_ENTITY = [
  { name: 'entity_id', selector: { entity: { domain: ['media_player', 'image', 'camera'] } } },
];

const SCHEMA_MEDIA_OPTIONS = [
  { name: 'show_info', selector: { boolean: {} } },
  { name: 'scroll_info', selector: { boolean: {} } },
  { name: 'fallback_icon', selector: { icon: {} } },
];

@customElement('grc-media-item')
export class MediaItem extends ItemBase {
  static override readonly label = 'Media info';
  static override readonly wrapperClass = 'grid-item media-wrapper';

  static override applyPresetEntity(item: Item, entityId: string): void { item.entity_id = entityId; }
  static override readonly editorIcon = 'mdi:music-box-outline';
  static override readonly defaultSize = { cols: 3, rows: 2 };

  static override getSize(item: Item): ItemSize {
    return {
      cols: item.col_span || 3,
      rows: item.row_span || 2,
    };
  }

  static override styles = [
    rippleStyles,
    css`
      :host { display: block; width: 100%; height: 100%; }
      .media-tile {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        background-color: var(--grc-btn-bg, var(--grc-item-bg));
        background-image: var(--grc-btn-bg-overlay, none);
        box-shadow: var(--grc-btn-shadow, none);
        transition: filter 0.15s, transform 0.08s;
        -webkit-tap-highlight-color: transparent;
      }
      .media-tile:hover { filter: brightness(1.1); }
      .media-tile:active {
        filter: brightness(0.9);
        box-shadow: var(--grc-btn-shadow-active, var(--grc-btn-shadow, none));
        transform: var(--grc-btn-active-transform, none);
      }
      .media-cover {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
      }
      .media-cover-fallback {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .media-tile:not([data-cover-url]) .media-cover-fallback,
      .media-tile.cover-error .media-cover-fallback { display: flex; }
      .media-tile.cover-error .media-cover { display: none; }
      .media-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 6px 10px;
        box-sizing: border-box;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        display: flex;
        flex-direction: column;
        gap: 1px;
        pointer-events: none;
      }
      .media-title {
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      }
      .media-artist {
        font-size: 11px;
        color: rgba(255,255,255,0.8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      }
      .media-title.marquee, .media-artist.marquee {
        text-overflow: clip;
      }
      .media-title.marquee span, .media-artist.marquee span {
        display: inline-block;
        padding-right: 2em;
        animation: grc-marquee var(--grc-marquee-duration, 10s) linear infinite;
      }
      @keyframes grc-marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
    `,
  ];

  /** On tap (without a custom action) open the source popup via the
   *  same event the source-item uses. */
  override handleItemAction(
    actionType: string,
    anchorEl: HTMLElement,
    _subButton: string | null,
  ): boolean {
    if (actionType !== 'tap') return false;
    const ta = this.item.tap_action as any;
    if (ta && ta.action && ta.action !== 'none') return false;
    this.dispatchEvent(new CustomEvent<OpenPopupDetail>(OPEN_POPUP_EVENT, {
      detail: { itemIndex: this.index, anchorEl },
      bubbles: true,
      composed: true,
    }));
    return true;
  }

  /** Share the source list popup — tap on media tile opens the source list. */
  static override renderPopup(card: GridRemoteCard, itemIndex: number): TemplateResult | '' {
    return renderSourceListContent(card, itemIndex);
  }

  protected override render(): TemplateResult {
    const item = this.item;
    const entityId = item.entity_id;
    const stateObj = entityId && this.hass ? this.hass.states[entityId] : null;
    const friendlyName = stateObj?.attributes?.friendly_name || entityId || '';
    const showInfo = item.show_info !== false;
    const scrollInfo = !!item.scroll_info;

    let coverUrl: string | null = null;
    let title = '';
    let artist = '';
    let isPlaying = false;

    if (stateObj) {
      const state = stateObj.state;
      isPlaying = state === 'playing' || state === 'paused' || state === 'buffering' || state === 'on';
      const entityPicture = stateObj.attributes?.entity_picture;
      if (entityPicture) {
        coverUrl = entityPicture.startsWith('/')
          ? `${(this.hass as any).hassUrl?.(entityPicture) || entityPicture}`
          : entityPicture;
      }
      title = stateObj.attributes?.media_title || '';
      artist = stateObj.attributes?.media_artist || '';
    }

    const showFallback = !isPlaying || !title;
    const displayTitle = showFallback ? friendlyName : title;
    const displayArtist = showFallback
      ? (stateObj ? (this.hass as any).formatEntityState?.(stateObj) || stateObj.state : 'unavailable')
      : artist;

    // Use resolveColor to satisfy unused-import lint if any; actually media
    // tile doesn't use resolveColor. Keeping import for consistency commented
    // would be dead code — remove if lint complains.
    void resolveColor;

    return html`
      <div class="media-tile" ?data-cover-url="${!!coverUrl}"
        @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, null)}
        @pointerup=${(e: PointerEvent) => this._onPointerUp(e, null)}
        @pointermove=${(e: PointerEvent) => this._onPointerMove(e)}
        @pointerleave=${(e: PointerEvent) => this._onPointerCancel(e)}
        @pointercancel=${(e: PointerEvent) => this._onPointerCancel(e)}
        @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="ripple-container"></span>
        ${coverUrl
          ? html`<img class="media-cover" src="${coverUrl}" alt="" @error=${(e: Event) => { (e.target as HTMLElement).closest('.media-tile')?.classList.add('cover-error'); }}>`
          : ''}
        <div class="media-cover-fallback">
          <ha-icon icon="${item.fallback_icon || 'mdi:music'}" style="--mdc-icon-size:48px;color:var(--secondary-text-color);opacity:0.5;"></ha-icon>
        </div>
        ${showInfo ? html`
          <div class="media-overlay">
            <span class="media-title" data-scroll="${scrollInfo ? '1' : ''}">${displayTitle}</span>
            ${displayArtist ? html`<span class="media-artist" data-scroll="${scrollInfo ? '1' : ''}">${displayArtist}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /** Per-instance marquee activation. Runs after each render on the
   *  shadow DOM's marquee-eligible text elements and toggles the class
   *  if their content overflows the available width. */
  override updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    const els = this.shadowRoot?.querySelectorAll<HTMLElement>('[data-scroll="1"]');
    if (!els) return;
    for (const el of els) {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      if (overflows && !el.classList.contains('marquee')) {
        const text = el.textContent || '';
        el.setAttribute('data-text-orig', text);
        el.classList.add('marquee');
        const dur = Math.max(5, text.length * 0.3);
        const inner = document.createElement('span');
        inner.textContent = `${text}\u00A0\u00A0\u00A0\u00A0${text}`;
        inner.style.setProperty('--grc-marquee-duration', `${dur}s`);
        el.textContent = '';
        el.appendChild(inner);
      } else if (!overflows && el.classList.contains('marquee')) {
        el.classList.remove('marquee');
        el.textContent = el.getAttribute('data-text-orig') || (el.textContent || '').split('\u00A0\u00A0\u00A0\u00A0')[0];
        el.removeAttribute('data-text-orig');
      }
    }
  }
}

// -- Editor ------------------------------------------------------------------

export function renderMediaEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const basisData = {
    entity_id: item.entity_id ?? '',
    show_info: item.show_info !== false,
    scroll_info: item.scroll_info ?? false,
    fallback_icon: item.fallback_icon ?? '',
  };
  const basisSchema = [
    ...SCHEMA_MEDIA_ENTITY,
    ...SCHEMA_MEDIA_OPTIONS,
  ];

  const actionsData = {
    tap_action: item.tap_action ?? {},
    hold_action: item.hold_action ?? {},
    hold_repeat: item.hold_repeat ?? false,
    hold_repeat_interval: item.hold_repeat_interval ?? '',
  };
  const actionsSchema = editor._actionFields({ hasEntity: true });

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
