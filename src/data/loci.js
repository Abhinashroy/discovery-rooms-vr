export const LOCI = Object.freeze([
  {
    id: 'door',
    name: 'Door',
    description: 'Tall blue door at the far left; the start of the route.',
    x: -5,
    z: -6.38,
  },
  {
    id: 'desk',
    name: 'Desk',
    description: 'Wide wooden work surface with two drawers.',
    x: -3,
    z: -4.55,
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    description: 'Three shelves of differently colored books.',
    x: -1,
    z: -6.12,
  },
  {
    id: 'window',
    name: 'Window',
    description: 'Bright window with a cross-shaped frame.',
    x: 1,
    z: -6.38,
  },
  {
    id: 'plant',
    name: 'Plant',
    description: 'Leafy green plant in a warm clay pot.',
    x: 3,
    z: -4.65,
  },
  {
    id: 'lamp',
    name: 'Lamp',
    description: 'Floor lamp with a golden shade at the far right.',
    x: 5,
    z: -5.5,
  },
]);

export function nextRouteIndex(index, step) {
  if (!Number.isInteger(index) || !Number.isInteger(step))
    throw new TypeError('Route index and step must be integers.');
  return Math.max(0, Math.min(LOCI.length - 1, index + step));
}
