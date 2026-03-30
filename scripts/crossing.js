import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader }  from 'three/addons/loaders/RGBELoader.js';

const GLB_PATHS = [
  'assets/items/item1.glb',
  'assets/items/item2.glb',
  'assets/items/item3.glb',
  'assets/items/item4.glb',
  'assets/items/item5.glb',
];

const IMAGE_PATHS = [
  'assets/items/image1.png',
  'assets/items/image2.png',
  'assets/items/image4.png',
  'assets/items/image5.png',
  'assets/items/image6.png',
  'assets/items/image7.png',
  'assets/items/image8.png',
];

const HDRI_PATH = 'assets/hdri/flamingo_pan_1k.hdr';

const ITEM_META = {
  item1:  { name: 'Indila Cat',      about: 'Better in person, but kinda funny when sculpted',   coords: "127°10\"80'" },
  item2:  { name: 'Coral Shell',     about: 'Found between tides, keeps humming at night',       coords: "98°42\"15'" },
  item3:  { name: 'Signal Totem',    about: 'Points north when nobody is watching',              coords: "45°03\"22'" },
  item4:  { name: 'Dust Ring',       about: 'Worn once, remembers everything',                   coords: "162°55\"09'" },
  item5:  { name: 'Glyph Shard',     about: 'Part of something larger, still vibrating',         coords: "73°31\"44'" },
  image1: { name: 'Soft Proof',      about: 'A photograph that blinks if you stare long enough', coords: "12°08\"61'" },
  image2: { name: 'Drift Note',      about: 'Written in salt, barely legible',                   coords: "88°19\"37'" },
  image4: { name: 'Heat Stamp',      about: 'Pressed at noon, cooled by midnight',               coords: "141°27\"03'" },
  image5: { name: 'Fold Mark',       about: 'Creased paper with a hidden contour',               coords: "56°44\"18'" },
  image6: { name: 'Tide Print',      about: 'Left by the sea, claimed by the wind',              coords: "33°52\"90'" },
  image7: { name: 'Skin Layer',      about: 'Peeled off gently, still warm',                     coords: "109°06\"72'" },
  image8: { name: 'Ember Trace',     about: 'Last light before the ash settled',                  coords: "7°38\"55'" },
};

const CAM_FOV       = 45;
const CAM_NEAR      = 0.1;
const CAM_FAR       = 100;
const CAM_Z         = 10;

const GLB_TARGET_SIZE  = 3.0;
const IMG_TARGET_H     = 2.8;

const ATTRACT_K        = 8;
const ATTRACT_DAMP     = 0.88;
const DEFAULT_DAMP     = 0.995;
const ANG_DAMP         = 0.997;
const BOUNDARY_FRAC    = 0.82;
const BOUNDARY_K       = 12;
const SEP_MIN_DIST     = 1.6;
const SEP_K            = 5;
const IDLE_ANG_SCALE   = 0.006;
const COLLAPSED_PX     = 62;

const bounds = { x: 1, y: 1 };

const state = {
  mouseHeld:  false,
  mouseWorld: null,
};

function calcBounds(camera, w, h) {
  const aspect = w / h;
  const halfH  = Math.tan((camera.fov * Math.PI / 180) / 2) * CAM_Z;
  bounds.x = halfH * aspect;
  bounds.y = halfH;
}

function mouseToWorld(clientX, clientY, camera, container) {
  const rect = container.getBoundingClientRect();
  const ndcX =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  const ndcY = -((clientY - rect.top)  / rect.height) * 2 + 1;

  const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
  const far  = new THREE.Vector3(ndcX, ndcY,  1).unproject(camera);
  const dir  = far.clone().sub(near).normalize();

  if (Math.abs(dir.z) < 1e-6) return null;
  const t = -near.z / dir.z;
  return near.addScaledVector(dir, t);
}

