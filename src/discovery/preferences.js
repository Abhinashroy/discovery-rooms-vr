import { profileFor } from './personalization.js';
export const PREFERENCE_KEY = 'discovery-preferences-v2';
export function cleanPreferences(value = {}, reducedMotion = false) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const comfort = v.comfort && typeof v.comfort === 'object' ? v.comfort : {};
  return {
    version: 2,
    comfort: Object.fromEntries(
      Object.entries({
        stationary: false,
        largeText: false,
        highContrast: false,
        reducedMotion,
      }).map(([k, fallback]) => [k, typeof comfort[k] === 'boolean' ? comfort[k] : fallback]),
    ),
    profile: profileFor(v.profile && typeof v.profile === 'object' ? v.profile : {}),
    mode: v.mode === 'explorer' ? 'explorer' : 'guided',
    adventure: ['space', 'ocean', 'workshop'].includes(v.adventure) ? v.adventure : 'space',
  };
}
export function loadPreferences(getStorage, reducedMotion = false) {
  try {
    const storage = getStorage(),
      raw = storage.getItem(PREFERENCE_KEY);
    return cleanPreferences(
      raw
        ? JSON.parse(raw)
        : { comfort: JSON.parse(storage.getItem('discovery-comfort-v1') || '{}') },
      reducedMotion,
    );
  } catch {
    return cleanPreferences({}, reducedMotion);
  }
}
export function savePreferences(getStorage, value) {
  try {
    getStorage().setItem(PREFERENCE_KEY, JSON.stringify(cleanPreferences(value)));
    return true;
  } catch {
    return false;
  }
}
