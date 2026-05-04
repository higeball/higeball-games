import Phaser from "phaser";
import { COLORS, DISPLAY, FONT, LAYOUT } from "./ui/layout";

const WIDTH = LAYOUT.CANVAS.w;
const HEIGHT = LAYOUT.CANVAS.h;
const TILE = 32;
const FIELD_TILE = 28;
const FIELD_TOP = LAYOUT.FIELD_TOP;
const PANEL_Y = LAYOUT.PANEL_Y;
const BATTLE_ENEMY_X = LAYOUT.BATTLE.ENEMY_X;
const BATTLE_ENEMY_Y = LAYOUT.BATTLE.ENEMY_Y;
const PARTY_BATTLE_X = LAYOUT.BATTLE.PARTY_X;
const PARTY_BATTLE_Y = LAYOUT.BATTLE.PARTY_Y;
const PARTY_BATTLE_GAP = LAYOUT.BATTLE.PARTY_GAP;
const LEVEL_XP = [0, 20, 48, 88, 140, 210, 300];
const UI_FONT = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif';
const TEXT_RESOLUTION = 4;

type Direction = "up" | "down" | "left" | "right";
type SceneMode = "title" | "field" | "battle";
type BgmTrack = "title" | "world" | "village" | "forest" | "dungeon" | "battle" | "boss" | "ending";
type SeKey = "confirm" | "cancel" | "move" | "attack" | "magic" | "heal" | "chest" | "stairs" | "boss" | "victory" | "levelup" | "equip";

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
  skills: string[];
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

type EnemyAction = {
  atk: number;
  text: string;
  kind?: "physical" | "magic";
  heal?: number;
  hits?: number;
  mpDrain?: number;
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
  cueText: string | null;
  cueUntil: number;
  levelUpSummary: LevelUpSummary[] | null;
  levelUpPage: number;
  levelUpUntil: number;
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

type LevelUpSummary = {
  name: string;
  job: string;
  lvBefore: number;
  lvAfter: number;
  hpBefore: number;
  hpAfter: number;
  mpBefore: number;
  mpAfter: number;
  strengthBefore: number;
  strengthAfter: number;
  staminaBefore: number;
  staminaAfter: number;
  speedBefore: number;
  speedAfter: number;
  magicBefore: number;
  magicAfter: number;
  evadeBefore: number;
  evadeAfter: number;
  learned: string[];
};

type BattleSubmenu = {
  kind: "じゅもん" | "ベジタブル";
  cursor: number;
  page: number;
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
  mode: "main" | "save" | "load" | "shop" | "equip" | "equipGear" | "items" | "status";
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
  traits?: {
    atk?: number;
    def?: number;
    crit?: number;
    speed?: number;
    magic?: number;
    evade?: number;
    heal?: number;
    exp?: number;
    mp?: number;
    guard?: number;
    hit?: number;
    resist?: string[];
  };
};

type SaveData = {
  schemaVersion?: number;
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
  storyFlags?: Record<string, boolean>;
  savedAt?: string;
  playTimeMs?: number;
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
    if (key === "boss") this.arpeggio([196, 247, 311], 0.09, "sawtooth", 0.16);
    if (key === "victory") this.arpeggio([523, 659, 784, 1047], 0.08, "triangle", 0.13);
    if (key === "levelup") this.arpeggio([784, 988, 1175], 0.06, "square", 0.12);
    if (key === "equip") this.tone(560, 0.05, now, "triangle", 0.1);
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
      world: { stepMs: 310, lead: [67, 71, 74, 71, 69, 67, 64, 0], bass: [43, 0, 48, 0], leadGain: 0.07, bassGain: 0.06 },
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
  { name: "yos", job: "ゲーマス", lv: 1, xp: 0, maxHp: 50, hp: 50, maxMp: 14, mp: 14, atk: 12, def: 6, spd: 7, strength: 12, stamina: 8, magicPower: 13, evade: 8, skills: ["ホイミ"], magic: "ホイミ", weapon: "stick", armor: "cloth" },
  { name: "もじさん", job: "百姓貴族", lv: 5, xp: 140, maxHp: 116, hp: 116, maxMp: 24, mp: 24, atk: 30, def: 16, spd: 4, strength: 30, stamina: 20, magicPower: 8, evade: 5, skills: ["オニオンソード", "オニオンラッシュ"], magic: "オニオンソード", weapon: "onionSword", armor: "cloth" },
  { name: "ヤス", job: "賢者", lv: 1, xp: 0, maxHp: 46, hp: 46, maxMp: 28, mp: 28, atk: 8, def: 5, spd: 5, strength: 8, stamina: 7, magicPower: 18, evade: 7, skills: ["メラヒゲ"], magic: "メラヒゲ", weapon: "stick", armor: "cloth" },
  { name: "貧", job: "盗賊", lv: 1, xp: 0, maxHp: 42, hp: 42, maxMp: 6, mp: 6, atk: 11, def: 4, spd: 11, strength: 11, stamina: 6, magicPower: 6, evade: 14, skills: [], steal: true, weapon: "stick", armor: "cloth" },
];

const catalog: Record<string, ShopEntry> = {
  herb: { id: "herb", name: "やくそう", kind: "item", price: 8 },
  water: { id: "water", name: "まほうの水", kind: "item", price: 18 },
  stick: { id: "stick", name: "木の棒", kind: "weapon", price: 0, atk: 1, traits: { speed: 1, atk: 1, hit: 2 } },
  onionSword: { id: "onionSword", name: "オニオンソード", kind: "weapon", price: 0, atk: 4, users: ["もじさん"], traits: { crit: 0.2, atk: 2, speed: 1, hit: 3 } },
  copperSword: { id: "copperSword", name: "銅の剣", kind: "weapon", price: 45, atk: 5, users: ["yos", "もじさん", "貧"], traits: { crit: 0.08, atk: 1, hit: 2 } },
  sageStaff: { id: "sageStaff", name: "賢者の杖", kind: "weapon", price: 52, atk: 3, users: ["yos", "ヤス"], traits: { magic: 3, mp: 4, hit: 4 } },
  ironAxe: { id: "ironAxe", name: "鉄の斧", kind: "weapon", price: 78, atk: 8, users: ["もじさん"], traits: { crit: 0.1, speed: -1, atk: 3, hit: 1 } },
  cloth: { id: "cloth", name: "布の服", kind: "armor", price: 0, def: 1, traits: { evade: 1, def: 1, resist: ["物理"] } },
  traveler: { id: "traveler", name: "旅人の服", kind: "armor", price: 35, def: 4, traits: { speed: 1, exp: 0.1, def: 1, resist: ["物理"] } },
  ironArmor: { id: "ironArmor", name: "鉄の胸当て", kind: "armor", price: 70, def: 7, users: ["yos", "もじさん"], traits: { guard: 2, def: 3, resist: ["物理"] } },
  lightCloak: { id: "lightCloak", name: "身かわしマント", kind: "armor", price: 64, def: 5, users: ["ヤス", "貧"], traits: { evade: 3, speed: 1, resist: ["魔法"] } },
};

const shopStock: Record<"item" | "weapon" | "armor", string[]> = {
  item: ["herb", "water"],
  weapon: ["copperSword", "sageStaff", "ironAxe"],
  armor: ["traveler", "ironArmor", "lightCloak"],
};

function copyMember(member: PartyMember): PartyMember {
  return { ...member, skills: [...member.skills] };
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
    skills: [...(member.skills || base.skills || [])],
  };
}

function fitLines(text: string, containerWidthPx: number, fontPx: number): string[] {
  const maxUnits = containerWidthPx / fontPx;
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const paragraph of paragraphs) {
    let line = "";
    let width = 0;
    for (const char of paragraph) {
      const charWidth = /[　-鿿＀-￯]/.test(char) ? 1 : 0.55;
      if (line && width + charWidth > maxUnits) {
        lines.push(line);
        line = "";
        width = 0;
      }
      line += char;
      width += charWidth;
    }
    if (line) lines.push(line);
    if (!paragraph.length) lines.push("");
  }
  return lines;
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
  world: {
    name: "フィールド",
    encounter: 0.08,
    tiles: [
      "XXXXXXXXXXXX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XGGGGGGGGGGX",
      "XXXXXXXXXXXX",
    ],
    exits: [
      { x: 2, y: 10, to: "village", tx: 5, ty: 12, text: "チバの村に入った。" },
      { x: 7, y: 7, to: "forest", tx: 5, ty: 12, text: "ヒョーゴの村に入った。" },
      { x: 9, y: 4, to: "dungeon1", tx: 5, ty: 1, text: "山道ふもとへ入った。" },
    ],
    npcs: [],
    chests: [],
  },
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
    exits: [{ x: 5, y: 13, to: "world", tx: 2, ty: 9, text: "電車でフィールドへ出た。" }],
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
      { x: 5, y: 0, to: "world", tx: 7, ty: 8, text: "フィールドへ戻った。" },
    ],
    npcs: [
      { x: 3, y: 3, name: "農家", lines: ["農家: もじさんなら畑を充実させる新しい野菜を探しに山へ行ったよ。", "農家: でも、まだ帰ってこないんだ。山頂まで見に行けるかい？"], flag: "heardMojisanMountain" },
      { x: 8, y: 5, name: "村人", lines: ["村人: もじさんは百姓貴族を名乗っているよ。", "村人: 野菜への気合いだけは誰にも負けない人だ。"] },
      { x: 7, y: 10, name: "山の案内", lines: ["南: 山道", "装備を整え、少し腕をならしてから山頂へ。"] },
    ],
    chests: [{ x: 8, y: 10, item: "やくそう", opened: false }],
  },
  dungeon1: dungeonMap("山道 ふもと", "dungeon2", "world", 0.16),
  dungeon2: dungeonMap("山道 中腹", "dungeon3", "dungeon1", 0.18),
  dungeon3: { ...dungeonMap("山頂", null, "dungeon2", 0.2), boss: { x: 5, y: 9 } },
};

