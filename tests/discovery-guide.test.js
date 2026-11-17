import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPreferences, savePreferences, PREFERENCE_KEY } from '../src/discovery/preferences.js';
import { createQuest, reduceQuest } from '../src/discovery/quest-state.js';
import { guideContent } from '../src/discovery/room-guide.js';

test('preference persistence validates values, migrates comfort, and survives inaccessible/corrupt/full storage', () => {
  const data = new Map(),
    storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) },
    get = () => storage;
  data.set('discovery-comfort-v1', JSON.stringify({ stationary: true, largeText: true }));
  assert.equal(loadPreferences(get).comfort.stationary, true);
  const p = {
    comfort: { stationary: true, highContrast: true, reducedMotion: true, largeText: false },
    profile: { emblem: 'Leaf', companion: 'Owl', palette: 'Teal' },
    mode: 'explorer',
    adventure: 'ocean',
  };
  assert.equal(savePreferences(get, p), true);
  assert.deepEqual(loadPreferences(get), { version: 2, ...p });
  for (const bad of [
    'null',
    '[]',
    '{oops',
    JSON.stringify({ comfort: null, profile: null, adventure: 'url', mode: 'system' }),
  ]) {
    data.set(PREFERENCE_KEY, bad);
    const value = loadPreferences(get, true);
    assert.equal(value.adventure, 'space');
    assert.equal(value.mode, 'guided');
    assert.equal(value.comfort.reducedMotion, true);
  }
  const broken = () => {
    throw new Error('Storage denied');
  };
  assert.equal(loadPreferences(broken).profile.emblem, 'Star');
  assert.equal(savePreferences(broken, p), false);
  assert.equal(
    savePreferences(
      () => ({
        setItem() {
          throw new Error('Quota');
        },
      }),
      p,
    ),
    false,
  );
  const defaults = loadPreferences(broken);
  let q = createQuest(1, defaults.mode, defaults.adventure, defaults.profile);
  q = reduceQuest(q, { type: 'assist' });
  q = reduceQuest(q, { type: 'reveal' });
  q = reduceQuest(q, { type: 'collect' });
  assert.equal(q.fragments, 1);
});
test('the room guide has an authored explanation and hint for every table', () => {
  for (const adventure of ['space', 'ocean', 'workshop']) {
    for (const tableId of ['cargo', 'solar', 'globe', 'moon', 'mission', 'beacon']) {
      const guide = guideContent(adventure, tableId);
      assert.ok(guide.table);
      assert.ok(guide.explanation);
      assert.ok(guide.instruction);
      assert.ok(guide.reference);
    }
  }
  assert.throws(() => guideContent('space', 'missing'), /Unknown table/);
});
