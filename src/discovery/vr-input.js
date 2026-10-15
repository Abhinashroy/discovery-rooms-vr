// xr-standard reserves axes 2/3 for the thumbstick and button 5 for B/Y.
export function readVRInput(sources = []) {
  const result = { x: 0, y: 0, turn: 0, menu: false };
  for (const source of sources) {
    const pad = source.gamepad;
    if (!pad || pad.mapping !== 'xr-standard') continue;
    const axis = (i) => (Number.isFinite(pad.axes[i]) ? pad.axes[i] : 0);
    if (source.handedness === 'left') {
      result.x = Math.abs(axis(2)) > 0.2 ? axis(2) : 0;
      result.y = Math.abs(axis(3)) > 0.2 ? axis(3) : 0;
    }
    if (source.handedness === 'right') result.turn = axis(2);
    result.menu ||= Boolean(pad.buttons[5]?.pressed);
  }
  return result;
}
