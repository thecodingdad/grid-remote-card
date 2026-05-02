/**
 * TemplateSubscriber — bridge between live HA Jinja templates and
 * synchronous render code. Color settings throughout the card may
 * contain Jinja expressions like `{{ states('sun.sun') }}`. Render
 * paths are sync, so we resolve templates via WebSocket
 * `subscribe_template` and cache the latest value. The cache is
 * consulted synchronously by render code; new templates trigger an
 * async subscription that calls `onUpdate` once the first result lands
 * (which re-renders the card with the resolved value).
 */

import type { HomeAssistant } from './types';

export function isTemplate(v: string | undefined | null): boolean {
  return typeof v === 'string' && /\{\{|\{%|\{#/.test(v);
}

interface SubState {
  unsub: (() => void) | null;
  // Pending unsubscribe promise — needed when subscribe is in flight
  // and we already want to drop the subscription (rare race).
  pendingUnsub?: Promise<() => void>;
}

export class TemplateSubscriber {
  private cache = new Map<string, string>();
  private subs = new Map<string, SubState>();
  private hass: HomeAssistant | null = null;
  private onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  setHass(hass: HomeAssistant) {
    this.hass = hass;
  }

  /** Resolve a template synchronously from cache. If not cached, kicks
   *  off a subscription and returns '' (caller should treat as "no
   *  override"). The next render after the first result lands will see
   *  the cached value. */
  resolve(template: string): string {
    if (!isTemplate(template)) return template;
    if (this.cache.has(template)) return this.cache.get(template)!;
    if (!this.subs.has(template)) this.subscribe(template);
    return '';
  }

  private async subscribe(template: string) {
    if (!this.hass) return;
    // Mark intent to subscribe so concurrent resolve() calls don't
    // re-trigger.
    const state: SubState = { unsub: null };
    this.subs.set(template, state);
    const conn = (this.hass as any).connection;
    if (!conn?.subscribeMessage) {
      console.error('grc: hass.connection.subscribeMessage unavailable');
      this.cache.set(template, '');
      return;
    }
    try {
      const unsub = await conn.subscribeMessage(
        (msg: any) => {
          const val = msg && typeof msg.result !== 'undefined'
            ? String(msg.result ?? '')
            : '';
          const prev = this.cache.get(template);
          if (prev !== val) {
            this.cache.set(template, val);
            this.onUpdate();
          }
        },
        { type: 'render_template', template },
      );
      state.unsub = unsub;
    } catch (e) {
      console.error('grc: template subscribe failed', template, e);
      this.cache.set(template, '');
      this.subs.delete(template);
    }
  }

  /** Drop subscriptions for templates no longer referenced. Called
   *  after each render so unused templates don't leak. */
  prune(activeTemplates: Set<string>) {
    for (const [tpl, state] of [...this.subs.entries()]) {
      if (!activeTemplates.has(tpl)) {
        try { state.unsub?.(); } catch (_) { /* noop */ }
        this.subs.delete(tpl);
        this.cache.delete(tpl);
      }
    }
  }

  disconnect() {
    for (const state of this.subs.values()) {
      try { state.unsub?.(); } catch (_) { /* noop */ }
    }
    this.subs.clear();
    this.cache.clear();
  }
}