function loadEnvironment(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  new RGBELoader().load(
    HDRI_PATH,
    (texture) => {
      const envMap = pmrem.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      texture.dispose();
      pmrem.dispose();
    },
    undefined,
    () => {}
  );
}

function loadGLB(path, loader) {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;

        const box1  = new THREE.Box3().setFromObject(model);
        const size  = new THREE.Vector3();
        box1.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) model.scale.setScalar(GLB_TARGET_SIZE / maxDim);

        const box2   = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        box2.getCenter(centre);
        model.position.sub(centre);

        const sizeScaled = new THREE.Vector3();
        box2.getSize(sizeScaled);
        model.userData.radius = Math.max(sizeScaled.x, sizeScaled.y) / 2;

        resolve(model);
      },
      undefined,
      reject
    );
  });
}

function loadImage(path, texLoader) {
  return new Promise((resolve) => {
    texLoader.load(
      path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const iw     = texture.image.naturalWidth  || texture.image.width;
        const ih     = texture.image.naturalHeight || texture.image.height;
        const aspect = iw / ih || 1;

        const planeW = IMG_TARGET_H * aspect;
        const geo = new THREE.PlaneGeometry(planeW, IMG_TARGET_H);
        const mat = new THREE.MeshBasicMaterial({
          map:        texture,
          transparent: true,
          side:        THREE.DoubleSide,
          depthWrite:  false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.radius = Math.max(planeW, IMG_TARGET_H) / 2;
        resolve(mesh);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function makeBody(mesh, isGLB, id) {
  const spread = 0.7;
  return {
    mesh,
    isGLB,
    id,
    radius: mesh.userData.radius || 0.8,
    pos:    new THREE.Vector3(
      (Math.random() * 2 - 1) * bounds.x * spread,
      (Math.random() * 2 - 1) * bounds.y * spread,
      (Math.random() - 0.5) * 1.5
    ),
    vel:    new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      0
    ),
    angVel: new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.4
    ),
    zAngle: Math.random() * Math.PI * 2,
    phase:  Math.random() * Math.PI * 2,
  };
}

function stepPhysics(bodies, dt) {
  const dtc = Math.min(dt, 0.05);

  for (const b of bodies) {

    if (state.mouseHeld && state.mouseWorld) {
      const diff = state.mouseWorld.clone().sub(b.pos);
      const dist = diff.length();
      if (dist > 0.01) {
        b.vel.addScaledVector(diff.normalize(), ATTRACT_K * dist * dtc);
      }
      b.vel.multiplyScalar(Math.pow(ATTRACT_DAMP, dtc * 60));
    } else {
      b.vel.multiplyScalar(Math.pow(DEFAULT_DAMP, dtc * 60));
    }

    const lx = bounds.x * BOUNDARY_FRAC;
    const ly = bounds.y * BOUNDARY_FRAC;
    const lz = 1.0;
    if (Math.abs(b.pos.x) > lx) b.vel.x -= Math.sign(b.pos.x) * (Math.abs(b.pos.x) - lx) * BOUNDARY_K * dtc;
    if (Math.abs(b.pos.y) > ly) b.vel.y -= Math.sign(b.pos.y) * (Math.abs(b.pos.y) - ly) * BOUNDARY_K * dtc;
    if (Math.abs(b.pos.z) > lz) b.vel.z -= Math.sign(b.pos.z) * (Math.abs(b.pos.z) - lz) * BOUNDARY_K * dtc;

    b.phase += dtc * 0.5;
    if (b.isGLB) {
      b.angVel.x += Math.sin(b.phase * 1.3) * IDLE_ANG_SCALE;
      b.angVel.y += Math.cos(b.phase * 0.9) * IDLE_ANG_SCALE;
    }
    b.angVel.z += Math.sin(b.phase * 0.7) * IDLE_ANG_SCALE * 0.5;

    b.angVel.multiplyScalar(Math.pow(ANG_DAMP, dtc * 60));
  }

  const RESTITUTION = 0.7;

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const diff = a.pos.clone().sub(b.pos);
      const dist = diff.length();
      const minDist = a.radius + b.radius;

      if (dist > 0 && dist < minDist) {
        const normal = diff.normalize();

        const overlap = minDist - dist;
        a.pos.addScaledVector(normal,  overlap * 0.5);
        b.pos.addScaledVector(normal, -overlap * 0.5);

        const relVel = a.vel.clone().sub(b.vel);
        const velAlongNormal = relVel.dot(normal);

        if (velAlongNormal < 0) {
          const impulse = -(1 + RESTITUTION) * velAlongNormal * 0.5;
          a.vel.addScaledVector(normal,  impulse);
          b.vel.addScaledVector(normal, -impulse);
        }
      }
    }
  }

  for (const b of bodies) {
    b.pos.addScaledVector(b.vel, dtc);
    b.mesh.position.copy(b.pos);

    if (b.isGLB) {
      b.mesh.rotation.x += b.angVel.x * dtc;
      b.mesh.rotation.y += b.angVel.y * dtc;
      b.mesh.rotation.z += b.angVel.z * dtc;
    } else {
      b.zAngle += b.angVel.z * dtc;
      b.mesh.lookAt(0, 0, CAM_Z);
      b.mesh.rotateZ(b.zAngle);
    }
  }
}

const EXPLODE_SPEED = 4.0;

function explodeBodies(bodies) {
  if (!state.mouseWorld) return;
  const origin = state.mouseWorld;
  for (const b of bodies) {
    const away = b.pos.clone().sub(origin);
    const dist = away.length();
    if (dist < 0.01) away.set(Math.random() - 0.5, Math.random() - 0.5, 0);
    away.normalize();
    const kick = EXPLODE_SPEED * (1 + 1 / (dist + 0.3));
    b.vel.addScaledVector(away, kick);
    b.angVel.x += (Math.random() - 0.5) * 2;
    b.angVel.y += (Math.random() - 0.5) * 2;
    b.angVel.z += (Math.random() - 0.5) * 1;
  }
}

const flow = {
  step:         1,
  choice:       null,
  itemName:     '',
  selectedBody: null,
  holdTimer:    null,
  holdTarget:   null,
};

const raycaster = new THREE.Raycaster();

function getHitBody(clientX, clientY, camera, container, bodies) {
  const rect = container.getBoundingClientRect();
  const ndcX =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  const ndcY = -((clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  for (const b of bodies) {
    const hits = raycaster.intersectObject(b.mesh, true);
    if (hits.length > 0) return b;
  }
  return null;
}

function getStepEl(n) {
  return document.querySelector(`[data-step="${n}"]`);
}

function getActiveStep() {
  return document.querySelector('.cross-card.is-active, .cross-step4.is-active');
}

function goToStep(n) {
  const current = getActiveStep();
  if (current) {
    current.classList.remove('is-active');
    const ref = current;
    setTimeout(() => { ref.style.display = 'none'; }, 350);
  }

  const next = getStepEl(n);
  if (next) {
    next.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      next.classList.add('is-active');
    }));
  }
  flow.step = n;

  if (n === 4) {
    const selectedBadge = document.getElementById('slotSelectedBadge');
    const userBadge     = document.getElementById('slotUserBadge');
    if (flow.choice === 'obj') {
      if (selectedBadge) selectedBadge.textContent = 'O';
      if (userBadge)     userBadge.textContent     = 'M';
    } else {
      if (selectedBadge) selectedBadge.textContent = 'M';
      if (userBadge)     userBadge.textContent     = 'O';
    }
  }
}

function hideFlow() {
  const current = getActiveStep();
  if (current) {
    current.classList.remove('is-active');
    const ref = current;
    setTimeout(() => { ref.style.display = 'none'; }, 350);
  }
  flow.step = 0;
}

function resetFlow() {
  flow.choice = null;
  flow.itemName = '';
  flow.selectedBody = null;
  clearHoldTimer();
  const meta = document.getElementById('crossMeta');
  if (meta) meta.classList.remove('is-visible');
  const slotSelected = document.getElementById('slotSelected');
  if (slotSelected) slotSelected.innerHTML = '';
  const input = document.getElementById('crossItemName');
  if (input) input.value = '';
  goToStep(1);
}

let holdProgressEl = null;

function createHoldProgress() {
  const el = document.createElement('div');
  el.className = 'cross-hold-progress';
  el.innerHTML = '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="20"/></svg>';
  document.body.appendChild(el);
  holdProgressEl = el;
  return el;
}

function showHoldProgress(x, y) {
  if (!holdProgressEl) createHoldProgress();
  holdProgressEl.style.left = x + 'px';
  holdProgressEl.style.top  = y + 'px';
  holdProgressEl.style.display = 'block';
  holdProgressEl.classList.remove('is-filling');
  void holdProgressEl.offsetWidth;
  holdProgressEl.classList.add('is-filling');
}

function hideHoldProgress() {
  if (holdProgressEl) {
    holdProgressEl.classList.remove('is-filling');
    holdProgressEl.style.display = 'none';
  }
}

function clearHoldTimer() {
  if (flow.holdTimer) {
    clearTimeout(flow.holdTimer);
    flow.holdTimer = null;
  }
  flow.holdTarget = null;
  hideHoldProgress();
}

function renderThumbnail(body, mainScene, mainRenderer, mainCamera) {
  const size = 256;

  const prevSize = new THREE.Vector2();
  mainRenderer.getSize(prevSize);

  const visMap = new Map();
  mainScene.traverse((obj) => {
    if (obj.isMesh || obj.isGroup || obj.isSprite) {
      visMap.set(obj, obj.visible);
    }
  });
  mainScene.traverse((obj) => {
    if ((obj.isMesh || obj.isGroup || obj.isSprite) && obj !== body.mesh && !body.mesh.getObjectById(obj.id)) {
      obj.visible = false;
    }
  });
  body.mesh.visible = true;
  body.mesh.traverse((c) => { if (c.isMesh) c.visible = true; });

  const thumbCam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const box = new THREE.Box3().setFromObject(body.mesh);
  const center = new THREE.Vector3();
  const objSize = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(objSize);

  const maxDim = Math.max(objSize.x, objSize.y, objSize.z) || 1;
  const camDist = maxDim / (2 * Math.tan((45 * Math.PI / 180) / 2)) * 1.6;
  thumbCam.position.set(center.x, center.y, center.z + camDist);
  thumbCam.lookAt(center);

  mainRenderer.setSize(size, size, false);
  mainRenderer.render(mainScene, thumbCam);

  const dataUrl = mainRenderer.domElement.toDataURL('image/png');

  mainRenderer.setSize(prevSize.x, prevSize.y, false);
  mainCamera.aspect = prevSize.x / prevSize.y;
  mainCamera.updateProjectionMatrix();

  visMap.forEach((vis, obj) => { obj.visible = vis; });

  return dataUrl;
}

function previewObject(body, mainScene, mainRenderer, mainCamera) {
  const meta = ITEM_META[body.id];
  if (!meta) return;

  const thumbUrl = renderThumbnail(body, mainScene, mainRenderer, mainCamera);
  const slotEl = document.getElementById('slotSelected');
  if (slotEl) {
    slotEl.innerHTML = `<img src="${thumbUrl}" alt="${meta.name}">`;
  }

  const metaEl   = document.getElementById('crossMeta');
  const nameEl   = document.getElementById('metaName');
  const aboutEl  = document.getElementById('metaAbout');
  const coordsEl = document.getElementById('metaCoords');
  if (nameEl)   nameEl.textContent   = meta.name;
  if (aboutEl)  aboutEl.textContent  = meta.about;
  if (coordsEl) coordsEl.textContent = meta.coords;
  if (metaEl)   metaEl.classList.add('is-visible');
}

function selectObject(body, mainScene, mainRenderer, mainCamera) {
  flow.selectedBody = body;
  hideHoldProgress();

  const meta = ITEM_META[body.id];
  if (!meta) return;

  const thumbUrl = renderThumbnail(body, mainScene, mainRenderer, mainCamera);
  const slotEl = document.getElementById('slotSelected');
  if (slotEl) {
    slotEl.innerHTML = `<img src="${thumbUrl}" alt="${meta.name}">`;
  }

  const selectedBadge = document.getElementById('slotSelectedBadge');
  const userBadge     = document.getElementById('slotUserBadge');
  if (flow.choice === 'obj') {
    if (selectedBadge) selectedBadge.textContent = 'O';
    if (userBadge)     userBadge.textContent     = 'M';
  } else {
    if (selectedBadge) selectedBadge.textContent = 'M';
    if (userBadge)     userBadge.textContent     = 'O';
  }

  const metaEl = document.getElementById('crossMeta');
  if (metaEl) metaEl.classList.remove('is-visible');

  const holdBody = document.querySelector('.cross-hold-body');
  if (holdBody) holdBody.classList.add('is-merging');

  setTimeout(() => {
    if (holdBody) holdBody.classList.remove('is-merging');
    goToStep(5);
  }, 800);

  setTimeout(() => resetFlow(), 4000);
}

function initFlow(camera, container, bodies, scene, renderer) {
  const flowEl = document.getElementById('crossFlow');
  if (!flowEl) return;

  flowEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const opt = e.target.closest('[data-choice]');

    if (btn) {
      const action = btn.dataset.action;
      if (action === 'change')      goToStep(2);
      else if (action === 'look')   hideFlow();
      else if (action === 'submit-name') {
        const input = document.getElementById('crossItemName');
        flow.itemName = input ? input.value.trim() : '';
        if (flow.itemName) goToStep(4);
      }
    }

    if (opt) {
      flow.choice = opt.dataset.choice;
      goToStep(3);
    }
  });

  const input = document.getElementById('crossItemName');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        flow.itemName = input.value.trim();
        if (flow.itemName) goToStep(4);
      }
    });
  }

  let downTime = 0;
  let downHit  = null;
  const CLICK_MS = 300;

  container.addEventListener('mousedown', (e) => {
    if (e.target.closest('.cross-flow') || e.target.closest('.section-mark')) return;

    if (flow.step === 4) {
      const hit = getHitBody(e.clientX, e.clientY, camera, container, bodies);
      downHit  = hit;
      downTime = performance.now();
      if (hit) {
        flow.holdTarget = hit;
        showHoldProgress(e.clientX, e.clientY);
        flow.holdTimer = setTimeout(() => {
          downHit = null;
          selectObject(hit, scene, renderer, camera);
        }, 3000);
      }
      return;
    }

    if (flow.step === 0 || flow.step === 1) {
      state.mouseHeld = true;
      state.mouseWorld = mouseToWorld(e.clientX, e.clientY, camera, container);
    }
  });

  container.addEventListener('mousemove', (e) => {
    if (state.mouseHeld) {
      state.mouseWorld = mouseToWorld(e.clientX, e.clientY, camera, container);
    }
  });

  container.addEventListener('mouseup', () => {
    if (flow.step === 4) {
      clearHoldTimer();
      if (downHit && (performance.now() - downTime) < CLICK_MS) {
        previewObject(downHit, scene, renderer, camera);
      }
      downHit = null;
      return;
    }
    if (state.mouseHeld) {
      explodeBodies(bodies);
      state.mouseHeld = false;
    }
  });

  container.addEventListener('mouseleave', () => {
    state.mouseHeld = false;
    if (flow.step === 4) { clearHoldTimer(); downHit = null; }
  });

  container.addEventListener('touchstart', (e) => {
    if (e.target.closest('.cross-flow') || e.target.closest('.section-mark')) return;
    e.preventDefault();

    if (flow.step === 4) {
      const t = e.touches[0];
      const hit = getHitBody(t.clientX, t.clientY, camera, container, bodies);
      downHit  = hit;
      downTime = performance.now();
      if (hit) {
        flow.holdTarget = hit;
        showHoldProgress(t.clientX, t.clientY);
        flow.holdTimer = setTimeout(() => {
          downHit = null;
          selectObject(hit, scene, renderer, camera);
        }, 3000);
      }
      return;
    }

    if (flow.step === 0 || flow.step === 1) {
      state.mouseHeld = true;
      state.mouseWorld = mouseToWorld(e.touches[0].clientX, e.touches[0].clientY, camera, container);
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.target.closest('.cross-flow') || e.target.closest('.section-mark')) return;
    e.preventDefault();
    if (state.mouseHeld) {
      state.mouseWorld = mouseToWorld(e.touches[0].clientX, e.touches[0].clientY, camera, container);
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (flow.step === 4) {
      clearHoldTimer();
      if (downHit && (performance.now() - downTime) < CLICK_MS) {
        previewObject(downHit, scene, renderer, camera);
      }
      downHit = null;
      return;
    }
    if (state.mouseHeld) { explodeBodies(bodies); state.mouseHeld = false; }
  });
}

