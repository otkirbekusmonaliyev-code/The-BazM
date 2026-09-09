import { useCallback } from 'react';
import ThreeBanner from './ThreeBanner';

// Restoran Admin dashboard banneri: markazda aylanuvchi oltin halqa,
// atrofida past-poly "taom" shakllari — likopcha (yassi silindr),
// stakan (kesik konus) va choynak (sfera + tumshuq) suzib yuradi.

const GOLD = 0xc6a05c;
const SOFT = 0x8b927d;

export default function FoodBanner({ height = 120 }) {
  const build = useCallback(({ THREE, scene, camera }) => {
    camera.position.set(0, 0.6, 6.2);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    scene.add(group);

    // Markaziy halqa
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.035, 3, 64),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2.3;
    group.add(ring);

    const ringInner = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.02, 3, 64),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.25 })
    );
    ringInner.rotation.x = Math.PI / 2.3;
    group.add(ringInner);

    // Orbitadagi past-poly shakllar
    const makers = [
      // likopcha
      () =>
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.34, 0.09, 12),
          new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.7 })
        ),
      // stakan
      () =>
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.14, 0.42, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: SOFT, wireframe: true, transparent: true, opacity: 0.6 })
        ),
      // choynak tanasi
      () =>
        new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.3, 0),
          new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.65 })
        ),
      // kichik piyola
      () =>
        new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: SOFT, wireframe: true, transparent: true, opacity: 0.55 })
        ),
    ];

    const orbiters = makers.map((make, i) => {
      const mesh = make();
      const angle = (i / makers.length) * Math.PI * 2;
      mesh.userData = { angle, radius: 1.5 + (i % 2) * 0.65, speed: 0.28 + i * 0.05, bob: i * 1.7 };
      group.add(mesh);
      return mesh;
    });

    return {
      update(t, pointer) {
        group.rotation.y = pointer.x * 0.2;
        group.rotation.x = pointer.y * 0.12;
        ring.rotation.z = t * 0.12;
        ringInner.rotation.z = -t * 0.08;

        orbiters.forEach((mesh) => {
          const { angle, radius, speed, bob } = mesh.userData;
          const a = angle + t * speed;
          mesh.position.set(Math.cos(a) * radius, Math.sin(t * 0.7 + bob) * 0.28, Math.sin(a) * radius * 0.42);
          mesh.rotation.x = t * 0.5;
          mesh.rotation.y = t * 0.35;
        });
      },
    };
  }, []);

  return <ThreeBanner build={build} height={height} className="banner-food" />;
}
