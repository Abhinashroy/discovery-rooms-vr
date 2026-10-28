// A menu is placed once in world space. Content updates never chase the headset.
export function paintMenuLabel(canvas, text, width, height, color, background) {
  // Match the texture to the physical plane, so glyphs aren't flattened in VR.
  canvas.width = 1024;
  canvas.height = Math.max(80, Math.min(512, Math.round((1024 * height) / width)));
  const context = canvas.getContext('2d');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let size = Math.round(canvas.height * 0.6),
    lines;
  const maxWidth = canvas.width * 0.93;
  do {
    context.font = `600 ${size}px Segoe UI, sans-serif`;
    lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.16 <= canvas.height * 0.86) break;
    size = Math.max(16, Math.floor(size * 0.9));
  } while (size > 16);
  lines.forEach((line, index) =>
    context.fillText(
      line,
      canvas.width / 2,
      canvas.height / 2 + (index - (lines.length - 1) / 2) * size * 1.16,
      maxWidth,
    ),
  );
}

export function createMenuAnchor(readView, writePose) {
  let open = false;
  function place({ distance = 2.6, lateral = 0, vertical = -0.05 } = {}) {
    const { position, forward } = readView();
    const length = Math.hypot(forward[0], forward[2]);
    const x = length > 0.001 ? forward[0] / length : 0;
    const z = length > 0.001 ? forward[2] / length : -1;
    writePose({
      position: [
        position[0] + x * distance - z * lateral,
        position[1] + vertical,
        position[2] + z * distance + x * lateral,
      ],
      rotation: [0, (Math.atan2(-x, -z) * 180) / Math.PI, 0],
    });
  }
  return {
    show(options) {
      if (!open) {
        place(options);
        open = true;
      }
    },
    hide() {
      open = false;
    },
    recenter(options) {
      place(options);
      open = true;
    },
  };
}

// A-Frame attaches new entities asynchronously. Include their own Three objects
// before attachment so an immediate redraw/prune cannot erase visible text.
export function pruneLabelResources({
  textures,
  materials,
  roots = [],
  entities = [],
  ownedMaterials,
}) {
  const used = new Set();
  const collect = (object) => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material?.map) used.add(material.map);
    }
  };
  for (const root of roots) root?.traverse?.(collect);
  for (const entity of entities) entity?.object3D?.traverse?.(collect);
  for (const [key, texture] of textures) {
    if (used.has(texture)) continue;
    const material = materials.get(key);
    if (material) {
      material.map = null;
      material.dispose();
      const index = ownedMaterials?.indexOf(material) ?? -1;
      if (index >= 0) ownedMaterials.splice(index, 1);
    }
    texture.dispose();
    textures.delete(key);
    materials.delete(key);
  }
}
