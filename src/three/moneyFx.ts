// Χαρτονομίσματα που πετάνε: το όπλο με λεφτά, οι κερδοφόρες συναλλαγές, τα πάρτι.
import * as THREE from 'three';
import { canvasTexture } from './textures';

const MAX = 420;

function billTexture(): THREE.CanvasTexture {
  const { tex, ctx } = canvasTexture(128, 64, 1);
  ctx.fillStyle = '#7FBF7A';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#3E7A3B';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 56);
  ctx.fillStyle = '#5E9E59';
  ctx.beginPath();
  ctx.ellipse(64, 32, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E9F5E6';
  ctx.font = '900 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 64, 34);
  ctx.font = '700 12px sans-serif';
  ctx.fillStyle = '#2F5E2D';
  ctx.fillText('100', 20, 16);
  ctx.fillText('100', 108, 50);
  tex.needsUpdate = true;
  return tex;
}

export class MoneyFx {
  readonly mesh: THREE.InstancedMesh;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private rot = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private next = 0;
  private active = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private zero = new THREE.Vector3(0, 0, 0);

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshLambertMaterial({ map: billTexture(), side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.12), mat, MAX);
    this.mesh.frustumCulled = false;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, hide);
    scene.add(this.mesh);
  }

  /** Ριπή χαρτονομισμάτων από ένα σημείο προς μια κατεύθυνση (ή προς τα πάνω). */
  burst(from: THREE.Vector3, dir: THREE.Vector3 | null, count: number, speed = 3) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos.set([from.x, from.y, from.z], i * 3);
      const d = dir ?? new THREE.Vector3(0, 1, 0);
      const sp = speed * (0.6 + Math.random() * 0.6);
      this.vel.set([
        d.x * sp + (Math.random() - 0.5) * 1.6,
        d.y * sp + 1 + Math.random() * 1.5,
        d.z * sp + (Math.random() - 0.5) * 1.6,
      ], i * 3);
      this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      this.life[i] = 3.5 + Math.random() * 2;
    }
    this.active = Math.min(MAX, this.active + count);
  }

  update(dt: number) {
    if (this.active <= 0) return;
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      const onFloor = this.pos[o + 1] <= 0.02;
      if (!onFloor) {
        // πέφτουν σαν φύλλα: αργά, με αέρα
        this.vel[o + 1] -= 3.2 * dt;
        this.vel[o + 1] = Math.max(this.vel[o + 1], -1.1);
        this.vel[o] *= 1 - dt * 0.9;
        this.vel[o + 2] *= 1 - dt * 0.9;
        this.pos[o] += this.vel[o] * dt + Math.sin(this.life[i] * 5 + i) * dt * 0.3;
        this.pos[o + 1] += this.vel[o + 1] * dt;
        this.pos[o + 2] += this.vel[o + 2] * dt;
        this.rot[o] += dt * 4;
        this.rot[o + 1] += dt * 3;
        if (this.pos[o + 1] < 0.02) {
          this.pos[o + 1] = 0.015;
          this.rot[o] = -Math.PI / 2;
          this.rot[o + 2] = 0;
        }
      }
      const alive1 = this.life[i] > 0;
      if (alive1) alive++;
      this.e.set(this.rot[o], this.rot[o + 1], this.rot[o + 2]);
      this.q.setFromEuler(this.e);
      this.v.set(this.pos[o], this.pos[o + 1], this.pos[o + 2]);
      this.m.compose(this.v, this.q, alive1 ? this.one : this.zero);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.active = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    const mt = this.mesh.material as THREE.MeshLambertMaterial;
    mt.map?.dispose();
    mt.dispose();
    this.mesh.removeFromParent();
  }
}

/** Το όπλο με λεφτά: πράσινο πιστόλι με χρυσές λεπτομέρειες. */
export function makeMoneyGun(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: '#3FA34D' });
  const gold = new THREE.MeshLambertMaterial({ color: '#E8B923', emissive: new THREE.Color('#6B5000') });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.07), body);
  barrel.position.set(0, -0.13, 0.02);
  g.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.13), gold);
  mag.position.set(0, -0.06, -0.05);
  g.add(mag);
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: '#7FBF7A' }));
  stack.position.set(0, -0.12, 0.07);
  g.add(stack);
  return g;
}
