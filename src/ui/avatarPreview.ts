// Μικρή 3D προεπισκόπηση του χαρακτήρα που γυρίζει.
import * as THREE from 'three';
import type { Look } from '../sim/engine';
import { Avatar } from '../three/avatar';

export class AvatarPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  private avatar: Avatar | null = null;
  private raf = 0;
  private last = performance.now();
  /** Γυρίζει μόνος του· σταματά με πάτημα, και με σύρσιμο τον γυρίζεις εσύ. */
  private spinning = true;
  private drag: { x: number; moved: number; id: number } | null = null;
  private velocity = 0;

  constructor(readonly el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(3, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.append(this.renderer.domElement);
    const c = this.renderer.domElement;
    c.style.touchAction = 'none';
    c.style.cursor = 'grab';
    c.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, moved: 0, id: e.pointerId };
      c.setPointerCapture(e.pointerId);
      c.style.cursor = 'grabbing';
      this.velocity = 0;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id || !this.avatar) return;
      const dx = e.clientX - this.drag.x;
      this.drag.x = e.clientX;
      this.drag.moved += Math.abs(dx);
      if (this.drag.moved > 4) {
        this.spinning = false;
        this.faceTurn = false;
      }
      this.avatar.group.rotation.y += dx * 0.012;
      this.velocity = dx * 0.012;
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      // σκέτο πάτημα (χωρίς σύρσιμο): παύση ή συνέχεια της περιστροφής
      if (this.drag.moved <= 4) this.spinning = !this.spinning;
      this.drag = null;
      c.style.cursor = 'grab';
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#40384A', 2.2));
    const d = new THREE.DirectionalLight('#FFF0DD', 1.4);
    d.position.set(2, 3, 4);
    this.scene.add(d);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 32), new THREE.MeshLambertMaterial({ color: '#2A3346' }));
    disc.position.y = -0.02;
    this.scene.add(disc);
    this.camera.position.set(0, 1.35, 4.2);
    this.camera.lookAt(0, 1.05, 0);
    const camPos = new THREE.Vector3(0, 1.35, 4.2);
    const camLook = new THREE.Vector3(0, 1.05, 0);
    const look = camLook.clone();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const w = el.clientWidth;
      const hh = el.clientHeight;
      if (w && hh) {
        const c = this.renderer.domElement;
        if (c.width !== Math.round(w * this.renderer.getPixelRatio())) {
          this.renderer.setSize(w, hh, false);
          this.camera.aspect = w / hh;
          this.camera.updateProjectionMatrix();
        }
      }
      // ομαλό ζουμ στο πρόσωπο (καρτέλα «Πρόσωπο») ή σε όλο το σώμα
      const face = this.zoomFace;
      camPos.set(0, face ? 1.95 : 1.35, face ? 2.15 : 4.2);
      camLook.set(0, face ? 1.82 : 1.05, 0);
      const kz = 1 - Math.exp(-dt * 7);
      this.camera.position.lerp(camPos, kz);
      look.lerp(camLook, kz);
      this.camera.lookAt(look);
      if (this.avatar) {
        if (this.faceTurn && !this.drag) {
          // μόλις άνοιξε η καρτέλα: ο χαρακτήρας γυρίζει να μας κοιτάξει
          const r = this.avatar.group.rotation.y;
          const target = Math.round(r / (Math.PI * 2)) * Math.PI * 2;
          this.avatar.group.rotation.y += (target - r) * kz;
          if (Math.abs(target - r) < 0.002) this.faceTurn = false;
        } else if (this.spinning && !this.drag) this.avatar.group.rotation.y += dt * 0.6;
        else if (!this.drag && Math.abs(this.velocity) > 0.0005) {
          // λίγη αδράνεια μετά το σύρσιμο
          this.avatar.group.rotation.y += this.velocity;
          this.velocity *= Math.exp(-dt * 6);
        }
        this.avatar.update(dt, Date.now(), false);
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Ζουμ στο πρόσωπο (true) ή σε όλο το σώμα. */
  zoomFace = false;
  private faceTurn = false;
  focusFace(v: boolean) {
    this.zoomFace = v;
    this.spinning = !v;
    this.faceTurn = v;
  }

  set(look: Look) {
    const ry = this.avatar?.group.rotation.y ?? 0.4;
    this.avatar?.dispose();
    this.avatar = new Avatar(look, ' ', '#F5C542');
    this.avatar.showTag(false);
    this.avatar.group.rotation.y = ry;
    this.avatar.anim = 'idle';
    this.scene.add(this.avatar.group);
  }

  cheer() {
    if (!this.avatar) return;
    this.avatar.anim = 'cheer';
    setTimeout(() => this.avatar && (this.avatar.anim = 'idle'), 1200);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.avatar?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
