import Phaser from "phaser";

const WIDTH = 360;
const HEIGHT = 472;
const TILE = 32;
const FIELD_TILE = 28;
const FIELD_TOP = 62;
const PANEL_Y = 306;
const BATTLE_ENEMY_X = 104;
const BATTLE_ENEMY_Y = 154;
const PARTY_BATTLE_X = 252;
const PARTY_BATTLE_Y = 142;
const PARTY_BATTLE_GAP = 34;
const LEVEL_XP = [0, 20, 48, 88, 140, 210, 300];
const UI_FONT = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif';

type Direction = "up" | "down" | "left" | "right";
type SceneMode = "title" | "field" | "battle";
type BgmTrack = "title" | "village" | "forest" | "dungeon" | "battle" | "boss" | "ending";
type SeKey = "confirm" | "cancel" | "move" | "attack" | "magic" | "heal" | "chest" | "stairs";

type PartyMember = {
  name: string;
  job: string;
  lv: number;
  xp: number;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  strength: number;
  stamina: number;
  magicPower: number;
  evade: number;
  magic?: string;
  steal?: boolean;
  weapon?: string;
  armor?: string;
};

type Enemy = {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
  color: number;
  boss?: boolean;
  behavior?: "slime" | "bat" | "knight" | "mage" | "boss";
  stealGold?: number;
  stealItem?: string;
};

type Npc = {
  x: number;
  y: number;
  name: string;
  lines: string[];
  inn?: boolean;
  shop?: boolean;
  shopType?: "item" | "weapon" | "armor";
  join?: string;
  flag?: string;
};

type Chest = {
  x: number;
  y: number;
  item: string;
  opened: boolean;
};

type Exit = {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
  text: string;
};

type GameMap = {
  name: string;
  encounter: number;
  tiles: string[];
  exits: Exit[];
  npcs: Npc[];
  chests: Chest[];
  boss?: { x: number; y: number };
};

type BattleState = {
  enemy: Enemy;
  actor: number;
  command: number;
  submenu: BattleSubmenu | null;
  log: string[];
  won: boolean;
  wonBoss: boolean;
  waiting: boolean;
  enemyFlashUntil: number;
  partyFlashUntil: number[];
  shakeUntil: number;
  defending: boolean[];
  actingIndex: number | null;
  actingUntil: number;
};

type BattleSubmenu = {
  kind: "じゅもん" | "ベジタブル";
  cursor: number;
};

type BattleSkill = {
  name: string;
  mp: number;
  description: string;
};

type BattleEffect = {
  kind: "slash" | "magic" | "heal" | "hit";
  x: number;
  y: number;
  startedAt: number;
  duration: number;
};

type MenuState = {
  mode: "main" | "save" | "load" | "shop" | "equip" | "equipGear" | "items";
  cursor: number;
  items: string[];
  shopType?: "item" | "weapon" | "armor";
  memberIndex?: number;
  gearKind?: "weapon" | "armor";
};

type ShopEntry = {
  id: string;
  name: string;
  kind: "item" | "weapon" | "armor";
  price: number;
  atk?: number;
  def?: number;
  users?: string[];
};

