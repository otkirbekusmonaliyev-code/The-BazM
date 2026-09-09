'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { qrShape, phoneShape, kitchenShape, PARTICLE_COUNT } from '@/lib/shapes';

// Saytning butun fonida ishlaydigan 3D sahna. Ikki qatlamdan iborat:
//
//   1) OLTIN OQIM — ekran bo'ylab sekin suzadigan ingichka oltin iplar.
//      Doim ko'rinadi, sichqoncha ortidan yengil egiladi.
//
//   2) HIKOYA — 420 ta zarracha scroll bilan uchta shaklga morflanadi:
//      QR kod → telefon (mijoz menyusi) → oshxona ekrani.
//      Ya'ni foydalanuvchi pastga tushar ekan, mahsulot qanday ishlashini
//      O'QIMAYDI, balki KO'RADI.
//
// Qoidalar: sahna DOIM matn ortida (z-index 0, pointer-events: none),
// past-poly va instansiyalangan geometriya (tez), WebGL bo'lmasa yoki
// foydalanuvchi animatsiyani o'chirgan bo'lsa — oddiy gradient fon.

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (_) {
    return false;
  }
}

// 0..1 oralig'ida silliq o'tish
const smoothstep = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function SceneCanvas() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!webglAvailable() || reduceMotion) {
      host.classList.add('fallback');
      return undefined;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (_) {
      host.classList.add('fallback');
      return undefined;
    }

    const GOLD = new THREE.Color('#c6a05c');
    const RUST = new THREE.Color('#a85a3a');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 12);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    // ---------------- 1-qatlam: oltin oqim ----------------
    const flowGroup = new THREE.Group();
    scene.add(flowGroup);

    const FLOW_LINES = 7;
    const FLOW_POINTS = 90;
    const flows = [];

    for (let i = 0; i < FLOW_LINES; i += 1) {
      const positions = new Float32Array(FLOW_POINTS * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: GOLD,
          transparent: true,
          opacity: 0.09 + (i % 3) * 0.05,
        })
      );
      flowGroup.add(line);
      flows.push({
        line,
        positions,
        baseY: -3.4 + i * 1.15,
        amp: 0.55 + (i % 4) * 0.28,
        freq: 0.32 + (i % 5) * 0.08,
        speed: 0.16 + (i % 3) * 0.07,
        phase: i * 1.31,
      });
    }

    // ---------------- 2-qatlam: morflanuvchi hikoya ----------------
    const shapes = [
      qrShape(PARTICLE_COUNT),
      phoneShape(PARTICLE_COUNT),
      kitchenShape(PARTICLE_COUNT),
    ];

    const storyGroup = new THREE.Group();
    scene.add(storyGroup);

    const cell = new THREE.PlaneGeometry(0.062, 0.062);
    const cellMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const particles = new THREE.InstancedMesh(cell, cellMaterial, PARTICLE_COUNT);
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    storyGroup.add(particles);

    // Har bir zarrachaga o'z rangi va kichik "jonli" tebranishi
    const tint = new THREE.Color();
    const jitter = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      tint.copy(i % 9 === 0 ? RUST : GOLD).offsetHSL(0, 0, (i % 5) * 0.02 - 0.03);
      particles.setColorAt(i, tint);
      jitter[i * 2] = Math.random() * Math.PI * 2;
      jitter[i * 2 + 1] = 0.6 + Math.random() * 0.9;
    }
    if (particles.instanceColor) particles.instanceColor.needsUpdate = true;

    // ---------------- O'lchamga moslash ----------------
    let narrow = false;
    const resize = () => {
      // Element hali o'lchanmagan bo'lsa (layout tugamagan), oynaning
      // o'lchamiga tayanamiz — sahna 1x1 bo'lib qolib ketmasin
      const w = host.clientWidth || window.innerWidth || 1;
      const h = host.clientHeight || window.innerHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      narrow = w < 900;
      // Keng ekranda hikoya o'ng tomonda (chapda sarlavha turadi),
      // torda esa markazda va kichikroq
      storyGroup.position.x = narrow ? 0 : 3.6;
      storyGroup.position.y = narrow ? 0.6 : 0.2;
      storyGroup.scale.setScalar(narrow ? 1.35 : 2.05);
      flowGroup.scale.setScalar(narrow ? 1.15 : 1);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener('resize', resize);

    // ---------------- Sichqoncha va scroll ----------------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // Scroll ba'zi muhitlarda hodisa yubormaydi, shuning uchun qiymatni
    // har kadrda o'qiymiz — bu ishonchliroq va deyarli bepul
    let progress = 0;

    const dummy = new THREE.Object3D();
    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const loop = () => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      if (document.hidden) return;

      const t = clock.getElapsedTime();

      // Yumshoq parallaks
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      // Scroll holati: taxminan ikki ekran balandligida hikoya tugaydi
      const reference = window.innerHeight * 2.1;
      const target = clamp01(window.scrollY / reference);
      progress += (target - progress) * 0.08;

      // --- Oltin oqim ---
      for (const f of flows) {
        const { positions, baseY, amp, freq, speed, phase } = f;
        for (let i = 0; i < FLOW_POINTS; i += 1) {
          const x = -8 + (16 * i) / (FLOW_POINTS - 1);
          const y =
            baseY +
            Math.sin(x * freq + t * speed + phase) * amp +
            Math.sin(x * freq * 2.3 + t * speed * 1.6) * amp * 0.3;
          positions[i * 3] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = Math.cos(x * 0.2 + t * 0.1 + phase) * 0.6;
        }
        f.line.geometry.attributes.position.needsUpdate = true;
      }
      flowGroup.rotation.z = Math.sin(t * 0.05) * 0.04;
      flowGroup.position.y = pointer.y * 0.35;
      flowGroup.position.x = pointer.x * 0.5;

      // --- Hikoya morflanishi ---
      // 0 -> QR, 1 -> telefon, 2 -> oshxona ekrani
      const stage = progress * 2;
      const from = Math.min(Math.floor(stage), shapes.length - 1);
      const to = Math.min(from + 1, shapes.length - 1);
      // Har bosqichda biroz "ushlab turish", keyin silliq o'tish
      const mix = smoothstep(clamp01((stage - from - 0.18) / 0.64));

      const a = shapes[from];
      const b = shapes[to];

      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const wob = Math.sin(t * jitter[i * 2 + 1] + jitter[i * 2]) * 0.014;
        const x = a[i][0] + (b[i][0] - a[i][0]) * mix;
        const y = a[i][1] + (b[i][1] - a[i][1]) * mix;
        // O'tish paytida zarrachalar biroz "uchib" chiqadi — jonliroq ko'rinadi
        const lift = Math.sin(mix * Math.PI) * 0.45 * Math.sin(i * 12.9898);

        dummy.position.set(x + wob, y + wob, lift);
        dummy.rotation.z = lift * 1.4;
        const s = 1 + Math.sin(mix * Math.PI) * 0.35;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      storyGroup.rotation.y = pointer.x * 0.22 + Math.sin(t * 0.14) * 0.07;
      storyGroup.rotation.x = -pointer.y * 0.14;

      // Hikoya tugagach (oshxona ekrani ko'rsatilgach) sekin so'nadi —
      // pastdagi bo'limlarda faqat oltin oqim qoladi
      const fade = progress < 0.9 ? 1 : clamp01(1 - (progress - 0.9) / 0.1);
      cellMaterial.opacity = 0.9 * fade;
      particles.visible = fade > 0.02;

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const list = Array.isArray(obj.material) ? obj.material : [obj.material];
          list.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={hostRef} className="scene-canvas" aria-hidden="true" />;
}
