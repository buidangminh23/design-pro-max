import * as THREE from 'three';

export const mat = {
  silver: new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 1, roughness: 0.34 }),
  silverDark: new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 1, roughness: 0.4 }),
  port: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.95 }),
};

for (const m of [mat.silver, mat.silverDark]) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;\nfloat grainHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= (0.992 + 0.016 * grainHash(floor(vGrainPos * 9.0) + 3.0)) * mix(0.9, 1.0, smoothstep(0.0, 9.0, vGrainPos.y));');
  };
}

function shade(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function slab(w, h, depth, r, bevel, material) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(0.01, r - bevel)), {
    depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 96,
  });
  geo.translate(0, 0, -depth / 2 + bevel);
  return shade(new THREE.Mesh(geo, material));
}

export function macMini() {
  const g = new THREE.Group();
  const S = 12.7, F = 0.65, H = 4.41, R = 2.3;
  const body = slab(S, S, H, R, 0.42, mat.silver);
  body.rotation.x = -Math.PI / 2;
  body.position.y = F + H / 2;
  g.add(body);
  const vent = document.createElement('canvas');
  vent.width = 4096; vent.height = 128;
  {
    const v = vent.getContext('2d');
    const bg = v.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, '#3a3b3f');
    bg.addColorStop(0.5, '#2b2c30');
    bg.addColorStop(1, '#1d1e21');
    v.fillStyle = bg; v.fillRect(0, 0, 4096, 128);
    const slots = 118, pitch = 4096 / slots, sw = pitch * 0.42, y0 = 10, y1 = 100;
    v.fillStyle = '#060607';
    for (let i = 0; i < slots; i += 1) {
      const x = i * pitch + (pitch - sw) / 2, r = sw / 2;
      v.beginPath();
      v.moveTo(x, y0 + r); v.arc(x + r, y0 + r, r, Math.PI, 0); v.lineTo(x + sw, y1 - r); v.arc(x + r, y1 - r, r, 0, Math.PI); v.closePath();
      v.fill();
    }
  }
  const ventTex = new THREE.CanvasTexture(vent);
  ventTex.colorSpace = THREE.SRGBColorSpace;
  ventTex.anisotropy = 16;
  const ventMat = new THREE.MeshStandardMaterial({ map: ventTex, metalness: 0.35, roughness: 0.55 });
  const foot = shade(new THREE.Mesh(new THREE.CylinderGeometry(5.34, 4.6, F, 236, 1, false), [ventMat, mat.rubber, mat.rubber]));
  foot.position.y = F / 2;
  g.add(foot);
  const front = S / 2 + 0.001;
  const portY = F + 1.6;
  const rim = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, metalness: 0.6, roughness: 0.5 });
  for (const x of [-3.67, -2.19]) {
    const outer = slab(0.27, 0.87, 0.02, 0.135, 0.002, rim);
    outer.position.set(x, portY, front);
    g.add(outer);
    const inner = slab(0.17, 0.75, 0.02, 0.085, 0.002, mat.port);
    inner.position.set(x, portY, front + 0.004);
    g.add(inner);
  }
  const jack = new THREE.Mesh(new THREE.CircleGeometry(0.18, 40), mat.port);
  jack.position.set(3.61, portY, front);
  g.add(jack);
  const jackRim = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.2, 40), rim);
  jackRim.position.set(3.61, portY, front);
  g.add(jackRim);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  led.position.set(2.42, portY, front);
  g.add(led);
  g.userData.led = led;
  return g;
}