type SaveData = {
  mapId: string;
  player: { x: number; y: number; dir: Direction };
  party: PartyMember[];
  joined: Record<string, boolean>;
  items: Record<string, number>;
  inventory: Record<string, number>;
  gold: number;
  xp: number;
  ending: boolean;
  chests: Record<string, boolean[]>;
  flags?: Record<string, boolean>;
  savedAt?: string;
};

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private desiredTrack: BgmTrack = "title";
  private activeTrack: BgmTrack | null = null;
  private loopTimer: number | null = null;
  private step = 0;

  unlock() {
    if (!this.ctx) {
      const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.seGain = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.bgmGain.gain.value = 0.18;
      this.seGain.gain.value = 0.42;
      this.bgmGain.connect(this.master);
      this.seGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.startLoop(this.desiredTrack);
  }

  playBgm(track: BgmTrack) {
    this.desiredTrack = track;
    if (!this.ctx || this.activeTrack === track) return;
    this.startLoop(track);
  }

  playSe(key: SeKey) {
    if (!this.ctx || !this.seGain) return;
    const now = this.ctx.currentTime;
    if (key === "confirm") this.tone(740, 0.055, now, "square", 0.18);
    if (key === "cancel") this.tone(250, 0.075, now, "sawtooth", 0.14);
    if (key === "move") this.tone(180, 0.035, now, "triangle", 0.08);
    if (key === "stairs") this.arpeggio([440, 554, 659], 0.055, "triangle", 0.12);
    if (key === "chest") this.arpeggio([659, 880, 1175], 0.07, "square", 0.14);
    if (key === "attack") {
      this.noise(0.08, now, 0.16);
      this.tone(150, 0.06, now, "sawtooth", 0.18);
    }
    if (key === "magic") this.arpeggio([523, 659, 784, 1047], 0.05, "sine", 0.13);
    if (key === "heal") this.arpeggio([392, 523, 659, 784], 0.065, "triangle", 0.11);
  }

  private startLoop(track: BgmTrack) {
    if (!this.ctx) return;
    this.stopLoop();
    this.activeTrack = track;
    this.step = 0;
    this.tickBgm();
    this.loopTimer = window.setInterval(() => this.tickBgm(), this.pattern(track).stepMs);
  }

  private stopLoop() {
    if (this.loopTimer !== null) window.clearInterval(this.loopTimer);
    this.loopTimer = null;
  }

  private tickBgm() {
    if (!this.ctx || !this.bgmGain || !this.activeTrack) return;
    const pattern = this.pattern(this.activeTrack);
    const index = this.step % pattern.lead.length;
    const now = this.ctx.currentTime;
    const lead = pattern.lead[index];
    const bass = pattern.bass[index % pattern.bass.length];
    if (lead) this.note(lead, pattern.stepMs / 1000 * 0.82, now, "square", pattern.leadGain);
    if (bass) this.note(bass, pattern.stepMs / 1000 * 0.95, now, "triangle", pattern.bassGain);
    this.step += 1;
  }

  private pattern(track: BgmTrack) {
    const patterns: Record<BgmTrack, { stepMs: number; lead: number[]; bass: number[]; leadGain: number; bassGain: number }> = {
      title: { stepMs: 280, lead: [72, 76, 79, 84, 79, 76, 74, 0], bass: [48, 0, 55, 0], leadGain: 0.1, bassGain: 0.08 },
      village: { stepMs: 330, lead: [67, 69, 71, 74, 72, 69, 67, 0], bass: [43, 0, 50, 0], leadGain: 0.075, bassGain: 0.065 },
      forest: { stepMs: 250, lead: [69, 72, 74, 76, 74, 72, 69, 67], bass: [45, 0, 52, 0], leadGain: 0.08, bassGain: 0.06 },
      dungeon: { stepMs: 390, lead: [57, 0, 60, 0, 62, 0, 60, 0], bass: [33, 0, 36, 0], leadGain: 0.07, bassGain: 0.075 },
      battle: { stepMs: 190, lead: [76, 74, 72, 74, 79, 76, 74, 72], bass: [40, 40, 47, 47], leadGain: 0.095, bassGain: 0.085 },
      boss: { stepMs: 170, lead: [72, 75, 72, 70, 68, 70, 72, 75], bass: [36, 36, 43, 43], leadGain: 0.105, bassGain: 0.1 },
      ending: { stepMs: 360, lead: [72, 76, 79, 83, 84, 83, 79, 76], bass: [48, 0, 55, 0], leadGain: 0.085, bassGain: 0.065 },
    };
    return patterns[track];
  }

  private note(midi: number, duration: number, start: number, wave: OscillatorType, gain: number) {
    this.tone(440 * 2 ** ((midi - 69) / 12), duration, start, wave, gain, this.bgmGain);
  }

  private tone(freq: number, duration: number, start: number, wave: OscillatorType, gain: number, output = this.seGain) {
    if (!this.ctx || !output) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(output);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private arpeggio(freqs: number[], stepDuration: number, wave: OscillatorType, gain: number) {
    if (!this.ctx) return;
    freqs.forEach((freq, index) => this.tone(freq, stepDuration, this.ctx!.currentTime + index * stepDuration, wave, gain));
  }

  private noise(duration: number, start: number, gain: number) {
    if (!this.ctx || !this.seGain) return;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(amp);
    amp.connect(this.seGain);
    source.start(start);
  }
}

const colors = {
  paper: 0xfff3cb,
  border: 0xf3d17b,
  panel: 0x202735,
  grass: 0x87b65a,
  grass2: 0x739f4e,
  path: 0xc49b62,
  tree: 0x295a39,
  water: 0x3b7ca7,
  wall: 0x6e6472,
  floor: 0xa99675,
  roof: 0xa8473d,
  wood: 0x8b5a38,
};

const partyBase: PartyMember[] = [
  { name: "yos", job: "ゲーマス", lv: 1, xp: 0, maxHp: 50, hp: 50, maxMp: 14, mp: 14, atk: 12, def: 6, spd: 7, strength: 12, stamina: 8, magicPower: 13, evade: 8, magic: "ホイミ", weapon: "stick", armor: "cloth" },
  { name: "もじさん", job: "百姓貴族", lv: 5, xp: 140, maxHp: 116, hp: 116, maxMp: 24, mp: 24, atk: 30, def: 16, spd: 4, strength: 30, stamina: 20, magicPower: 8, evade: 5, magic: "オニオンソード", weapon: "onionSword", armor: "cloth" },
  { name: "ヤス", job: "賢者", lv: 1, xp: 0, maxHp: 46, hp: 46, maxMp: 28, mp: 28, atk: 8, def: 5, spd: 5, strength: 8, stamina: 7, magicPower: 18, evade: 7, magic: "メラヒゲ", weapon: "stick", armor: "cloth" },
  { name: "貧", job: "盗賊", lv: 1, xp: 0, maxHp: 42, hp: 42, maxMp: 6, mp: 6, atk: 11, def: 4, spd: 11, strength: 11, stamina: 6, magicPower: 6, evade: 14, steal: true, weapon: "stick", armor: "cloth" },
];

const catalog: Record<string, ShopEntry> = {
  herb: { id: "herb", name: "やくそう", kind: "item", price: 8 },
  water: { id: "water", name: "まほうの水", kind: "item", price: 18 },
  stick: { id: "stick", name: "木の棒", kind: "weapon", price: 0, atk: 1 },
  onionSword: { id: "onionSword", name: "オニオンソード", kind: "weapon", price: 0, atk: 4, users: ["もじさん"] },
  copperSword: { id: "copperSword", name: "銅の剣", kind: "weapon", price: 45, atk: 5, users: ["yos", "もじさん", "貧"] },
  sageStaff: { id: "sageStaff", name: "賢者の杖", kind: "weapon", price: 52, atk: 3, users: ["yos", "ヤス"] },
  ironAxe: { id: "ironAxe", name: "鉄の斧", kind: "weapon", price: 78, atk: 8, users: ["もじさん"] },
  cloth: { id: "cloth", name: "布の服", kind: "armor", price: 0, def: 1 },
  traveler: { id: "traveler", name: "旅人の服", kind: "armor", price: 35, def: 4 },
  ironArmor: { id: "ironArmor", name: "鉄の胸当て", kind: "armor", price: 70, def: 7, users: ["yos", "もじさん"] },
  lightCloak: { id: "lightCloak", name: "身かわしマント", kind: "armor", price: 64, def: 5, users: ["ヤス", "貧"] },
};

const shopStock: Record<"item" | "weapon" | "armor", string[]> = {
  item: ["herb", "water"],
  weapon: ["copperSword", "sageStaff", "ironAxe"],
  armor: ["traveler", "ironArmor", "lightCloak"],
};

function copyMember(member: PartyMember): PartyMember {
  return { ...member };
}

function normalizeMember(member: Partial<PartyMember>): PartyMember {
  const base = partyBase.find((item) => item.name === member.name) || partyBase[0];
  const lv = member.lv || base.lv;
  const xp = member.xp ?? LEVEL_XP[Math.max(0, lv - 1)] ?? base.xp;
  return {
    ...base,
    ...member,
    lv,
    xp,
    hp: Math.min(member.hp ?? base.hp, member.maxHp ?? base.maxHp),
    mp: Math.min(member.mp ?? base.mp, member.maxMp ?? base.maxMp),
    strength: member.strength ?? member.atk ?? base.strength,
    stamina: member.stamina ?? member.def ?? base.stamina,
    magicPower: member.magicPower ?? base.magicPower,
    evade: member.evade ?? Math.max(base.evade, member.spd ?? base.spd),
  };
}

function dungeonMap(name: string, next: string | null, prev: string, encounter: number): GameMap {
  return {
    name,
    encounter,
    tiles: [
      "XXXXXXXXXXXX",
      "X..........X",
      "X.XXX.XXXX.X",
      "X...X......X",
      "XXX.X.XXXX.X",
      "X...X......X",
      "X.X.X.XX.X.X",
      "X.X...X....X",
      "X.XXX.XXXX.X",
      "X.....X....X",
      "X.XXX.XXXX.X",
      "X..........X",
      "X..........X",
      "XXXXXXXXXXXX",
    ],
    exits: [
      { x: 5, y: 0, to: prev, tx: 5, ty: 12, text: "階段を戻った。" },
      ...(next ? [{ x: 5, y: 12, to: next, tx: 5, ty: 1, text: "階段を上った。" }] : []),
    ],
    npcs: [],
    chests: [{ x: 9, y: 6, item: "まほうの水", opened: false }],
  };
}

const maps: Record<string, GameMap> = {
  village: {
    name: "チバの村",
    encounter: 0,
    tiles: [
      "GGGGGGGGGGGG",
      "GGGHHGGGGCHG",
      "GGGHHGGGGHHG",
      "GGGGPPPPGGGG",
      "GSSGPPPPPIIG",
      "GSSGPPPPPIIG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GWWGGPPPPFGG",
      "GWWGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
    ],
    exits: [{ x: 5, y: 13, to: "forest", tx: 5, ty: 1, text: "電車に乗ってヒョーゴの村へ向かった。" }],
    npcs: [
      { x: 5, y: 3, name: "yos", lines: ["yos: 60歳でシステムエンジニアをリタイヤした。", "yos: 第二の人生か……まずは10年会っていない旧友を探してみよう。", "yos: 一番頼りになるのは、やっぱりもじさんだ。"] },
      { x: 2, y: 5, name: "宿屋", lines: ["宿屋: ひと晩休んでいくかい？", "宿屋: 第二の人生にも休息は必要だよ。", "HPとMPを全回復した。"], inn: true },
      { x: 1, y: 4, name: "武器屋", lines: ["武器屋: 旧友探しでも備えは大事だ。山へ行くならなおさらな。"], shopType: "weapon" },
      { x: 2, y: 4, name: "防具屋", lines: ["防具屋: 年季の入った旅ほど、よい防具を選ぶものだ。"], shopType: "armor" },
      { x: 9, y: 5, name: "道具屋", lines: ["道具屋: やくそうとまほうの水を扱っているよ。"], shop: true, shopType: "item" },
      { x: 9, y: 1, name: "教会", lines: ["教会: 旅の記録を祈りに刻みましょう。", "教会: Bメニューから3スロットに記録できるぞ。"] },
      { x: 7, y: 8, name: "駅の案内", lines: ["南: ヒョーゴ方面の電車", "もじさんの手がかりを聞いてから向かおう。"] },
      { x: 7, y: 3, name: "元同僚", lines: ["元同僚: もじさん？ ヨツビシで一緒だったよ。", "元同僚: 退職後はヒョーゴの村で農家をやっていると聞いたな。", "元同僚: 南の駅から電車で向かえるはずだ。"], flag: "heardMojisanLead" },
    ],
    chests: [],
  },
  forest: {
    name: "ヒョーゴの村",
    encounter: 0,
    tiles: [
      "GGGGGGGGGGGG",
      "GGGHHGGGGHHG",
      "GGGHHGGGGHHG",
      "GGGGPPPPGGGG",
      "GSSGPPPPPIIG",
      "GSSGPPPPPIIG",
      "GGGGGPPPGGGG",
      "GGFGGPPPGFGG",
      "GGFGGPPPPGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
      "GGGGGPPPGGGG",
    ],
    exits: [
      { x: 5, y: 0, to: "village", tx: 5, ty: 12, text: "電車でチバの村へ戻った。" },
      { x: 5, y: 12, to: "dungeon1", tx: 5, ty: 1, text: "もじさんを探して山道へ入った。" },
    ],
    npcs: [
      { x: 3, y: 3, name: "農家", lines: ["農家: もじさんなら畑を充実させる新しい野菜を探しに山へ行ったよ。", "農家: でも、まだ帰ってこないんだ。山頂まで見に行けるかい？"], flag: "heardMojisanMountain" },
      { x: 8, y: 5, name: "村人", lines: ["村人: もじさんは百姓貴族を名乗っているよ。", "村人: 野菜への気合いだけは誰にも負けない人だ。"] },
      { x: 7, y: 10, name: "山の案内", lines: ["南: 山道", "装備を整え、少し腕をならしてから山頂へ。"] },
    ],
    chests: [{ x: 8, y: 10, item: "やくそう", opened: false }],
  },
  dungeon1: dungeonMap("山道 ふもと", "dungeon2", "forest", 0.16),
  dungeon2: dungeonMap("山道 中腹", "dungeon3", "dungeon1", 0.18),
  dungeon3: { ...dungeonMap("山頂", null, "dungeon2", 0.2), boss: { x: 5, y: 9 } },
};

const enemyTemplates: Record<"forest" | "dungeon" | "boss", Omit<Enemy, "maxHp">[]> = {
  forest: [
    { name: "まゆげスライム", hp: 26, atk: 8, def: 2, xp: 12, gold: 8, color: 0x79c5d8, behavior: "slime", stealGold: 4, stealItem: "やくそう" },
    { name: "ヒゲこうもり", hp: 32, atk: 10, def: 3, xp: 14, gold: 10, color: 0x5d5b8c, behavior: "bat", stealGold: 6 },
  ],
  dungeon: [
    { name: "ねぐせナイト", hp: 48, atk: 14, def: 5, xp: 24, gold: 18, color: 0x927c68, behavior: "knight", stealGold: 10 },
    { name: "うすげメイジ", hp: 40, atk: 16, def: 4, xp: 28, gold: 20, color: 0x79518a, behavior: "mage", stealGold: 8, stealItem: "まほうの水" },
  ],
  boss: [{ name: "オニオンJK", hp: 480, atk: 44, def: 15, xp: 240, gold: 260, color: 0x7f5a52, boss: true, behavior: "boss", stealGold: 40, stealItem: "まほうの水" }],
};

class HigeQuestScene extends Phaser.Scene {
  private mode: SceneMode = "title";
  private mapId = "village";
  private player = { x: 5, y: 8, dir: "down" as Direction };
  private party: PartyMember[] = [copyMember(partyBase[0])];
  private joined: Record<string, boolean> = { yos: true };
  private flags: Record<string, boolean> = {};
  private items: Record<string, number> = { やくそう: 3, まほうの水: 1 };
  private inventory: Record<string, number> = { stick: 1, cloth: 1 };
  private gold = 60;
  private xp = 0;
  private message: string[] = [];
  private menu: MenuState | null = null;
  private titleCursor = 0;
  private battle: BattleState | null = null;
  private battleEffects: BattleEffect[] = [];
  private encounterEffect: { startedAt: number; kind: "random" | "boss" } | null = null;
  private audio = new AudioSystem();
  private ending = false;
  private pendingBossBattle = false;
  private graphics!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyB!: Phaser.Input.Keyboard.Key;
  private held = new Set<Direction>();
  private stepReady = true;
  private inputLock = false;
  private moveAnim: { fromX: number; fromY: number; toX: number; toY: number; startedAt: number; duration: number } | null = null;

  create() {
    this.graphics = this.add.graphics();
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyB = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on("down", () => this.actionA());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => this.actionA());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => this.actionB());
    this.bindVirtualControls();
    this.bindSwipe();
    this.disableBrowserGestures();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyA)) this.actionA();
    if (Phaser.Input.Keyboard.JustDown(this.keyB)) this.actionB();
    this.handleKeyboardDirection();
    this.audio.playBgm(this.currentBgmTrack());
    this.redraw();
  }

  private bindVirtualControls() {
    document.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((button) => {
      const dir = button.dataset.dir as Direction;
      button.tabIndex = -1;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.blur();
        button.classList.add("is-down");
        this.held.add(dir);
        this.directionInput(dir);
      });
      button.addEventListener("pointerup", (event) => {
        event.preventDefault();
        button.classList.remove("is-down");
        this.held.delete(dir);
      });
      button.addEventListener("pointercancel", () => {
        button.classList.remove("is-down");
        this.held.delete(dir);
      });
    });
    document.getElementById("btn-a")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      (event.currentTarget as HTMLButtonElement).blur();
      this.actionA();
    });
    document.getElementById("btn-b")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      (event.currentTarget as HTMLButtonElement).blur();
      this.actionB();
    });
  }

  private disableBrowserGestures() {
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener("selectstart", prevent);
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("dragstart", prevent);
  }

  private bindSwipe() {
    let start: { x: number; y: number } | null = null;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      start = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!start) return;
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) {
        this.tryMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      }
      start = null;
    });
  }

  private handleKeyboardDirection() {
    const dir = this.cursors.up.isDown ? "up" : this.cursors.down.isDown ? "down" : this.cursors.left.isDown ? "left" : this.cursors.right.isDown ? "right" : null;
    const justDir = Phaser.Input.Keyboard.JustDown(this.cursors.up)
      ? "up"
      : Phaser.Input.Keyboard.JustDown(this.cursors.down)
        ? "down"
        : Phaser.Input.Keyboard.JustDown(this.cursors.left)
          ? "left"
          : Phaser.Input.Keyboard.JustDown(this.cursors.right)
            ? "right"
            : null;
    if (this.menu || this.mode === "battle" || this.mode === "title") {
      if (justDir) this.directionInput(justDir);
      return;
    }
    if (dir) this.tryMove(dir);
    for (const heldDir of this.held) this.tryMove(heldDir);
  }

  private directionInput(dir: Direction) {
    this.audio.unlock();
    if (this.mode === "title" && !this.menu) {
      if (dir === "up" || dir === "down") {
        this.titleCursor = this.titleCursor === 0 ? 1 : 0;
        this.audio.playSe("move");
      }
      return;
    }
    if (this.menu) {
      if (dir === "up" || dir === "down") {
        const delta = dir === "down" ? 1 : -1;
        this.menu.cursor = (this.menu.cursor + delta + this.menu.items.length) % this.menu.items.length;
        this.audio.playSe("move");
      }
      return;
    }
    if (this.mode === "battle" && this.battle) {
      if (this.battle.waiting || this.battle.won) return;
      if (this.battle.submenu) {
        const actor = this.currentActor();
        const skills = actor ? this.skillsFor(actor) : [];
        if (!skills.length) return;
        const delta = dir === "up" || dir === "left" ? -1 : 1;
        this.battle.submenu.cursor = (this.battle.submenu.cursor + delta + skills.length) % skills.length;
        this.audio.playSe("move");
        return;
      }
      const delta = dir === "up" || dir === "left" ? -1 : 1;
      this.battle.command = (this.battle.command + delta + 4) % 4;
      this.audio.playSe("move");
      return;
    }
    this.tryMove(dir);
  }

  private tryMove(dir: Direction) {
    if (this.mode !== "field" || this.menu || this.message.length || !this.stepReady || this.inputLock) return;
    this.player.dir = dir;
    const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
    const dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const map = maps[this.mapId];
    const exit = map.exits.find((item) => item.x === nx && item.y === ny);
    if (exit) {
      if (exit.to === "forest" && !this.flags.heardMojisanLead) {
        this.message = ["まずはチバの村で、もじさんの手がかりを聞こう。"];
        return;
      }
      if (exit.to === "dungeon1" && !this.flags.heardMojisanMountain) {
        this.message = ["村で、もじさんがどこへ行ったのか聞いてみよう。"];
        return;
      }
      this.mapId = exit.to;
      this.player.x = exit.tx;
      this.player.y = exit.ty;
      this.message = [exit.text];
      this.audio.playSe("stairs");
      this.moveAnim = null;
      this.inputLock = true;
      this.time.delayedCall(180, () => (this.inputLock = false));
      return;
    }
    if (this.bossAt(nx, ny)) {
      this.startBossIntro();
      return;
    }
    if (this.isSolid(this.tileAt(map, nx, ny)) || this.npcAt(nx, ny) || this.chestAt(nx, ny)) return;
    this.moveAnim = { fromX: this.player.x, fromY: this.player.y, toX: nx, toY: ny, startedAt: this.time.now, duration: 132 };
    this.player.x = nx;
    this.player.y = ny;
    this.stepReady = false;
    const shouldEncounter = Boolean(map.encounter && Math.random() < map.encounter);
    if (shouldEncounter) this.inputLock = true;
    this.time.delayedCall(132, () => {
      this.stepReady = true;
      this.moveAnim = null;
      if (shouldEncounter) this.startEncounter("random");
    });
    this.audio.playSe("move");
  }

  private actionA() {
    this.audio.unlock();
    this.audio.playSe("confirm");
    if (this.encounterEffect) return;
    if (this.mode === "title") {
      if (this.message.length) {
        this.advanceMessage();
        return;
      }
      if (this.menu && this.menuA()) return;
      if (this.titleCursor === 0) this.startNewGame();
      else this.openLoadMenu();
      return;
    }
    if (this.mode === "battle") {
      this.battleA();
      return;
    }
    if (this.message.length) {
      this.advanceMessage();
      if (!this.message.length && this.pendingBossBattle) this.beginPendingBossBattle();
      return;
    }
    if (this.menu && this.menuA()) return;
    const facing = this.facingTile();
    const npc = this.npcAt(facing.x, facing.y);
    if (npc) {
      this.message = [...npc.lines];
      if (npc.flag) this.flags[npc.flag] = true;
      if (npc.inn) this.fullHeal();
      if (npc.shopType) this.openShop(npc.shopType);
      if (npc.join && !this.joined[npc.join]) {
        const member = partyBase.find((item) => item.name === npc.join);
        if (member) this.party.push(copyMember(member));
        this.joined[npc.join] = true;
        this.inventory.stick = (this.inventory.stick || 0) + 1;
        this.inventory.cloth = (this.inventory.cloth || 0) + 1;
        this.message.push(`${npc.join}が仲間になった。`);
      }
      return;
    }
    const chest = this.chestAt(facing.x, facing.y);
    if (chest) {
      chest.opened = true;
      this.items[chest.item] = (this.items[chest.item] || 0) + 1;
      this.audio.playSe("chest");
      this.message = [`宝箱を開けた。${chest.item}を手に入れた。`];
      return;
    }
    const map = maps[this.mapId];
    if (this.bossAt(facing.x, facing.y)) {
      this.startBossIntro();
      return;
    }
    this.message = [`${map.name}。Aで調べる、Bで記録メニュー。`];
  }

  private actionB() {
    this.audio.unlock();
    this.audio.playSe("cancel");
    if (this.encounterEffect) return;
    if (this.mode === "title") {
      if (this.message.length) {
        this.message = [];
        return;
      }
      this.menu = this.menu ? null : this.loadMenu();
      return;
    }
    if (this.mode === "battle" && this.battle) {
      if (!this.battle.won && !this.battle.waiting) {
        if (this.battle.submenu) {
          this.battle.submenu = null;
          return;
        }
        this.battle.command = (this.battle.command + 1) % 4;
      }
      return;
    }
    if (this.message.length) {
      this.message = [];
      if (this.pendingBossBattle) this.beginPendingBossBattle();
      return;
    }
    if (this.menu?.mode === "shop") {
      this.menu = null;
      return;
    }
    if (this.menu?.mode === "equipGear") {
      this.openEquipMenu();
      return;
    }
    if (this.menu && this.menu.mode !== "main") {
      this.menu = this.mainMenu();
      return;
    }
    this.menu = this.menu ? null : this.mainMenu();
  }

  private menuA() {
    if (!this.menu) return false;
    const item = this.menu.items[this.menu.cursor];
    if (this.menu.mode === "shop") {
      this.buySelectedItem();
      return true;
    }
    if (this.menu.mode === "equip") {
      if (this.menu.cursor === 0) this.autoEquipAll();
      else this.openEquipGearMenu(this.menu.cursor - 1);
      return true;
    }
    if (this.menu.mode === "equipGear") {
      this.equipSelectedGear();
      return true;
    }
    if (this.menu.mode === "items") {
      this.menu = null;
      return true;
    }
    if (this.menu.mode === "save") {
      this.saveGame(this.menu.cursor + 1);
      return true;
    }
    if (this.menu.mode === "load") {
      this.loadGame(this.menu.cursor + 1);
      return true;
    }
    if (item === "記録する") this.menu = this.saveMenu();
    if (item === "つづきから") this.openLoadMenu();
    if (item === "そうび") this.openEquipMenu();
    if (item === "もちもの") this.openItemsMenu();
    if (item === "ステータス") {
      this.message = [
        ...this.party.flatMap((member) => [
          `${member.name} Lv${member.lv} HP${member.hp}/${member.maxHp} MP${member.mp}/${member.maxMp}`,
          `力${member.strength} 守${this.totalDef(member)} 速${member.spd} 体${member.stamina} 魔${member.magicPower} 回${member.evade}`,
          `EXP ${member.xp} / 次まで ${this.xpToNext(member)}。`,
        ]),
      ];
      this.menu = null;
    }
    return true;
  }

  private battleA() {
    if (!this.battle) return;
    if (this.battle.waiting) return;
    if (this.battle.won) {
      const wonBoss = this.battle.wonBoss;
      this.mode = "field";
      this.battle = null;
      if (wonBoss) {
        this.mapId = "forest";
        this.player = { x: 5, y: 8, dir: "down" };
        this.moveAnim = null;
        this.flags.chapter1Complete = true;
        this.message = [
          "オニオンJK: まさか、玉ねぎの力をここまで引き出すとは……。",
          "もじさん: 畑を充実させる野菜を探していたら、妙なやつに絡まれてな。",
          "yos: 10年ぶりでも、頼りになるところは変わらないな。",
          "もじさん: よし、正式に仲間になる。次の旧友探しも手伝おう。",
          "第1章 もじさん加入 完",
        ];
      }
      return;
    }
    const actor = this.currentActor();
    if (!actor) return;
    if (this.battle.submenu) {
      const skill = this.skillsFor(actor)[this.battle.submenu.cursor];
      if (!skill) return;
      if (actor.mp < skill.mp) {
        this.pushBattle(`${skill.name}を使うにはMPが足りない。`);
        this.audio.playSe("cancel");
        return;
      }
      this.battle.submenu = null;
      this.battle.waiting = true;
      this.battle.actingIndex = this.party.indexOf(actor);
      this.battle.actingUntil = this.time.now + 260;
      this.useSkill(actor, skill.name);
      this.time.delayedCall(420, () => this.nextActor());
      return;
    }
    const command = this.battleCommands(actor)[this.battle.command];
    if (command === "じゅもん" || command === "ベジタブル") {
      this.battle.submenu = { kind: command, cursor: 0 };
      this.audio.playSe("move");
      return;
    }
    this.battle.waiting = true;
    this.battle.actingIndex = this.party.indexOf(actor);
    this.battle.actingUntil = this.time.now + 260;
    if (command === "たたかう") {
      const damage = this.damage({ atk: this.totalAtk(actor) }, this.battle.enemy);
      this.battle.enemy.hp = Math.max(0, this.battle.enemy.hp - damage);
      this.flashEnemy();
      this.audio.playSe("attack");
      this.addBattleEffect("slash", BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 4);
      this.floatText(BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 34, `-${damage}`, "#ffdf7a");
      this.pushBattle(`${actor.name}の攻撃。${damage}ダメージ。`);
    } else if (command === "もちもの") {
      if ((this.items["やくそう"] || 0) > 0 && actor.hp < actor.maxHp) {
        this.items["やくそう"] -= 1;
        actor.hp = Math.min(actor.maxHp, actor.hp + 28);
        this.audio.playSe("heal");
        this.addBattleEffect("heal", PARTY_BATTLE_X, PARTY_BATTLE_Y + this.party.indexOf(actor) * PARTY_BATTLE_GAP);
        this.floatText(PARTY_BATTLE_X, PARTY_BATTLE_Y + 28 + this.party.indexOf(actor) * PARTY_BATTLE_GAP, "+28", "#9df09a");
        this.pushBattle(`${actor.name}はやくそうを使った。`);
      } else if ((this.items["まほうの水"] || 0) > 0 && actor.maxMp > 0 && actor.mp < actor.maxMp) {
        this.items["まほうの水"] -= 1;
        actor.mp = Math.min(actor.maxMp, actor.mp + 12);
        this.audio.playSe("heal");
        this.addBattleEffect("heal", PARTY_BATTLE_X, PARTY_BATTLE_Y + this.party.indexOf(actor) * PARTY_BATTLE_GAP);
        this.floatText(PARTY_BATTLE_X, PARTY_BATTLE_Y + 28 + this.party.indexOf(actor) * PARTY_BATTLE_GAP, "+12MP", "#9ad7ff");
        this.pushBattle(`${actor.name}はまほうの水を飲んだ。`);
      } else {
        this.pushBattle("今使える道具がない。");
      }
    } else if (command === "ぼうぎょ") {
      this.battle.defending[this.party.indexOf(actor)] = true;
      this.pushBattle(`${actor.name}は身を守っている。`);
    }
    this.time.delayedCall(420, () => this.nextActor());
  }

  private useSkill(actor: PartyMember, skillName: string) {
    if (!this.battle) return;
    if (skillName === "ホイミ" && actor.name === "yos" && actor.mp >= 4) {
      actor.mp -= 4;
      const target = this.party.reduce((low, member) => (member.hp / member.maxHp < low.hp / low.maxHp ? member : low), this.party[0]);
      const heal = 18 + actor.lv * 4;
      target.hp = Math.min(target.maxHp, target.hp + heal);
      this.audio.playSe("heal");
      this.addBattleEffect("heal", PARTY_BATTLE_X, PARTY_BATTLE_Y + this.party.indexOf(target) * PARTY_BATTLE_GAP);
      this.floatText(PARTY_BATTLE_X, PARTY_BATTLE_Y + 28 + this.party.indexOf(target) * PARTY_BATTLE_GAP, `+${heal}`, "#9df09a");
      this.pushBattle(`${actor.name}はホイミを唱えた。`);
      return;
    }
    if (skillName === "オニオンソード" && actor.name === "もじさん" && actor.mp >= 3) {
      actor.mp -= 3;
      const damage = Math.max(1, Math.floor(this.damage({ atk: this.totalAtk(actor) }, this.battle.enemy) * 1.5));
      this.battle.enemy.hp = Math.max(0, this.battle.enemy.hp - damage);
      this.flashEnemy();
      this.audio.playSe("attack");
      this.addBattleEffect("slash", BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 4);
      this.floatText(BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 34, `-${damage}`, "#ffdf7a");
      this.pushBattle(`${actor.name}のオニオンソード！`);
      return;
    }
    this.pushBattle("MPが足りない、またはスキルを使えない。");
  }

  private nextActor() {
    if (!this.battle) return;
    if (this.battle.enemy.hp <= 0) {
      this.winBattle();
      return;
    }
    const currentIndex = this.battle.actor;
    const nextIndex = this.nextLivingActorIndex(currentIndex);
    if (nextIndex === null) {
      this.winBattle();
      return;
    }
    this.battle.actor = nextIndex;
    this.battle.command = 0;
    this.battle.submenu = null;
    if (nextIndex <= currentIndex) {
      this.enemyTurn();
      this.time.delayedCall(460, () => {
        if (!this.battle || this.battle.won) return;
        this.battle.waiting = false;
        this.battle.actingIndex = null;
        this.currentActor();
      });
      return;
    }
    this.currentActor();
    this.battle.waiting = false;
    this.battle.actingIndex = null;
  }

  private nextLivingActorIndex(startIndex: number) {
    for (let offset = 1; offset <= this.party.length; offset += 1) {
      const index = (startIndex + offset) % this.party.length;
      if (this.party[index].hp > 0) return index;
    }
    return null;
  }

  private enemyTurn() {
    if (!this.battle) return;
    const targets = this.party.filter((member) => member.hp > 0);
    if (!targets.length) return;
    const target = Phaser.Utils.Array.GetRandom(targets);
    const targetIndex = this.party.indexOf(target);
    const guarded = this.battle.defending[targetIndex];
    const action = this.enemyAction();
    const baseDamage = this.damage({ atk: action.atk }, { def: this.totalDef(target) });
    const damage = guarded ? Math.max(1, Math.floor(baseDamage / 2)) : baseDamage;
    if (action.heal && this.battle.enemy.hp > 0) {
      this.battle.enemy.hp = Math.min(this.battle.enemy.maxHp, this.battle.enemy.hp + action.heal);
      this.audio.playSe("heal");
      this.addBattleEffect("heal", BATTLE_ENEMY_X, BATTLE_ENEMY_Y);
      this.floatText(BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 34, `+${action.heal}`, "#9df09a");
      this.pushBattle(`${this.battle.enemy.name}${action.text}`);
      return;
    }
    target.hp = Math.max(0, target.hp - damage);
    this.battle.defending[targetIndex] = false;
    this.flashParty(targetIndex);
    this.audio.playSe("attack");
    this.addBattleEffect("hit", PARTY_BATTLE_X, PARTY_BATTLE_Y + targetIndex * PARTY_BATTLE_GAP);
    this.floatText(PARTY_BATTLE_X, PARTY_BATTLE_Y + 28 + targetIndex * PARTY_BATTLE_GAP, `-${damage}`, "#ffdf7a");
    this.pushBattle(`${this.battle.enemy.name}${action.text}${target.name}に${damage}ダメージ。${guarded ? " 防御が効いた。" : ""}`);
    if (!this.party.some((member) => member.hp > 0)) {
      const lostToBoss = Boolean(this.battle.enemy.boss);
      this.pushBattle(lostToBoss ? "全滅した。もじさんは山頂へ戻っていった。" : "全滅した。チバの村で目を覚ました。");
      this.time.delayedCall(900, () => {
        this.mode = "field";
        this.battle = null;
        this.mapId = "village";
        this.player = { x: 5, y: 8, dir: "down" };
        if (lostToBoss) this.removeMojisanAfterBossLoss();
        this.fullHeal();
        this.message = [lostToBoss ? "教会の祈りで復活した。もじさんを助けるには、もう一度山頂へ向かおう。" : "教会の祈りで復活した。準備を整えよう。"];
      });
    }
  }

  private enemyAction() {
    if (!this.battle) return { atk: 1, text: "の攻撃。" };
    const enemy = this.battle.enemy;
    const roll = Math.random();
    if (enemy.behavior === "slime" && roll < 0.3) return { atk: Math.max(1, enemy.atk - 3), text: "はぷるぷる体当たり。" };
    if (enemy.behavior === "bat" && roll < 0.35) return { atk: enemy.atk + 3, text: "は急降下した。" };
    if (enemy.behavior === "knight" && roll < 0.35) return { atk: enemy.atk + 5, text: "は力を込めて斬りかかった。" };
    if (enemy.behavior === "mage" && roll < 0.35) return { atk: enemy.atk + 4, text: "は薄毛の呪文を唱えた。" };
    if (enemy.behavior === "boss") {
      if (roll < 0.25) return { atk: enemy.atk + 10, text: "の玉ねぎ審査。" };
      if (roll < 0.45) return { atk: enemy.atk + 5, text: "の涙目スライス。" };
      if (roll < 0.6 && enemy.hp < enemy.maxHp * 0.55) return { atk: enemy.atk, text: "は玉ねぎの皮をまとった。", heal: 28 };
    }
    return { atk: enemy.atk, text: "の攻撃。" };
  }

  private winBattle() {
    if (!this.battle) return;
    const enemy = this.battle.enemy;
    this.pushBattle(`${enemy.name}を倒した！`);
    this.gold += enemy.gold;
    this.xp += enemy.xp;
    this.party.forEach((member) => {
      member.xp += enemy.xp;
    });
    this.pushBattle(`${enemy.xp}EXPと${enemy.gold}Gを得た。`);
    this.applyLevelUps();
    this.battle.won = true;
    this.battle.wonBoss = Boolean(enemy.boss);
    this.battle.waiting = false;
    this.battle.submenu = null;
    this.battle.actingIndex = null;
    if (enemy.boss) this.ending = true;
  }

  private startBattle(kind: "random" | "boss" = "random") {
    const pool = kind === "boss" ? enemyTemplates.boss : this.mapId === "forest" ? enemyTemplates.forest : enemyTemplates.dungeon;
    const template = Phaser.Utils.Array.GetRandom(pool);
    this.mode = "battle";
    this.battle = {
      enemy: { ...template, maxHp: template.hp },
      actor: 0,
      command: 0,
      submenu: null,
      log: [],
      won: false,
      wonBoss: false,
      waiting: false,
      enemyFlashUntil: 0,
      partyFlashUntil: [],
      shakeUntil: 0,
      defending: [],
      actingIndex: null,
      actingUntil: 0,
    };
    this.battleEffects = [];
    this.pushBattle(`${template.name}が あらわれた！`);
  }

  private mainMenu(): MenuState {
    return { mode: "main", cursor: 0, items: ["記録する", "つづきから", "そうび", "もちもの", "ステータス"] };
  }

  private saveMenu(): MenuState {
    return { mode: "save", cursor: 0, items: this.saveSlotLines() };
  }

  private loadMenu(): MenuState {
    return { mode: "load", cursor: 0, items: this.saveSlotLines() };
  }

  private openLoadMenu() {
    this.menu = this.loadMenu();
  }

  private saveGame(slot: number) {
    const data: SaveData = {
      mapId: this.mapId,
      player: this.player,
      party: this.party,
      joined: this.joined,
      flags: this.flags,
      items: this.items,
      inventory: this.inventory,
      gold: this.gold,
      xp: this.xp,
      ending: this.ending,
      chests: this.chestState(),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`higeballquest-save-${slot}`, JSON.stringify(data));
    this.menu = null;
    this.message = [`スロット${slot}にセーブした。`];
  }

  private loadGame(slot: number) {
    this.menu = null;
    const data = this.readSaveSlot(slot);
    if (!data) {
      this.message = [`スロット${slot}にセーブデータがない。`];
      return;
    }
    this.mapId = data.mapId;
    this.player = data.player;
    this.party = data.party.map((member) => normalizeMember({ ...member, xp: member.xp ?? (member.name === "yos" ? data.xp : undefined) }));
    this.joined = data.joined || { yos: true };
    this.flags = data.flags || {};
    this.items = data.items || { やくそう: 3, まほうの水: 1 };
    this.inventory = data.inventory || { stick: this.party.length, cloth: this.party.length };
    this.gold = data.gold ?? 60;
    this.xp = data.xp ?? 0;
    this.ending = data.ending || false;
    this.applyChestState(data.chests);
    this.mode = "field";
    this.battle = null;
    this.encounterEffect = null;
    this.message = [`スロット${slot}をロードした。`];
  }

  private readSaveSlot(slot: number): SaveData | null {
    const raw = localStorage.getItem(`higeballquest-save-${slot}`);
    if (!raw) return null;
    let data: Partial<SaveData>;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!data.mapId || !maps[data.mapId] || !data.player || !data.party?.length) {
      return null;
    }
    return {
      mapId: data.mapId,
      player: data.player,
      party: data.party.map((member) => normalizeMember({ ...member, xp: member.xp ?? (member.name === "yos" ? data.xp : undefined) })),
      joined: data.joined || { yos: true },
      flags: data.flags || {},
      items: data.items || { やくそう: 3, まほうの水: 1 },
      inventory: data.inventory || { stick: data.party.length, cloth: data.party.length },
      gold: data.gold ?? 60,
      xp: data.xp ?? 0,
      ending: data.ending || false,
      chests: data.chests || {},
      savedAt: data.savedAt,
    };
  }

  private saveSlotLines() {
    return [1, 2, 3].map((slot) => {
      const data = this.readSaveSlot(slot);
      if (!data) return `スロット${slot}  空き`;
      const leader = data.party[0];
      return `スロット${slot}  ${maps[data.mapId].name} Lv${leader.lv} ${this.progressLabel(data)}`;
    });
  }

  private progressLabel(data: SaveData) {
    if (data.ending) return "クリア";
    if (data.mapId.startsWith("dungeon")) return "攻略中";
    if (data.joined["もじさん"]) return "もじさん";
    if (data.flags?.heardMojisanMountain) return "山へ";
    if (data.flags?.heardMojisanLead) return "手がかり";
    return "旅立ち";
  }

  private currentBgmTrack(): BgmTrack {
    if (this.mode === "title") return "title";
    if (this.mode === "battle") return this.battle?.enemy.boss ? "boss" : "battle";
    if (this.ending) return "ending";
    if (this.mapId === "village") return "village";
    if (this.mapId === "forest") return "forest";
    return "dungeon";
  }

  private startNewGame() {
    this.mode = "field";
    this.mapId = "village";
    this.player = { x: 5, y: 8, dir: "down" };
    this.party = [copyMember(partyBase[0])];
    this.joined = { yos: true };
    this.flags = {};
    this.items = { やくそう: 3, まほうの水: 1 };
    this.inventory = { stick: 1, cloth: 1 };
    this.gold = 60;
    this.xp = 0;
    this.menu = null;
    this.battle = null;
    this.battleEffects = [];
    this.encounterEffect = null;
    this.ending = false;
    this.pendingBossBattle = false;
    this.resetChestState();
    this.message = ["60歳でリタイヤしたyosの第二の人生が始まる。旧友もじさんの手がかりを探そう。"];
  }

  private redraw() {
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
    this.graphics.clear();
    this.mode === "title" ? this.drawTitle() : this.mode === "battle" ? this.drawBattle() : this.drawField();
    if (this.mode === "field") this.drawHud();
    if (this.encounterEffect) this.drawEncounterEffect();
    if (this.menu) this.drawMenu();
    if (this.message.length) this.drawMessage(this.message[0]);
  }

  private drawTitle() {
    this.graphics.fillGradientStyle(0x253f52, 0x253f52, 0x111722, 0x111722, 1);
    this.graphics.fillRect(0, 0, WIDTH, HEIGHT);
    this.graphics.fillStyle(0x6f9a55, 0.92);
    this.graphics.fillRect(0, 276, WIDTH, 196);
    for (let x = -20; x < WIDTH; x += 44) {
      this.graphics.fillStyle(0x294d36);
      this.graphics.fillTriangle(x + 22, 218, x - 4, 292, x + 48, 292);
      this.graphics.fillStyle(0x3e2b1d);
      this.graphics.fillRect(x + 18, 284, 8, 28);
    }
    this.drawBoss(260, 238, 1.25);
    this.drawPerson(92, 272, 0xe9d9b0, true, 1.25, "right", 0.4);
    this.text(WIDTH / 2, 104, "HIGEBALL", 34, "#ffe58a", "center");
    this.text(WIDTH / 2, 140, "QUEST", 30, "#fff3cb", "center");
    this.panel(48, 330, 264, 108);
    ["はじめから", "つづきから"].forEach((item, i) => {
      const y = 366 + i * 28;
      if (i === this.titleCursor) {
        this.graphics.fillStyle(0xffffff, 0.14);
        this.graphics.fillRect(76, y - 12, 208, 23);
      }
      this.text(WIDTH / 2, y, `${i === this.titleCursor ? "> " : "  "}${item}`, 17, i === this.titleCursor ? "#ffe58a" : "#fff3cb", "center");
    });
    this.text(WIDTH / 2, 424, "A:決定 / B:ロード", 12, "#d8c98f", "center");
  }

  private drawField() {
    const map = maps[this.mapId];
    const tile = FIELD_TILE;
    const ox = Math.floor((WIDTH - map.tiles[0].length * tile) / 2);
    const oy = FIELD_TOP;
    this.graphics.fillStyle(0x10151d);
    this.graphics.fillRect(0, 0, WIDTH, HEIGHT);
    map.tiles.forEach((row, y) => [...row].forEach((cell, x) => this.drawTile(cell, ox + x * tile, oy + y * tile, tile)));
    this.drawMapAtmosphere(map, ox, oy, tile);
    map.exits.forEach((exit) => {
      this.drawStairs(ox + exit.x * tile, oy + exit.y * tile, tile);
      this.drawExitMarker(ox + exit.x * tile + tile / 2, oy + exit.y * tile + tile / 2);
    });
    map.chests.forEach((chest) => {
      this.drawChest(ox + chest.x * tile, oy + chest.y * tile, chest.opened, tile);
      if (!chest.opened) this.drawSparkle(ox + chest.x * tile + tile * 0.72, oy + chest.y * tile + tile * 0.32);
    });
    map.npcs.forEach((npc) => {
      const x = ox + npc.x * tile + tile / 2;
      const y = oy + npc.y * tile + tile * 0.62;
      this.drawPerson(x, y, this.npcColor(npc.name), false, 0.88, "down", this.idlePhase(npc.x, npc.y));
      this.drawInteractMarker(x, y - 28, npc.name);
    });
    if (map.boss && !this.ending) {
      this.drawBoss(ox + map.boss.x * tile + tile / 2, oy + map.boss.y * tile + tile * 0.62, 0.88);
      if (this.pendingBossBattle || this.joined["もじさん"]) {
        this.drawPartySprite(ox + (map.boss.x + 1) * tile + tile / 2, oy + map.boss.y * tile + tile * 0.62, partyBase[1], 0.92, 0.2);
        this.drawInteractMarker(ox + (map.boss.x + 1) * tile + tile / 2, oy + map.boss.y * tile + tile * 0.62 - 28, "もじさん");
      }
    }
    const visual = this.visualPlayerPosition();
    this.drawFieldFollowers(visual, ox, oy, tile);
    this.drawPerson(ox + visual.x * tile + tile / 2, oy + visual.y * tile + tile * 0.62, 0xe9d9b0, true, 0.88, this.player.dir, this.walkPhase());
  }

  private drawFieldFollowers(leader: { x: number; y: number }, ox: number, oy: number, tile: number) {
    if (this.pendingBossBattle) return;
    const followers = this.party.slice(1, 3);
    if (!followers.length) return;
    const dx = this.player.dir === "left" ? 1 : this.player.dir === "right" ? -1 : 0;
    const dy = this.player.dir === "up" ? 1 : this.player.dir === "down" ? -1 : 0;
    followers.forEach((member, i) => {
      const offset = 0.62 + i * 0.5;
      const side = i % 2 === 0 ? -0.18 : 0.18;
      const x = ox + (leader.x + dx * offset + (dy ? side : 0)) * tile + tile / 2;
      const y = oy + (leader.y + dy * offset + (dx ? side : 0)) * tile + tile * 0.62;
      this.drawPartySprite(x, y, member, 0.82, this.walkPhase() + i * 0.7);
    });
  }

  private drawMapAtmosphere(map: GameMap, ox: number, oy: number, tile: number) {
    if (this.mapId === "village") {
      this.drawRailPlatform(ox, oy, tile);
      this.drawGuidancePulse(ox + 7 * tile + tile / 2, oy + 3 * tile + tile / 2, 0xffe58a);
      return;
    }
    if (this.mapId === "forest") {
      this.drawFarmRows(ox, oy, tile);
      this.drawGuidancePulse(ox + 3 * tile + tile / 2, oy + 3 * tile + tile / 2, 0x9df09a);
      return;
    }
    this.drawMountainDetails(map, ox, oy, tile);
  }

  private drawRailPlatform(ox: number, oy: number, tile: number) {
    const y = oy + 12.35 * tile;
    this.graphics.fillStyle(0x4b4f55, 0.95);
    this.graphics.fillRect(ox + 3.9 * tile, y, 3.35 * tile, 5);
    this.graphics.fillRect(ox + 3.9 * tile, y + 14, 3.35 * tile, 5);
    this.graphics.lineStyle(2, 0xe7e7ef, 0.7);
    for (let x = ox + 4.1 * tile; x < ox + 7 * tile; x += 18) this.graphics.lineBetween(x, y - 1, x + 8, y + 20);
    this.graphics.fillStyle(0xf3d17b, 0.72);
    this.graphics.fillRect(ox + 4.2 * tile, oy + 11.25 * tile, 2.65 * tile, 4);
  }

  private drawFarmRows(ox: number, oy: number, tile: number) {
    const rows = [
      { x: 2, y: 7, w: 3 },
      { x: 7, y: 7, w: 3 },
      { x: 2, y: 8, w: 3 },
    ];
    rows.forEach((row, i) => {
      const x = ox + row.x * tile + 4;
      const y = oy + row.y * tile + 8;
      this.graphics.fillStyle(0x6b4a2d, 0.42);
      this.graphics.fillRect(x, y, row.w * tile - 8, 4);
      this.graphics.fillRect(x, y + 10, row.w * tile - 8, 4);
      this.graphics.fillStyle(i % 2 ? 0xd8e277 : 0x7fcd6f, 0.9);
      for (let n = 0; n < row.w * 3; n += 1) this.graphics.fillCircle(x + 8 + n * 9, y + 2 + (n % 2) * 10, 2);
    });
  }

  private drawMountainDetails(map: GameMap, ox: number, oy: number, tile: number) {
    map.tiles.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell !== ".") return;
        const seed = x * 17 + y * 31;
        const px = ox + x * tile;
        const py = oy + y * tile;
        if (seed % 5 === 0) {
          this.graphics.fillStyle(0x726248, 0.5);
          this.graphics.fillRect(px + 7, py + 11, 9, 3);
          this.graphics.fillRect(px + 16, py + 14, 5, 2);
        }
        if (seed % 7 === 0) {
          this.graphics.lineStyle(1, 0x4d4650, 0.45);
          this.graphics.lineBetween(px + 8, py + 21, px + 18, py + 16);
          this.graphics.lineBetween(px + 18, py + 16, px + 23, py + 20);
        }
      });
    });
    const depth = this.mapId === "dungeon1" ? 0.14 : this.mapId === "dungeon2" ? 0.22 : 0.3;
    this.graphics.fillStyle(0x0f131a, depth);
    this.graphics.fillRect(ox, oy, map.tiles[0].length * tile, 14 * tile);
    if (this.mapId === "dungeon3") {
      const pulse = 0.22 + Math.sin(this.time.now * 0.006) * 0.08;
      this.graphics.fillStyle(0xffe58a, pulse);
      this.graphics.fillEllipse(ox + 5.5 * tile, oy + 9.6 * tile, 92, 38);
      this.graphics.lineStyle(1, 0xfff3cb, 0.42);
      this.graphics.lineBetween(ox + 3.8 * tile, oy + 8.6 * tile, ox + 7.1 * tile, oy + 8.15 * tile);
      this.graphics.lineBetween(ox + 4.2 * tile, oy + 10.35 * tile, ox + 7.2 * tile, oy + 10.8 * tile);
    }
  }

  private drawGuidancePulse(x: number, y: number, color: number) {
    const radius = 10 + Math.sin(this.time.now * 0.006) * 2;
    this.graphics.lineStyle(2, color, 0.42);
    this.graphics.strokeCircle(x, y, radius);
  }

  private drawBattle() {
    if (!this.battle) return;
    this.graphics.fillGradientStyle(0x31485a, 0x31485a, 0x1c2732, 0x1c2732, 1);
    this.graphics.fillRect(0, 0, WIDTH, PANEL_Y);
    this.graphics.fillStyle(0x7d8d61);
    this.graphics.fillRect(0, 244, WIDTH, 62);
    const shake = this.time.now < this.battle.shakeUntil ? Math.sin(this.time.now * 0.09) * 3 : 0;
    const enemyFlash = this.time.now < this.battle.enemyFlashUntil;
    if (this.battle.enemy.boss) this.drawBoss(BATTLE_ENEMY_X + shake, BATTLE_ENEMY_Y, 2.2, enemyFlash);
    else this.drawEnemySprite(this.battle.enemy, BATTLE_ENEMY_X + shake, BATTLE_ENEMY_Y, enemyFlash);
    this.drawEnemyStatus();
    this.party.forEach((member, i) => {
      const lunge = this.battle?.actingIndex === i && this.time.now < this.battle.actingUntil ? Math.sin((1 - (this.battle.actingUntil - this.time.now) / 260) * Math.PI) * 18 : 0;
      this.drawPartyBattler(PARTY_BATTLE_X - lunge, PARTY_BATTLE_Y + i * PARTY_BATTLE_GAP, member, i === this.battle?.actor && !this.battle?.won, this.time.now < (this.battle?.partyFlashUntil[i] || 0));
    });
    this.drawBattleEffects();
    this.drawBattlePanel();
  }

  private drawTile(tile: string, x: number, y: number, size = TILE) {
    if (tile === "G" || tile === "F") {
      this.graphics.fillStyle((x / TILE + y / TILE) % 2 ? colors.grass : colors.grass2);
      this.graphics.fillRect(x, y, size, size);
      if (tile === "F") {
        this.graphics.fillStyle(0xf2d15f);
        this.graphics.fillRect(x + size * 0.56, y + size * 0.38, 5, 5);
        this.graphics.fillStyle(0xd36a72);
        this.graphics.fillRect(x + size * 0.5, y + size * 0.32, 3, 3);
        this.graphics.fillRect(x + size * 0.69, y + size * 0.32, 3, 3);
      }
    } else if (tile === "P") {
      this.graphics.fillStyle(colors.path);
      this.graphics.fillRect(x, y, size, size);
      this.graphics.fillStyle(0x9f784b, 0.22);
      this.graphics.fillRect(x + size * 0.14, y + size * 0.72, size * 0.7, 2);
    } else if (tile === "T") {
      this.graphics.fillStyle(0x507441);
      this.graphics.fillRect(x, y, size, size);
      this.graphics.fillStyle(colors.tree);
      this.graphics.fillRect(x + 2, y + 2, size - 4, size - 8);
      this.graphics.fillStyle(0x463523);
      this.graphics.fillRect(x + size * 0.41, y + size * 0.64, 6, size * 0.36);
    } else if (tile === "X") {
      this.graphics.fillStyle(colors.wall);
      this.graphics.fillRect(x, y, size, size);
    } else if (tile === ".") {
      this.graphics.fillStyle(colors.floor);
      this.graphics.fillRect(x, y, size, size);
    } else if (tile === "W") {
      this.graphics.fillStyle(colors.water);
      this.graphics.fillRect(x, y, size, size);
    } else if ("HSIC".includes(tile)) {
      this.graphics.fillStyle(colors.grass);
      this.graphics.fillRect(x, y, size, size);
      this.graphics.fillStyle(tile === "C" ? 0xe7dfc6 : colors.wood);
      this.graphics.fillRect(x + 2, y + size * 0.34, size - 4, size * 0.6);
      this.graphics.fillStyle(tile === "S" ? 0x345e84 : tile === "I" ? 0x6d9450 : colors.roof);
      this.graphics.fillRect(x, y + 4, size, size * 0.32);
    }
  }

  private drawPerson(x: number, y: number, skin: number, hero: boolean, scale = 1, dir: Direction = "down", phase = 0) {
    const bob = Math.abs(Math.sin(phase)) * 2 * scale;
    const sway = Math.sin(phase) * 2.2 * scale;
    y -= bob;
    this.graphics.fillStyle(0x222836);
    this.graphics.fillRect(x - 8 * scale, y + 10 * scale, 16 * scale, 5 * scale);
    this.graphics.fillStyle(hero ? 0x2b4768 : 0x5e3f61);
    this.graphics.fillRect(x - 8 * scale, y + 10 * scale + Math.max(0, sway), 5 * scale, 7 * scale);
    this.graphics.fillRect(x + 3 * scale, y + 10 * scale - Math.min(0, sway), 5 * scale, 7 * scale);
    this.graphics.fillStyle(skin);
    this.graphics.fillRect(x - 6 * scale, y - 15 * scale, 12 * scale, 12 * scale);
    this.graphics.fillStyle(hero ? 0x466b91 : 0x7d5572);
    this.graphics.fillRect(x - 8 * scale, y - 3 * scale, 16 * scale, 18 * scale);
    this.graphics.fillStyle(hero ? 0xc9d8e8 : 0xb99162);
    this.graphics.fillRect(x - 13 * scale - sway, y - 2 * scale, 4 * scale, 15 * scale);
    this.graphics.fillRect(x + 9 * scale - sway, y - 2 * scale, 4 * scale, 15 * scale);
    this.graphics.fillStyle(0x2a1b17);
    this.graphics.fillRect(x - 6 * scale, y - 17 * scale, 12 * scale, 4 * scale);
    this.graphics.fillStyle(0x12151b);
    if (dir !== "up") {
      const eyeY = dir === "down" ? -10 : -9;
      const eyeOffset = dir === "left" ? -2 : dir === "right" ? 2 : 0;
      this.graphics.fillRect(x + (-4 + eyeOffset) * scale, y + eyeY * scale, 3 * scale, 2 * scale);
      this.graphics.fillRect(x + (2 + eyeOffset) * scale, y + eyeY * scale, 3 * scale, 2 * scale);
    }
    if (hero) {
      this.graphics.fillStyle(0xd9e7f2);
      if (dir !== "up") {
        const glassOffset = dir === "left" ? -2 : dir === "right" ? 2 : 0;
        this.graphics.fillRect(x + (-5 + glassOffset) * scale, y - 11 * scale, 4 * scale, 3 * scale);
        this.graphics.fillRect(x + (1 + glassOffset) * scale, y - 11 * scale, 4 * scale, 3 * scale);
      }
      this.graphics.fillStyle(0xffe58a);
      if (dir === "up") this.graphics.fillTriangle(x, y - 22 * scale, x - 4 * scale, y - 16 * scale, x + 4 * scale, y - 16 * scale);
      if (dir === "down") this.graphics.fillTriangle(x, y + 20 * scale, x - 4 * scale, y + 14 * scale, x + 4 * scale, y + 14 * scale);
      if (dir === "left") this.graphics.fillTriangle(x - 14 * scale, y, x - 8 * scale, y - 4 * scale, x - 8 * scale, y + 4 * scale);
      if (dir === "right") this.graphics.fillTriangle(x + 14 * scale, y, x + 8 * scale, y - 4 * scale, x + 8 * scale, y + 4 * scale);
    }
  }

  private drawBoss(x: number, y: number, scale: number, flash = false) {
    this.graphics.fillStyle(0x17191f);
    this.graphics.fillRect(x - 18 * scale, y + 19 * scale, 36 * scale, 6 * scale);
    this.graphics.fillStyle(0x5c3035);
    this.graphics.fillRect(x - 16 * scale, y - 12 * scale, 32 * scale, 32 * scale);
    this.graphics.fillStyle(0xd2a177);
    this.graphics.fillRect(x - 13 * scale, y - 25 * scale, 26 * scale, 22 * scale);
    this.graphics.fillStyle(0x34251f);
    this.graphics.fillRect(x - 6 * scale, y - 28 * scale, 12 * scale, 3 * scale);
    this.graphics.fillStyle(0x111111);
    this.graphics.fillRect(x - 7 * scale, y - 17 * scale, 4 * scale, 3 * scale);
    this.graphics.fillRect(x + 4 * scale, y - 17 * scale, 4 * scale, 3 * scale);
    if (flash) {
      this.graphics.fillStyle(0xffffff, 0.58);
      this.graphics.fillRect(x - 34 * scale, y - 32 * scale, 68 * scale, 58 * scale);
    }
  }

  private drawEnemySprite(enemy: Enemy, x: number, y: number, flash = false) {
    const color = flash ? 0xfff7d8 : enemy.color;
    if (enemy.name.includes("スライム")) {
      this.graphics.fillStyle(0x10212b, 0.45);
      this.graphics.fillEllipse(x, y + 24, 56, 12);
      this.graphics.fillStyle(color);
      this.graphics.fillEllipse(x, y + 2, 54, 42);
      this.graphics.fillStyle(0xbbefff, 0.55);
      this.graphics.fillEllipse(x - 12, y - 8, 14, 8);
      this.graphics.fillStyle(0x151720);
      this.graphics.fillRect(x - 10, y - 2, 5, 4);
      this.graphics.fillRect(x + 7, y - 2, 5, 4);
      this.graphics.fillStyle(0x2f3a45);
      this.graphics.fillRect(x - 12, y + 10, 24, 4);
      this.graphics.fillStyle(0x493423);
      this.graphics.fillRect(x - 18, y - 20, 36, 5);
    } else if (enemy.name.includes("こうもり")) {
      this.graphics.fillStyle(0x10121b, 0.55);
      this.graphics.fillEllipse(x, y + 28, 62, 10);
      this.graphics.fillStyle(color);
      this.graphics.fillTriangle(x - 8, y - 4, x - 50, y - 22, x - 34, y + 18);
      this.graphics.fillTriangle(x + 8, y - 4, x + 50, y - 22, x + 34, y + 18);
      this.graphics.fillEllipse(x, y, 32, 34);
      this.graphics.fillStyle(0xf6dfb0);
      this.graphics.fillRect(x - 12, y - 15, 24, 12);
      this.graphics.fillStyle(0x151720);
      this.graphics.fillRect(x - 8, y - 10, 4, 4);
      this.graphics.fillRect(x + 4, y - 10, 4, 4);
    } else if (enemy.name.includes("ナイト")) {
      this.graphics.fillStyle(0x10121b, 0.5);
      this.graphics.fillEllipse(x, y + 32, 54, 10);
      this.graphics.fillStyle(color);
      this.graphics.fillRect(x - 16, y - 12, 32, 38);
      this.graphics.fillStyle(0xb8b5a8);
      this.graphics.fillRect(x - 14, y - 32, 28, 24);
      this.graphics.fillStyle(0x3d4652);
      this.graphics.fillRect(x - 10, y - 24, 20, 5);
      this.graphics.fillStyle(0x6a4d37);
      this.graphics.fillRect(x + 20, y - 10, 5, 34);
      this.graphics.fillStyle(0xd6c17a);
      this.graphics.fillRect(x + 14, y - 18, 16, 16);
    } else {
      this.graphics.fillStyle(0x10121b, 0.5);
      this.graphics.fillEllipse(x, y + 32, 52, 10);
      this.graphics.fillStyle(color);
      this.graphics.fillRect(x - 19, y - 8, 38, 36);
      this.graphics.fillStyle(0x3b2646);
      this.graphics.fillTriangle(x, y - 38, x - 22, y - 8, x + 22, y - 8);
      this.graphics.fillStyle(0xf6dfb0);
      this.graphics.fillRect(x - 11, y - 22, 22, 14);
      this.graphics.fillStyle(0xff9fdb);
      this.graphics.fillCircle(x + 23, y - 10, 6);
      this.graphics.lineStyle(3, 0xff9fdb, 0.8);
      this.graphics.lineBetween(x + 18, y - 2, x + 28, y + 25);
    }
  }

  private drawPartyBattler(x: number, y: number, member: PartyMember, active: boolean, flash = false) {
    this.drawPartySprite(x, y - (active ? Math.sin(this.time.now * 0.008) * 2 : 0), member, 1, active ? this.time.now * 0.012 : 0);
    this.drawHpBar(x - 18, y + 20, 36, 4, member.hp, member.maxHp);
    if (active) {
      this.graphics.fillStyle(0xffe58a);
      this.graphics.fillRect(x - 18, y - 4, 5, 5);
    }
    if (flash) {
      this.graphics.fillStyle(0xffffff, 0.48);
      this.graphics.fillRect(x - 15, y - 20, 30, 38);
    }
    if (member.hp <= 0) {
      this.graphics.fillStyle(0x28282e, 0.72);
      this.graphics.fillRect(x - 13, y - 18, 26, 35);
    }
  }

  private drawPartySprite(x: number, y: number, member: PartyMember, scale = 1, phase = 0) {
    const skin = member.name === "もじさん" || member.name === "貧" ? 0x9b6a4c : 0xe4c09c;
    const outfit = member.name === "yos" ? 0x466b91 : member.name === "もじさん" ? 0x7b3f35 : member.name === "ヤス" ? 0x5b4f92 : 0x3f6a57;
    const bob = Math.abs(Math.sin(phase)) * 2 * scale;
    const sway = Math.sin(phase) * 2 * scale;
    y -= bob;
    this.graphics.fillStyle(0x151820, 0.5);
    this.graphics.fillEllipse(x, y + 16 * scale + bob, 24 * scale, 6 * scale);
    this.graphics.fillStyle(0x2a2f3a);
    this.graphics.fillRect(x - 7 * scale, y + 11 * scale + Math.max(0, sway), 5 * scale, 8 * scale);
    this.graphics.fillRect(x + 2 * scale, y + 11 * scale - Math.min(0, sway), 5 * scale, 8 * scale);
    this.graphics.fillStyle(outfit);
    this.graphics.fillRect(x - 8 * scale, y - 2 * scale, 16 * scale, 18 * scale);
    this.graphics.fillStyle(member.name === "もじさん" ? 0xd8e277 : 0xd1d7e0);
    this.graphics.fillRect(x - 13 * scale - sway, y - 1 * scale, 5 * scale, 14 * scale);
    this.graphics.fillRect(x + 8 * scale - sway, y - 1 * scale, 5 * scale, 14 * scale);
    this.graphics.fillStyle(skin);
    this.graphics.fillRect(x - 6 * scale, y - 16 * scale, 12 * scale, 13 * scale);
    this.graphics.fillStyle(member.name === "貧" ? 0x2a1b17 : 0x34251f);
    this.graphics.fillRect(x - 7 * scale, y - 19 * scale, 14 * scale, 5 * scale);
    this.graphics.fillStyle(0x14161e);
    this.graphics.fillRect(x - 4 * scale, y - 11 * scale, 3 * scale, 2 * scale);
    this.graphics.fillRect(x + 2 * scale, y - 11 * scale, 3 * scale, 2 * scale);
    if (member.name === "yos") {
      this.graphics.fillStyle(0xd9e7f2);
      this.graphics.fillRect(x - 5 * scale, y - 12 * scale, 4 * scale, 3 * scale);
      this.graphics.fillRect(x + 1 * scale, y - 12 * scale, 4 * scale, 3 * scale);
      this.graphics.fillStyle(0xc9d8e8);
      this.graphics.fillRect(x - 15 * scale, y - 3 * scale, 4 * scale, 24 * scale);
      this.graphics.fillStyle(0xf4d35e);
      this.graphics.fillRect(x + 10 * scale, y - 5 * scale, 5 * scale, 7 * scale);
    } else if (member.name === "もじさん") {
      this.graphics.fillStyle(0xb99162);
      this.graphics.fillRect(x - 14 * scale, y - 1 * scale, 6 * scale, 16 * scale);
      this.graphics.fillRect(x + 8 * scale, y - 1 * scale, 6 * scale, 16 * scale);
      this.graphics.fillStyle(0x6f9a55);
      this.graphics.fillRect(x - 11 * scale, y - 24 * scale, 22 * scale, 4 * scale);
      this.graphics.fillStyle(0xf3d17b);
      this.graphics.fillCircle(x + 13 * scale, y - 8 * scale, 4 * scale);
    } else if (member.name === "ヤス") {
      this.graphics.fillStyle(0xff9fdb);
      this.graphics.fillCircle(x + 14 * scale, y - 5 * scale, 4 * scale);
    } else {
      this.graphics.fillStyle(0x222836);
      this.graphics.fillRect(x - 12 * scale, y - 4 * scale, 4 * scale, 18 * scale);
      this.graphics.fillStyle(0xffe58a);
      this.graphics.fillRect(x + 8 * scale, y + 2 * scale, 8 * scale, 3 * scale);
    }
  }

  private drawChest(x: number, y: number, opened: boolean, size = TILE) {
    this.graphics.fillStyle(opened ? 0x5a432e : 0xa66b32);
    this.graphics.fillRect(x + size * 0.22, y + size * 0.44, size * 0.56, size * 0.38);
    this.graphics.fillStyle(0xf1c75d);
    this.graphics.fillRect(x + size * 0.47, y + size * 0.5, 3, size * 0.2);
  }

  private drawStairs(x: number, y: number, size = TILE) {
    this.graphics.fillStyle(0x3d3b42);
    this.graphics.fillRect(x + size * 0.22, y + size * 0.25, size * 0.56, size * 0.56);
    this.graphics.fillStyle(0x8c8a8c);
    this.graphics.fillRect(x + size * 0.28, y + size * 0.38, size * 0.44, 3);
    this.graphics.fillRect(x + size * 0.34, y + size * 0.56, size * 0.32, 3);
  }

  private drawExitMarker(x: number, y: number) {
    const pulse = 0.5 + Math.sin(this.time.now * 0.006) * 0.18;
    this.graphics.fillStyle(0xffe58a, pulse);
    this.graphics.fillTriangle(x, y - 17, x - 8, y - 6, x + 8, y - 6);
    this.graphics.lineStyle(2, 0x7b5c20, 0.65);
    this.graphics.strokeTriangle(x, y - 17, x - 8, y - 6, x + 8, y - 6);
  }

  private drawSparkle(x: number, y: number) {
    const size = 3 + Math.sin(this.time.now * 0.01) * 1.5;
    this.graphics.fillStyle(0xfff3cb, 0.9);
    this.graphics.fillTriangle(x, y - size, x - size, y, x + size, y);
    this.graphics.fillTriangle(x, y + size, x - size, y, x + size, y);
  }

  private drawInteractMarker(x: number, y: number, name: string) {
    if (name === "立て札" || name.includes("案内")) {
      this.graphics.fillStyle(0xffe58a);
      this.graphics.fillRect(x - 2, y - 6, 4, 10);
      this.graphics.fillCircle(x, y + 8, 2);
      return;
    }
    this.graphics.fillStyle(0xfff3cb, 0.92);
    this.graphics.fillCircle(x, y, 7);
    this.graphics.fillStyle(0x202735);
    this.graphics.fillCircle(x, y, 4);
  }

  private drawHud() {
    this.panel(8, 6, 344, 50);
    this.text(20, 24, maps[this.mapId].name, 14, "#ffe58a");
    this.text(20, 43, `${this.gold}G 薬:${this.items["やくそう"] || 0} 水:${this.items["まほうの水"] || 0}`, 12);
    this.party.forEach((member, i) => {
      const x = 112 + (i % 2) * 116;
      const y = 22 + Math.floor(i / 2) * 19;
      this.text(x, y, `${member.name.slice(0, 4)} Lv${member.lv} ${member.hp}/${member.maxHp}`, 11, member.hp <= 0 ? "#a89c8d" : "#fff3cb");
    });
  }

  private drawBattlePanel() {
    if (!this.battle) return;
    this.ffWindow(8, PANEL_Y + 4, 344, 62);
    const logText = this.battle.log.at(-1) || "";
    this.wrap(logText, 31).slice(0, 3).forEach((line, i) => this.text(20, PANEL_Y + 22 + i * 15, line, 12));
    this.ffWindow(8, PANEL_Y + 70, 118, 94);
    if (this.battle.won) {
      this.ffWindow(132, PANEL_Y + 70, 220, 94);
      this.text(242, PANEL_Y + 118, "Aで進む", 15, "#ffe58a", "center");
      return;
    }
    const actor = this.currentActor();
    this.ffWindow(132, PANEL_Y + 70, 220, 94);
    const commands = actor ? this.battleCommands(actor) : [];
    commands.forEach((command, i) => {
      if (i === this.battle?.command) {
        this.graphics.fillStyle(0xffffff, 0.15);
        this.graphics.fillRect(18, PANEL_Y + 83 + i * 19, 90, 16);
      }
      this.text(24, PANEL_Y + 91 + i * 19, `${i === this.battle?.command ? ">" : " "}${command}`, 14, i === this.battle?.command ? "#ffe58a" : "#fff3cb");
    });
    if (this.battle.waiting) this.text(67, PANEL_Y + 157, "行動中", 12, "#d8c98f", "center");
    if (!this.battle.submenu) this.text(146, PANEL_Y + 86, actor ? `${actor.name}  ${actor.job}` : "", 13, "#ffe58a");
    this.party.forEach((member, i) => {
      const rowY = PANEL_Y + 104 + i * 15;
      const active = actor?.name === member.name && !this.battle?.won;
      if (this.battle?.submenu) return;
      if (active) {
        this.graphics.fillStyle(0xffffff, 0.12);
        this.graphics.fillRect(142, rowY - 8, 198, 14);
      }
      const color = member.hp <= 0 ? "#9aa0a8" : "#fff3cb";
      this.text(146, rowY, member.name.slice(0, 4), 12, color);
      this.text(198, rowY, `HP ${member.hp}/${member.maxHp}`, 12, color);
      this.text(288, rowY, `MP ${member.mp}`, 12, color);
    });
    if (this.battle.submenu && actor) this.drawSkillSubwindow(actor);
  }

  private battleCommands(actor: PartyMember) {
    return ["たたかう", actor.name === "もじさん" ? "ベジタブル" : "じゅもん", "ぼうぎょ", "もちもの"];
  }

  private skillsFor(actor: PartyMember): BattleSkill[] {
    if (actor.name === "もじさん") return [{ name: "オニオンソード", mp: 3, description: "1.5倍攻撃" }];
    if (actor.name === "yos") return [{ name: "ホイミ", mp: 4, description: "HP小回復" }];
    return [];
  }

  private drawSkillSubwindow(actor: PartyMember) {
    if (!this.battle?.submenu) return;
    const submenu = this.battle.submenu;
    const skills = this.skillsFor(actor);
    this.ffWindow(116, PANEL_Y + 76, 138, 82);
    this.text(130, PANEL_Y + 94, `${actor.name} ${submenu.kind}`, 12, "#ffe58a");
    skills.forEach((skill, i) => {
      const y = PANEL_Y + 115 + i * 18;
      if (i === submenu.cursor) {
        this.graphics.fillStyle(0xffffff, 0.15);
        this.graphics.fillRect(126, y - 8, 112, 16);
      }
      const color = actor.mp < skill.mp ? "#9aa0a8" : i === submenu.cursor ? "#ffe58a" : "#fff3cb";
      this.text(132, y, `${i === submenu.cursor ? ">" : " "}${skill.name}`, 12, color);
    });
    const skill = skills[submenu.cursor];
    if (skill) this.text(130, PANEL_Y + 146, `MP${skill.mp} ${skill.description}`, 11, actor.mp < skill.mp ? "#ffb0a0" : "#d8c98f");
  }

  private drawEnemyStatus() {
    if (!this.battle) return;
    this.text(54, 94, this.battle.enemy.name, 13, "#fff3cb", "center");
    this.drawHpBar(62, 104, 84, 6, this.battle.enemy.hp, this.battle.enemy.maxHp);
  }

  private drawHpBar(x: number, y: number, w: number, h: number, value: number, max: number) {
    const ratio = Phaser.Math.Clamp(value / max, 0, 1);
    this.graphics.fillStyle(0x10151d, 0.86);
    this.graphics.fillRect(x, y, w, h);
    this.graphics.fillStyle(ratio < 0.3 ? 0xd75f5f : 0x67c66b);
    this.graphics.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * ratio), h - 2);
    this.graphics.lineStyle(1, 0xf3d17b, 0.7);
    this.graphics.strokeRect(x, y, w, h);
  }

  private drawBattleEffects() {
    this.battleEffects = this.battleEffects.filter((effect) => this.time.now - effect.startedAt < effect.duration);
    this.battleEffects.forEach((effect) => {
      const progress = Phaser.Math.Clamp((this.time.now - effect.startedAt) / effect.duration, 0, 1);
      const alpha = 1 - progress;
      if (effect.kind === "slash") {
        this.graphics.lineStyle(5, 0xfff3cb, alpha);
        this.graphics.beginPath();
        this.graphics.moveTo(effect.x - 28 + progress * 20, effect.y - 22);
        this.graphics.lineTo(effect.x + 24, effect.y + 22 - progress * 14);
        this.graphics.strokePath();
        this.graphics.lineStyle(2, 0xffdf7a, alpha);
        this.graphics.strokeCircle(effect.x, effect.y, 18 + progress * 12);
      } else if (effect.kind === "magic") {
        this.graphics.fillStyle(0xff9fdb, alpha * 0.5);
        this.graphics.fillCircle(effect.x, effect.y, 30 + progress * 18);
        this.graphics.lineStyle(3, 0xfff3cb, alpha);
        this.graphics.strokeCircle(effect.x, effect.y, 12 + progress * 34);
      } else if (effect.kind === "heal") {
        this.graphics.fillStyle(0x9df09a, alpha);
        for (let i = 0; i < 5; i += 1) {
          const angle = i * 1.25 + progress * 3;
          this.graphics.fillCircle(effect.x + Math.cos(angle) * 18, effect.y - progress * 26 + Math.sin(angle) * 8, 3);
        }
      } else {
        this.graphics.fillStyle(0xffdf7a, alpha);
        this.graphics.fillCircle(effect.x, effect.y, 16 + progress * 8);
      }
    });
  }

  private drawMenu() {
    if (!this.menu) return;
    const wide = this.menu.mode === "shop" || this.menu.mode === "equip" || this.menu.mode === "equipGear" || this.menu.mode === "items" || this.menu.mode === "save" || this.menu.mode === "load";
    const mainMenu = this.menu.mode === "main";
    this.panel(wide ? 28 : mainMenu ? 62 : 78, wide ? 112 : mainMenu ? 128 : 154, wide ? 304 : mainMenu ? 236 : 204, wide ? 236 : mainMenu ? 208 : 156);
    const title =
      this.menu.mode === "save"
        ? "セーブ先"
        : this.menu.mode === "load"
          ? "ロード元"
          : this.menu.mode === "shop"
            ? `店 ${this.gold}G`
            : this.menu.mode === "equip"
              ? "そうび"
              : this.menu.mode === "equipGear"
                ? `${this.party[this.menu.memberIndex || 0]?.name || ""}の装備`
              : this.menu.mode === "items"
                ? "もちもの"
                : "旅のメニュー";
    this.text(wide ? 44 : mainMenu ? 94 : 112, wide ? 138 : mainMenu ? 154 : 184, title, 14, "#ffe58a");
    this.menu.items.forEach((item, i) => {
      const y = (wide ? 166 : mainMenu ? 184 : 214) + i * (wide ? 24 : mainMenu ? 24 : 28);
      this.text(wide ? 44 : mainMenu ? 92 : 116, y, `${i === this.menu?.cursor ? ">" : " "}${item}`, this.menu?.mode === "save" || this.menu?.mode === "load" ? 12 : wide ? 14 : mainMenu ? 16 : 18, i === this.menu?.cursor ? "#ffe58a" : "#fff3cb");
    });
    if (this.menu.mode === "shop") this.drawShopHelp();
    if (this.menu.mode === "equip") this.text(44, 326, "A:選ぶ / B:戻る", 12, "#d8c98f");
    if (this.menu.mode === "equipGear") this.drawEquipHelp();
  }

  private drawShopHelp() {
    if (!this.menu?.shopType) return;
    const id = shopStock[this.menu.shopType][this.menu.cursor];
    const entry = catalog[id];
    if (!entry) return;
    const owned = entry.kind === "item" ? this.items[entry.name] || 0 : this.inventory[entry.id] || 0;
    const users = entry.users?.join("/") || "全員";
    this.text(44, 286, `所持 ${owned}  装備 ${users}`, 12, "#d8c98f");
    this.text(44, 310, this.gold >= entry.price ? "A:購入 / B:閉じる" : "お金が足りない", 12, this.gold >= entry.price ? "#d8c98f" : "#ffb0a0");
  }

  private drawEquipHelp() {
    if (this.menu?.memberIndex === undefined) return;
    const member = this.party[this.menu.memberIndex];
    if (!member) return;
    this.text(44, 286, `現在 武:${this.equipmentName(member.weapon)} 防:${this.equipmentName(member.armor)}`, 12, "#d8c98f");
    this.text(44, 310, "A:装備 / B:戻る", 12, "#d8c98f");
  }

  private drawMessage(message: string) {
    const parsed = this.parseMessage(message);
    this.graphics.fillStyle(0x080b10, 0.18);
    this.graphics.fillRect(0, 0, WIDTH, PANEL_Y + 12);
    this.panel(12, PANEL_Y + 10, 336, 146);
    const lines = this.messageLines(message);
    const hasMore = lines.length > 4 || this.message.length > 1;
    if (parsed.speaker) {
      this.panel(24, PANEL_Y + 32, 52, 76);
      this.drawSpeakerPortrait(parsed.speaker, 50, PANEL_Y + 80);
      this.graphics.fillStyle(0x10151d, 0.92);
      this.graphics.fillRect(88, PANEL_Y + 26, 100, 22);
      this.graphics.lineStyle(1, colors.border, 0.75);
      this.graphics.strokeRect(88, PANEL_Y + 26, 100, 22);
      this.text(98, PANEL_Y + 38, parsed.speaker, 12, "#ffe58a");
      lines.slice(0, 4).forEach((line, i) => this.text(90, PANEL_Y + 62 + i * 20, line, 14));
    } else {
      lines.slice(0, 4).forEach((line, i) => this.text(28, PANEL_Y + 44 + i * 22, line, 15));
    }
    this.drawContinueCue(hasMore);
    this.text(216, PANEL_Y + 138, hasMore ? "A:次へ / B:閉じる" : "A/B:閉じる", 13, "#ffe58a");
  }

  private parseMessage(message: string) {
    const match = message.match(/^([^:：]{1,10})[:：]\s*(.+)$/);
    return match ? { speaker: match[1], body: match[2] } : { speaker: "", body: message };
  }

  private messageLines(message: string) {
    const parsed = this.parseMessage(message);
    return this.wrap(parsed.body, parsed.speaker ? 15 : 18);
  }

  private drawSpeakerPortrait(speaker: string, x: number, y: number) {
    if (speaker === "yos") {
      this.drawPerson(x, y, 0xe9d9b0, true, 1.15, "down");
      return;
    }
    if (speaker === "もじさん") {
      this.drawPartySprite(x, y - 2, partyBase[1]);
      return;
    }
    if (speaker === "オニオンJK") {
      this.drawBoss(x, y - 4, 0.64);
      return;
    }
    this.drawPerson(x, y, this.npcColor(speaker), false, 1.05);
  }

  private drawContinueCue(hasMore: boolean) {
    const y = PANEL_Y + 136 + Math.sin(this.time.now * 0.008) * 2;
    this.graphics.fillStyle(hasMore ? 0xffe58a : 0xd8c98f, 0.9);
    this.graphics.fillTriangle(324, y, 316, y - 6, 332, y - 6);
  }

  private drawEncounterEffect() {
    if (!this.encounterEffect) return;
    const progress = Phaser.Math.Clamp((this.time.now - this.encounterEffect.startedAt) / 220, 0, 1);
    const alpha = 1 - Math.abs(progress - 0.5) * 1.4;
    const color = this.encounterEffect.kind === "boss" ? 0xffe58a : 0xfff3cb;
    this.graphics.fillStyle(0x05060a, 0.38 + alpha * 0.22);
    this.graphics.fillRect(0, 0, WIDTH, HEIGHT);
    this.graphics.lineStyle(3, color, 0.75 * alpha);
    for (let i = 0; i < 5; i += 1) {
      const offset = i * 48 + progress * 90;
      this.graphics.lineBetween(-40 + offset, 0, 42 + offset, HEIGHT);
    }
    this.graphics.fillStyle(color, 0.18 + alpha * 0.18);
    this.graphics.fillCircle(WIDTH / 2, FIELD_TOP + 150, 22 + progress * 120);
    this.text(WIDTH / 2, FIELD_TOP + 154, "!", 28, "#fff3cb", "center");
  }

  private drawTopLabel(label: string) {
    this.graphics.fillStyle(0x12151b, 0.65);
    this.graphics.fillRect(112, 104, 136, 28);
    this.graphics.lineStyle(1, colors.border, 0.7);
    this.graphics.strokeRect(112, 104, 136, 28);
    this.text(180, 123, label, 14, "#fff3cb", "center");
  }

  private panel(x: number, y: number, w: number, h: number) {
    this.graphics.fillStyle(colors.panel, 0.92);
    this.graphics.fillRect(x, y, w, h);
    this.graphics.lineStyle(4, 0x0e1219);
    this.graphics.strokeRect(x, y, w, h);
    this.graphics.lineStyle(2, colors.border);
    this.graphics.strokeRect(x + 4, y + 4, w - 8, h - 8);
  }

  private ffWindow(x: number, y: number, w: number, h: number) {
    this.graphics.fillGradientStyle(0x1d3f8f, 0x1d3f8f, 0x142457, 0x142457, 0.96);
    this.graphics.fillRoundedRect(x, y, w, h, 4);
    this.graphics.lineStyle(3, 0xe7e7ef, 0.95);
    this.graphics.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 4);
    this.graphics.lineStyle(1, 0x050816, 0.9);
    this.graphics.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 2);
  }

  private text(x: number, y: number, value: string, size = 14, color = "#fff3cb", align: "left" | "center" = "left") {
    const label = this.add.text(Math.round(x), Math.round(y), value, {
      fontFamily: UI_FONT,
      fontSize: `${size}px`,
      color,
      resolution: 3,
    });
    label.setOrigin(align === "center" ? 0.5 : 0, 0.5);
    this.labels.push(label);
  }

  private floatText(x: number, y: number, value: string, color: string) {
    const label = this.add.text(Math.round(x), Math.round(y), value, { fontFamily: UI_FONT, fontSize: "18px", color, fontStyle: "bold", resolution: 3 });
    label.setOrigin(0.5);
    this.tweens.add({ targets: label, y: y - 26, alpha: 0, duration: 620, onComplete: () => label.destroy() });
  }

  private flashEnemy() {
    if (!this.battle) return;
    this.battle.enemyFlashUntil = this.time.now + 180;
    this.battle.shakeUntil = this.time.now + 170;
  }

  private flashParty(index: number) {
    if (!this.battle) return;
    this.battle.partyFlashUntil[index] = this.time.now + 180;
    this.battle.shakeUntil = this.time.now + 140;
  }

  private addBattleEffect(kind: BattleEffect["kind"], x: number, y: number) {
    this.battleEffects.push({ kind, x, y, startedAt: this.time.now, duration: kind === "heal" ? 760 : 420 });
  }

  private currentActor() {
    if (!this.battle) return null;
    for (let i = 0; i < this.party.length; i += 1) {
      const index = (this.battle.actor + i) % this.party.length;
      if (this.party[index].hp > 0) {
        this.battle.actor = index;
        return this.party[index];
      }
    }
    return null;
  }

  private damage(attacker: Pick<PartyMember | Enemy, "atk">, defender: Pick<PartyMember | Enemy, "def">) {
    return Math.max(1, attacker.atk + Math.floor(Math.random() * 5) - defender.def);
  }

  private openShop(shopType: "item" | "weapon" | "armor") {
    this.menu = {
      mode: "shop",
      cursor: 0,
      shopType,
      items: shopStock[shopType].map((id) => this.shopLine(catalog[id])),
    };
  }

  private shopLine(entry: ShopEntry) {
    const stat = entry.atk ? ` 攻+${entry.atk}` : entry.def ? ` 守+${entry.def}` : "";
    return `${entry.name}${stat} ${entry.price}G`;
  }

  private buySelectedItem() {
    if (!this.menu?.shopType) return;
    const id = shopStock[this.menu.shopType][this.menu.cursor];
    const entry = catalog[id];
    if (!entry) return;
    if (this.gold < entry.price) {
      this.message = [`${entry.name}を買うにはお金が足りない。`];
      this.menu = null;
      return;
    }
    this.gold -= entry.price;
    if (entry.kind === "item") {
      this.items[entry.name] = (this.items[entry.name] || 0) + 1;
    } else {
      this.inventory[id] = (this.inventory[id] || 0) + 1;
    }
    this.message = [`${entry.name}を買った。`];
    this.menu.items = shopStock[this.menu.shopType].map((stockId) => this.shopLine(catalog[stockId]));
  }

  private openEquipMenu() {
    this.menu = {
      mode: "equip",
      cursor: 0,
      items: ["全員 最強装備", ...this.party.map((member) => `${member.name} 武:${this.equipmentName(member.weapon)} 防:${this.equipmentName(member.armor)}`)],
    };
  }

  private openEquipGearMenu(memberIndex: number) {
    const member = this.party[memberIndex];
    if (!member) return;
    const weapons = this.availableEquipment(member, "weapon").map((entry) => `武 ${entry.name} 攻+${entry.atk || 0}`);
    const armors = this.availableEquipment(member, "armor").map((entry) => `防 ${entry.name} 守+${entry.def || 0}`);
    this.menu = {
      mode: "equipGear",
      cursor: 0,
      memberIndex,
      items: [...weapons, ...armors],
    };
    if (!this.menu.items.length) {
      this.message = [`${member.name}が装備できる持ち物はない。`];
      this.menu = null;
    }
  }

  private equipSelectedGear() {
    if (this.menu?.mode !== "equipGear" || this.menu.memberIndex === undefined) return;
    const member = this.party[this.menu.memberIndex];
    if (!member) return;
    const choices = [...this.availableEquipment(member, "weapon"), ...this.availableEquipment(member, "armor")];
    const entry = choices[this.menu.cursor];
    if (!entry) return;
    if (entry.kind === "weapon") member.weapon = entry.id;
    if (entry.kind === "armor") member.armor = entry.id;
    this.message = [`${member.name}は${entry.name}を装備した。`];
    this.openEquipMenu();
  }

  private openItemsMenu() {
    const gear = Object.entries(this.inventory)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${catalog[id]?.name || id} x${count}`);
    this.menu = {
      mode: "items",
      cursor: 0,
      items: [`やくそう x${this.items["やくそう"] || 0}`, `まほうの水 x${this.items["まほうの水"] || 0}`, ...gear],
    };
  }

  private autoEquipAll() {
    this.party.forEach((member) => {
      const bestWeapon = this.bestEquipment(member, "weapon");
      const bestArmor = this.bestEquipment(member, "armor");
      if (bestWeapon) member.weapon = bestWeapon.id;
      if (bestArmor) member.armor = bestArmor.id;
    });
    this.message = ["全員に持っている中で一番よい装備をつけた。"];
    this.menu = null;
  }

  private bestEquipment(member: PartyMember, kind: "weapon" | "armor") {
    return this.availableEquipment(member, kind)
      .sort((a, b) => (kind === "weapon" ? (b.atk || 0) - (a.atk || 0) : (b.def || 0) - (a.def || 0)))[0];
  }

  private availableEquipment(member: PartyMember, kind: "weapon" | "armor") {
    return Object.entries(this.inventory)
      .filter(([, count]) => count > 0)
      .map(([id]) => catalog[id])
      .filter((entry): entry is ShopEntry => Boolean(entry) && entry.kind === kind && this.canEquip(member, entry));
  }

  private canEquip(member: PartyMember, entry: ShopEntry) {
    return !entry.users || entry.users.includes(member.name);
  }

  private totalAtk(member: PartyMember) {
    return member.strength + (catalog[member.weapon || ""]?.atk || 0);
  }

  private totalDef(member: PartyMember) {
    return member.stamina + (catalog[member.armor || ""]?.def || 0);
  }

  private equipmentName(id?: string) {
    return id ? catalog[id]?.name || "-" : "-";
  }

  private applyLevelUps() {
    const leveledMembers = this.party.filter((member) => this.levelUpMember(member));
    if (leveledMembers.length) {
      this.party.forEach((member) => {
        if (leveledMembers.includes(member)) {
          member.hp = member.maxHp;
          member.mp = member.maxMp;
        }
      });
      this.pushBattle(`${leveledMembers.map((member) => member.name).join("、")}のレベルが上がった！`);
    }
  }

  private levelUpMember(member: PartyMember) {
    let leveled = false;
    while (member.lv < LEVEL_XP.length && member.xp >= LEVEL_XP[member.lv]) {
      member.lv += 1;
      const hpGain = member.name === "もじさん" ? 12 : member.name === "貧" ? 8 : 10;
      member.maxHp += hpGain;
      member.maxMp += member.maxMp > 0 ? (member.name === "ヤス" ? 6 : 4) : 0;
      member.atk += member.name === "もじさん" ? 3 : 2;
      member.def += member.name === "貧" ? 1 : 2;
      member.strength += member.name === "もじさん" ? 3 : 2;
      member.stamina += member.name === "貧" ? 1 : 2;
      member.magicPower += member.name === "yos" || member.name === "ヤス" ? 2 : 1;
      member.spd += member.lv % 3 === 0 ? 1 : 0;
      member.evade += member.lv % 4 === 0 ? 1 : 0;
      leveled = true;
    }
    return leveled;
  }

  private xpToNext(member: PartyMember) {
    const next = LEVEL_XP[member.lv];
    if (next === undefined) return 0;
    return Math.max(0, next - member.xp);
  }

  private pushBattle(text: string) {
    if (!this.battle) return;
    this.battle.log.push(text);
    if (this.battle.log.length > 4) this.battle.log.shift();
  }

  private fullHeal() {
    this.party.forEach((member) => {
      member.hp = member.maxHp;
      member.mp = member.maxMp;
    });
  }

  private removeMojisanAfterBossLoss() {
    this.party = this.party.filter((member) => member.name !== "もじさん");
    this.joined["もじさん"] = false;
    if (this.inventory.onionSword) {
      this.inventory.onionSword -= 1;
      if (this.inventory.onionSword <= 0) delete this.inventory.onionSword;
    }
  }

  private facingTile() {
    const dx = this.player.dir === "left" ? -1 : this.player.dir === "right" ? 1 : 0;
    const dy = this.player.dir === "up" ? -1 : this.player.dir === "down" ? 1 : 0;
    return { x: this.player.x + dx, y: this.player.y + dy };
  }

  private visualPlayerPosition() {
    if (!this.moveAnim) return { x: this.player.x, y: this.player.y };
    const progress = Phaser.Math.Clamp((this.time.now - this.moveAnim.startedAt) / this.moveAnim.duration, 0, 1);
    const eased = Phaser.Math.Easing.Sine.Out(progress);
    return {
      x: Phaser.Math.Linear(this.moveAnim.fromX, this.moveAnim.toX, eased),
      y: Phaser.Math.Linear(this.moveAnim.fromY, this.moveAnim.toY, eased),
    };
  }

  private walkPhase() {
    if (!this.moveAnim) return 0;
    const progress = Phaser.Math.Clamp((this.time.now - this.moveAnim.startedAt) / this.moveAnim.duration, 0, 1);
    return progress * Math.PI * 2;
  }

  private idlePhase(x: number, y: number) {
    return Math.sin(this.time.now * 0.003 + x * 0.9 + y * 0.6) * 0.22;
  }

  private tileAt(map: GameMap, x: number, y: number) {
    return map.tiles[y]?.[x] || "X";
  }

  private isSolid(tile: string) {
    return ["T", "X", "W", "H", "S", "I", "C"].includes(tile);
  }

  private advanceMessage() {
    if (!this.message.length) return;
    const parsed = this.parseMessage(this.message[0]);
    const lines = this.messageLines(this.message[0]);
    if (lines.length > 4) {
      const rest = lines.slice(4).join("");
      this.message[0] = parsed.speaker ? `${parsed.speaker}: ${rest}` : rest;
      return;
    }
    this.message.shift();
  }

  private beginPendingBossBattle() {
    this.pendingBossBattle = false;
    this.startEncounter("boss");
  }

  private startEncounter(kind: "random" | "boss") {
    if (this.mode !== "field") return;
    this.encounterEffect = { startedAt: this.time.now, kind };
    this.inputLock = true;
    this.audio.playSe(kind === "boss" ? "magic" : "attack");
    this.time.delayedCall(220, () => {
      this.encounterEffect = null;
      this.inputLock = false;
      this.startBattle(kind);
    });
  }

  private startBossIntro() {
    if (this.ending) return;
    if (!this.joined["もじさん"]) {
      const member = partyBase.find((item) => item.name === "もじさん");
      if (member && !this.party.some((item) => item.name === "もじさん")) this.party.push(copyMember(member));
      this.joined["もじさん"] = true;
      this.inventory.onionSword = (this.inventory.onionSword || 0) + 1;
    }
    this.pendingBossBattle = true;
    this.message = [
      "もじさん: yos、久しぶりだな。山頂で会うとは思わなかったぞ。",
      "オニオンJK: 新しい野菜を探す者よ、玉ねぎの審査を受けてもらう。",
      "yos: 何の話か分からないが、まずは友を助ける。",
      "もじさん: いくぞ。オニオンソードで道を開く。",
    ];
  }

  private npcAt(x: number, y: number) {
    return maps[this.mapId].npcs.find((npc) => npc.x === x && npc.y === y);
  }

  private bossAt(x: number, y: number) {
    const boss = maps[this.mapId].boss;
    return Boolean(boss && !this.ending && boss.x === x && boss.y === y);
  }

  private chestAt(x: number, y: number) {
    return maps[this.mapId].chests.find((chest) => chest.x === x && chest.y === y && !chest.opened);
  }

  private npcColor(name: string) {
    return name === "もじさん" || name === "貧" ? 0x9b6a4c : 0xe4c09c;
  }

  private wrap(text: string, max: number) {
    const rows: string[] = [];
    let row = "";
    let width = 0;
    for (const char of text) {
      const charWidth = char.charCodeAt(0) > 255 ? 1 : 0.58;
      if (row && width + charWidth > max) {
        rows.push(row);
        row = "";
        width = 0;
      }
      row += char;
      width += charWidth;
    }
    if (row) rows.push(row);
    return rows;
  }

  private chestState() {
    const result: Record<string, boolean[]> = {};
    Object.entries(maps).forEach(([mapId, map]) => {
      result[mapId] = map.chests.map((chest) => chest.opened);
    });
    return result;
  }

  private applyChestState(saved?: Record<string, boolean[]>) {
    if (!saved) return;
    Object.entries(saved).forEach(([mapId, values]) => {
      values.forEach((opened, index) => {
        if (maps[mapId]?.chests[index]) maps[mapId].chests[index].opened = opened;
      });
    });
  }

  private resetChestState() {
    Object.values(maps).forEach((map) => map.chests.forEach((chest) => (chest.opened = false)));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#12151b",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: HigeQuestScene,
  render: {
    antialias: true,
    roundPixels: true,
  },
});
