import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 3D bannerlar uchun umumiy "idish".
//
// Qoidalar (texnik topshiriqdagi 7.7-bo'lim):
//   - 3D DOIM dekorativ: hech qanday tugma yoki matnni to'smaydi
//     (pointer-events: none, ustidagi kontent alohida qatlamda)
//   - past-poly geometriyalar — zaif qurilmalarda ham sekinlashmaydi
//   - WebGL bo'lmasa yoki xato bersa — oddiy gradient fon bilan almashadi
//   - ekranda ko'rinmaganda yoki tab fonda bo'lganda animatsiya to'xtaydi

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (_) {
    return false;
  }
}

export default function ThreeBanner({ build, height = 140, className = '', fallbackClassName = '' }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (!webglAvailable()) {
      host.classList.add('three-fallback', fallbackClassName);
      return undefined;
    }

    let renderer;
    let sceneApi;
    let frame = 0;
    let visible = true;
    let disposed = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 6;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (_) {
      host.classList.add('three-fallback', fallbackClassName);
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    sceneApi = build({ THREE, scene, camera, renderer });

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (sceneApi && sceneApi.resize) sceneApi.resize(w, h);
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    // Ekrandan chiqib ketgan banner uchun kadr chizmaymiz
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0.01 }
    );
    io.observe(host);

    // Sichqoncha harakatiga yengil "parallaks" javob
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    host.addEventListener('pointermove', onPointerMove);

    const clock = new THREE.Clock();
    const loop = () => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      if (sceneApi && sceneApi.update) sceneApi.update(t, pointer);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      if (sceneApi && sceneApi.dispose) sceneApi.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [build, fallbackClassName]);

  return <div ref={hostRef} className={`three-banner ${className}`} style={{ height }} aria-hidden="true" />;
}
