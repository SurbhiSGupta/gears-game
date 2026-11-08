// Orbiting camera that eases toward a goal view, so every move glides instead of jumping.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.cur = { target: new THREE.Vector3(), dist: 2, az: 0, pol: 1.2 };
    this.goal = { target: new THREE.Vector3(), dist: 2, az: 0, pol: 1.2 };
    this.speed = 6;
  }

  set(view, instant = false) {
    if (view.target) this.goal.target.copy(view.target);
    for (const k of ['dist', 'az', 'pol']) if (view[k] != null) this.goal[k] = view[k];
    if (instant) {
      this.cur.target.copy(this.goal.target);
      this.cur.dist = this.goal.dist;
      this.cur.az = this.goal.az;
      this.cur.pol = this.goal.pol;
    }
  }

  orbit(dx, dy) {
    this.goal.az -= dx * 0.006;
    this.goal.pol = clamp(this.goal.pol - dy * 0.006, 0.3, 1.52);
  }

  zoom(factor) {
    this.goal.dist = clamp(this.goal.dist * factor, 0.14, 4.5);
  }

  update(dt, shake = 0) {
    const k = 1 - Math.exp(-dt * this.speed);
    const { cur, goal } = this;
    cur.target.lerp(goal.target, k);
    cur.dist += (goal.dist - cur.dist) * k;
    cur.az += (goal.az - cur.az) * k;
    cur.pol += (goal.pol - cur.pol) * k;
    const s = Math.sin(cur.pol);
    this.camera.position.set(
      cur.target.x + cur.dist * s * Math.sin(cur.az),
      cur.target.y + cur.dist * Math.cos(cur.pol),
      cur.target.z + cur.dist * s * Math.cos(cur.az),
    );
    this.camera.lookAt(cur.target);
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }
  }
}
