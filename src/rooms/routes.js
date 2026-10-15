export const ROOM_ROUTES = Object.freeze({
  main: './',
  classroom: './classroom.html',
  planetarium: './planetarium.html',
  earth: './earth.html',
});
export function freshEntry(getScene = () => null) {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
  window.addEventListener('pagehide', () => {
    try {
      const scene = getScene();
      scene?.pause?.();
      scene?.renderer?.setAnimationLoop(null);
      scene?.renderer?.dispose();
      scene?.renderer?.forceContextLoss();
    } catch {}
  });
}
export async function changeRoom(id, scene, stop = () => {}) {
  if (!Object.hasOwn(ROOM_ROUTES, id)) return;
  stop();
  if (scene?.is?.('vr-mode'))
    try {
      await scene.exitVR();
    } catch {}
  window.location.assign(ROOM_ROUTES[id]);
}
