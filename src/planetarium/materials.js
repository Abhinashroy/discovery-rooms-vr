const FILES = {
  mercury: '2k_mercury.jpg',
  venus: '2k_venus_atmosphere.jpg',
  earth: '2k_earth_daymap.jpg',
  mars: '2k_mars.jpg',
  jupiter: '2k_jupiter.jpg',
  saturn: '2k_saturn.jpg',
  uranus: '2k_uranus.jpg',
  neptune: '2k_neptune.jpg',
  sun: '2k_sun.jpg',
  clouds: '2k_earth_clouds.jpg',
  rings: '2k_saturn_ring_alpha.png',
  stars: '2k_stars_milky_way.jpg',
};
export function createMaterials(T, onStatus = () => {}) {
  const loader = new T.TextureLoader(),
    cache = new Map(),
    resources = [],
    bodies = [];
  let failed = 0,
    loaded = 0;
  function texture(id) {
    if (cache.has(id)) return cache.get(id);
    const high = ['sun', 'earth', 'jupiter'].includes(id),
      url = './planetarium/' + (high ? '' : 'low_') + FILES[id];
    const t = loader.load(
      url,
      () => {
        loaded++;
        onStatus({ loaded, failed, total: Object.keys(FILES).length });
      },
      undefined,
      () => {
        failed++;
        onStatus({ loaded, failed, total: Object.keys(FILES).length });
      },
    );
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(id, t);
    resources.push(t);
    return t;
  }
  const sphere = new T.SphereGeometry(1, 64, 32);
  resources.push(sphere);
  function mesh(geometry, material) {
    resources.push(material);
    return new T.Mesh(geometry, material);
  }
  function ring(inner, outer, kind) {
    const g = new T.RingGeometry(inner, outer, 128),
      uv = g.attributes.uv,
      pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
    resources.push(g);
    const m = new T.MeshBasicMaterial({
      map: kind === 'saturn' ? texture('rings') : null,
      color: kind === 'saturn' ? 0xffffff : 0x879c9e,
      side: T.DoubleSide,
      transparent: true,
      opacity: kind === 'saturn' ? 0.83 : kind === 'jupiter' ? 0.05 : 0.18,
      alphaTest: kind === 'saturn' ? 0.05 : 0,
      depthWrite: false,
    });
    if (['uranus', 'neptune'].includes(kind))
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = 'varying float ringU;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\nringU = uv.x;',
        );
        shader.fragmentShader = 'varying float ringU;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nfloat line=pow(abs(cos(ringU*3.14159265*5.0)),100.0);diffuseColor.a *= line;',
        );
      };
    const r = mesh(g, m);
    r.rotation.x = -Math.PI / 2;
    return r;
  }
  function body(p, radius, { inspection = false } = {}) {
    const group = new T.Group(),
      axis = new T.Group(),
      spin = new T.Group();
    axis.rotation.z = T.MathUtils.degToRad(p.tilt || 0);
    if (p.ringKm) group.rotation.y = 0.6;
    group.add(axis);
    axis.add(spin);
    const mat =
      p.id === 'sun'
        ? new T.MeshBasicMaterial({ map: texture('sun'), color: 0xffefd0 })
        : new T.MeshStandardMaterial({ map: texture(p.id), roughness: 0.88, metalness: 0 });
    // Source Neptune map is enhanced blue; moderate the rendered colour explicitly.
    if (p.id === 'neptune')
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>\nfloat luminance = dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(luminance), 0.55);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40,0.69,0.72), 0.38);`,
        );
      };
    if (['mercury', 'mars'].includes(p.id)) {
      mat.bumpMap = texture(p.id);
      mat.bumpScale = radius * 0.005;
    }
    const globe = mesh(sphere, mat);
    globe.scale.setScalar(radius);
    spin.add(globe);
    if (p.id === 'earth') {
      const cloud = mesh(
        sphere,
        new T.MeshStandardMaterial({
          alphaMap: texture('clouds'),
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          roughness: 1,
        }),
      );
      cloud.scale.setScalar(radius * 1.008);
      spin.add(cloud);
    }
    if (['earth', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(p.id)) {
      const atmosphere = mesh(
        sphere,
        new T.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { tint: { value: new T.Color(p.id === 'earth' ? 0x5b96dd : 0xb8dadd) } },
          vertexShader:
            'varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vP=p.xyz;gl_Position=projectionMatrix*p;}',
          fragmentShader:
            'uniform vec3 tint;varying vec3 vN;varying vec3 vP;void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(-vP))),4.0);gl_FragColor=vec4(tint,rim*0.24);}',
        }),
      );
      atmosphere.scale.setScalar(radius * 1.025);
      axis.add(atmosphere);
    }
    if (p.ringKm) {
      const k = radius / (p.km / 2);
      axis.add(ring(p.ringKm[0] * k, p.ringKm[1] * k, p.id));
    }
    bodies.push({ group, spin, id: p.id, inspection });
    return group;
  }
  function tick(dt, reduced) {
    if (reduced) return;
    for (const b of bodies) b.spin.rotation.y += dt * (b.id === 'sun' ? 0.015 : 0.045);
  }
  function forget(group) {
    const index = bodies.findIndex((b) => b.group === group);
    if (index >= 0) bodies.splice(index, 1);
    group.traverse((o) => {
      if (o.material) {
        o.material.dispose();
        if (o.geometry !== sphere) o.geometry?.dispose();
      }
    });
  }
  function estimatedTextureBytes() {
    return [...cache.values()].reduce(
      (n, t) => n + ((t.image?.width || 0) * (t.image?.height || 0) * 4 * 4) / 3,
      0,
    );
  }
  return {
    texture,
    body,
    tick,
    forget,
    estimatedTextureBytes,
    dispose() {
      resources.forEach((r) => r.dispose());
    },
  };
}
