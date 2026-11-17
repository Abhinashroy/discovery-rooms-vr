import { detailsFor, tablesFor } from './content.js';

export function guideContent(adventure, tableId) {
  const context = { adventure };
  const table = tablesFor(context).find((entry) => entry.id === tableId);
  if (!table) throw new Error('Unknown table.');

  const detail = detailsFor(context)[tableId] || {
    instruction: 'Select a supply, then its matching compartment.',
    reference: 'Water matches Circle; Food matches Triangle; Tools matches Square.',
    explanation: 'Matching labels helps explorers organize their supplies.',
  };
  return { table: table.title, ...detail };
}
