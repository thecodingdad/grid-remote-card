/**
 * Entry point — imports the card + editor classes (which self-register
 * their custom elements) and the customCards window registration.
 */

import { GridRemoteCard } from './card';
import { GridRemoteCardEditor } from './editor';

customElements.define('grid-remote-card-editor', GridRemoteCardEditor);
customElements.define('grid-remote-card', GridRemoteCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'grid-remote-card',
  name: 'Grid Remote Card',
  description: 'Customizable TV remote with configurable grid layout, drag-and-drop, various button layouts, and source popup.',
  preview: true,
});

console.info(
  `%c GRID-REMOTE-CARD %c ${VERSION} `,
  'color:#fff;background:#555;font-weight:bold;',
  'color:#fff;background:#007acc;font-weight:bold;',
);
