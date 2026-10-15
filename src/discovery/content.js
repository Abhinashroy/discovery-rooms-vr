import * as workshop from './workshop.js';
export const isWorkshop = (s) => s.adventure === 'workshop';
import { TABLES, PROPS, CLUE } from './adventure.js';
import * as space from './space.js';
import * as ocean from './ocean.js';
export const isOcean = (s) => s.adventure === 'ocean';
export const tablesFor = (s) =>
  isWorkshop(s) ? workshop.WORKSHOP_TABLES : isOcean(s) ? ocean.OCEAN_TABLES : TABLES;
export const detailsFor = (s) =>
  isWorkshop(s) ? workshop.WORKSHOP_DETAILS : isOcean(s) ? ocean.OCEAN_DETAILS : space.DETAILS;
export const taskView = (s, id) =>
  isWorkshop(s)
    ? workshop.workshopView(s, id)
    : isOcean(s)
      ? ocean.oceanView(s, id)
      : space.taskView(s, id);
export const collected = (s, id) =>
  isWorkshop(s)
    ? workshop.workshopCollected(s, id)
    : isOcean(s)
      ? ocean.oceanCollected(s, id)
      : space.collected(s, id);
export const unlocked = (s, id) =>
  isWorkshop(s)
    ? workshop.workshopUnlocked(s, id)
    : isOcean(s)
      ? ocean.oceanUnlocked(s, id)
      : space.unlocked(s, id);
export const currentTable = (s) => tablesFor(s).find((t) => !collected(s, t.id)) ?? tablesFor(s)[5];
export const titleFor = (s) =>
  isWorkshop(s) ? "Inventor's Workshop" : isOcean(s) ? 'Ocean Guardians' : 'Space Rescue';
export const clueFor = (s) => detailsFor(s)[currentTable(s).id]?.clue || CLUE;
export const propsFor = (s) =>
  PROPS.map((p, i) => ({
    ...p,
    title: isWorkshop(s)
      ? ['Wind-up toy', 'Magnifying viewer'][i]
      : isOcean(s)
        ? ['Periscope viewer', 'Fish viewer'][i]
        : p.title,
  }));
