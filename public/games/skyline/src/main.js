import * as THREE from 'three';
import { CFG, SKINS, PRESETS, DEFAULT_LOOK, STUDIO } from './config.js';
import { Pipeline, LAYER_NO_OUTLINE } from './render/pipeline.js';
import { createWorldMaterials, buildSegment, disposeSegment, setPropLibrary, RIFT_TIME } from './world/zones.js';
import { PropLibrary } from './world/propLibrary.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Path } from './world/path.js';
import { Sky, Atmosphere } from './world/sky.js';
import { Hero } from './entities/hero.js';
import { Monster } from './entities/monster.js';
import { Coins, PowerUps, SwingLine, Particles } from './entities/pickups.js';
import { SwingRig } from './entities/swing.js';
import { Input } from './game/input.js';
import { Audio } from './game/audio.js';
import { loadSave, writeSave } from './game/save.js';
import { UI } from './game/ui.js';
import { Intro } from './game/intro.js';
import { ACHIEVEMENTS, settleRun, liveCheck, levelOf, xpFor } from './game/progress.js';
import { Webs } from './game/webs.js';
import { Ambient } from './game/ambient.js';
import { Encounters } from './game/encounters.js';
import { Story, ACTS } from './game/story.js';
import { Lobby } from './game/lobby.js';
import { UPGRADES, GADGETS, buy, stats, nextGoal, canAffordAny } from './game/shop.js';
import { SkillChain } from './game/skills.js';
import { HOWTO_PAGES } from './game/howto.js';
import { Physics } from './game/physics.js';
import { Hazards } from './game/hazards.js';
import { Director } from './game/director.js';

const W = CFG.corridorHalf;
const LW = CFG.laneWidth;
const clamp = THREE.MathUtils.clamp;
const damp = (a, b, k, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-k * dt));
};
const ZONE_NAMES = CFG.zoneNames;
// Original story beats shown on chapter cards as the chase moves across town.
const STORY_UNUSED = {
  roof: ['The skyline is Volt\u2019s playground. Tonight it\u2019s a hunting ground.', 'Water towers, wires, wind. Keep swinging.', 'Back above the city. The hound can smell the neon.'],
  street: ['Downtown traffic won\u2019t stop for monsters. Neither will you.', 'Goons, taxis, falling concrete. Just another Tuesday.', 'The imps are pouring out of the manholes.'],
  prison: ['The tunnel dumps you into Iron Isle Lockup. Every cell door just clicked open.', 'Inmates cheering. Guards yelling. Nobody\u2019s in charge down here.', 'Someone let the ink into the cell block. It smells like a set-up.'],
  office: ['Floor 20, Obsidian Tower. Somebody\u2019s having a very weird Monday.', 'Mind the desks. And the coffee. And the interns.', 'Varga worked two floors up. Her files might still be here.'],
  park: ['The Green: eight hundred acres of trees, and every one of them is in the way.', 'Hot-dog carts make great springboards. Don\u2019t tell the vendor.', 'Even the pigeons are running from the hound.'],
  rift: ['The rift tore the sky open. Behind it: the city, upside down.', 'Mirror City. Same streets, wrong gravity.', 'Every tower here is a reflection of one back home. Find the way out.'],
  subway: ['Follow the ink underground, to where the rift began.', 'Trains don\u2019t brake for heroes.', 'Something big is nesting down the old line.'],
};
const TIPS = [
  'Tap up to three times for a TRIPLE JUMP. Land on trains and buses to ride them.',
  'Chain stunts before the timer runs out to bank a SKILL CHAIN.',
  'A second hit while the Ink Hound is close means you\u2019re CAUGHT.',
  'Red rings on the ground mean something is about to fall there.',
  'Swipe toward the arrow sign to take corners. Miss it and you SPLAT.',
  'Coins charge your SHOCKWAVE. It clears the road and scares the hound off.',
  'Mystery boxes are usually good news. Usually.',
];
const _v = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _v2 = new THREE.Vector3();

class Game {
  constructor() {
    this.cfg = CFG;
    this.save = loadSave();
    this.pipeline = new Pipeline(document.getElementById('app'));
    this.pipeline.setQuality(this.save.quality);
    this.renderer = this.pipeline.renderer;

    const scene = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 1500);
    this.camera.layers.enable(LAYER_NO_OUTLINE);
    this.camLook = new THREE.Vector3();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444488, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sunDir = new THREE.Vector3(0.55, 0.52, -0.62).normalize();
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.fill = new THREE.PointLight(0xfff0e0, 0, 30, 1.5); // subway work-light near the hero
    scene.add(this.fill);

    this.sky = new Sky(scene);
    this.sky.uniforms.sunDir.value.copy(this.sunDir);
    this.atmos = new Atmosphere();
    scene.fog = new THREE.Fog(0xffffff, 100, 600);
    this.mats = createWorldMaterials();
    this.sky.finishSkyline(this.mats);
    this.makeEnvironment();

    const ctx = { scene, mats: this.mats };
    this.path = new Path((s) => buildSegment(s, ctx), (s) => disposeSegment(s, ctx));

