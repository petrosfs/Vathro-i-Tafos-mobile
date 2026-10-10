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

  constructor(readonly el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#40384A', 2.2));
    const d = new THREE.DirectionalLight('#FFF0DD', 1.4);
    d.position.set(2, 3, 4);
    this.scene.add(d);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 32), new THREE.MeshLambertMaterial({ color: '#2A3346' }));
    disc.position.y = -0.02;
    this.scene.add(disc);
    this.camera.position.set(0, 1.35, 4.2);
    this.camera.lookAt(0, 1.05, 0);
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
      if (this.avatar) {
        this.avatar.group.rotation.y += dt * 0.6;
        this.avatar.update(dt, Date.now(), false);
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
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