const enemyTemplates: Record<"world" | "forest" | "dungeon" | "boss", Omit<Enemy, "maxHp">[]> = {
  world: [
    { name: "ちびスライム", hp: 14, atk: 5, def: 1, xp: 5, gold: 3, color: 0x8ed6db, behavior: "slime", stealGold: 2 },
    { name: "こヒゲこうもり", hp: 18, atk: 6, def: 1, xp: 6, gold: 4, color: 0x6d6a96, behavior: "bat", stealGold: 3 },
  ],
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

type SkillDef = {
  name: string;
  family: "じゅもん" | "ベジタブル";
  mp: number;
  description: string;
  minLv: number;
  target: "heal" | "attack" | "allheal" | "trick";
  power: number;
};

const skillCatalog: SkillDef[] = [
  { name: "ホイミ", family: "じゅもん", mp: 4, description: "HPを小回復する", minLv: 1, target: "heal", power: 22 },
  { name: "ベホイミ", family: "じゅもん", mp: 8, description: "HPを大きく回復する", minLv: 3, target: "heal", power: 44 },
  { name: "メガホイミ", family: "じゅもん", mp: 12, description: "味方全体を回復する", minLv: 5, target: "allheal", power: 18 },
  { name: "レトロホイミ", family: "じゅもん", mp: 10, description: "懐かしい気配で大きく回復する", minLv: 2, target: "heal", power: 38 },
  { name: "メラヒゲ", family: "じゅもん", mp: 5, description: "炎のようなヒゲで焼きつける", minLv: 1, target: "attack", power: 24 },
  { name: "オニオンソード", family: "ベジタブル", mp: 3, description: "1.5倍の切り込み", minLv: 1, target: "attack", power: 15 },
  { name: "オニオンラッシュ", family: "ベジタブル", mp: 6, description: "2連撃で大ダメージ", minLv: 4, target: "attack", power: 28 },
  { name: "オニオンブラスト", family: "ベジタブル", mp: 10, description: "玉ねぎの気合で大打撃", minLv: 6, target: "trick", power: 40 },
  { name: "タネばくだん", family: "ベジタブル", mp: 8, description: "畑の力を爆ぜさせる", minLv: 4, target: "attack", power: 42 },
];

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
  private bossCinematic: { kind: "intro" | "outro"; startedAt: number; until: number } | null = null;
  private sessionStartedAt = Date.now();
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
      if (this.menu.mode === "status") {
        if (dir === "up" || dir === "down") {
          const delta = dir === "down" ? 1 : -1;
          this.menu.cursor = (this.menu.cursor + delta + this.menu.items.length) % this.menu.items.length;
          this.audio.playSe("move");
        }
        return;
      }
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
        const skills = actor ? this.skillsFor(actor, this.battle.submenu.kind) : [];
        if (!skills.length) return;
        const pageSize = 3;
        const pageCount = Math.max(1, Math.ceil(skills.length / pageSize));
        if (dir === "left" || dir === "right") {
          this.battle.submenu.page = (this.battle.submenu.page + (dir === "left" ? -1 : 1) + pageCount) % pageCount;
          const pageSkills = skills.slice(this.battle.submenu.page * pageSize, this.battle.submenu.page * pageSize + pageSize);
          this.battle.submenu.cursor = Math.min(this.battle.submenu.cursor, Math.max(0, pageSkills.length - 1));
          this.audio.playSe("move");
          return;
        }
        const pageSkills = skills.slice(this.battle.submenu.page * pageSize, this.battle.submenu.page * pageSize + pageSize);
        const delta = dir === "up" ? -1 : 1;
        this.battle.submenu.cursor = (this.battle.submenu.cursor + delta + pageSkills.length) % pageSkills.length;
        this.audio.playSe("move");
        return;
      }
      let next = this.battle.command;
      if (dir === "left" || dir === "right") next = next ^ 1;
      else if (dir === "up" || dir === "down") next = next ^ 2;
      this.battle.command = next;
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
      this.message = this.resolveNpcLines(npc);
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
    if (this.menu.mode === "status") {
      this.menu = this.mainMenu();
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
    if (item === "ステータス") this.openStatusMenu();
    return true;
  }

  private battleA() {
    if (!this.battle) return;
    if (this.battle.waiting) return;
    if (this.battle.won) {
      if (this.battle.levelUpSummary && this.time.now < this.battle.levelUpUntil) return;
      if (this.battle.levelUpSummary) {
        if (this.battle.levelUpPage < this.battle.levelUpSummary.length - 1) {
          this.battle.levelUpPage += 1;
        } else {
          this.battle.levelUpSummary = null;
        }
        this.audio.playSe("confirm");
        return;
      }
      const wonBoss = this.battle.wonBoss;
      if (wonBoss && this.bossCinematic && this.time.now < this.bossCinematic.until) return;
      this.mode = "field";
      if (wonBoss) {
        this.mapId = "forest";
        this.player = { x: 5, y: 8, dir: "down" };
        this.moveAnim = null;
        this.flags.chapter1Complete = true;
        this.battle = null;
        this.message = [
          "オニオンJK: まさか、玉ねぎの力をここまで引き出すとは……。",
          "もじさん: 畑を充実させる野菜を探していたら、妙なやつに絡まれてな。",
          "yos: 10年ぶりでも、頼りになるところは変わらないな。",
          "もじさん: よし、正式に仲間になる。次の旧友探しも手伝おう。",
          "第1章 もじさん加入 完",
        ];
        return;
      }
      this.battle = null;
      return;
    }
    const actor = this.currentActor();
    if (!actor) return;
    if (this.battle.submenu) {
      const skills = this.skillsFor(actor, this.battle.submenu.kind);
      const skill = skills[this.battle.submenu.page * 3 + this.battle.submenu.cursor];
      if (!skill) return;
      if (actor.mp < skill.mp) {
        this.pushBattle(`${skill.name}を使うにはMPが足りない。`);
        this.audio.playSe("cancel");
        return;
      }
      this.announceBattleCue(`${actor.name}の${skill.name}`);
      this.battle.submenu = null;
      this.battle.waiting = true;
      this.battle.actingIndex = this.party.indexOf(actor);
      this.battle.actingUntil = this.time.now + 260;
      this.useSkill(actor, skill);
      this.time.delayedCall(420, () => this.nextActor());
      return;
    }
    const command = this.battleCommands(actor)[this.battle.command];
    if (command === "じゅもん" || command === "ベジタブル") {
      const skills = this.skillsFor(actor, command);
      if (!skills.length) {
        this.pushBattle(`${actor.name}はまだ${command}を覚えていない。`);
        this.audio.playSe("cancel");
        return;
      }
      this.battle.submenu = { kind: command, cursor: 0, page: 0 };
      this.audio.playSe("move");
      return;
    }
    this.announceBattleCue(`${actor.name}の番`);
    this.battle.waiting = true;
    this.battle.actingIndex = this.party.indexOf(actor);
    this.battle.actingUntil = this.time.now + 260;
    if (command === "たたかう") {
      const damage = this.physicalDamage(actor, this.battle.enemy);
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

  private useSkill(actor: PartyMember, skill: SkillDef) {
    if (!this.battle) return;
    actor.mp -= skill.mp;
    if (skill.target === "heal" || skill.target === "allheal") {
      const healTargets = skill.target === "allheal"
        ? this.party.filter((member) => member.hp > 0)
        : [this.party.reduce((low, member) => (member.hp / member.maxHp < low.hp / low.maxHp ? member : low), this.party[0])];
      healTargets.forEach((target, index) => {
        const heal = skill.power + Math.floor(this.totalMagic(actor) * 1.3) + (skill.target === "allheal" ? 4 : 0) + this.equipmentHealBonus(actor);
        target.hp = Math.min(target.maxHp, target.hp + heal);
        this.addBattleEffect("heal", PARTY_BATTLE_X, PARTY_BATTLE_Y + this.party.indexOf(target) * PARTY_BATTLE_GAP);
        this.floatText(PARTY_BATTLE_X, PARTY_BATTLE_Y + 28 + this.party.indexOf(target) * PARTY_BATTLE_GAP, `+${heal}`, "#9df09a");
        if (index === 0) this.audio.playSe("heal");
      });
      this.pushBattle(`${actor.name}は${skill.name}を唱えた。`);
      return;
    }
    const hits = skill.name === "オニオンラッシュ" ? 2 : skill.name === "オニオンブラスト" ? 3 : 1;
    const mult = skill.name === "オニオンソード" ? 1.5 : skill.name === "オニオンラッシュ" ? 0.92 : skill.name === "オニオンブラスト" ? 0.82 : 1.0;
    const base = this.physicalDamage(actor, this.battle.enemy, mult);
    const perHit = Math.max(1, Math.floor(base / hits) + Math.floor(skill.power / hits));
    let totalDamage = 0;
    for (let i = 0; i < hits; i += 1) {
      const damage = Math.min(perHit, this.battle.enemy.hp);
      this.battle.enemy.hp = Math.max(0, this.battle.enemy.hp - damage);
      totalDamage += damage;
      if (i === 0) this.flashEnemy();
    }
    this.audio.playSe("attack");
    this.addBattleEffect("slash", BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 4);
    this.floatText(BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 34, `-${totalDamage}`, "#ffdf7a");
    this.pushBattle(`${actor.name}の${skill.name}！${hits > 1 ? ` ${hits}連撃。` : ""}`);
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
    this.announceBattleCue(`${this.party[nextIndex].name}の番`);
    if (nextIndex <= currentIndex) {
      this.announceBattleCue("敵の番");
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
    const dodgeChance = Math.min(0.3, this.totalEvade(target) / 140);
    if (Math.random() < dodgeChance) {
      this.battle.defending[targetIndex] = false;
      this.flashParty(targetIndex);
      this.audio.playSe("move");
      this.pushBattle(`${target.name}は${this.battle.enemy.name}${action.text}をかわした。`);
      return;
    }
    const baseDamage = action.kind === "magic"
      ? this.damage({ atk: action.atk }, { def: Math.floor(this.totalMagic(target) / 2) })
      : this.damage({ atk: action.atk }, { def: this.totalDef(target) });
    const resisted = this.applyResistance(target, baseDamage, action.kind === "magic" ? "magic" : "physical");
    const damage = guarded ? Math.max(1, Math.floor(resisted / 2)) : resisted;
    if (action.heal && this.battle.enemy.hp > 0) {
      this.battle.enemy.hp = Math.min(this.battle.enemy.maxHp, this.battle.enemy.hp + action.heal);
      this.audio.playSe("heal");
      this.addBattleEffect("heal", BATTLE_ENEMY_X, BATTLE_ENEMY_Y);
      this.floatText(BATTLE_ENEMY_X, BATTLE_ENEMY_Y + 34, `+${action.heal}`, "#9df09a");
      this.pushBattle(`${this.battle.enemy.name}${action.text}`);
      return;
    }
    const hits = action.hits || 1;
    let totalDamage = 0;
    for (let i = 0; i < hits && target.hp > 0; i += 1) {
      target.hp = Math.max(0, target.hp - damage);
      totalDamage += damage;
    }
    if (action.mpDrain) target.mp = Math.max(0, target.mp - action.mpDrain);
    this.battle.defending[targetIndex] = false;
    this.flashParty(targetIndex);
    this.audio.playSe("attack");
    this.addBattleEffect("hit", PARTY_BATTLE_X, PARTY_BATTLE_Y + targetIndex * PARTY_BATTLE_GAP);
    this.floatText(PARTY_BATTLE_X, PARTY_BATTLE_Y + 28 + targetIndex * PARTY_BATTLE_GAP, `-${totalDamage}`, "#ffdf7a");
    this.pushBattle(`${this.battle.enemy.name}${action.text}${target.name}に${totalDamage}ダメージ。${guarded ? " 防御が効いた。" : ""}${action.mpDrain ? ` ${target.name}のMPが減った。` : ""}`);
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
    const hpRate = enemy.hp / enemy.maxHp;
    if (enemy.behavior === "slime") {
      if (hpRate < 0.45 && roll < 0.35) return { atk: enemy.atk - 2, text: "はぷるぷる回復した。", heal: 10 };
      if (roll < 0.35) return { atk: Math.max(1, enemy.atk - 3), text: "は体当たりした。", kind: "physical" };
      if (roll < 0.6) return { atk: Math.max(1, enemy.atk - 1), text: "は跳ね回った。", hits: 2, kind: "physical" };
    }
    if (enemy.behavior === "bat") {
      if (roll < 0.32) return { atk: enemy.atk + 2, text: "は急降下してMPを吸った。", mpDrain: 4, kind: "physical" };
      if (roll < 0.6) return { atk: enemy.atk + 1, text: "は羽ばたきで翻弄した。", hits: 2, kind: "physical" };
    }
    if (enemy.behavior === "knight") {
      if (roll < 0.28) return { atk: enemy.atk + 7, text: "は力を込めて二連斬り。", hits: 2, kind: "physical" };
      if (roll < 0.55) return { atk: enemy.atk + 5, text: "は守りを固めてから斬りかかった。", kind: "physical" };
    }
    if (enemy.behavior === "mage") {
      if (roll < 0.3) return { atk: enemy.atk + 3, text: "は薄毛の呪文でMPを削った。", mpDrain: 5, kind: "magic" };
      if (roll < 0.55) return { atk: enemy.atk + 4, text: "は呪文を重ねてきた。", hits: 2, kind: "magic" };
    }
    if (enemy.behavior === "boss") {
      if (hpRate < 0.55 && roll < 0.3) return { atk: enemy.atk, text: "は玉ねぎの皮をまとった。", heal: 28, kind: "magic" };
      if (roll < 0.24) return { atk: enemy.atk + 10, text: "の玉ねぎ審査。", hits: 2, kind: "physical" };
      if (roll < 0.48) return { atk: enemy.atk + 5, text: "の涙目スライス。", kind: "physical" };
      if (roll < 0.68) return { atk: enemy.atk + 4, text: "は鋭く目を細めた。", mpDrain: 3, kind: "magic" };
    }
    return { atk: enemy.atk, text: "の攻撃。", kind: "physical" };
  }

  private winBattle() {
    if (!this.battle) return;
    const enemy = this.battle.enemy;
    const beforeLevelUps = this.party.map(copyMember);
    this.pushBattle(`${enemy.name}を倒した！`);
    this.gold += enemy.gold;
    this.xp += enemy.xp;
    const bonusRate = Math.max(0, ...this.party.map((member) => this.totalExpBonus(member)));
    const bonusXp = Math.floor(enemy.xp * bonusRate);
    this.party.forEach((member) => {
      member.xp += enemy.xp + bonusXp;
    });
    this.pushBattle(`${enemy.xp + bonusXp}EXPと${enemy.gold}Gを得た。`);
    const summaries = this.applyLevelUps(beforeLevelUps);
    if (this.battle) {
      this.battle.levelUpSummary = summaries;
      this.battle.levelUpPage = 0;
      this.battle.levelUpUntil = summaries.length ? this.time.now + 1200 : 0;
    }
    this.maybeLearnEventSkill();
    this.battle.won = true;
    this.battle.wonBoss = Boolean(enemy.boss);
    this.battle.waiting = false;
    this.battle.submenu = null;
    this.battle.actingIndex = null;
    if (enemy.boss) {
      this.ending = true;
      this.bossCinematic = { kind: "outro", startedAt: this.time.now, until: this.time.now + 1100 };
    }
    if (enemy.boss || !summaries.length) this.audio.playSe("victory");
  }

  private startBattle(kind: "random" | "boss" = "random") {
    const pool = kind === "boss" ? enemyTemplates.boss : this.enemyPoolForMap();
    const template = Phaser.Utils.Array.GetRandom(pool);
    this.mode = "battle";
    this.battle = {
      enemy: { ...template, maxHp: template.hp },
      actor: 0,
      command: 0,
      submenu: null,
      cueText: null,
      cueUntil: 0,
      levelUpSummary: null,
      levelUpPage: 0,
      levelUpUntil: 0,
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
    this.announceBattleCue("戦闘開始");
  }

  private enemyPoolForMap() {
    if (this.mapId === "world") return enemyTemplates.world;
    if (this.mapId === "forest") return enemyTemplates.forest;
    return enemyTemplates.dungeon;
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
      schemaVersion: 2,
      mapId: this.mapId,
      player: this.player,
      party: this.party,
      joined: this.joined,
      flags: this.flags,
      storyFlags: { ...this.flags },
      items: this.items,
      inventory: this.inventory,
      gold: this.gold,
      xp: this.xp,
      ending: this.ending,
      chests: this.chestState(),
      playTimeMs: Date.now() - this.sessionStartedAt,
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
    this.flags = { ...(data.flags || {}), ...(data.storyFlags || {}) };
    this.applyChestState(data.chests);
    this.mode = "field";
    this.battle = null;
    this.encounterEffect = null;
    this.sessionStartedAt = Date.now() - (data.playTimeMs || 0);
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
      schemaVersion: data.schemaVersion ?? 1,
      mapId: data.mapId,
      player: data.player,
      party: data.party.map((member) => normalizeMember({ ...member, xp: member.xp ?? (member.name === "yos" ? data.xp : undefined) })),
      joined: data.joined || { yos: true },
      flags: data.flags || {},
      storyFlags: data.storyFlags || data.flags || {},
      items: data.items || { やくそう: 3, まほうの水: 1 },
      inventory: data.inventory || { stick: data.party.length, cloth: data.party.length },
      gold: data.gold ?? 60,
      xp: data.xp ?? 0,
      ending: data.ending || false,
      chests: data.chests || {},
      savedAt: data.savedAt,
      playTimeMs: data.playTimeMs || 0,
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
    if (this.mapId === "world") return "world";
    if (this.mapId === "village") return "village";
    if (this.mapId === "forest") return "forest";
    return "dungeon";
  }

  private startNewGame() {
    this.mode = "field";
    this.mapId = "world";
    this.player = { x: 3, y: 11, dir: "up" };
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
    this.bossCinematic = null;
    this.sessionStartedAt = Date.now();
    this.resetChestState();
    this.message = ["60歳でリタイヤしたyosの第二の人生が始まる。まずはフィールドの村へ向かおう。"];
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
    this.text(WIDTH / 2, 104, "HIGEBALL", DISPLAY.D4, "#ffe58a", "center");
    this.text(WIDTH / 2, 140, "QUEST", DISPLAY.D3, "#fff3cb", "center");
    this.panel(48, 330, 264, 108);
    ["はじめから", "つづきから"].forEach((item, i) => {
      const y = 366 + i * 28;
      if (i === this.titleCursor) {
        this.graphics.fillStyle(0xffffff, 0.14);
        this.graphics.fillRect(76, y - 12, 208, 23);
      }
      this.text(WIDTH / 2, y, `${i === this.titleCursor ? "> " : "  "}${item}`, FONT.L, i === this.titleCursor ? COLORS.text.accent : COLORS.text.primary, "center");
    });
    this.text(WIDTH / 2, 424, "A:決定 / B:ロード", FONT.S, COLORS.text.muted, "center");
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
    this.drawMapTint(map, ox, oy, tile);
    if (this.mapId === "world") {
      this.drawWorldRoutes(ox, oy, tile);
      map.exits.forEach((exit) => this.drawWorldIcon(exit, ox, oy, tile));
    } else {
      map.exits.forEach((exit) => {
        this.drawStairs(ox + exit.x * tile, oy + exit.y * tile, tile);
        this.drawExitMarker(ox + exit.x * tile + tile / 2, oy + exit.y * tile + tile / 2);
      });
    }
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
    this.drawBossCinematic(map, ox, oy, tile);
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
    if (this.mapId === "world") {
      this.drawWorldAtmosphere(ox, oy, tile);
      return;
    }
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

  private drawMapTint(map: GameMap, ox: number, oy: number, tile: number) {
    const width = map.tiles[0].length * tile;
    const height = map.tiles.length * tile;
    const tint = this.mapId === "world"
      ? { color: 0x9de0ff, alpha: 0.04 }
      : this.mapId === "village"
        ? { color: 0xffcf8d, alpha: 0.08 }
        : this.mapId === "forest"
          ? { color: 0x7bd18b, alpha: 0.12 }
          : { color: 0x0c1120, alpha: this.mapId === "dungeon3" ? 0.22 : 0.16 };
    this.graphics.fillStyle(tint.color, tint.alpha);
    this.graphics.fillRect(ox, oy, width, height);
  }

  private drawWorldAtmosphere(ox: number, oy: number, tile: number) {
    this.graphics.fillStyle(0x8ab86a, 0.12);
    this.graphics.fillRect(ox + 1.2 * tile, oy + 1.1 * tile, 3.5 * tile, 2.1 * tile);
    this.graphics.fillRect(ox + 6.2 * tile, oy + 2.1 * tile, 3.4 * tile, 2.2 * tile);
    this.graphics.fillStyle(0x5d8fdf, 0.14);
    this.graphics.fillRect(ox + 8.5 * tile, oy + 7.3 * tile, 2.8 * tile, 3.2 * tile);
    this.graphics.fillStyle(0xe7e7ef, 0.34);
    this.graphics.fillEllipse(ox + 2.5 * tile, oy + 2.2 * tile, 46, 14);
    this.graphics.fillEllipse(ox + 8.8 * tile, oy + 1.8 * tile, 42, 12);
    this.graphics.fillEllipse(ox + 5.4 * tile, oy + 4.1 * tile, 36, 10);
  }

  private drawWorldRoutes(ox: number, oy: number, tile: number) {
    this.graphics.lineStyle(5, 0xc49b62, 0.5);
    this.graphics.lineBetween(ox + 2.1 * tile, oy + 10.2 * tile, ox + 4.7 * tile, oy + 8.8 * tile);
    this.graphics.lineBetween(ox + 4.7 * tile, oy + 8.8 * tile, ox + 7.0 * tile, oy + 7.6 * tile);
    this.graphics.lineBetween(ox + 7.0 * tile, oy + 7.6 * tile, ox + 8.9 * tile, oy + 4.4 * tile);
    this.graphics.lineStyle(2, 0xffe58a, 0.42);
    this.graphics.lineBetween(ox + 2.1 * tile, oy + 10.2 * tile, ox + 4.7 * tile, oy + 8.8 * tile);
    this.graphics.lineBetween(ox + 4.7 * tile, oy + 8.8 * tile, ox + 7.0 * tile, oy + 7.6 * tile);
    this.graphics.lineBetween(ox + 7.0 * tile, oy + 7.6 * tile, ox + 8.9 * tile, oy + 4.4 * tile);
  }

  private drawWorldIcon(exit: Exit, ox: number, oy: number, tile: number) {
    const x = ox + exit.x * tile + tile / 2;
    const y = oy + exit.y * tile + tile / 2;
    const pulse = 0.52 + Math.sin(this.time.now * 0.005 + exit.x) * 0.12;
    if (exit.to === "village") {
      this.graphics.fillStyle(0x4d85a5, pulse);
      this.graphics.fillCircle(x, y - 10, 14);
      this.graphics.fillStyle(0xa8473d);
      this.graphics.fillTriangle(x, y - 18, x - 14, y - 2, x + 14, y - 2);
      this.graphics.fillStyle(0xe7dfc6);
      this.graphics.fillRect(x - 12, y - 2, 24, 16);
      this.graphics.fillStyle(0x8b5a38);
      this.graphics.fillRect(x - 4, y + 4, 8, 10);
      return;
    }
    if (exit.to === "forest") {
      this.graphics.fillStyle(0x63a05a, pulse);
      this.graphics.fillCircle(x, y - 10, 14);
      this.graphics.fillStyle(0x7b3f35);
      this.graphics.fillTriangle(x - 2, y - 18, x - 16, y - 2, x + 12, y - 2);
      this.graphics.fillStyle(0xc8d88a);
      this.graphics.fillRect(x - 13, y - 1, 26, 14);
      this.graphics.fillStyle(0x8b5a38);
      this.graphics.fillRect(x + 7, y - 8, 4, 21);
      this.graphics.fillStyle(0x395b34);
      this.graphics.fillRect(x - 14, y + 6, 6, 4);
      return;
    }
    this.graphics.fillStyle(0xf3d17b, pulse);
    this.graphics.fillCircle(x, y - 8, 16);
    this.graphics.fillStyle(0x5c3035);
    this.graphics.fillTriangle(x, y - 18, x - 16, y + 6, x + 16, y + 6);
    this.graphics.fillStyle(0x17191f);
    this.graphics.fillRect(x - 10, y - 1, 20, 12);
    this.graphics.fillStyle(0x3d4652);
    this.graphics.fillRect(x - 4, y - 10, 8, 8);
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

  private drawBossCinematic(map: GameMap, ox: number, oy: number, tile: number) {
    if (!this.bossCinematic) return;
    if (this.time.now >= this.bossCinematic.until) {
      this.bossCinematic = null;
      return;
    }
    const progress = Phaser.Math.Clamp((this.time.now - this.bossCinematic.startedAt) / (this.bossCinematic.until - this.bossCinematic.startedAt), 0, 1);
    const fade = this.bossCinematic.kind === "intro" ? Math.sin(progress * Math.PI) : 1 - progress;
    const boss = map.boss || { x: 5, y: 9 };
    const bx = ox + boss.x * tile + tile / 2;
    const by = oy + boss.y * tile + tile * 0.62;
    this.graphics.fillStyle(0x05060a, 0.28 + fade * 0.28);
    this.graphics.fillRect(0, 0, WIDTH, HEIGHT);
    this.graphics.lineStyle(3, this.bossCinematic.kind === "intro" ? 0xffe58a : 0xf8f3dc, 0.75 * fade);
    this.graphics.strokeCircle(bx, by, 30 + fade * 28);
    this.graphics.lineStyle(2, this.bossCinematic.kind === "intro" ? 0xff9fdb : 0x9df09a, 0.55 * fade);
    for (let i = 0; i < 4; i += 1) {
      const offset = (i - 1.5) * 10;
      this.graphics.lineBetween(bx - 40, by + offset, bx + 40, by - offset);
    }
    this.text(WIDTH / 2, this.bossCinematic.kind === "intro" ? 40 : 54, this.bossCinematic.kind === "intro" ? "オニオンJK との対峙" : "ボス撃破", DISPLAY.D1, COLORS.text.primary, "center");
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
    this.panel(LAYOUT.HUD.x, LAYOUT.HUD.y, LAYOUT.HUD.w, LAYOUT.HUD.h);
    this.text(20, 23, maps[this.mapId].name, FONT.M, "#ffe58a");
    this.text(20, 41, `${this.gold}G  薬:${this.items["やくそう"] || 0}  水:${this.items["まほうの水"] || 0}`, FONT.S);
    const rows = this.party.slice(0, 3);
    rows.forEach((member, i) => {
      const y = 19 + i * 16;
      const color = member.hp <= 0 ? COLORS.text.disabled : COLORS.text.primary;
      this.text(154, y, member.name, FONT.S, color);
      this.text(210, y, `Lv ${member.lv}`, FONT.XS, color);
      this.text(246, y, `${member.hp}/${member.maxHp}`, FONT.XS, member.hp <= 0 ? COLORS.text.disabled : COLORS.text.primary);
      this.drawHpBar(282, y - 1, 58, 5, member.hp, member.maxHp);
    });
  }

  private drawBattlePanel() {
    if (!this.battle) return;
    this.ffWindow(LAYOUT.BATTLE.MSG.x, LAYOUT.BATTLE.MSG.y, LAYOUT.BATTLE.MSG.w, LAYOUT.BATTLE.MSG.h);
    const logText = this.battle.log.at(-1) || "";
    const cueActive = this.battle.cueText && this.time.now < this.battle.cueUntil;
    if (cueActive && this.battle.cueText) {
      this.text(180, PANEL_Y + 18, this.battle.cueText, FONT.S, COLORS.text.accent, "center");
    } else {
      fitLines(logText, 320, FONT.S).slice(0, 3).forEach((line, i) => this.text(20, PANEL_Y + 20 + i * 15, line, FONT.S));
    }
    this.ffWindow(LAYOUT.BATTLE.STATUS.x, LAYOUT.BATTLE.STATUS.y, LAYOUT.BATTLE.STATUS.w, LAYOUT.BATTLE.STATUS.h);
    if (this.battle.won) {
      this.ffWindow(LAYOUT.BATTLE.CMD.x, LAYOUT.BATTLE.CMD.y, LAYOUT.BATTLE.CMD.w, LAYOUT.BATTLE.CMD.h);
      if (this.battle.levelUpSummary?.length) {
        this.drawLevelUpSummary(this.battle.levelUpSummary);
        return;
      }
      if (this.battle.wonBoss && this.bossCinematic && this.time.now < this.bossCinematic.until) {
        this.text(252, PANEL_Y + 104, "オニオンJK 撃破", FONT.L, COLORS.text.primary, "center");
        this.text(252, PANEL_Y + 128, "山頂の空気が変わった。", FONT.S, COLORS.text.muted, "center");
      } else {
        this.text(252, PANEL_Y + 118, "Aで進む", FONT.L, COLORS.text.accent, "center");
      }
      return;
    }
    const actor = this.currentActor();
    this.ffWindow(LAYOUT.BATTLE.CMD.x, LAYOUT.BATTLE.CMD.y, LAYOUT.BATTLE.CMD.w, LAYOUT.BATTLE.CMD.h);
    const commands = actor ? this.battleCommands(actor) : [];
    const cells = [
      { x: 160, y: PANEL_Y + 84, w: 88, h: 18 },
      { x: 252, y: PANEL_Y + 84, w: 88, h: 18 },
      { x: 160, y: PANEL_Y + 104, w: 88, h: 18 },
      { x: 252, y: PANEL_Y + 104, w: 88, h: 18 },
    ];
    commands.forEach((command, i) => {
      const cell = cells[i];
      const selected = i === this.battle?.command;
      if (selected) {
        this.graphics.fillStyle(0xffffff, 0.15);
        this.graphics.fillRect(cell.x - 8, cell.y - 2, cell.w, cell.h);
      }
      this.text(cell.x, cell.y + 7, `${selected ? ">" : " "}${command}`, FONT.M, selected ? COLORS.text.accent : COLORS.text.primary);
    });
    if (this.battle.waiting) this.text(206, PANEL_Y + 157, "行動中", FONT.S, COLORS.text.muted, "center");
    if (!this.battle.submenu) this.text(160, PANEL_Y + 72, actor ? `${actor.name}  ${actor.job}` : "", FONT.S, COLORS.text.accent);
    this.party.forEach((member, i) => {
      const rowY = PANEL_Y + 74 + i * 16;
      const active = actor?.name === member.name && !this.battle?.won;
      if (this.battle?.submenu) return;
      if (active) {
        this.graphics.fillStyle(0xffffff, 0.12);
        this.graphics.fillRect(8, rowY - 8, 132, 14);
      }
      const color = member.hp <= 0 ? COLORS.text.disabled : COLORS.text.primary;
      this.text(12, rowY, member.name, FONT.S, color);
      this.text(52, rowY, `HP ${member.hp}/${member.maxHp}`, FONT.XS, color);
      this.text(108, rowY, `MP ${member.mp}`, FONT.XS, color);
    });
    if (this.battle.submenu && actor) this.drawSkillSubwindow(actor);
  }

  private drawLevelUpSummary(summaries: LevelUpSummary[]) {
    const page = Phaser.Math.Clamp(this.battle?.levelUpPage || 0, 0, summaries.length - 1);
    const summary = summaries[page];
    this.ffWindow(LAYOUT.MENU.WIDE.x, LAYOUT.MENU.WIDE.y, LAYOUT.MENU.WIDE.w, LAYOUT.MENU.WIDE.h);
    this.text(180, 98, "レベルアップ", FONT.L, COLORS.text.accent, "center");
    this.text(44, 124, `${summary.name}  ${summary.job}`, FONT.M, COLORS.text.primary);
    this.text(274, 124, `${page + 1}/${summaries.length}`, FONT.S, COLORS.text.muted, "center");

    this.graphics.fillStyle(0xffffff, 0.08);
    this.graphics.fillRect(34, 138, 292, 116);
    this.graphics.lineStyle(1, 0xe7e7ef, 0.28);
    this.graphics.lineBetween(106, 140, 106, 252);
    this.graphics.lineBetween(196, 140, 196, 252);
    this.graphics.lineBetween(238, 140, 238, 252);
    this.text(62, 153, "能力", FONT.XS, COLORS.text.muted, "center");
    this.text(152, 153, "前", FONT.XS, COLORS.text.muted, "center");
    this.text(217, 153, "→", FONT.S, COLORS.text.accent, "center");
    this.text(282, 153, "後", FONT.XS, COLORS.text.muted, "center");

    const rows = [
      ["Lv", summary.lvBefore, summary.lvAfter],
      ["HP", summary.hpBefore, summary.hpAfter],
      ["MP", summary.mpBefore, summary.mpAfter],
      ["力", summary.strengthBefore, summary.strengthAfter],
      ["体", summary.staminaBefore, summary.staminaAfter],
      ["速", summary.speedBefore, summary.speedAfter],
      ["魔", summary.magicBefore, summary.magicAfter],
      ["回", summary.evadeBefore, summary.evadeAfter],
    ] as const;
    rows.forEach(([label, before, after], i) => {
      const y = 174 + Math.floor(i / 2) * 19;
      const x = i % 2 === 0 ? 44 : 178;
      this.drawStatChange(x, y, label, before, after);
    });
    if (summary.learned.length) this.text(44, 264, `習得 ${summary.learned.join(" / ")}`, FONT.XS, COLORS.text.mpAccent);
    this.text(180, 276, page < summaries.length - 1 ? "A:次の仲間" : this.battle?.wonBoss ? "A:次へ" : "A:閉じる", FONT.M, COLORS.text.accent, "center");
  }

  private drawStatChange(x: number, y: number, label: string, before: number, after: number) {
    const changed = before !== after;
    this.text(x, y, label, FONT.XS, changed ? COLORS.text.accent : COLORS.text.muted);
    this.text(x + 46, y, String(before), FONT.XS, COLORS.text.primary, "center");
    this.text(x + 78, y, "→", FONT.XS, COLORS.text.muted, "center");
    this.text(x + 112, y, String(after), FONT.XS, changed ? COLORS.text.mpAccent : COLORS.text.primary, "center");
  }

  private battleCommands(actor: PartyMember) {
    return ["たたかう", actor.name === "もじさん" ? "ベジタブル" : "じゅもん", "ぼうぎょ", "もちもの"];
  }

  private skillsFor(actor: PartyMember, family?: "じゅもん" | "ベジタブル"): SkillDef[] {
    return actor.skills
      .map((name) => skillCatalog.find((skill) => skill.name === name))
      .filter((skill): skill is SkillDef => Boolean(skill))
      .filter((skill) => actor.lv >= skill.minLv && (!family || skill.family === family));
  }

  private drawSkillSubwindow(actor: PartyMember) {
    if (!this.battle?.submenu) return;
    const submenu = this.battle.submenu;
    const skills = this.skillsFor(actor, submenu.kind);
    const pageSize = 3;
    const pageCount = Math.max(1, Math.ceil(skills.length / pageSize));
    submenu.page = Phaser.Math.Clamp(submenu.page, 0, pageCount - 1);
    submenu.cursor = Phaser.Math.Clamp(submenu.cursor, 0, Math.min(pageSize, skills.length - submenu.page * pageSize) - 1);
    const start = submenu.page * pageSize;
    const pageSkills = skills.slice(start, start + pageSize);
    this.subWindow(LAYOUT.BATTLE.SUBMENU.x, LAYOUT.BATTLE.SUBMENU.y, LAYOUT.BATTLE.SUBMENU.w, LAYOUT.BATTLE.SUBMENU.h, {
      x: LAYOUT.BATTLE.CMD.x,
      y: LAYOUT.BATTLE.CMD.y,
      w: LAYOUT.BATTLE.CMD.w,
      h: LAYOUT.BATTLE.CMD.h,
    });
    this.text(28, 326, `${actor.name} ${submenu.kind}`, FONT.S, COLORS.text.accent);
    this.text(182, 326, pageCount > 1 ? `${submenu.page + 1}/${pageCount}` : "", FONT.XS, COLORS.text.muted, "center");
    pageSkills.forEach((skill, i) => {
      const y = 348 + i * 24;
      const selected = i === submenu.cursor;
      if (selected) {
        this.graphics.fillStyle(0xffffff, 0.15);
        this.graphics.fillRect(20, y - 9, 184, 20);
      }
      const color = actor.mp < skill.mp ? COLORS.text.disabled : selected ? COLORS.text.accent : COLORS.text.primary;
      this.text(28, y, `${selected ? ">" : " "}${skill.name}`, FONT.M, color);
      this.text(178, y, `MP ${skill.mp}`, FONT.S, color, "center");
      this.text(28, y + 12, skill.description, FONT.S, COLORS.text.muted);
    });
    const skill = pageSkills[submenu.cursor];
    if (skill) this.text(28, 402, `MP${skill.mp} ${skill.description}`, FONT.S, actor.mp < skill.mp ? COLORS.text.danger : COLORS.text.muted);
    else this.text(28, 402, "覚えている技がない。", FONT.S, COLORS.text.muted);
  }

  private drawEnemyStatus() {
    if (!this.battle) return;
    this.text(54, 94, this.battle.enemy.name, FONT.M, COLORS.text.primary, "center");
    this.drawHpBar(62, 104, 84, 6, this.battle.enemy.hp, this.battle.enemy.maxHp);
  }

  private drawHpBar(x: number, y: number, w: number, h: number, value: number, max: number) {
    const ratio = Phaser.Math.Clamp(value / max, 0, 1);
    this.graphics.fillStyle(0x10151d, 0.86);
    this.graphics.fillRect(x, y, w, h);
    const color = ratio < 0.25 ? 0xff7a6a : ratio <= 0.5 ? 0xf5d36a : 0x7adb7a;
    this.graphics.fillStyle(color);
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
    if (this.menu.mode === "status") {
      this.drawStatusMenu();
      return;
    }
    const box = this.menu.mode === "shop" || this.menu.mode === "equip" || this.menu.mode === "equipGear" || this.menu.mode === "items" || this.menu.mode === "save" || this.menu.mode === "load" ? LAYOUT.MENU.NARROW : LAYOUT.MENU.MAIN;
    this.panel(box.x, box.y, box.w, box.h);
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
    this.text(box.x + 16, box.y + 26, title, FONT.M, COLORS.text.accent);
    this.menu.items.forEach((item, i) => {
      const y = box.y + 58 + i * 22;
      const selected = i === this.menu?.cursor;
      if (selected) {
        this.graphics.fillStyle(0xffffff, 0.12);
        this.graphics.fillRect(box.x + 10, y - 10, box.w - 20, 18);
      }
      this.text(box.x + 16, y, `${selected ? ">" : " "}${item}`, this.menu?.mode === "save" || this.menu?.mode === "load" ? FONT.S : FONT.M, selected ? COLORS.text.accent : COLORS.text.primary);
    });
    if (this.menu.mode === "shop") this.drawShopHelp();
    if (this.menu.mode === "equip") this.text(44, 326, "A:選ぶ / B:戻る", FONT.S, COLORS.text.muted);
    if (this.menu.mode === "equipGear") this.drawEquipHelp();
  }

  private drawStatusMenu() {
    if (!this.menu) return;
    const member = this.party[this.menu.cursor] || this.party[0];
    this.panel(LAYOUT.MENU.STATUS.x, LAYOUT.MENU.STATUS.y, LAYOUT.MENU.STATUS.w, LAYOUT.MENU.STATUS.h);
    this.text(36, 112, "ステータス", FONT.L, COLORS.text.accent);
    this.text(36, 136, "↑↓:切替  A/B:戻る", FONT.XS, COLORS.text.muted);
    this.party.forEach((entry, i) => {
      const y = 166 + i * 26;
      if (i === this.menu!.cursor) this.graphics.fillStyle(0xffffff, 0.12), this.graphics.fillRect(30, y - 10, 118, 18);
      this.text(38, y, `${i === this.menu!.cursor ? ">" : " "} ${entry.name} Lv${entry.lv}`, FONT.S, i === this.menu!.cursor ? COLORS.text.accent : COLORS.text.primary);
      this.text(132, y, `HP ${entry.hp}/${entry.maxHp} MP ${entry.mp}/${entry.maxMp}`, FONT.S, entry.hp <= 0 ? COLORS.text.disabled : COLORS.text.primary);
    });
    this.text(182, 140, `${member.name} ${member.job}`, FONT.S, COLORS.text.accent);
    this.text(182, 162, `Lv ${member.lv}  EXP ${member.xp}`, FONT.S);
    this.text(182, 184, `HP ${member.hp}/${member.maxHp}`, FONT.S);
    this.text(182, 204, `MP ${member.mp}/${member.maxMp}`, FONT.S);
    this.text(182, 228, `力 ${this.totalAtk(member)}`, FONT.S);
    this.text(182, 248, `体 ${this.totalDef(member)}`, FONT.S);
    this.text(182, 268, `速 ${this.totalSpd(member)}`, FONT.S);
    this.text(182, 288, `魔 ${this.totalMagic(member)}`, FONT.S);
    this.text(182, 308, `回 ${this.totalEvade(member)}`, FONT.S);
    this.text(182, 328, `命中 ${this.accuracy(member)}%`, FONT.XS, COLORS.text.muted);
    this.text(182, 346, `耐性 ${this.resistanceLabel(member)}`, FONT.XS, COLORS.text.muted);
    this.text(182, 364, `武 ${this.equipmentName(member.weapon)}`, FONT.XS, COLORS.text.muted);
    this.text(182, 382, `防 ${this.equipmentName(member.armor)}`, FONT.XS, COLORS.text.muted);
    const skills = member.skills.filter((name) => this.skillsFor(member).some((skill) => skill.name === name));
    this.text(182, 398, `技 ${skills.join(" / ") || "-"}`, FONT.XS, COLORS.text.muted);
    this.text(182, 412, `EXPボーナス ${Math.round(this.totalExpBonus(member) * 100)}%`, FONT.XS, COLORS.text.muted);
  }

  private drawShopHelp() {
    if (!this.menu?.shopType) return;
    const id = shopStock[this.menu.shopType][this.menu.cursor];
    const entry = catalog[id];
    if (!entry) return;
    const owned = entry.kind === "item" ? this.items[entry.name] || 0 : this.inventory[entry.id] || 0;
    const users = entry.users?.join("/") || "全員";
    this.text(44, 286, `所持 ${owned}  装備 ${users}`, FONT.S, COLORS.text.muted);
    this.text(44, 310, this.gold >= entry.price ? "A:購入 / B:閉じる" : "お金が足りない", FONT.S, this.gold >= entry.price ? COLORS.text.muted : COLORS.text.danger);
  }

  private drawEquipHelp() {
    if (this.menu?.memberIndex === undefined) return;
    const member = this.party[this.menu.memberIndex];
    if (!member) return;
    this.text(44, 286, `現在 武:${this.equipmentName(member.weapon)} 防:${this.equipmentName(member.armor)}`, FONT.S, COLORS.text.muted);
    this.text(44, 308, this.equipmentTraitsText(member.weapon, "武器") || "武器の特性なし", FONT.XS, COLORS.text.muted);
    this.text(44, 328, this.equipmentTraitsText(member.armor, "防具") || "防具の特性なし", FONT.XS, COLORS.text.muted);
    this.text(44, 350, "A:装備 / B:戻る", FONT.S, COLORS.text.muted);
  }

  private drawMessage(message: string) {
    const parsed = this.parseMessage(message);
    if (this.mode === "field") {
      this.graphics.fillStyle(COLORS.window.dimOverlay.color, COLORS.window.dimOverlay.alphaField);
      this.graphics.fillRect(0, 0, WIDTH, PANEL_Y + 12);
    }
    this.panel(LAYOUT.MESSAGE.x, LAYOUT.MESSAGE.y, LAYOUT.MESSAGE.w, LAYOUT.MESSAGE.h);
    const lines = this.messageLines(message);
    const hasMore = lines.length > 4 || this.message.length > 1;
    if (parsed.speaker) {
      this.panel(LAYOUT.MESSAGE_PORTRAIT.x, LAYOUT.MESSAGE_PORTRAIT.y, LAYOUT.MESSAGE_PORTRAIT.w, LAYOUT.MESSAGE_PORTRAIT.h);
      this.drawSpeakerPortrait(parsed.speaker, 50, PANEL_Y + 80);
      this.graphics.fillStyle(0x10151d, 0.92);
      this.graphics.fillRect(LAYOUT.MESSAGE_SPEAKER.x, LAYOUT.MESSAGE_SPEAKER.y, LAYOUT.MESSAGE_SPEAKER.w, LAYOUT.MESSAGE_SPEAKER.h);
      this.graphics.lineStyle(1, colors.border, 0.75);
      this.graphics.strokeRect(LAYOUT.MESSAGE_SPEAKER.x, LAYOUT.MESSAGE_SPEAKER.y, LAYOUT.MESSAGE_SPEAKER.w, LAYOUT.MESSAGE_SPEAKER.h);
      this.text(90, PANEL_Y + 38, parsed.speaker, FONT.S, COLORS.text.accent);
      fitLines(parsed.body, parsed.speaker ? 240 : 308, FONT.M).slice(0, 4).forEach((line, i) => this.text(90, PANEL_Y + 62 + i * 20, line, FONT.M));
    } else {
      fitLines(parsed.body, 308, FONT.M).slice(0, 4).forEach((line, i) => this.text(28, PANEL_Y + 44 + i * 22, line, FONT.M));
    }
    this.drawContinueCue(hasMore);
    this.text(216, PANEL_Y + 138, hasMore ? "A:次へ / B:閉じる" : "A/B:閉じる", FONT.S, COLORS.text.accent);
  }

  private parseMessage(message: string) {
    const match = message.match(/^([^:：]{1,10})[:：]\s*(.+)$/);
    return match ? { speaker: match[1], body: match[2] } : { speaker: "", body: message };
  }

  private messageLines(message: string) {
    const parsed = this.parseMessage(message);
    return fitLines(parsed.body, parsed.speaker ? 240 : 308, FONT.M);
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
    this.text(WIDTH / 2, FIELD_TOP + 154, "!", DISPLAY.D3, COLORS.text.primary, "center");
  }

  private drawTopLabel(label: string) {
    this.graphics.fillStyle(0x12151b, 0.65);
    this.graphics.fillRect(112, 104, 136, 28);
    this.graphics.lineStyle(1, colors.border, 0.7);
    this.graphics.strokeRect(112, 104, 136, 28);
    this.text(180, 123, label, FONT.M, COLORS.text.primary, "center");
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
    this.graphics.fillGradientStyle(COLORS.window.ffTop, COLORS.window.ffTop, COLORS.window.ffBottom, COLORS.window.ffBottom, 0.96);
    this.graphics.fillRoundedRect(x, y, w, h, 4);
    this.graphics.lineStyle(3, COLORS.window.ffBorder, 0.95);
    this.graphics.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 4);
    this.graphics.lineStyle(1, COLORS.window.ffInset, 0.9);
    this.graphics.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 2);
  }

  private subWindow(x: number, y: number, w: number, h: number, parent?: { x: number; y: number; w: number; h: number }) {
    if (parent) {
      this.graphics.fillStyle(COLORS.window.dimOverlay.color, COLORS.window.dimOverlay.alphaSubmenu);
      this.graphics.fillRect(parent.x, parent.y, parent.w, parent.h);
    }
    this.ffWindow(x, y, w, h);
  }

  private text(x: number, y: number, value: string, size = 14, color = "#fff3cb", align: "left" | "center" = "left") {
    const label = this.add.text(Math.round(x), Math.round(y), value, {
      fontFamily: UI_FONT,
      fontSize: `${size}px`,
      color,
      resolution: TEXT_RESOLUTION,
    });
    label.setPadding(4, 2, 4, 2);
    label.setOrigin(align === "center" ? 0.5 : 0, 0.5);
    this.labels.push(label);
  }

  private floatText(x: number, y: number, value: string, color: string) {
    const label = this.add.text(Math.round(x), Math.round(y), value, { fontFamily: UI_FONT, fontSize: "18px", color, fontStyle: "bold", resolution: TEXT_RESOLUTION });
    label.setPadding(4, 2, 4, 2);
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
    this.audio.playSe("equip");
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

  private openStatusMenu() {
    this.menu = {
      mode: "status",
      cursor: 0,
      items: this.party.map((member) => member.name),
    };
    this.audio.playSe("equip");
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
    return member.strength + (catalog[member.weapon || ""]?.atk || 0) + this.equipmentAtkBonus(member);
  }

  private totalDef(member: PartyMember) {
    return member.stamina + (catalog[member.armor || ""]?.def || 0) + this.equipmentDefBonus(member);
  }

  private totalSpd(member: PartyMember) {
    return member.spd + this.equipmentSpeedBonus(member);
  }

  private totalMagic(member: PartyMember) {
    return member.magicPower + this.equipmentMagicBonus(member);
  }

  private totalEvade(member: PartyMember) {
    return member.evade + this.equipmentEvadeBonus(member);
  }

  private equipmentEntry(member: PartyMember, kind: "weapon" | "armor") {
    const id = kind === "weapon" ? member.weapon : member.armor;
    return id ? catalog[id] : undefined;
  }

  private equipmentAtkBonus(member: PartyMember) {
    return this.equipmentEntry(member, "weapon")?.traits?.atk || 0;
  }

  private equipmentDefBonus(member: PartyMember) {
    return this.equipmentEntry(member, "armor")?.traits?.def || 0;
  }

  private equipmentSpeedBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.speed || 0) + (this.equipmentEntry(member, "armor")?.traits?.speed || 0);
  }

  private equipmentMagicBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.magic || 0) + (this.equipmentEntry(member, "armor")?.traits?.magic || 0);
  }

  private equipmentEvadeBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.evade || 0) + (this.equipmentEntry(member, "armor")?.traits?.evade || 0);
  }

  private equipmentHealBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.heal || 0) + (this.equipmentEntry(member, "armor")?.traits?.heal || 0);
  }

  private equipmentCritBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.crit || 0) + (this.equipmentEntry(member, "armor")?.traits?.crit || 0);
  }

  private equipmentHitBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.hit || 0) + (this.equipmentEntry(member, "armor")?.traits?.hit || 0);
  }

  private totalExpBonus(member: PartyMember) {
    return this.equipmentExpBonus(member);
  }

  private equipmentTraitsText(id?: string, label = "") {
    if (!id) return "";
    const entry = catalog[id];
    if (!entry) return "";
    const parts: string[] = [];
    if (entry.atk) parts.push(`攻+${entry.atk}`);
    if (entry.def) parts.push(`守+${entry.def}`);
    if (entry.traits?.atk) parts.push(`力+${entry.traits.atk}`);
    if (entry.traits?.def) parts.push(`体+${entry.traits.def}`);
    if (entry.traits?.speed) parts.push(`速${entry.traits.speed > 0 ? "+" : ""}${entry.traits.speed}`);
    if (entry.traits?.magic) parts.push(`魔+${entry.traits.magic}`);
    if (entry.traits?.evade) parts.push(`回+${entry.traits.evade}`);
    if (entry.traits?.hit) parts.push(`命+${entry.traits.hit}`);
    if (entry.traits?.crit) parts.push(`会心+${Math.round(entry.traits.crit * 100)}%`);
    if (entry.traits?.heal) parts.push(`回復+${entry.traits.heal}`);
    if (entry.traits?.exp) parts.push(`EXP+${Math.round(entry.traits.exp * 100)}%`);
    if (entry.traits?.mp) parts.push(`MP+${entry.traits.mp}`);
    if (entry.traits?.resist?.length) parts.push(`耐性 ${entry.traits.resist.join("/")}`);
    return `${label ? `${label} ` : ""}${parts.join(" / ")}`.trim();
  }

  private resistanceLabel(member: PartyMember) {
    const entries = [this.equipmentEntry(member, "weapon"), this.equipmentEntry(member, "armor")];
    const resist = [...new Set(entries.flatMap((entry) => entry?.traits?.resist || []))];
    return resist.length ? resist.join("/") : "なし";
  }

  private equipmentExpBonus(member: PartyMember) {
    return (this.equipmentEntry(member, "weapon")?.traits?.exp || 0) + (this.equipmentEntry(member, "armor")?.traits?.exp || 0);
  }

  private accuracy(member: PartyMember) {
    return Math.min(99, 84 + this.totalSpd(member) + this.equipmentHitBonus(member));
  }

  private physicalResistance(member: PartyMember) {
    const traits = [this.equipmentEntry(member, "weapon")?.traits, this.equipmentEntry(member, "armor")?.traits];
    return traits.reduce((sum, trait) => sum + (trait?.resist?.includes("物理") ? 0.12 : 0), 0);
  }

  private magicResistance(member: PartyMember) {
    const traits = [this.equipmentEntry(member, "weapon")?.traits, this.equipmentEntry(member, "armor")?.traits];
    return traits.reduce((sum, trait) => sum + (trait?.resist?.includes("魔法") ? 0.18 : 0), 0);
  }

  private physicalDamage(member: PartyMember, enemy: Enemy, multiplier = 1) {
    const raw = Math.max(1, this.damage({ atk: this.totalAtk(member) }, enemy) * multiplier);
    const hit = Math.random() < this.accuracy(member) / 120;
    const crit = Math.random() < this.equipmentCritBonus(member);
    return Math.max(1, Math.floor((hit ? raw : raw * 0.5) * (crit ? 1.5 : 1)));
  }

  private applyResistance(target: PartyMember, damage: number, kind: "physical" | "magic" = "physical") {
    const resist = kind === "magic" ? this.magicResistance(target) : this.physicalResistance(target);
    return Math.max(1, Math.floor(damage * (1 - resist)));
  }

  private equipmentName(id?: string) {
    return id ? catalog[id]?.name || "-" : "-";
  }

  private applyLevelUps(beforeMembers: PartyMember[]) {
    const leveledMembers = this.party.filter((member) => this.levelUpMember(member));
    if (leveledMembers.length) {
      this.party.forEach((member) => {
        if (leveledMembers.includes(member)) {
          member.hp = member.maxHp;
          member.mp = member.maxMp;
        }
      });
      this.audio.playSe("levelup");
      this.pushBattle(`${leveledMembers.map((member) => member.name).join("、")}のレベルが上がった！`);
    }
    return this.buildLevelUpSummaries(beforeMembers, this.party);
  }

  private buildLevelUpSummaries(beforeMembers: PartyMember[], afterMembers: PartyMember[]) {
    const beforeMap = new Map(beforeMembers.map((member) => [member.name, member]));
    return afterMembers
      .filter((member) => {
        const before = beforeMap.get(member.name);
        return before && before.lv !== member.lv;
      })
      .map((member) => {
        const before = beforeMap.get(member.name)!;
        return {
          name: member.name,
          job: member.job,
          lvBefore: before.lv,
          lvAfter: member.lv,
          hpBefore: before.maxHp,
          hpAfter: member.maxHp,
          mpBefore: before.maxMp,
          mpAfter: member.maxMp,
          strengthBefore: before.strength,
          strengthAfter: member.strength,
          staminaBefore: before.stamina,
          staminaAfter: member.stamina,
          speedBefore: before.spd,
          speedAfter: member.spd,
          magicBefore: before.magicPower,
          magicAfter: member.magicPower,
          evadeBefore: before.evade,
          evadeAfter: member.evade,
          learned: member.skills.filter((skill) => !before.skills.includes(skill)),
        };
      });
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
      const learned = this.learnSkillsForLevel(member);
      if (learned.length && this.battle) this.pushBattle(`${member.name}は${learned.join("、")}を覚えた！`);
      leveled = true;
    }
    return leveled;
  }

  private learnSkillsForLevel(member: PartyMember) {
    const progression: Record<string, Record<number, string>> = {
      yos: { 3: "ベホイミ", 5: "メガホイミ" },
      "もじさん": { 4: "オニオンラッシュ", 6: "オニオンブラスト" },
    };
    const learned: string[] = [];
    const schedule = progression[member.name] || {};
    const skillName = schedule[member.lv];
    if (skillName && this.learnSkill(member, skillName)) learned.push(skillName);
    return learned;
  }

  private learnEventSkill(member: PartyMember) {
    const eventPools: Record<string, string[]> = {
      yos: ["レトロホイミ"],
      "もじさん": ["タネばくだん"],
    };
    const pool = eventPools[member.name] || [];
    const choices = pool.filter((name) => !member.skills.includes(name));
    const skillName = choices.length ? Phaser.Utils.Array.GetRandom(choices) : "";
    if (!skillName) return "";
    return this.learnSkill(member, skillName) ? skillName : "";
  }

  private learnSkill(member: PartyMember, skillName: string) {
    const skill = skillCatalog.find((item) => item.name === skillName);
    if (!skill) return false;
    if (member.skills.includes(skillName)) return false;
    if (member.lv < skill.minLv) return false;
    member.skills.push(skillName);
    return true;
  }

  private maybeLearnEventSkill() {
    if (!this.battle) return;
    const learnCandidates = this.party.filter((member) => member.hp > 0 && member.skills.length < 8);
    if (!learnCandidates.length) return;
    if (Math.random() > 0.33) return;
    const member = Phaser.Utils.Array.GetRandom(learnCandidates);
    const learned = this.learnEventSkill(member);
    if (learned) this.pushBattle(`${member.name}は${learned}をひらめいた！`);
  }

  private resolveNpcLines(npc: Npc) {
    const base = [...npc.lines];
    if (npc.name === "yos") {
      if (this.joined["もじさん"]) return ["yos: もじさんがいると、旅の段取りが一気に整う。", "yos: 次はこの先の手がかりを拾っていこう。"];
      return base;
    }
    if (npc.name === "元同僚") {
      if (!this.flags.heardMojisanLead) return base;
      return ["元同僚: そうそう、もじさんは退職後にヒョーゴの村へ行った。", "元同僚: 山へ向かったという噂もある。急ぐなら電車だ。"];
    }
    if (npc.name === "農家") {
      if (this.joined["もじさん"]) return ["農家: もじさんが戻ったなら畑も一気に賑やかになる。", "農家: 山の上で見つけた野菜、今度見せてもらいたいね。"];
      if (this.flags.heardMojisanMountain) return ["農家: もじさんは山へ行ったまま帰ってこない。", "農家: 装備を整えたら山頂まで見に行ってくれ。"];
      return base;
    }
    if (npc.name === "山の案内") {
      if (this.joined["もじさん"]) return ["山の案内: ふたりなら山頂まで行けるはずだ。", "山の案内: 風が強い、油断は禁物だよ。"];
      return ["山の案内: まずは村で、もじさんの話を聞いておくといい。"];
    }
    if (npc.name === "教会") {
      if (this.flags.chapter1Complete) return ["教会: 旧友との再会は、旅の節目でもあります。", "教会: 新しい記録をいつでも祈りましょう。"];
      return base;
    }
    if (npc.name === "宿屋" && this.joined["もじさん"]) {
      return ["宿屋: ふたり旅かい。にぎやかでいいね。", "宿屋: しっかり休んで、また次の町へ。", "HPとMPを全回復した。"];
    }
    return base;
  }

  private announceBattleCue(text: string, duration = 520) {
    if (!this.battle) return;
    this.battle.cueText = text;
    this.battle.cueUntil = this.time.now + duration;
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
    this.audio.playSe(kind === "boss" ? "boss" : "attack");
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
    this.bossCinematic = { kind: "intro", startedAt: this.time.now, until: this.time.now + 900 };
    this.audio.playSe("boss");
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

const startGame = () => {
  syncAppScale();
  window.addEventListener("resize", syncAppScale);
  window.addEventListener("orientationchange", syncAppScale);
  window.visualViewport?.addEventListener("resize", syncAppScale);
  window.visualViewport?.addEventListener("scroll", syncAppScale);
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
};

function syncAppScale() {
  const MAX_SCALE = 1.5;
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const scale = Math.min(vw / 360, vh / 640, MAX_SCALE);
  document.documentElement.style.setProperty("--app-scale", scale.toFixed(4));
}

startGame();
