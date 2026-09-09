import { useCallback } from 'react';
import ThreeBanner from './ThreeBanner';

// Super Admin dashboard banneri: har bir nuqta — bitta restoran.
// Ular sekin aylanadi va bir-biriga ingichka chiziqlar bilan bog'lanadi —
// platformaning "tarmoq" tabiatini ifodalaydi.

const STATUS_COLORS = {
  active: 0x4ade80,
  trial: 0x60a5fa,
  suspended: 0xf87171,
  cancelled: 0x7b8296,
};

export default function NetworkBanner({ nodes = [], height = 140 }) {
  // Nuqtalar soni o'zgargandagina sahna qayta quriladi
  const signature = nodes.map((n) => n.status).join(',');

  const build = useCallback(
    ({ THREE, scene, camera }) => {
      camera.position.set(0, 0, 7);

      const group = new THREE.Group();
      scene.add(group);

      // Kamida 14 ta nuqta — bo'sh platformada ham banner "tirik" ko'rinsin
      const list = nodes.length >= 14 ? nodes : [
        ...nodes,
        ...Array.from({ length: 14 - nodes.length }, () => ({ status: 'ghost' })),
      ];

      const positions = [];
      const sphere = new THREE.IcosahedronGeometry(0.085, 1); // past-poly

      list.forEach((node, i) => {
        // Fibonacci sferasi — nuqtalar bir tekis taqsimlanadi
        const y = 1 - (i / Math.max(1, list.length - 1)) * 2;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = Math.PI * (3 - Math.sqrt(5)) * i;
        const p = new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).multiplyScalar(2.4);
        positions.push(p);

        const isGhost = node.status === 'ghost';
        const material = new THREE.MeshBasicMaterial({
          color: isGhost ? 0x232838 : STATUS_COLORS[node.status] || 0xe8a33d,
          transparent: true,
          opacity: isGhost ? 0.35 : 0.95,
        });
        const mesh = new THREE.Mesh(sphere, material);
        mesh.position.copy(p);
        if (!isGhost) mesh.scale.setScalar(1.25);
        group.add(mesh);
      });

      // Yaqin nuqtalarni chiziq bilan bog'laymiz
      const linePoints = [];
      for (let i = 0; i < positions.length; i += 1) {
        for (let j = i + 1; j < positions.length; j += 1) {
          if (positions[i].distanceTo(positions[j]) < 2.4) {
            linePoints.push(positions[i], positions[j]);
          }
        }
      }
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lines = new THREE.LineSegments(
        lineGeometry,
        new THREE.LineBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.16 })
      );
      group.add(lines);

      return {
        update(t, pointer) {
          group.rotation.y = t * 0.16;
          group.rotation.x = Math.sin(t * 0.24) * 0.14 + pointer.y * 0.12;
          group.position.x = pointer.x * 0.25;
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );

  return <ThreeBanner build={build} height={height} className="banner-network" />;
}
