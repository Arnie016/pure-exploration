import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const LAYER_NO_OUTLINE = 2;

const ComicShader = {
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    useNormals: { value: 1 },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.3 },
    cameraFar: { value: 1500 },
    inkColor: { value: new THREE.Color(0x1b1030) },
    lineScale: { value: 1 },
    time: { value: 0 },
    hitFlash: { value: 0 },
    speedLines: { value: 0 },
    focus: { value: 0 },
    noir: { value: 0 },
    horror: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform float useNormals;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec3 inkColor;
    uniform float lineScale;
    uniform float time;
    uniform float hitFlash;
    uniform float speedLines;
    uniform float focus;
    uniform float noir;
    uniform float horror;
    varying vec2 vUv;

    float linDepth(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 px = lineScale / resolution;
      vec3 col = texture2D(tColor, vUv).rgb;

      // Depth edges: Laplacian of inverse depth is zero on flat planes, so
      // only silhouettes and creases light up.
      float zc = linDepth(vUv);
      float il = 1.0 / linDepth(vUv - vec2(px.x, 0.0));
      float ir = 1.0 / linDepth(vUv + vec2(px.x, 0.0));
      float iu = 1.0 / linDepth(vUv + vec2(0.0, px.y));
      float id = 1.0 / linDepth(vUv - vec2(0.0, px.y));
      float ic = 1.0 / zc;
      float lap = (abs(il + ir - 2.0 * ic) + abs(iu + id - 2.0 * ic)) / ic;
      float edge = smoothstep(0.035, 0.09, lap);

      if (useNormals > 0.5) {
        vec3 nc = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
        vec3 nl = texture2D(tNormal, vUv - vec2(px.x, 0.0)).xyz * 2.0 - 1.0;
        vec3 nr = texture2D(tNormal, vUv + vec2(px.x, 0.0)).xyz * 2.0 - 1.0;
        vec3 nu = texture2D(tNormal, vUv + vec2(0.0, px.y)).xyz * 2.0 - 1.0;
        vec3 nd = texture2D(tNormal, vUv - vec2(0.0, px.y)).xyz * 2.0 - 1.0;
        float nEdge = 1.0 - min(min(dot(nc, nl), dot(nc, nr)), min(dot(nc, nu), dot(nc, nd)));
        edge = max(edge, smoothstep(0.28, 0.55, nEdge));
      }
      // Lines thin out with distance so the far skyline stays clean.
      edge *= 1.0 - smoothstep(160.0, 520.0, zc);

      // Perceptual luminance of the lit colour drives halftone + hatching.
      vec3 tm = col / (1.0 + col);
      float lum = pow(dot(tm, vec3(0.299, 0.587, 0.114)), 0.8);
      vec2 fc = gl_FragCoord.xy;

      // Rotated halftone dots in the mid-shadows.
      float cell = 6.0 * lineScale;
      mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
      vec2 g = rot * fc / cell;
      vec2 f = fract(g) - 0.5;
      float dotR = clamp((0.42 - lum) * 1.9, 0.0, 0.55);
      float dots = 1.0 - smoothstep(dotR - 0.08, dotR + 0.02, length(f));
      col = mix(col, col * 0.6 + inkColor * 0.1, dots * 0.32 * step(zc, 400.0));

      // Sketchy diagonal hatching in the deepest shadow.
      float hatch = step(0.72, fract((fc.x + fc.y) / (5.0 * lineScale)));
      col = mix(col, inkColor, hatch * smoothstep(0.2, 0.06, lum) * 0.2);

      // Candy colour boost + paper grain.
      float grey = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(grey), col, 1.18);
      col += (hash(fc + floor(time * 12.0)) - 0.5) * 0.025;

      // Radial speed lines while dashing.
      if (speedLines > 0.0) {
        vec2 c = vUv - 0.5;
        float ang = atan(c.y, c.x);
        float streak = step(0.93, fract(sin(floor(ang * 60.0) * 91.7) * 43758.5 + time * 3.0));
        float rad = smoothstep(0.22, 0.62, length(c * vec2(resolution.x / resolution.y, 1.0)));
        col = mix(col, vec3(1.0), streak * rad * speedLines * 0.55);
      }

      // Episode styles. Noir: hard black & white. Horror: bled-out red, flicker.
      float gN = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 noirCol = vec3(smoothstep(0.08, 0.75, gN / (1.0 + gN) * 1.9));
      col = mix(col, noirCol, noir);
      float flick = 0.85 + 0.15 * step(0.5, fract(sin(floor(time * 9.0)) * 43758.5));
      vec3 horrorCol = vec3(gN) * vec3(1.25, 0.42, 0.45) * flick;
      col = mix(col, horrorCol, horror * 0.85);
      // Focus (slow-mo): cool desaturated world with glowing cyan ink lines.
      float g2 = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(g2) * vec3(0.75, 1.0, 1.12), focus * 0.6);
      vec3 ink = mix(inkColor, vec3(0.2, 1.6, 1.8), focus * 0.8);
      col = mix(col, ink, edge);
      col = mix(col, vec3(1.6, 0.35, 0.55), hitFlash * 0.35);

      // Soft vignette.
      vec2 v = vUv - 0.5;
      col *= 1.0 - dot(v, v) * (0.45 + horror * 1.6);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

class ComicPass extends Pass {
  constructor(pipeline) {
    super();
    this.pipeline = pipeline;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ComicShader.uniforms),
      vertexShader: ComicShader.vertexShader,
      fragmentShader: ComicShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer) {
    const u = this.material.uniforms;
    u.tColor.value = this.pipeline.sceneRT.texture;
    u.tDepth.value = this.pipeline.sceneRT.depthTexture;
    u.tNormal.value = this.pipeline.normalRT.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

/**
 * Renders the scene into an HDR target with depth, optionally renders a normal
 * buffer, then runs comic ink/halftone -> bloom -> tone-mapped output.
 */
export class Pipeline {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.quality = 'high';
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.sceneRT.depthTexture = new THREE.DepthTexture(1, 1);
    this.sceneRT.depthTexture.type = THREE.UnsignedIntType;
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.normalMat = new THREE.MeshNormalMaterial();

    this.composer = new EffectComposer(this.renderer);
    this.comic = new ComicPass(this);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 1.1);
    this.composer.addPass(this.comic);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  get uniforms() {
    return this.comic.material.uniforms;
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q === 'high';
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.75 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    const pw = Math.floor(w * pr);
    const ph = Math.floor(h * pr);
    this.sceneRT.setSize(pw, ph);
    this.normalRT.setSize(pw, ph);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(pw / 2, ph / 2);
    this.uniforms.resolution.value.set(pw, ph);
    this.uniforms.lineScale.value = Math.max(1.5, pr * 1.2);
  }

  render(scene, camera, dt) {
    const r = this.renderer;
    const u = this.uniforms;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.time.value += dt;
    u.useNormals.value = this.quality === 'high' ? 1 : 0;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    if (this.quality === 'high') {
      const bg = scene.background;
      const fog = scene.fog;
      scene.background = null;
      scene.fog = null;
      scene.overrideMaterial = this.normalMat;
      camera.layers.disable(LAYER_NO_OUTLINE);
      r.shadowMap.autoUpdate = false; // shadows were already drawn this frame
      r.setRenderTarget(this.normalRT);
      r.setClearColor(0x000000, 1);
      r.clear();
      r.render(scene, camera);
      r.shadowMap.autoUpdate = true;
      camera.layers.enable(LAYER_NO_OUTLINE);
      scene.overrideMaterial = null;
      scene.background = bg;
      scene.fog = fog;
    }
    this.composer.render(dt);
  }
}