    this.hero = new Hero();
    scene.add(this.hero.root);
    this.monster = new Monster();
    scene.add(this.monster.root);
    this.coinsFx = new Coins(scene);
    this.powerups = new PowerUps(scene);
    this.line = new SwingLine(scene);
    this.rig = new SwingRig();
    this.particles = new Particles(scene);
    this.wave = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 8, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3fe0ff).multiplyScalar(3), transparent: true }),
    );
    this.wave.layers.set(LAYER_NO_OUTLINE);
    this.wave.visible = false;
    scene.add(this.wave);

    this.audio = new Audio();
    this.audio.musicOn = this.save.music;
    this.audio.sfxOn = this.save.sfx;
    this.input = new Input(this.renderer.domElement);
    this.webs = new Webs(this);
    this.input.onAction = (a) => this.onKey(a);
    window.addEventListener('pointerdown', () => this.soundOn(), { once: false });
    window.addEventListener('keydown', () => this.soundOn(), { once: false });

    this.ui = new UI({
      action: (a, from) => this.onUi(a, from),
      skin: (id) => this.onSkin(id),
      customColor: (k, v) => this.onCustomColor(k, v),
      look: (k, v, fromInput) => this.onLook(k, v, fromInput),
      studioRefresh: () => this.ui.studio(this.save, this.look()),
      click: () => this.audio.play('ui'),
    });
    this.intro = new Intro(this);
    this.skills = new SkillChain(this.ui);
    this.physics = new Physics(scene);
    this.hazards = new Hazards(this);
    this.ambient = new Ambient(this);
    this.encounters = new Encounters(this);
    this.story = new Story(this);
    this.lobby = new Lobby(this);
    this.director = new Director(this);
    this.onRelease = (rig) => {
      if (this.state !== 'playing') return;
      if (rig.flipSpeed > 0) this.skills.add('flip');
      else if (rig.vy > 8.5) this.skills.add('bigAir');
    };
    this.applySkin();

    this.shake = 0;
    this.state = 'boot';
    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.ui.loadingTip(`TIP: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`);
    this.ui.loading(0.05, 'INKING THE CITY…');
    this.state = 'boot';
    const t0 = performance.now();
    this.props = new PropLibrary();
    this.props
      .load((f) => this.ui.loading(0.1 + f * 0.8, f < 0.5 ? 'LIGHTING THE NEON…' : 'WAKING THE HOUNDS…'))
      .then(() => {
        setPropLibrary(this.props);
        this.resetWorld();
        this.ui.loading(1, 'READY!');
        setTimeout(() => this.ui.bootDone(), Math.max(300, 1400 - (performance.now() - t0)));
        if (this.save.seenIntro) this.toTitle();
        else this.startIntro();
      });

    window.__game = this; // debug hook
    this.renderer.setAnimationLoop(() => this.frame());
  }

  makeEnvironment() {
    // Reflections come from the painted sky itself, so wet streets and glass
    // mirror the sunset colours.
    this.atmos.snap('roof');
    this.sky.apply(this.atmos.cur);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(this.sky.dome.geometry, this.sky.dome.material));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0, 0.1, 2000).texture;
    this.scene.environmentIntensity = 0.85;
    // Upgrade to the real CC0 city HDRI once it loads (keeps the sky env on failure).
    new HDRLoader().load('assets/hdri/sunset_jhbcentral_1k.hdr', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const old = this.scene.environment;
      this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 0.7;
      old?.dispose();
      hdr.dispose();
      pmrem.dispose();
    }, undefined, () => pmrem.dispose());
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    // Portrait screens get a wider vertical FOV so lanes stay in view.
    this.baseFov = this.camera.aspect < 1 ? 70 : 56;
    this.camera.updateProjectionMatrix();
    this.pipeline.resize();
  }

  // ───────────────────────── world / run lifecycle ─────────────────────────

  resetWorld(zone = 'roof', city = 'nyc') {
    this.powerups.clear();
    this.path.reset(zone, city);
    this.path.ensure(0);
    this.s = 0;
    this.x = 0;
    this.lane = 0;
    this.turnOffset = new THREE.Vector3();
    this.heroYaw = this.path.segments[0].yaw + Math.PI;
    this.curSeg = this.path.segments[0];
    const a = this.atmos.snap(this.curSeg.zone);
    this.applyAtmos(a);
  }

  resetRun() {
    this.encounters?.reset();
    this.cineT = 0;
    document.getElementById('letterbox')?.classList.remove('on');
    this.skills.reset();
    this.misses = 0;
    this.zonesSeen = new Set();
    this.liveAch = [];
    this.achCheckT = 0;
    this.untouchedDist = null;
    this.runTime = 0;
    this.score = 0;
    this.coins = 0;
    this.speed = CFG.speedStart;
    this.mode = 'swing';
    this.modeT = 0;
    this.bodyY = CFG.restCenter;
    this.vy = 0;
    this.jumps = 0;
    this.ground = 0;
    this.focusT = 0;
    this.boostV = 0;
    this.springT = 0;
    this.doubleT = 0;
    this.queuedTurn = false;
    this.wallT = 0;
    this.strikes = 0;
    this.st = stats(this.save, CFG);
    this.lives = this.st.lives;
    this.maxLives = this.st.lives;
    this.chaseT = 0;
    this.invuln = 0;
    this.slowT = 0;
    this.stumbleT = 0;
    this.magnetT = 0;
    this.shieldOn = false;
    this.shieldT = 0;
    this.turboT = 0;
    this.charge = 0;
    this.mult = 1;
    this.zoneCount = 0;
    this.lastZone = this.path.segments[0]?.zone ?? 'roof';
    this.coinStreak = 0;
    this.coinStreakT = 0;
    this.monsterGap = 7;
    this.monsterX = 0;
    this.monsterYaw = this.heroYaw;
    this.rig.reset(CFG.restCenter);
    this.flipT = 0;
    this.flipDir = 0;
    this.lean = 0;
    this.lastTurnDir = 0;
    this.hero.flip = 0;
    this.hero.lean = 0;
    this.hero.shield.visible = false;
    this.skills?.reset();
    this.physics?.clear();
    this.hazards?.reset();
    this.director?.reset();
    this.laneTimes = [];
    this.coinTimes = [];
    this.airT = 0;
    this.lastLaneT = -9;
  }

  startIntro() {
    this.state = 'intro';
    this.resetWorld();
    this.resetRun();
    this.hero.root.visible = true;
    this.intro.start();
    this.audio.playing = true;
    this.audio.music('music_intro');
  }

  /** First interaction anywhere turns the sound on (browsers block autoplay). */
  soundOn() {
    const first = !this.audio.ctx;
    this.audio.unlock();
    if (first) {
      this.soundOnAt = performance.now();
      this.ui.soundChip(true, this.save.music);
      if (this.state === 'title') this.audio.ambience?.('roof');
    }
  }

  toTitle() {
    this.state = 'title';
    this.resetWorld();
    this.resetRun();
    this.monster.root.visible = false;
    this.line.hide();
    this.ui.showHud(false);
    this.ui.titleStats(this.save);
    this.ui.screen('title');
    this.titleT = 0;
    this.audio.playing = true;
    this.audio.music('music_intro');
    this.audio.ambience?.('roof');
    this.input.drain();
    this.lobby.enter();
  }

  startRun(fromIntro = false) {
    const actIdx = fromIntro ? 0 : (this.save.checkpointAct || 0) % ACTS.length;
    this.lobby.clear();
    if (!fromIntro) this.resetWorld(ACTS[actIdx].zone);
    this.resetRun();
    if (fromIntro) this.s = 6; // the story ends mid-leap, 6 m past the ledge
    this.input.drain();
    this.state = 'playing';
    this.ui.screen(null);
    this.ui.showHud(true);
    this.ui.turn(0);
    this.monster.root.visible = true;
    this.monster.roar();
    this.audio.play('roar');
    this.chaseIntroT = 2.2; // the hound starts right behind you, then drops back
    this.audio.music('music_run');
    this.ui.hint(matchMedia('(pointer: coarse)').matches ? 'LEFT: SWIPE LANES · TAP HOP  |  RIGHT: TAP WEB · HOLD SWING' : 'AIM MOUSE · CLICK WEB · HOLD SWING · A/D LANES · SPACE HOP · S DIVE', 5200);
    this.ui.gadgets(this.save);
    if ((this.save.gadgets?.headstart || 0) > 0) {
      this.save.gadgets.headstart--;
      writeSave(this.save);
      setTimeout(() => {
        if (this.state !== 'playing') return;
        this.turboT = 6;
        this.spawnSkyTrail();
        this.ui.pop('HEAD START!', '#3fe0ff', 50, 40, 56);
        this.ui.gadgets(this.save);
      }, 2600);
    }
    this.chapterNo = 1;
    setTimeout(() => this.state === 'playing' && this.ui.zone(ZONE_NAMES[this.lastZone]), 500);
    this.audio.playing = true;
    this.story.begin(actIdx);
  }

  // ───────────────────────── UI handlers ─────────────────────────

  /** Keyboard shortcuts outside of gameplay (gameplay drains the queue itself). */
  onKey(a) {
    this.audio.unlock();
    const screen = this.ui.current;
    if (this.state === 'intro' && (a === 'confirm' || a === 'pause')) this.intro.skip();
    else if (this.state === 'title' && screen === 'title' && a === 'confirm') this.startRun();
    else if (this.state === 'gameover' && screen === 'gameover' && a === 'confirm') this.startRun();
    else if (this.state === 'paused' && (a === 'pause' || a === 'confirm')) this.resume();
  }

  onUi(a) {
    this.audio.unlock();
    if (a.startsWith('buy-')) {
      if (buy(this.save, a.slice(4))) {
        writeSave(this.save);
        this.audio.play('unlock');
        this.ui.shop(this.save, UPGRADES, GADGETS, a.slice(4), PRESETS);
      } else this.audio.play('hit');
      return;
    }
    if (a.startsWith('suit-')) {
      this.onLook('preset', a.slice(5));
      writeSave(this.save);
      this.applyLook?.();
      this.ui.shop(this.save, UPGRADES, GADGETS, null, PRESETS);
      return;
    }
    if (a === 'gadget-burst') {
      if (this.state === 'playing') this.webs.burst();
      return;
    }
    if (a === 'gadget-net' || a === 'gadget-smoke') {
      if (this.state === 'playing') this.useGadget(a.slice(7));
      return;
    }
    switch (a) {
      case 'play':
      case 'retry':
        this.startRun();
        break;
      case 'skins':
        this.studioReturn = { screen: this.ui.current, state: this.state };
        this.state = 'studio';
        this.titleT = 0;
        this.ui.studio(this.save, this.look());
        this.ui.screen('studio');
        break;
      case 'studio-done': {
        const r = this.studioReturn || { screen: 'title', state: 'title' };
        if (r.state === 'startRun') {
          this.startRun();
          break;
        }
        this.state = r.state === 'studio' ? 'title' : r.state;
        if (r.screen === 'title') this.ui.titleStats(this.save);
        this.ui.screen(r.screen || 'title');
        break;
      }
      case 'randomize':
        this.randomLook();
        break;
      case 'howto':
        this.showHowto();
        break;
      case 'howto-next':
        this.howtoPage = Math.min(HOWTO_PAGES.length - 1, this.howtoPage + 1);
        this.ui.howto(HOWTO_PAGES, this.howtoPage, true);
        this.audio.play('whoosh');
        break;
      case 'howto-skip':
      case 'howto-go':
        this.finishHowto(false);
        break;
      case 'howto-custom':
        this.finishHowto(true);
        break;
      case 'settings':
        this.ui.settings(this.save);
        this.ui.screen('settings');
        break;
      case 'story':
        this.journalReturn = this.state;
        this.ui.journal(this.save);
        this.ui.screen('journal');
        break;
      case 'replay-intro':
        this.ui.screen(null);
        this.startIntro();
        break;
      case 'journal-back':
        if (this.journalReturn === 'safehouse') { this.ui.safehouse(this.story.act, this.story.actIdx, this.save, this.lives, this.maxLives); this.ui.screen('safehouse'); }
        else { this.ui.titleStats(this.save); this.ui.screen('title'); }
        break;
      case 'back':
        if (this.skinsReturn === 'gameover' && this.ui.current === 'skins') this.ui.screen('gameover');
        else {
          this.ui.titleStats(this.save);
          this.ui.screen('title');
        }
        this.skinsReturn = null;
        break;
      case 'sound':
        if (this.audio.ctx && performance.now() - (this.soundOnAt || 0) > 600) {
          this.save.music = !this.save.music;
          this.audio.setMusic(this.save.music);
          writeSave(this.save);
        }
        this.ui.soundChip(true, this.save.music);
        break;
      case 'safehouse-continue':
        this.leaveSafehouse();
        break;
      case 'shop':
        this.shopReturn = this.ui.current === 'safehouse' ? 'safehouse' : this.ui.current;
        this.ui.shop(this.save, UPGRADES, GADGETS, null, PRESETS);
        this.ui.screen('shop');
        break;
      case 'shop-back':
        if (this.shopReturn === 'gameover') {
          this.result.bank = this.save.bank;
          this.ui.gameover(this.result);
          this.ui.screen('gameover');
        } else if (this.shopReturn === 'safehouse') {
          this.ui.safehouse(this.story.act, this.story.actIdx, this.save, this.lives, this.maxLives);
          this.ui.screen('safehouse');
        } else {
          this.ui.titleStats(this.save);
          this.ui.screen('title');
        }
        break;
      case 'title':
      case 'quit':
        this.toTitle();
        break;
      case 'pause':
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        break;
      case 'resume':
        this.resume();
        break;
      case 'skip':
        if (this.state === 'intro') this.intro.skip();
        break;
      case 'ability':
        if (this.state === 'playing') this.shockwave();
        break;
      case 'toggle-quality':
        this.save.quality = this.save.quality === 'high' ? 'low' : 'high';
        this.pipeline.setQuality(this.save.quality);
        this.sun.castShadow = this.save.quality === 'high';
        writeSave(this.save);
        this.ui.settings(this.save);
        break;
      case 'toggle-music':
        this.save.music = !this.save.music;
        this.audio.setMusic(this.save.music);
        writeSave(this.save);
        this.ui.settings(this.save);
        break;
      case 'toggle-sfx':
        this.save.sfx = !this.save.sfx;
        this.audio.setSfx(this.save.sfx);
        writeSave(this.save);
        this.ui.settings(this.save);
        break;
    }
  }

  onSkin(id) {
    const s = SKINS.find((k) => k.id === id);
    if (!this.save.unlocked.includes(id)) {
      if (this.save.bank < s.cost) {
        this.ui.pop('NEED MORE COINS!', '#ff6b6b', 50, 20, 44);
        this.audio.play('hit');
        return;
      }
      this.save.bank -= s.cost;
      this.save.unlocked.push(id);
      this.audio.play('unlock');
      this.ui.pop('UNLOCKED!', '#a8f03a', 50, 20, 52);
    } else this.audio.play('ui');
    this.save.skin = id;
    writeSave(this.save);
    this.applySkin();
    this.ui.skins(this.save);
  }

  onCustomColor(k, v) {
    this.save.custom[k] = v;
    writeSave(this.save);
    this.applySkin();
  }

  /** Comic-page tutorial (first run, or from the title). */
  showHowto() {
    this.resetWorld();
    this.resetRun();
    this.state = 'howto';
    this.titleT = 0;
    this.monster.root.visible = false;
    this.line.hide();
    this.ui.showHud(false);
    this.howtoPage = 0;
    this.ui.howto(HOWTO_PAGES, 0, false);
    this.ui.screen('howto');
  }

  finishHowto(customize) {
    this.save.seenTutorial = true;
    writeSave(this.save);
    if (customize) {
      this.studioReturn = { screen: null, state: 'startRun' };
      this.state = 'studio';
      this.ui.studio(this.save, this.look());
      this.ui.screen('studio');
    } else this.startRun();
  }

  look() {
    return { ...DEFAULT_LOOK, ...(this.save.look || {}) };
  }

  applyLook() {
    const look = this.look();
    this.hero.setLook(look);
    this.line.setColor(new THREE.Color(look.accent));
  }

  onLook(k, v, fromInput) {
    if (k === 'preset') {
      const p = PRESETS.find((x) => x.id === v);
      if (!p) return;
      if (!this.save.unlockedPresets.includes(p.id)) {
        if (this.save.bank < p.cost) {
          this.ui.pop('NEED MORE COINS!', '#ff6b6b', 50, 20, 44);
          this.audio.play('hit');
          return;
        }
        this.save.bank -= p.cost;
        this.save.unlockedPresets.push(p.id);
        this.audio.play('unlock');
        this.ui.pop('UNLOCKED!', '#a8f03a', 50, 20, 52);
      }
      this.save.look = { ...DEFAULT_LOOK, ...p.look };
      this.save.preset = p.id;
    } else {
      const val = v === 'true' ? true : v === 'false' ? false : v;
      this.save.look = { ...this.look(), [k]: val };
      this.save.preset = null;
    }
    writeSave(this.save);
    this.applyLook();
    if (!fromInput) this.ui.studio(this.save, this.look());
  }

  randomLook() {
    const r = (a) => a[Math.floor(Math.random() * a.length)];
    const S = STUDIO;
    this.save.look = {
      ...DEFAULT_LOOK,
      body: r(['A', 'B']), skin: r(S.skin), hood: r(['up', 'down', 'down']), hair: r(S.hair), hairColor: r(S.hairColor),
      mask: r(['full', 'eye']), eyes: r(['visor', 'goggles', 'none']), suit: r(S.colors), pants: r(S.colors), shoes: r(S.colors),
      accent: r(S.colors), trim: r(['#1b1030', '#f4f4f4', '#232a5c']), pattern: r(S.pattern), emblem: r(S.emblem),
      backpack: Math.random() < 0.6, headphones: Math.random() < 0.3, scarf: Math.random() < 0.4, scarfColor: r(S.colors),
    };
    this.save.preset = null;
    writeSave(this.save);
    this.applyLook();
    this.ui.studio(this.save, this.look());
    this.audio.play('power');
  }

  applySkin() {
    this.applyLook();
  }

  /** SAFEHOUSE: a real pause screen at 100% act progress. Nothing moves until CONTINUE. */
  enterSafehouse(act, actIdx) {
    this.state = 'safehouse';
    this.audio.playing = false;
    this.audio.music('music_intro');
    this.ui.safehouse(act, actIdx, this.save, this.lives, this.maxLives);
    this.ui.screen('safehouse');
    this.ui.pop('CHECKPOINT! +50 & +1 ❤', '#a8f03a', 50, 30, 44);
  }

  leaveSafehouse() {
    this.input.drain();
    this.state = 'playing';
    this.ui.screen(null);
    this.audio.playing = true;
    this.audio.music('music_run');
    this.story.nextAct();
  }

  pause() {
    this.state = 'paused';
    this.ui.screen('pause');
    this.audio.playing = false;
  }

  resume() {
    this.input.drain();
    this.state = 'playing';
    this.ui.screen(null);
    this.audio.playing = true;
  }

  // ───────────────────────── main loop ─────────────────────────

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    // Debug: `__game.freeze = true` keeps presenting frames without advancing.
    if (this.freeze) {
      this.pipeline.render(this.scene, this.camera, 0);
      return;
    }
    this.tick(dt);
  }

  /** Debug: advance the simulation deterministically (works even when rAF is throttled). */
  step(seconds, fps = 60) {
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) this.tick(1 / fps, i < n - 1);
  }

  tick(dt, skipRender = false) {
    this.elapsed = (this.elapsed || 0) + dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const pu = this.pipeline.uniforms;
    pu.hitFlash.value = Math.max(0, pu.hitFlash.value - dt * 3);

    if (this.state === 'intro') {
      this.updateAtmos(dt, 'roof');
      if (this.intro.update(dt)) {
        this.save.seenIntro = true;
        writeSave(this.save);
        if (!this.save.seenTutorial) this.showHowto();
        else this.startRun(true);
      }
    } else if (this.state === 'title') {
      this.updateTitle(dt);
      this.webs.update(dt);
      this.ambient.update(dt);
    } else if (this.state === 'studio') {
      this.updateTitle(dt, true);
    } else if (this.state === 'howto') {
      this.updateTitle(dt);
    } else if (this.state === 'playing') {
      this.realDt = dt;
      // Cinematic beats slow time; Hero Sense slows it more.
      const cineSlow = this.cineT > 0 ? this.cineSlow : 1;
      this.updateRun((this.focusT > 0 ? dt * 0.45 : dt) * cineSlow);
      this.updateCine(dt);
      this.webs.update(dt);
      this.ambient.update(dt);
      this.encounters.update(dt);
    } else if (this.state === 'dying') {
      this.updateDying(dt);
    } else if (this.state === 'gameover') {
      this.updateDying(dt, true);
    } else if (this.state === 'safehouse') {
      // Calm establishing shot: camera drifts, nothing else in the world moves.
      this.updateCamera(dt);
    }
    // 'paused' renders the frozen frame.

    if (this.state !== 'paused' && this.state !== 'safehouse') {
      this.particles.update(dt);
      this.physics.update(dt);
      this.coinsFx.update(dt, this.path.segments, this.path, this.heroCenter || this.hero.root.position);
      this.powerups.update(dt, this.path.segments, this.elapsed);
    }
    this.hero.updateScarf(dt, this.scene);
    this.sky.update(this.camera, dt);
    this.followSun();
    this.audio.intensity = this.strikes > 0 ? 1 : 0;
    if (!skipRender) this.pipeline.render(this.scene, this.camera, dt);
  }

  followSun() {
    const p = this.hero.root.position;
    this.sun.target.position.copy(p);
    this.sun.position.copy(p).addScaledVector(this.sunDir, 150);
    this.sun.target.updateMatrixWorld();
  }

  applyAtmos(a) {
    this.scene.fog.color.copy(a.fog);
    this.scene.fog.near = a.fogNear;
    this.scene.fog.far = a.fogFar;
    this.sky.apply(a);
    this.hemi.color.copy(a.hemiSky);
    this.hemi.groundColor.copy(a.hemiGround);
    this.hemi.intensity = a.hemi;
    this.sun.color.copy(a.sun);
    this.sun.intensity = a.sunI;
    this.renderer.toneMappingExposure = a.exposure;
  }

  updateAtmos(dt, zone) {
    RIFT_TIME.value += dt;
    this.applyAtmos(this.atmos.approach(zone, 1 - Math.exp(-1.6 * dt)));
  }

  updateTitle(dt, studio = false) {
    this.titleT += dt;
    this.updateAtmos(dt, 'roof');
    const seg = this.path.segments[0];
    let p = seg.toWorld(40, 0, 1.05);
    const playable = this.state === 'title' && this.lobby.active;
    if (playable) {
      // The lobby is playable: pointer webs, hold swings, space hops.
      this.lobby.update(dt, this.input.drain(), this.input.aim);
      p = this.lobby.pos.clone();
    } else {
      if (this.lobby.active) {
        this.lobby.pos.copy(p);
        this.lobby.vel.set(0, 0, 0);
        this.lobby.anchor = null;
      }
      this.hero.root.position.copy(p);
      this.hero.root.rotation.set(0, seg.yaw + Math.PI, 0);
      this.hero.animate(dt, { mode: 'idle' });
      this.line.hide();
    }
    this.heroCenter = p;
    // Slow heroic orbit; in landscape the hero sits right of the menu.
    const a = Math.sin(this.titleT * 0.18) * 0.5 + 0.35;
    const portrait = this.camera.aspect < 1.25;
    const r = studio ? (portrait ? 2.7 : 3.0) : playable ? (portrait ? 9 : 9.5) : portrait ? 5.2 : 5.6;
    const target = _v.copy(p).addScaledVector(seg.fwd, Math.cos(a) * r).addScaledVector(seg.right, Math.sin(a) * r);
    target.y += playable ? 3.2 : portrait ? 0.9 : 1.1;
    this.camera.position.lerp(target, 1 - Math.exp(-3 * dt));
    const look = _v2.copy(p).setY(p.y + (studio ? (portrait ? -0.75 : 0.1) : portrait ? 0.2 : 0.5));
    if (!portrait) {
      // Title: hero in the right third. Studio: hero in the left third (panel is right).
      const toCam = this.camera.position.clone().sub(p).setY(0).normalize();
      look.add(new THREE.Vector3(-toCam.z, 0, toCam.x).multiplyScalar(studio ? 1.5 : -2.2));
    }
    this.camLook.lerp(look, 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.camLook);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  // ───────────────────────── gameplay ─────────────────────────

  currentSpeed() {
    const ramp = clamp(this.runTime / CFG.rampSec, 0, 1);
    let v = CFG.speedStart + (CFG.speedMax - CFG.speedStart) * ramp;
    v += this.boostV || 0; // momentum from perfect releases
    if (this.turboT > 0) v *= CFG.turboMult;
    if (this.slowT > 0) v *= 0.72;
    return v;
  }

  updateRun(dt) {
    this.runTime += dt;
    const seg = this.path.segAt(this.s);
    const d = this.s - seg.startS;
    const inWindow = seg.turnEnd && d > seg.length - CFG.turnWindow && d < seg.length && !(this.wallT > 0);
    // Junction ahead: a decision beat. Time slows and the camera looks down both roads.
    if (seg.fork && !seg.chosen && !seg.decisionShown && d > seg.length - CFG.turnWindow - 24) {
      seg.decisionShown = true;
      this.cineKey = 'fork';
      this.cine(() => seg.toWorld(seg.length + 1, 0, 3.5, _v3), 1.5, null, 0.3);
      this.audio.play('rise');
    }
    if (this.autoTurn && inWindow && !this.queuedTurn) this.input.queue.push(seg.fork ? (Math.random() < 0.5 ? 'left' : 'right') : seg.turnEnd > 0 ? 'right' : 'left');

    for (const a of this.input.drain()) {
      if (a === 'pause') {
        this.pause();
        return;
      }
      if (a === 'left' || a === 'right') {
        const dir = a === 'left' ? -1 : 1;
        if (inWindow && !this.queuedTurn && (seg.fork || dir === seg.turnEnd)) {
          this.queuedTurn = true;
          this.queuedAt = seg.length - d;
          if (seg.fork) this.chooseFork(seg, dir);
          this.audio.play('turn');
          continue;
        }
        const nl = clamp(this.lane + dir, -1, 1);
        if (nl !== this.lane) {
          this.lane = nl;
          this.audio.play('lane');
          this.lastLaneT = this.elapsed;
          this.laneTimes = this.laneTimes.filter((t) => this.elapsed - t < 1.6);
          this.laneTimes.push(this.elapsed);
          if (this.laneTimes.length >= 3) {
            this.skills.add('weave');
            this.laneTimes = [];
          }
        } else {
          this.lean = -dir * 0.3; // bump against the edge
        }
      } else if (a === 'holdStart') this.rig.setHold(true, this.webs.hasAnchor && !this.webs.target ? this.webs.anchor : null);
      else if (a === 'web') this.webs.fire();
      else if (a === 'burst') this.webs.burst();
      else if (a === 'net' || a === 'smoke') this.useGadget(a);
      else if (a === 'holdEnd') this.rig.setHold(false);
      else if (a === 'up') this.startHop();
      else if (a === 'down') this.startDive();
      else if (a === 'ability') this.shockwave();
    }

    this.boostV = (this.boostV || 0) * Math.exp(-0.9 * dt);
    this.speed = this.currentSpeed();
    // Slammed into a wall: stay pinned against it until you peel off.
    if (this.wallT > 0) {
      this.wallT -= dt;
      this.speed = 0;
      if (this.wallT <= 0) {
        if (seg.fork && !seg.chosen) this.chooseFork(seg, Math.random() < 0.5 ? -1 : 1);
        this.queuedTurn = true;
        this.queuedAt = 99;
        this.slowT = Math.max(this.slowT, 0.9);
      }
    }
    const prevS = this.s;
    this.s += this.speed * dt;

    // Corners only turn when you take them. Miss one and you hit the facade.
    const wallAt = seg.endS - 0.6;
    if (seg.turnEnd && !this.queuedTurn && !(this.wallT > 0) && prevS < wallAt && this.s >= wallAt) {
      if (this.turboT > 0 || this.god) {
        if (seg.fork && !seg.chosen) this.chooseFork(seg, Math.random() < 0.5 ? -1 : 1);
        this.queuedTurn = true;
        this.queuedAt = 99;
      } else {
        this.s = wallAt;
        this.wallT = 0.75;
        this.hit(null, 'wall');
        this.stumbleT = 0.75;
        this.shake = 1;
        this.ui.pop('SPLAT!', '#ff6b6b', 50, 42, 72);
        this.audio.play('slam');
        this.particles.burst(this.hero.root.position, 0xd8d0e8, 30, 7, 0.7, 4, 1.4);
        this.crowd?.('fail');
      }
    }

    // Corner handling.
    if (prevS < seg.endS && this.s >= seg.endS && seg.turnEnd) {
      const before = this.path.toWorld(prevS, this.x, 0);
      if (this.queuedTurn && this.queuedAt < 90) this.skills.add(this.queuedAt < 12 ? 'clutch' : 'corner');
      this.queuedTurn = false;
      this.lastTurnDir = seg.turnEnd;
      this.audio.play('whoosh');
      this.path.ensure(this.s);
      // Keep the rendered hero continuous across the corner snap.
      const after = this.path.toWorld(this.s, this.x, 0);
      this.turnOffset.add(before.addScaledVector(seg.fwd, this.s - prevS).sub(after));
    }
    this.path.ensure(this.s);
    const cur = this.path.segAt(this.s);
    const cd = this.s - cur.startS;
    if (cur !== this.curSeg) this.enterSegment(cur);
    const turnDir = cur.turnEnd && cd > cur.length - CFG.turnSignAt ? cur.turnEnd : 0;
    this.ui.turn(turnDir, this.queuedTurn, cur.fork && !cur.chosen ? [ZONE_NAMES[cur.forkZones[-1]], ZONE_NAMES[cur.forkZones[1]]] : null);

    // Lateral.
    const tx = this.lane * LW;
    const prevX = this.x;
    const step = CFG.laneLerp * dt;
    this.x = Math.abs(tx - this.x) <= step ? tx : this.x + Math.sign(tx - this.x) * step;
    const lateralVel = (this.x - prevX) / Math.max(dt, 1e-4);

    // Vertical: real gravity with up to three jumps, landing on whatever is
    // under you (street, a raised roof, a train or bus roof).
    const ground = this.groundUnder();
    const rest = ground + CFG.restCenter;
    let halfH = CFG.bodyHalfH;
    if (this.turboT > 0) {
      this.bodyY = damp(this.bodyY, ground + 6.8, 3, dt);
      this.vy = 0;
      this.jumps = 0;
    } else {
      this.vy -= CFG.gravity * dt;
      this.bodyY += this.vy * dt;
      if (this.bodyY <= rest) {
        if (this.vy < -9 && this.jumps > 0) {
          this.particles.burst(this.path.toWorld(this.s, this.x, ground + 0.1), 0xd8d0e8, 10, 4, 0.5, 6, 1);
          this.audio.play('slam');
        }
        this.bodyY = rest;
        this.vy = Math.max(0, this.vy);
        this.jumps = 0;
        if (this.mode === 'hop') this.mode = 'swing';
      }
    }
    let yC = this.bodyY;
    if (this.mode === 'dive' && this.bodyY <= rest + 0.05) {
      this.modeT += dt;
      yC = ground + CFG.diveCenter;
      halfH = CFG.diveHalfH;
      if (this.modeT >= CFG.diveSec) this.mode = 'swing';
    }
    this.ground = ground;
    this.yLogic = yC;

    // Timers.
    this.invuln = Math.max(0, this.invuln - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.focusT = Math.max(0, this.focusT - (this.realDt ?? dt));
    this.springT = Math.max(0, this.springT - dt);
    this.doubleT = Math.max(0, this.doubleT - dt);
    if (this.shieldOn) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) this.shieldOn = false;
    }
    if (this.turboT > 0) {
      this.turboT -= dt;
      if (this.turboT <= 0) this.invuln = Math.max(this.invuln, 1.2);
    }
    if (this.chaseT > 0) {
      this.chaseT -= dt;
      if (this.chaseT <= 0) {
        this.strikes = 0;
        this.ui.pop('LOST HIM!', '#a8f03a', 50, 30, 46);
        this.skills.add('escape');
      }
    }
    this.coinStreakT -= dt;
    if (this.coinStreakT <= 0) this.coinStreak = 0;
    this.chaseIntroT = Math.max(0, (this.chaseIntroT || 0) - dt);

    this.collide(this.yLogic, halfH);
    this.moveVehicles(dt);
    this.hazards.update(dt);
    this.director.update(dt);
    this.story.update(dt);
    this.physics.setFloor(cur.floorY(cd));

    // Air time from the swing rig (body well above the lane band).
    if (this.rig.y - this.yLogic > 1.4 || this.turboT > 0) {
      this.airT += dt;
      if (this.airT > 0.7) {
        this.airT = 0;
        this.skills.add('air');
      }
    } else this.airT = Math.max(0, this.airT - dt);
    this.score += this.skills.update(dt);

    this.score += this.speed * dt * 0.5 * this.mult * (this.turboT > 0 ? 2 : 1);
    this.ui.hud(this);

    this.updateHeroVisual(dt, lateralVel);
    this.updateMonster(dt);
    this.updateCamera(dt);
    this.updateAtmos(dt, cur.zone);
    this.subwayLight(cur, dt);
    this.pipeline.uniforms.focus.value = damp(this.pipeline.uniforms.focus.value, this.focusT > 0 ? 1 : 0, 8, this.realDt ?? dt);
    this.audio.setRate(this.focusT > 0 ? 0.8 : 1);
    this.pipeline.uniforms.speedLines.value = damp(this.pipeline.uniforms.speedLines.value, this.turboT > 0 ? 1 : 0, 6, dt);
    this.checkGlass();
    this.coach();
    this.checkAchievements(dt);
    this.maybeRebase();
  }

  /** Commit to a branch at a T-junction (the other road stays until you've turned). */
  chooseFork(seg, dir) {
    if (seg.chosen) return;
    this.path.resolveFork(dir);
    const zone = seg.forkZones[dir];
    this.ui.pop(`${dir < 0 ? '◂ ' : ''}${ZONE_NAMES[zone]}${dir > 0 ? ' ▸' : ''}`, '#3fe0ff', 50, 34, 40);
    this.skills.add('route');
    this.save.routes ??= {};
    this.save.routes[zone] = (this.save.routes[zone] || 0) + 1;
  }

  enterSegment(seg) {
    this.curSeg = seg;
    if (seg.zone !== this.lastZone) {
      this.lastZone = seg.zone;
      this.zoneCount++;
      this.mult = Math.min(10, 1 + this.zoneCount);
      this.chapterNo = (this.chapterNo || 1) + 1;
      // Zone changes are quiet now: a small toast, a new soundscape, no cards or wipes.
      this.skills.add('zone');
      this.audio.ambience?.(seg.zone);
      this.ui.zone(ZONE_NAMES[seg.zone]);
      this.ui.pop(`x${this.mult}!`, '#ff3fa4', 50, 30, 36);
      const words = { street: 'DIVE!', subway: 'DOWN WE GO!', roof: seg.prevZone === 'rift' ? 'BACK HOME!' : 'LAUNCH!', park: 'INTO THE GREEN!', rift: 'RIFT JUMP!', office: 'CRASH!', prison: 'JAILBREAK!' };
      if (seg.zone === 'rift' || seg.prevZone === 'rift') {
        this.pipeline.uniforms.hitFlash.value = 0.9;
        this.audio.sample?.('cinematic_rise');
      }
      setTimeout(() => this.state === 'playing' && this.ui.pop(words[seg.zone], '#3fe0ff', 50, 55, 34), 700);
    }
  }

  /** Up to three jumps: each press in the air kicks off another. */
  startHop() {
    if (this.turboT > 0 || this.jumps >= 3) return;
    const boost = this.springT > 0 ? 1.35 : 1;
    this.vy = [14, 12.5, 11.5][this.jumps] * boost;
    this.jumps++;
    this.mode = 'hop';
    this.modeT = 0;
    this.audio.play('hop');
    if (this.jumps >= 2) {
      this.flipT = CFG.hopSec;
      this.flipDir = -1;
      this.skills.add(this.jumps === 2 ? 'double' : 'triple');
      this.particles.burst(this.hero.root.position, this.hero.accent, 14, 5, 0.5, 2, 3);
      this.ui.pop(this.jumps === 2 ? 'DOUBLE!' : 'TRIPLE!', '#3fe0ff', 50, 52, 40);
    } else if (Math.random() < 0.4) {
      this.flipT = CFG.hopSec;
      this.flipDir = -1;
    }
  }

  startDive() {
    if (this.turboT > 0) return;
    // In the air: slam straight down first.
    if (this.bodyY > (this.ground || 0) + CFG.restCenter + 0.3) this.vy = -30;
    this.mode = 'dive';
    this.modeT = 0;
    this.audio.play('dive');
    this.flipT = CFG.diveSec;
    this.flipDir = 1;
  }

  /** Obstacles, coins and pickups against the hero's logical box. */
  collide(yC, halfH) {
    const segs = this.path.segments;
    const heroWorld = (this.heroCenter = this.path.toWorld(this.s, this.x, yC, this.heroCenter || new THREE.Vector3()));
    heroWorld.add(this.turnOffset);
    for (const seg of segs) {
      if (seg.endS + 10 < this.s || seg.startS > this.s + 40) continue;
      for (const ob of seg.obstacles) {
        if (!ob.alive) continue;
        const obS = seg.startS + ob.d;
        if (!ob.passed && obS < this.s - ob.hd - 0.6) {
          ob.passed = true;
          this.scorePass(ob);
        }
        if (Math.abs(obS - this.s) > ob.hd + CFG.bodyHalfD) continue;
        if (Math.abs(ob.x - this.x) > ob.hw + CFG.bodyHalfW) continue;
        if (yC + halfH < ob.yMin || yC - halfH > ob.yMax) continue;
        if (ob.ramp) continue; // ramps are walked up, never crashed into
        if (ob.standable && yC - halfH >= ob.yMax - 0.3) continue; // riding on top
        // Mantle: airborne and feet within reach of the roof -> pull yourself up.
        if (ob.standable && !ob.step && this.mode !== 'dive' && yC - halfH >= ob.yMax - 2.4 && this.bodyY > this.ground + CFG.restCenter + 0.15) {
          this.vy = Math.max(this.vy, Math.sqrt(2 * CFG.gravity * (ob.yMax - (yC - halfH) + 0.5)));
          if (!ob.mantled) {
            ob.mantled = true;
            this.ui.pop('CLIMB!', '#a8f03a', 50, 50, 34);
            this.audio.play('hop');
          }
          continue;
        }
        this.hit(ob, ob.kind);
      }
      const magnet = this.magnetT > 0;
      for (const c of seg.tokens) {
        if (!c.alive) continue;
        const cs = seg.startS + c.d;
        const ds = cs - this.s;
        if (magnet && !c.pull && ds > -2 && ds < 26 && Math.abs(c.x - this.x) < 9) c.pull = true;
        if (c.pull) {
          if (c.world && c.world.distanceToSquared(heroWorld) < 1.4) this.collectCoin(c);
          continue;
        }
        if (Math.abs(ds) < 1.0 && Math.abs(c.x - this.x) < 1.0 && Math.abs(c.y - yC) < halfH + 0.6) this.collectCoin(c);
      }
      for (const p of seg.pickups) {
        if (!p.alive) continue;
        const ps = seg.startS + p.d;
        if (Math.abs(ps - this.s) < 1.3 && Math.abs(p.x - this.x) < 1.3 && Math.abs(p.y - yC) < halfH + 0.9) this.collectPower(p);
      }
    }
  }

  /** Highest standable surface under the hero (0 = the zone floor). */
  groundUnder() {
    let top = 0;
    const bottom = (this.bodyY ?? CFG.restCenter) - CFG.bodyHalfH;
    for (const seg of this.path.segments) {
      if (seg.endS < this.s - 10 || seg.startS > this.s + 10) continue;
      for (const ob of seg.obstacles) {
        if (!ob.alive || !ob.standable) continue;
        if (Math.abs(seg.startS + ob.d - this.s) > ob.hd + 0.3) continue;
        if (Math.abs(ob.x - this.x) > ob.hw + 0.35) continue;
        if (ob.ramp) {
          // Sloped board: height grows along it; you can walk straight up.
          const t = clamp((this.s - (seg.startS + ob.d - ob.hd)) / (2 * ob.hd), 0, 1);
          const rt = ob.yMin + (ob.yMax - ob.yMin) * t;
          if (bottom >= rt - 0.9) top = Math.max(top, rt);
          continue;
        }
        // One-way platforms: only count when the feet were already on/above the top.
        if (bottom >= ob.yMax - 0.25 && (this.vy ?? 0) <= 0.5) top = Math.max(top, ob.yMax);
      }
    }
    return top;
  }

  /** Stunt credit for an obstacle the hero just got past. */
  scorePass(ob) {
    if (this.turboT > 0 || ob.step) return;
    if (ob.standable && this.yLogic - CFG.bodyHalfH >= ob.yMax - 0.6) {
      this.skills.add('roofRide');
      return;
    }
    const dx = Math.abs(ob.x - this.x);
    if (dx < 1.3) {
      if (ob.skill && (ob.kind !== 'high' || this.mode === 'dive')) {
        this.skills.add(ob.skill);
        if (ob.skill === 'imp') {
          this.coins += 3;
          this.particles.burst(this.hero.root.position, 0xc94dff, 16, 6, 0.6, 6, 2.5);
          this.ui.pop('STOMP!', '#c94dff', 50, 48, 44);
        }
      } else if (ob.kind === 'low') this.skills.add('hopOver');
      else if (ob.kind === 'high') this.skills.add('diveUnder');
    } else if (dx < 3.4 && (ob.kind === 'block' || ob.moving)) {
      this.skills.add(this.elapsed - this.lastLaneT < 0.55 ? 'thread' : 'near');
    }
  }

  collectCoin(c) {
    c.alive = false;
    this.coins++;
    this.coinStreak++;
    this.coinStreakT = 0.45;
    this.coinTimes.push(this.elapsed);
    if (this.coinTimes.length >= 10) {
      if (this.elapsed - this.coinTimes[0] < 2.2) this.skills.add('coinRush');
      this.coinTimes = [];
    }
    this.score += CFG.tokenPoints * this.mult * (this.turboT > 0 ? 2 : 1) * (this.doubleT > 0 ? 2 : 1);
    if (this.doubleT > 0) this.coins++;
    this.charge = Math.min(1, this.charge + 1 / this.st.shockCost);
    this.audio.play('coin', this.coinStreak);
    if (c.world) this.particles.burst(c.world, 0xffd84a, 4, 3, 0.5, 4, 2.2);
    if (this.charge >= 1 && !this.chargeAnnounced) {
      this.chargeAnnounced = true;
      this.ui.pop('SHOCKWAVE READY!', '#3fe0ff', 50, 68, 40);
    }
  }

  collectPower(p) {
    p.alive = false;
    this.skills.add('pickup');
    this.audio.play('power');
    const pos = p.mesh ? p.mesh.position : this.heroCenter;
    const col = { magnet: 0xff3f5a, shield: 0x3fe0ff, turbo: 0xff9a2e, focus: 0x9bf5d5, spring: 0xa8f03a, double: 0xffd84a, mystery: 0xffd84a }[p.type];
    this.particles.burst(pos, col, 30, 7, 0.8, 3, 3);
    if (p.type === 'magnet') {
      this.magnetT = this.st.magnetSec;
      this.ui.pop('MAGNET!', '#ff5a7a');
    } else if (p.type === 'shield') {
      this.shieldOn = true;
      this.shieldT = this.st.shieldSec;
      this.ui.pop('SHIELD!', '#3fe0ff');
    } else if (p.type === 'turbo') {
      this.turboT = this.st.turboSec;
      this.ui.pop('SKY DASH!', '#ff9a2e');
      this.mode = 'swing';
      this.spawnSkyTrail();
    } else if (p.type === 'focus') {
      this.focusT = this.st.focusSec;
      this.ui.pop('FOCUS!', '#9bf5d5');
    } else if (p.type === 'spring') {
      this.springT = CFG.springSec;
      this.ui.pop('SUPER JUMP!', '#a8f03a');
    } else if (p.type === 'double') {
      this.doubleT = CFG.doubleSec;
      this.ui.pop('COINS x2!', '#ffd84a');
    } else if (p.type === 'mystery') {
      this.openMystery();
    }
  }

  /** Mystery box: usually a treat, occasionally the hound. */
  openMystery() {
    this.skills.add('mystery');
    const r = Math.random();
    if (r < 0.3) {
      this.coins += 20;
      this.ui.pop('+20 COINS!', '#ffd84a', 50, 40, 56);
      for (let i = 0; i < 4; i++) this.particles.burst(this.hero.root.position, 0xffd84a, 12, 8, 0.6, 8, 3);
    } else if (r < 0.5) {
      this.charge = 1;
      this.ui.pop('SHOCKWAVE CHARGED!', '#3fe0ff', 50, 40, 44);
    } else if (r < 0.75) {
      this.collectPower({ type: ['magnet', 'shield', 'turbo', 'focus', 'spring', 'double'][Math.floor(Math.random() * 6)], alive: true });
    } else if (r < 0.9) {
      this.score += 2000;
      this.ui.pop('JACKPOT +2000!', '#ff3fa4', 50, 40, 56);
    } else {
      this.ui.pop('UH OH…', '#c94dff', 50, 40, 60);
      this.strikes = 1;
      this.chaseT = CFG.chaseWindowSec;
      this.monsterGap = 12;
      this.monster.roar();
      this.audio.play('roar');
    }
  }

  /** Jetpack-style coin trail high above the lanes during Sky Dash. */
  spawnSkyTrail() {
    const len = this.currentSpeed() * this.st.turboSec;
    this.path.ensure(this.s + len + 20);
    for (let s = this.s + 14; s < this.s + len; s += 2.4) {
      const seg = this.path.segAt(s);
      const d = s - seg.startS;
      if (d > seg.length - 6 || d < seg.floorStart + 2) continue;
      const lane = Math.round(Math.sin(s * 0.08) * 1.2);
      seg.tokens.push({ d, x: clamp(lane, -1, 1) * LW, y: 6.8, alive: true, seg });
    }
  }

  /** Debug: start a run in a given zone ('roof' | 'street' | 'subway'). */
  testZone(zone) {
    this.ui.screen(null);
    this.intro.done || this.intro.finish();
    this.resetWorld(zone);
    this.startRun(true);
  }

  hit(ob, kind) {
    if (this.god) {
      if (ob && !ob.step) this.smash(ob);
      return;
    }
    if (ob && (this.turboT > 0 || this.invuln > 0)) {
      if (this.turboT > 0 && !ob.step) this.smash(ob);
      return;
    }
    if (this.invuln > 0) return;
    if (ob && ob.step) {
      // Clipped a raised roof: a scramble jump carries you up onto it.
      this.vy = Math.max(this.vy, Math.sqrt(2 * CFG.gravity * (ob.yMax + 0.6)));
      this.jumps = 3;
    } else if (ob) this.smash(ob, false);
    if (this.shieldOn) {
      this.shieldOn = false;
      this.invuln = 1.0;
      this.audio.play('shield');
      this.ui.pop('BLOCKED!', '#3fe0ff');
      this.particles.burst(this.heroCenter, 0x3fe0ff, 40, 9, 0.7, 2, 3);
      return;
    }
    this.audio.play('hit');
    this.skills.break();
    this.shake = 0.8;
    this.pipeline.uniforms.hitFlash.value = 1;
    if (this.strikes > 0 && this.chaseT > 0) {
      if (this.lives > 1) {
        this.loseLife();
        return;
      }
      this.caught();
      return;
    }
    this.strikes = 1;
    this.chaseT = CFG.chaseWindowSec;
    this.invuln = CFG.invulnSec;
    this.slowT = 0.9;
    this.stumbleT = 0.5;
    this.monster.roar();
    this.audio.play('roar');
    if (kind !== 'wall') this.ui.pop(['OOF!', 'WHAM!', 'OUCH!'][Math.floor(Math.random() * 3)], '#ff6b6b', 50, 42);
  }

  smash(ob, loud = true, credit = false) {
    ob.alive = false;
    if (this.state === 'playing' && (this.turboT > 0 || credit)) this.skills.add('smash');
    const grp = ob.group;
    const p = grp.getWorldPosition(new THREE.Vector3());
    p.y += 1;
    // Crate stacks burst into separate tumbling pieces.
    if (grp.userData.breakable && grp.parent) {
      const seg = this.path.segAt(this.s);
      for (const piece of [...grp.children]) {
        const box = new THREE.Box3().setFromObject(piece);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        piece.updateMatrixWorld(true);
        const local = piece.worldToLocal(center.clone());
        const vel = seg.fwd.clone().multiplyScalar(this.speed * 0.3 + Math.random() * 4).addScaledVector(seg.right, (Math.random() - 0.5) * 14);
        vel.y = 5 + Math.random() * 7;
        this.physics.add(piece, size.multiplyScalar(0.5).clampScalar(0.1, 2), local.multiplyScalar(piece.scale.x), vel, new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14), { mass: 0.6, life: 3, owned: false });
      }
      grp.visible = false;
    } else if (grp.parent && grp.children.length && !ob.noFling && ob.hd <= 4.6) {
      const seg = this.path.segAt(this.s);
      const side = Math.sign(ob.x - this.x) || (Math.random() < 0.5 ? -1 : 1);
      const vel = seg.fwd.clone().multiplyScalar(this.speed * 0.25 + 3);
      vel.addScaledVector(seg.right, side * (11 + Math.random() * 6));
      vel.y = 8 + Math.random() * 6;
      const spin = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10);
      const hh = ob.kind === 'high' ? 0.6 : Math.max(0.4, ob.yMax / 2);
      const cy = ob.kind === 'high' ? ob.yMin + 0.6 : hh;
      this.physics.add(grp, new THREE.Vector3(ob.hw, hh, ob.hd), new THREE.Vector3(0, cy, 0), vel, spin, { mass: 2, life: 3.2 });
    } else {
      grp.visible = false;
      this.physics.rubble(p, 8, 9, 0.6);
    }
    this.particles.burst(p, 0xfff1d6, 18, 10, 0.9, 12, 1.2);
    this.particles.burst(p, 0xff9a2e, 10, 8, 0.7, 10, 2.5);
    if (loud) {
      this.audio.play('smash');
      this.ui.pop('KRAK!', '#ffd84a', 50, 45);
      this.shake = Math.max(this.shake, 0.35);
    }
  }

  shockwave() {
    if (this.charge < 1) {
      this.ui.pop('CHARGE IT WITH COINS', '#fff1d6', 50, 70, 30);
      return;
    }
    this.charge = 0;
    this.chargeAnnounced = false;
    this.audio.play('boom');
    this.shake = 1;
    this.pipeline.uniforms.hitFlash.value = 0.5;
    this.ui.pop('KA-BOOM!', '#3fe0ff', 50, 40, 80);
    for (const seg of this.path.segments) {
      for (const ob of seg.obstacles) {
        if (!ob.alive || ob.step) continue;
        const ds = seg.startS + ob.d - this.s;
        if (ds > -2 && ds < 60) this.smash(ob, false, true);
      }
    }
    // Knock the hound back too.
    this.strikes = 0;
    this.chaseT = 0;
    this.monsterGap = CFG.monsterGapFar;
    this.wave.visible = true;
    this.waveT = 0;
  }

  useGadget(id) {
    const gd = this.save.gadgets || {};
    if (!(gd[id] > 0) || this.state !== 'playing') {
      this.ui.pop('NONE LEFT — VISIT THE SHOP', '#fff1d6', 50, 70, 26);
      return;
    }
    gd[id]--;
    writeSave(this.save);
    this.ui.gadgets(this.save);
    if (id === 'net') {
      let n = 0;
      for (const seg of this.path.segments) {
        for (const ob of seg.obstacles) {
          const ds = seg.startS + ob.d - this.s;
          if (!ob.alive || ob.step || ob.ramp || ob.webbed || ds < 1 || ds > 48) continue;
          this.webs.cocoon(ob);
          n++;
        }
      }
      this.ui.pop(`WEB NET! x${n}`, '#ffffff', 50, 34, 60);
      this.audio.play('boom');
      this.shake = 0.5;
    } else {
      this.strikes = 0;
      this.chaseT = 0;
      this.monsterGap = CFG.monsterGapFar;
      this.invuln = Math.max(this.invuln, 2);
      this.particles.burst(this.heroCenter, 0x8a86a6, 70, 8, 1.4, 1, 4);
      this.ui.pop('SMOKE BOMB!', '#c9c4de', 50, 38, 56);
      this.audio.play('whoosh');
    }
  }

  /**
   * Story camera beat: slow time, letterbox, and swing the camera's gaze to a
   * world point (or a function returning one) for `dur` seconds.
   */
  cine(target, dur = 1.6, label = null, slow = 0.35) {
    if (this.state !== 'playing') return;
    // First time ever seeing this beat: ultra slow motion, held longer.
    const key = this.cineKey;
    this.cineKey = null;
    if (key) {
      this.save.seen ??= {};
      if (!this.save.seen[key]) {
        this.save.seen[key] = 1;
        writeSave(this.save);
        slow = 0.12;
        dur *= 1.7;
      }
    }
    this.cineTarget = target;
    this.cineDur = dur;
    this.cineT = dur;
    this.cineSlow = slow;
    document.getElementById('letterbox')?.classList.add('on');
    if (label) this.ui.pop(label, '#ffffff', 50, 22, 46);
  }

  /** Ultra slow-mo teaching beat the very first time something happens. */
  firstTime(key, target, label, dur = 1.5) {
    this.save.seen ??= {};
    if (this.save.seen[key] || this.state !== 'playing' || this.cineT > 0) return false;
    this.save.seen[key] = 1;
    writeSave(this.save);
    this.cine(target, dur, label, 0.12);
    return true;
  }

  /** First-run coaching: freeze-frame the first obstacle of each kind. */
  coach() {
    if (this.cineT > 0) return;
    const seen = this.save.seen || {};
    for (const seg of this.path.segments) {
      if (seg.startS > this.s + 30 || seg.endS < this.s) continue;
      for (const ob of seg.obstacles) {
        if (!ob.alive || ob.step || ob.ramp) continue;
        const ds = seg.startS + ob.d - this.s;
        if (ds < 14 || ds > 24 || Math.abs(ob.x - this.x) > 1.4) continue;
        const key = ob.moving ? 'ob-moving' : `ob-${ob.kind}`;
        if (seen[key]) continue;
        const label = {
          'ob-low': 'HOP OVER! (SPACE / W / TAP LEFT SIDE)',
          'ob-high': 'DIVE UNDER! (S / SWIPE DOWN)',
          'ob-block': 'SWITCH LANES! (A / D / SWIPE)',
          'ob-moving': 'ONCOMING! DODGE — OR JUMP ON TOP',
        }[key];
        const p = ob.group.getWorldPosition(new THREE.Vector3());
        p.y += 1;
        this.firstTime(key, p, label, 1.3);
        return;
      }
      for (const pk of seg.pickups) {
        const ds = seg.startS + pk.d - this.s;
        if (pk.alive && ds > 12 && ds < 22 && !seen.pickup) {
          this.firstTime('pickup', seg.toWorld(pk.d, pk.x, pk.y), 'POWER-UP! GRAB IT', 1.2);
          return;
        }
      }
      if (seg.turnEnd && !seen.turn) {
        const d = this.s - seg.startS;
        if (d > seg.length - CFG.turnWindow && d < seg.length - CFG.turnWindow + 8) {
          this.firstTime('turn', seg.toWorld(seg.length, seg.turnEnd * 8, 4), seg.turnEnd > 0 ? 'CORNER! PRESS D / SWIPE RIGHT' : 'CORNER! PRESS A / SWIPE LEFT', 1.4);
          return;
        }
      }
    }
  }

  updateCine(dt) {
    if (!(this.cineT > 0)) return;
    this.cineT -= dt;
    if (this.cineT <= 0) document.getElementById('letterbox')?.classList.remove('on');
  }

  /** 0..1 weight of the cinematic look this frame (eases in and out). */
  cineWeight() {
    if (!(this.cineT > 0)) return 0;
    const k = this.cineT / this.cineDur;
    return Math.min(1, (1 - k) * 5, k * 3);
  }

  /** Hound catches you with lives to spare: knock it off, lose a heart, keep running. */
  loseLife() {
    if (this.untouchedDist === null) this.untouchedDist = this.s;
    this.lives--;
    this.strikes = 0;
    this.chaseT = 0;
    this.invuln = 2.5;
    this.slowT = 0.6;
    this.stumbleT = 0.6;
    this.monsterGap = CFG.monsterGapFar;
    this.monster.roar();
    this.audio.play('roar');
    this.ui.pop(this.lives === 1 ? 'LAST LIFE!' : 'LIFE LOST!', '#ff3f5a', 50, 38, 60);
    this.particles.burst(this.heroCenter, 0xff3f5a, 40, 9, 0.7, 2, 3);
  }

  runStats() {
    return {
      dist: this.s, score: this.score, coins: this.coins, bestChain: this.skills.best, counts: this.skills.counts,
      zones: this.zonesSeen, zoneTotal: CFG.zoneOrder.length, misses: this.misses, untouchedDist: this.untouchedDist ?? this.s,
    };
  }

  /** Smash any office window you reach. */
  checkGlass() {
    for (const seg of this.path.segments) {
      if (!seg.glass) continue;
      for (const gl of seg.glass) {
        if (gl.broken || seg.startS + gl.d - this.s > 0.8) continue;
        gl.broken = true;
        gl.mesh.visible = gl.frame.visible = false;
        const wp = seg.toWorld(gl.d, this.x, gl.y - seg.floorY(gl.d) + 2.5);
        this.particles.burst(wp, 0xbfe8ff, 60, 12, 0.8, 8, 1.2);
        this.particles.burst(wp, 0xffffff, 30, 9, 0.5, 4, 0.8);
        this.physics.rubble(wp, 10, 9, 0.18);
        this.audio.play('glass');
        this.audio.play('smash');
        this.shake = Math.max(this.shake, 0.7);
        this.skills.add('crash');
        this.ui.pop('CRASH!', '#bfe8ff', 50, 36, 64);
        this.cine(null, 0.5, null, 0.3);
        if (seg.zone === 'office') {
          const lines = ['WHOA!', 'IS THAT…?!', 'MY COFFEE!', 'NOT AGAIN!', 'CALL SECURITY!', 'SELFIE!!'];
          setTimeout(() => this.state === 'playing' && this.ui.bubble(lines[Math.floor(Math.random() * lines.length)], 28, 44, true, 1300), 250);
          setTimeout(() => this.state === 'playing' && this.ui.bubble(lines[Math.floor(Math.random() * lines.length)], 72, 40, true, 1300), 900);
          this.skills.add('office');
        }
      }
    }
    // Low ceilings: the office caps your jump.
    const z = this.curSeg?.zone;
    if (z === 'office') {
      const cap = (this.ground || 0) + 4.2;
      if (this.bodyY > cap) {
        this.bodyY = cap;
        this.vy = Math.min(0, this.vy);
      }
    }
  }

  /** Once a second: toast achievements the moment they're earned. */
  checkAchievements(dt) {
    if ((this.achCheckT -= dt) > 0) return;
    this.achCheckT = 1;
    this.zonesSeen.add(this.curSeg.zone);
    for (const a of liveCheck(this.save, this.runStats(), this.liveAch)) {
      this.liveAch.push(a.id);
      this.ui.achievement(a);
      this.audio.play('unlock');
    }
  }

  caught() {
    if ((this.save.gadgets?.revive || 0) > 0) {
      // Second Wind: back on your feet with a shield and one heart.
      this.save.gadgets.revive--;
      writeSave(this.save);
      this.lives = Math.max(1, this.lives);
      this.strikes = 0;
      this.chaseT = 0;
      this.monsterGap = CFG.monsterGapFar;
      this.shieldOn = true;
      this.shieldT = 4;
      this.invuln = 3;
      this.ui.pop('SECOND WIND!', '#a8f03a', 50, 38, 64);
      this.particles.burst(this.heroCenter, 0xa8f03a, 60, 10, 0.8, 2, 3);
      this.audio.play('shield');
      this.ui.gadgets(this.save);
      return;
    }
    this.state = 'dying';
    this.dieT = 0;
    this.audio.play('caught');
    this.audio.play('roar');
    this.audio.music(null);
    this.director.cleanup();
    this.ui.objective(null);
    this.monster.roar();
    this.ui.showHud(false);
    this.ui.turn(0);
    this.line.hide();
    this.rig.detach();
    const newBest = this.score > this.save.best;
    if (newBest) this.save.best = Math.floor(this.score);
    this.coinBonus = Math.round(this.coins * (this.st.coinMult - 1));
    this.save.bank += this.coins + this.coinBonus;
    writeSave(this.save);
    this.skills.break();
    this.progress = settleRun(this.save, this.runStats(), this.liveAch);
    writeSave(this.save);
    this.result = { score: this.score, coins: this.coins, best: this.save.best, dist: this.s, bank: this.save.bank, newBest, chapter: this.chapterNo, bestChain: this.skills.best, act: this.story.act.title, actPct: Math.floor(this.story.progress * 100),
      progress: this.progress, xpFor, achDone: this.save.achievements.length, coinBonus: this.coinBonus, goal: nextGoal(this.save), canShop: canAffordAny(this.save), achTotal: ACHIEVEMENTS.length, bank: this.save.bank };
  }

  updateDying(dt, over = false) {
    this.dieT += dt;
    this.speed = damp(this.speed, 0, 3, dt);
    this.s += this.speed * dt;
    this.monsterGap = damp(this.monsterGap, 1.6, 3, dt);
    this.yLogic = damp(this.yLogic, 0.9, 3, dt);
    this.updateHeroVisual(dt, 0, 'fall');
    this.updateMonster(dt);
    this.updateCamera(dt, true);
    if (!over && this.dieT > 1.5) {
      this.state = 'gameover';
      this.ui.gameover(this.result);
      this.ui.screen('gameover');
    }
  }

  moveVehicles(dt) {
    for (const seg of this.path.segments) {
      for (const ob of seg.obstacles) {
        if (!ob.moving || !ob.alive) continue;
        const ds = seg.startS + ob.d - this.s;
        if (ds > 170 || ds < -20 || ob.d < 26) continue;
        ob.d -= ob.moving * dt;
        ob.group.position.z = -ob.d;
        ob.group.position.y = seg.floorY(ob.d);
      }
    }
  }

  // ───────────────────────── visuals ─────────────────────────

  /**
   * Pick a real building face ahead on the requested side (falls back to the
   * other side, then open sky). Returns true when it's a real surface.
   * `height` 0.5..1.4 scales how high up the face the line bites.
   */
  anchorFor(sAhead, side, out, height = 1) {
    const seg = this.path.segAt(sAhead);
    const d = sAhead - seg.startS;
    const floor = seg.floorY(d);
    const ceil = seg.zone === 'subway' ? 7.85 : seg.zone === 'office' ? 5.9 : seg.zone === 'prison' ? 8.6 : 0;
    if (ceil && (d > seg.transStart + seg.transLen || seg.prevZone === seg.zone)) {
      seg.toWorld(d, this.x * 0.5 + side * (1.2 + height * 0.8), ceil, out);
      return true;
    }
    const want = (this.turboT > 0 ? 20 : 13) * (0.75 + height * 0.35) * (0.8 + Math.random() * 0.4);
    // Gather everything in reach: towers, low roofs, lamps, trees. Pick one of
    // the closest few at random (never the one we just used) so arcs vary.
    for (const sd of [side, -side]) {
      const cands = [];
      for (const f of seg.faces || []) {
        if (f.side !== sd || f.top < floor + 5 || f === this.lastFace) continue;
        const dd = f.d1 < d - 2 ? 99 : Math.max(0, f.d0 - d);
        if (dd < 20) cands.push({ f, dd: dd + Math.random() * 6 });
      }
      if (!cands.length) continue;
      cands.sort((p, q) => p.dd - q.dd);
      const f = cands[Math.floor(Math.random() * Math.min(3, cands.length))].f;
      this.lastFace = f;
      const ad = THREE.MathUtils.clamp(d + (Math.random() - 0.3) * 8, f.d0 + 0.5, f.d1 - 0.5);
      const ay = Math.min(floor + want, f.top - (f.pole ? 0.3 : 1.5)) - seg.floorY(ad);
      seg.toWorld(ad, f.x - sd * 0.05, ay, out);
      return true;
    }
    // Nothing in reach: the line sails into empty air and misses.
    seg.toWorld(d + 6, side * (W + 9), want + 2, out);
    return false;
  }

  /** Metres to the nearest live obstacle ahead in the lane we're in or heading to. */
  threatAhead() {
    let best = 99;
    const tx = this.lane * LW;
    for (const seg of this.path.segments) {
      if (seg.endS < this.s - 3 || seg.startS > this.s + 20) continue;
      for (const ob of seg.obstacles) {
        if (!ob.alive) continue;
        const ds = seg.startS + ob.d - this.s;
        if (ds < -ob.hd - 1 || ds > 20) continue;
        if (Math.abs(ob.x - this.x) > 2.2 && Math.abs(ob.x - tx) > 2.2) continue;
        best = Math.min(best, Math.max(0, ds - ob.hd));
      }
    }
    return best;
  }

  updateHeroVisual(dt, lateralVel, forceMode) {
    const hero = this.hero;
    const rig = this.rig;
    const seg = this.path.segAt(this.s);
    const mode = forceMode || (this.stumbleT > 0 ? 'stumble' : this.mode === 'dive' ? 'dive' : this.mode === 'hop' ? 'hop' : 'swing');
    // Free arcs in open air; hug the gameplay band as an obstacle approaches.
    const free = clamp((this.threatAhead() - 3) / 9, 0, 1);
    const maxY = this.yLogic + 0.3 + free * (this.turboT > 0 ? 1 : 3.8);
    rig.update(dt, {
      s: this.s, x: this.x, yLogic: this.yLogic, maxY, speed: this.speed, mode,
      path: this.path, fwd: seg.fwd, right: seg.right, aim: this.input.aim,
      anchorFor: (sa, side, out, h) => this.anchorFor(sa, side, out, h),
    });
    for (const e of rig.events) {
      if (e === 'attach') {
        this.line.zap();
        if (this.elapsed - (this.lastZapT || 0) > 0.3) {
          this.audio.play('zap');
          this.lastZapT = this.elapsed;
        }
        if (rig.anchorReal) {
          this.particles.burst(rig.anchor, 0xd8d0e8, 5, 3, 0.3, 6, 1);
          this.webs.splatAt(rig.anchor);
        }
        if (rig.manual && this.state === 'playing') {
          // Your own grapple: a little zip of speed toward the point you picked.
          this.boostV = Math.min(12, (this.boostV || 0) + this.st.zip);
          this.skills.add('grapple');
        }
      } else if (e === 'miss') {
        // A short strand flicks out toward nothing and droops away.
        this.line.lastFrom.copy(hero.handWorld);
        this.line.lastTo.copy(hero.handWorld).lerp(rig.anchor, 0.55);
        this.line.release();
        if (this.state === 'playing') {
          this.ui.pop('MISSED!', '#ffffff', 50, 48, 34);
          this.speed = Math.max(CFG.speedStart, this.speed * 0.97);
          this.misses = (this.misses || 0) + 1;
        }
      } else if (e === 'release' || e === 'perfect') {
        this.line.release();
        this.onRelease?.(rig);
        if (e === 'perfect' && this.state === 'playing') {
          this.boostV = Math.min(12, (this.boostV || 0) + 6);
          this.skills.add('perfect');
          this.audio.play('whoosh');
          this.ui.pop('PERFECT!', '#3fe0ff', 50, 50, 40);
          this.particles.burst(hero.root.position, hero.accent, 16, 6, 0.5, 2, 3);
        }
      }
    }

    // Swing physics feel: falling through the arc pumps speed; the bottom of
    // the arc whooshes and kicks the camera; the body sways toward the anchor.
    if (rig.attached && this.state === 'playing') {
      if (rig.vy < -1.5) this.boostV = Math.min(10, (this.boostV || 0) + Math.min(12, -rig.vy) * 0.3 * dt);
      if (this.prevRigVy < -3 && rig.vy >= 0 && rig.attachT > 0.2) {
        this.audio.play('whoosh');
        this.camKick = 1;
      }
      const lat = (rig.anchor.x - hero.root.position.x) * seg.right.x + (rig.anchor.z - hero.root.position.z) * seg.right.z;
      this.swayT = clamp(lat * 0.08, -0.8, 0.8);
    } else this.swayT = 0;
    this.prevRigVy = rig.vy;
    this.sway = damp(this.sway || 0, this.swayT, 3, dt);
    this.camKick = Math.max(0, (this.camKick || 0) - dt * 2.5);
    const raw = this.path.toWorld(this.s, this.x + this.sway, rig.y);
    this.turnOffset.multiplyScalar(Math.exp(-7 * dt));
    hero.root.position.copy(raw).add(this.turnOffset);
    this.heroYaw = dampAngle(this.heroYaw, seg.yaw + Math.PI, 9, dt);
    hero.root.rotation.set(rig.pitch, this.heroYaw, rig.roll, 'YXZ');

    // Hop / dive flips layered on top of release flips.
    let flip = rig.flip;
    if (this.flipT > 0) {
      this.flipT -= dt;
      const T = this.flipDir < 0 ? CFG.hopSec : CFG.diveSec;
      flip += this.flipDir * Math.PI * 2 * (1 - Math.max(0, this.flipT) / T);
    }
    hero.flip = flip;
    this.lean = damp(this.lean, clamp(-lateralVel * 0.045, -0.5, 0.5), 10, dt);
    hero.lean = this.lean;
    hero.lineSide = rig.side;
    hero.shield.visible = this.shieldOn;
    hero.shield.scale.setScalar(1 + Math.sin(this.elapsed * 6) * 0.03);
    const blink = this.invuln > 0 && this.turboT <= 0 && Math.floor(this.invuln * 12) % 2 === 0;
    hero.body.visible = !blink;
    const pose = mode === 'swing' && !rig.attached ? 'fly' : mode;
    hero.animate(dt, { mode: pose, phase: 0.5, anchorWorld: rig.attached ? rig.anchor : null, swingVel: rig.pitchV });
    this.line.update(dt, hero.handWorld, rig.anchor, rig.attached && hero.body.visible, this.turboT > 0 ? 0.6 : 0);

    if (this.wave.visible) {
      this.waveT += dt;
      this.wave.position.copy(hero.root.position);
      this.wave.rotation.set(Math.PI / 2, 0, 0);
      this.wave.scale.setScalar(1 + this.waveT * 70);
      this.wave.material.opacity = Math.max(0, 1 - this.waveT * 1.6);
      if (this.waveT > 0.7) this.wave.visible = false;
    }
    if (this.turboT > 0 && Math.random() < 0.7) this.particles.burst(hero.root.position, 0xff9a2e, 2, 3, 0.6, 0, 3);
  }

  updateMonster(dt) {
    const chasing = this.strikes > 0 && this.chaseT > 0;
    let target = chasing ? CFG.monsterGapNear + Math.sin(this.elapsed * 3) * 0.6 : CFG.monsterGapFar;
    if (this.chaseIntroT > 0) target = 4.8;
    if (this.state !== 'dying' && this.state !== 'gameover') this.monsterGap = damp(this.monsterGap, target, chasing || this.chaseIntroT > 0 ? 3.5 : 2.4, dt);
    const ms = this.s - this.monsterGap;
    this.monsterX = damp(this.monsterX, this.x * 0.8, 3, dt);
    const seg = this.path.segAt(ms);
    // Run a little off to the side so the hero stays readable.
    const side = this.x > 0 ? -1 : 1;
    const pos = this.path.toWorld(ms, this.monsterX + side * 0.9, this.state === 'dying' ? 0.3 : 0);
    const m = this.monster.root;
    m.position.copy(pos);
    this.monsterYaw = dampAngle(this.monsterYaw, seg.yaw + Math.PI, 6, dt);
    m.rotation.set(0, this.monsterYaw, 0);
    m.visible = this.monsterGap < 13;
    this.monster.update(dt, this.speed);
    this.houndFx(dt, seg, ms);
  }

  /** Ink footprints, hot breath and a menacing rim light on the chaser. */
  houndFx(dt, seg, ms) {
    if (!this.prints) {
      const geo = new THREE.CircleGeometry(0.45, 10);
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a0a40, transparent: true, opacity: 0.8, depthWrite: false });
      this.prints = Array.from({ length: 24 }, () => {
        const p = new THREE.Mesh(geo, mat.clone());
        p.rotation.x = -Math.PI / 2;
        p.visible = false;
        p.userData.life = 0;
        this.scene.add(p);
        return p;
      });
      this.printT = 0;
      this.houndRim = new THREE.PointLight(0xff2fd0, 0, 14, 1.6);
      this.scene.add(this.houndRim);
    }
    const m = this.monster.root;
    const hound = m.visible && !(this.story?.clown?.visible);
    this.houndRim.intensity = damp(this.houndRim.intensity, hound ? 18 : 0, 4, dt);
    this.houndRim.position.copy(m.position).add(new THREE.Vector3(0, 3.5, 0));
    this.printT -= dt;
    if (hound && this.printT <= 0 && this.state === 'playing') {
      this.printT = 0.14;
      const p = this.prints.find((x) => x.userData.life <= 0);
      if (p) {
        const side = (this.printSide = -(this.printSide || 1));
        seg.toWorld(ms - seg.startS, this.monsterX + side * 0.6, 0.04, p.position);
        p.scale.set(1, 1.4, 1);
        p.rotation.z = -this.monsterYaw;
        p.userData.life = 2.2;
        p.visible = true;
      }
      // Hot breath in the cold air.
      if (Math.random() < 0.5) this.particles.burst(m.position.clone().add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(seg.fwd, 2.4), 0xd8d0e8, 2, 1.5, 0.6, -1, 1.2);
    }
    for (const p of this.prints) {
      if (p.userData.life <= 0) continue;
      p.userData.life -= dt;
      p.material.opacity = Math.min(0.8, p.userData.life * 0.5);
      if (p.userData.life <= 0) p.visible = false;
    }
  }

  updateCamera(dt, dying = false) {
    const cam = this.camera;
    const back = dying ? 11 : 7.6;
    const up = dying ? 5.5 : 3.8 + (this.turboT > 0 ? 1.5 : 0);
    const camY = (this.rig.y ?? CFG.restCenter) * 0.62 + up - (this.camKick || 0) * 0.6;
    const seg = this.path.segAt(this.s);
    // Follow camera: the heading eases toward the road's yaw, so corners swing
    // round smoothly instead of snapping. The pointer adds a little free look.
    this.camYaw = this.camYaw === undefined || this.camSnap ? seg.yaw : dampAngle(this.camYaw, seg.yaw, this.wallT > 0 ? 0.6 : 3.6, dt);
    this.camSnap = false;
    const aim = this.input.aim;
    this.lookYaw = damp(this.lookYaw || 0, aim.active && !dying ? clamp(aim.x, -1, 1) * 0.14 : 0, 3, dt);
    this.lookPitch = damp(this.lookPitch || 0, aim.active && !dying ? clamp(aim.y - 0.45, -0.4, 0.4) * 2.2 : 0, 3, dt);
    const yaw = this.camYaw - this.lookYaw;
    _fw.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const base = this.path.toWorld(this.s, this.x * 0.55, camY, _v3).add(this.turnOffset);
    const target = _v.copy(base).addScaledVector(_fw, -back);
    // Keep the camera from dipping below the zone floor during transitions.
    const heroFloor = seg.floorY(this.s - seg.startS);
    target.y = Math.max(target.y, heroFloor + 2.4);
    cam.position.x = damp(cam.position.x, target.x, 7, dt);
    cam.position.z = damp(cam.position.z, target.z, 7, dt);
    cam.position.y = damp(cam.position.y, target.y, 4.5, dt);
    const look = _v2.copy(base).addScaledVector(_fw, 9);
    look.y = base.y - camY + (this.yLogic ?? CFG.restCenter) * 0.5 + 0.6 - this.lookPitch;
    const cw = this.cineWeight();
    if (cw > 0) {
      const tp = typeof this.cineTarget === 'function' ? this.cineTarget() : this.cineTarget;
      if (tp) look.lerp(tp, cw * 0.85);
      // Pull the camera out and up a little for the establishing shot.
      cam.position.y += cw * 1.6 * dt * 4;
    }
    this.camLook.lerp(look, 1 - Math.exp(-9 * dt));
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }
    cam.lookAt(this.camLook);
    cam.rotateZ(-this.lean * 0.12 - this.rig.roll * 0.12);
    const fovT = this.baseFov + clamp((this.speed - CFG.speedStart) * 0.18, 0, 5) + (this.turboT > 0 ? 8 : 0) + (this.boostV || 0) * 0.5 + (this.camKick || 0) * 3 - this.cineWeight() * 8;
    cam.fov = damp(cam.fov, fovT, 4, dt);
    cam.updateProjectionMatrix();
  }

  subwayLight(seg, dt) {
    const inTunnel = seg.zone === 'subway' || seg.zone === 'office' || seg.zone === 'prison';
    this.fill.intensity = damp(this.fill.intensity, inTunnel ? 16 : 0, 3, dt);
    this.fill.position.copy(this.hero.root.position).add(new THREE.Vector3(0, 3.5, 0));
  }

  maybeRebase() {
    const p = this.hero.root.position;
    if (Math.abs(p.x) < 4000 && Math.abs(p.z) < 4000) return;
    const off = new THREE.Vector3(Math.round(p.x), 0, Math.round(p.z));
    this.path.rebase(off);
    this.coinsFx.rebase(off, this.path.segments);
    this.powerups.rebase(off);
    this.particles.rebase(off);
    this.physics.rebase(off);
    this.camera.position.sub(off);
    this.camLook.sub(off);
    this.rig.anchor.sub(off);
    this.webs.rebase(off);
    this.ambient.rebase(off);
    for (const p of this.prints || []) p.position.sub(off);
    this.hero.root.position.sub(off);
    if (this.heroCenter) this.heroCenter.sub(off);
  }
}

try {
  new Game();
} catch (e) {
  console.error(e);
  const boot = document.getElementById('boot');
  boot.textContent = 'Could not start WebGL: ' + e.message;
}
