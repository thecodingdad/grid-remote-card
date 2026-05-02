/**
 * Shared CSS fragments for item custom elements.
 *
 * Because each item lives in its own shadow DOM, styles cannot be
 * inherited from the parent card. These fragments are imported by item
 * classes via `static styles = [sharedA, sharedB, css\`local\`]` so the
 * same base styling is applied consistently.
 *
 * CSS custom properties from the card's `:host` (e.g. `--grc-item-bg`,
 * `--grc-variant-radius`, `--grid-cell-width`) automatically cross
 * shadow DOM boundaries via CSS inheritance, so they don't need to be
 * duplicated here.
 */

import { css } from 'lit';

/** Base `.remote-btn` — the clickable round/shaped button used by
 *  button, entity, source, numbers, color-buttons and dpad items. */
export const remoteBtnStyles = css`
  :host { display: contents; }

  .remote-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    border-radius: var(--grc-variant-radius, 50%);
    background-color: var(--grc-btn-bg, var(--grc-item-bg));
    background-image: var(--grc-btn-bg-overlay, none);
    box-shadow: var(--grc-btn-shadow, none);
    transition: filter 0.15s, transform 0.08s, background-color 0.3s ease, color 0.3s ease;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
    touch-action: manipulation;
    margin: 0 auto;
  }

  .remote-btn.multi-span {
    width: 100%;
    height: 100%;
  }

  .remote-btn ha-icon {
    --mdc-icon-size: 25px;
    color: var(--grc-item-icon);
    position: relative;
    z-index: 1;
    transition: color 0.3s ease;
  }

  .remote-btn:hover {
    background-color: var(--grc-btn-hover-bg, color-mix(in srgb, var(--primary-text-color) 10%, var(--grc-btn-bg, var(--grc-item-bg))));
    filter: var(--grc-btn-hover-filter, none);
  }
  .remote-btn:active {
    background-color: var(--grc-btn-active-bg, color-mix(in srgb, var(--primary-text-color) 18%, var(--grc-btn-bg, var(--grc-item-bg))));
    background-image: var(--grc-btn-bg-overlay-active, var(--grc-btn-bg-overlay, none));
    box-shadow: var(--grc-btn-shadow-active, var(--grc-btn-shadow, none));
    filter: var(--grc-btn-active-filter, var(--grc-item-press-filter));
    transform: var(--grc-btn-active-transform, none);
  }
`;

/** Variant radius tokens — set `--grc-variant-radius` based on the
 *  variant class applied to the button or slider container. */
export const variantRadiusStyles = css`
  .round       { --grc-variant-radius: 100%; }
  .rounded     { --grc-variant-radius: 12px; }
  .square      { --grc-variant-radius: 4px; }
  .pill        { --grc-variant-radius: 9999px; }
  .pill-top    { --grc-variant-radius: 9999px 9999px 4px 4px; }
  .pill-bottom { --grc-variant-radius: 4px 4px 9999px 9999px; }
  .pill-left   { --grc-variant-radius: 9999px 4px 4px 9999px; }
  .pill-right  { --grc-variant-radius: 4px 9999px 9999px 4px; }
`;

/** Ripple effect — consumed by any element with a `.ripple-container`
 *  child that receives dynamically-appended `.ripple` spans. */
export const rippleStyles = css`
  .ripple-container {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes grc-ripple {
    to { transform: scale(2.5); opacity: 0; }
  }
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.18;
    transform: scale(0);
    animation: grc-ripple 0.45s ease-out forwards;
    pointer-events: none;
  }
`;

/** `.btn-text` — text label shown inside a remote button when the
 *  item has text instead of an icon. */
export const btnTextStyles = css`
  .btn-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--grc-item-text, var(--primary-text-color));
    position: relative;
    z-index: 1;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    letter-spacing: 0.05em;
  }
`;

/** `.entity-img` — small round image used by entity buttons that
 *  carry an entity_picture attribute. */
export const entityImgStyles = css`
  .entity-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    position: relative;
    z-index: 1;
  }
`;
