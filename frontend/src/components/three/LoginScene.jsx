import { useCallback } from 'react';
import ThreeBanner from './ThreeBanner';

// Kirish sahifasi ortidagi 3D sahna.
//
// Mavzu — mahsulotning o'zi: havoda sekin aylanib turgan QR plitkalari va
// ular orasidagi nozik ulanish chiziqlari ("stol → oshxona → ofitsiant").
//
// Uchta qoida:
//   1) Sahna HECH QACHON matnga xalaqit bermaydi — u eng orqa qatlamda,
//      ustidagi shisha panellar uni yumshatib turadi (pointer-events yo'q).
//   2) Harakat sekin: to'liq aylanish ~90 soniya. Kirish sahifasida odam
//      bir necha soniya turadi — ko'z charchashi mumkin bo'lgan hech narsa
//      bo'lmasligi kerak.
//   3) WebGL bo'lmasa — ThreeBanner o'zi gradient fonga o'tadi.

const TILE_COUNT = 150;
const RADIUS = 7;

// Plitkalarni sfera bo'ylab teng taqsimlaymiz (oltin burchak spirali) —
// tasodifiy joylashtirishda ular g'ujlashib qolardi
function spherePoints(count, radius) {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push([Math.cos(theta) * r * radius, y * radius * 0.62, Math.sin(theta) * r * radius]);
  }
  return points;
}

export default function LoginScene() {
  const build = useCallback(({ THREE, scene, camera }) => {
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    scene.add(group);

    const points = spherePoints(TILE_COUNT, RADIUS);

    // ---- QR plitkalari ----
    const geometry = new THREE.PlaneGeometry(0.42, 0.42);
    const material = new THREE.MeshBasicMaterial({
      color: 0xe8a33d,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const tiles = new THREE.InstancedMesh(geometry, material, TILE_COUNT);
    tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Har bir plitkaning o'z rangi va "nafas olish" tezligi bor
    const colors = new Float32Array(TILE_COUNT * 3);
    const palette = [
      new THREE.Color(0xe8a33d), // oltin
      new THREE.Color(0xf0c27a), // och oltin
      new THREE.Color(0x60a5fa), // ko'k urg'u
      new THREE.Color(0x4ade80), // yashil urg'u
    ];
    const phases = new Float32Array(TILE_COUNT);
    const spins = new Float32Array(TILE_COUNT);

    for (let i = 0; i < TILE_COUNT; i += 1) {
      // Ko'k va yashil kamdan-kam uchraydi — asosiy ohang oltin bo'lib qolsin
      const pick = i % 11 === 0 ? 2 : i % 17 === 0 ? 3 : i % 3 === 0 ? 1 : 0;
      palette[pick].toArray(colors, i * 3);
      phases[i] = Math.random() * Math.PI * 2;
      spins[i] = 0.15 + Math.random() * 0.35;
    }
    tiles.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    group.add(tiles);

    // ---- Ulanish chiziqlari: yaqin plitkalarni bog'laymiz ----
    const linePositions = [];
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i][0] - points[j][0];
        const dy = points[i][1] - points[j][1];
        const dz = points[i][2] - points[j][2];
        if (dx * dx + dy * dy + dz * dz < 2.6) {
          linePositions.push(...points[i], ...points[j]);
        }
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3)
    );
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.1 })
    );
    group.add(lines);

    const dummy = new THREE.Object3D();

    return {
      update(time, pointer) {
        // Butun sahna sekin aylanadi + sichqonchaga yengil egiladi
        group.rotation.y = time * 0.07 + pointer.x * 0.25;
        group.rotation.x = Math.sin(time * 0.05) * 0.12 - pointer.y * 0.16;

        for (let i = 0; i < TILE_COUNT; i += 1) {
          const [x, y, z] = points[i];
          // Yumshoq "nafas olish" — plitkalar markazdan bir oz uzoqlashadi
          const breathe = 1 + Math.sin(time * 0.5 + phases[i]) * 0.05;
          dummy.position.set(x * breathe, y * breathe, z * breathe);
          dummy.rotation.set(time * spins[i] * 0.3, time * spins[i] * 0.5, 0);
          const scale = 0.75 + Math.sin(time * 0.9 + phases[i]) * 0.25;
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          tiles.setMatrixAt(i, dummy.matrix);
        }
        tiles.instanceMatrix.needsUpdate = true;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        lineGeometry.dispose();
        lines.material.dispose();
      },
    };
  }, []);

  return <ThreeBanner build={build} height="100%" className="auth-scene" />;
}