function startLoop(renderer, scene, camera, bodies) {
  let lastTime = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);

    if (renderer.domElement.clientWidth < COLLAPSED_PX) {
      lastTime = now;
      return;
    }

    const dt = (now - lastTime) / 1000;
    lastTime = now;

    stepPhysics(bodies, dt);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(frame);
}

async function init() {
  const container = document.getElementById('crossing-container');
  const canvas    = document.getElementById('crossing-canvas');
  if (!container || !canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace   = THREE.SRGBColorSpace;
  renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const w0 = container.clientWidth;
  const h0 = container.clientHeight;
  renderer.setSize(w0, h0, false);

  const camera = new THREE.PerspectiveCamera(CAM_FOV, w0 / (h0 || 1), CAM_NEAR, CAM_FAR);
  camera.position.set(0, 0, CAM_Z);
  calcBounds(camera, w0, h0);

  const scene = new THREE.Scene();

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(3, 5, 8);
  scene.add(dirLight);

  loadEnvironment(scene, renderer);

  const gltfLoader = new GLTFLoader();
  const texLoader  = new THREE.TextureLoader();

  const [glbResults, imgResults] = await Promise.all([
    Promise.allSettled(GLB_PATHS.map(p  => loadGLB(p, gltfLoader))),
    Promise.allSettled(IMAGE_PATHS.map(p => loadImage(p, texLoader))),
  ]);

  const bodies = [];

  glbResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      scene.add(r.value);
      const id = GLB_PATHS[i].match(/item\d+/)?.[0] || `item${i + 1}`;
      bodies.push(makeBody(r.value, true, id));
    }
  });

  imgResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      scene.add(r.value);
      const id = IMAGE_PATHS[i].match(/image\d+/)?.[0] || `image${i + 1}`;
      bodies.push(makeBody(r.value, false, id));
    }
  });

  initFlow(camera, container, bodies, scene, renderer);

  new ResizeObserver((entries) => {
    for (const entry of entries) {
      const cs = entry.contentBoxSize
        ? entry.contentBoxSize[0]
        : { inlineSize: entry.contentRect.width, blockSize: entry.contentRect.height };
      const w = cs.inlineSize;
      const h = cs.blockSize;

      if (w < COLLAPSED_PX) continue;

      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      calcBounds(camera, w, h);
    }
  }).observe(container);

  startLoop(renderer, scene, camera, bodies);
}

init();
