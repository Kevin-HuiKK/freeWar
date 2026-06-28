// V8 static map data. Coordinates use the 1920x1080 world space.

export const WORLD = { width: 1920, height: 1080 };
export const ACTIONS_PER_TURN = 3;
export const VICTORY_RULES = {
  // V1.0: occupy every enemy city to win; auto-draw after drawTurn.
  mode: 'conquest',
  drawTurn: 80,
};

export const TALENTS = {
  capitalExpansion: {
    id: 'capitalExpansion',
    branch: 'city',
    name: '主城扩建',
    max: 3,
    desc: '每级使开局主城等级 +1，并提高主城防御。',
  },
  grandRoads: {
    id: 'grandRoads',
    branch: 'connect',
    name: '宏大道路',
    max: 3,
    desc: '每级降低建路和升级连接的金币、劳力消耗。',
  },
  harborWorks: {
    id: 'harborWorks',
    branch: 'trade',
    name: '海港船坞',
    max: 3,
    desc: '每级增加开局金币与劳力，并强化港口舰队。',
  },
  doubleLanes: {
    id: 'doubleLanes',
    branch: 'connect',
    name: '双行通道',
    max: 1,
    prereq: ['grandRoads'],
    desc: '己方城市间调兵比例提高，连接更像双行道。',
  },
  swiftRoads: {
    id: 'swiftRoads',
    branch: 'connect',
    name: '连接速度',
    max: 3,
    prereq: ['grandRoads'],
    desc: '提升道路效率，进一步降低连接升级成本。',
  },
  extraAction: {
    id: 'extraAction',
    branch: 'command',
    name: '每回合行动 +1',
    max: 3,
    desc: '每级增加 1 点每回合行动点。',
  },
  assaultDrill: {
    id: 'assaultDrill',
    branch: 'attack',
    name: '进攻训练',
    max: 3,
    desc: '每级提升进攻方战力。',
  },
  openingInfantry: {
    id: 'openingInfantry',
    branch: 'attack',
    name: '初始步兵',
    max: 3,
    desc: '每级使主城开局额外获得 1 名步兵。',
  },
  openingCavalry: {
    id: 'openingCavalry',
    branch: 'attack',
    name: '初始骑兵',
    max: 3,
    prereq: ['openingInfantry'],
    desc: '每级使主城开局额外获得 1 名骑兵。',
  },
  merchantGuild: {
    id: 'merchantGuild',
    branch: 'trade',
    name: '商会税契',
    max: 5,
    desc: '每级增加开局金币。',
  },
  talentDividend: {
    id: 'talentDividend',
    branch: 'trade',
    name: '胜利分红',
    max: 2,
    prereq: ['merchantGuild'],
    desc: '满级后每次胜利额外获得 1 点天赋。',
  },
  defenseMatrix: {
    id: 'defenseMatrix',
    branch: 'city',
    name: '城防矩阵',
    max: 5,
    prereq: ['capitalExpansion'],
    desc: '每级提高己方城市防御。',
  },
};

export const TALENT_BRANCHES = {
  connect: { id: 'connect', name: '连接', color: '#9b6931' },
  command: { id: 'command', name: '行动', color: '#8a4d8f' },
  attack: { id: 'attack', name: '进攻', color: '#b94a3f' },
  city: { id: 'city', name: '城市', color: '#d0a23e' },
  trade: { id: 'trade', name: '交易', color: '#4d8aa8' },
};

export const FACTIONS = {
  player: {
    id: 'player',
    name: '金鸢同盟',
    shortName: '金鸢',
    color: '#d2a74f',
    dark: '#8b6422',
    capitalId: 'c_aurea',
  },
  crimson: {
    id: 'crimson',
    name: '赤岭王国',
    shortName: '赤岭',
    color: '#b94a3f',
    dark: '#6f251f',
    capitalId: 'c_redspire',
  },
  azure: {
    id: 'azure',
    name: '青潮商邦',
    shortName: '青潮',
    color: '#4d8aa8',
    dark: '#245166',
    capitalId: 'c_blueharbor',
  },
};

export const FACTION_IDS = Object.keys(FACTIONS);

// hp = 城市血量初值（按等级再加成，见 game-state）。defense = 基础防守值。
export const CITY_TYPES = {
  village: { name: '村镇', radius: 14, defense: 2, tax: 4, growth: 4, hp: 6 },
  town: { name: '市镇', radius: 17, defense: 4, tax: 7, growth: 5, hp: 9 },
  city: { name: '城市', radius: 21, defense: 7, tax: 11, growth: 6, hp: 12 },
  great: { name: '大城', radius: 25, defense: 10, tax: 16, growth: 7, hp: 16 },
  capital: { name: '首都', radius: 31, defense: 14, tax: 20, growth: 8, hp: 22 },
  port: { name: '港口', radius: 21, defense: 6, tax: 10, growth: 6, hp: 10 },
  barracks: { name: '军营城', radius: 21, defense: 8, tax: 9, growth: 5, hp: 11 },
  trade: { name: '商贸城', radius: 21, defense: 6, tax: 14, growth: 7, hp: 11 },
  resource: { name: '资源点', radius: 19, defense: 5, tax: 12, growth: 6, hp: 11 },
  fortress: { name: '要塞', radius: 22, defense: 13, tax: 8, growth: 4, hp: 18 },
};

// V1.0 roster. attack/defense per the rules doc; flags carry skills.
// req: training prerequisite — null | 'barracks' | 'capital' | 'port'.
// 'barracks' is satisfied by barracks-tagged cities OR capitals.
export const UNIT_TYPES = {
  infantry: { name: '步兵', icon: '♟', cost: { gold: 12, food: 4 }, attack: 1, defense: 0, req: null },
  charger: { name: '冲锋兵', icon: '♙', cost: { gold: 16, food: 5 }, attack: 2, defense: 0, req: null },
  cavalry: { name: '骑兵', icon: '♞', cost: { gold: 22, food: 6 }, attack: 2, defense: 0, req: 'barracks' },
  guard: { name: '守卫', icon: '◆', cost: { gold: 16, food: 5 }, attack: 0, defense: 1, req: null },
  engineer: { name: '工兵', icon: '⚒', cost: { gold: 18, labor: 8 }, attack: 0, defense: 1, heal: 1, req: null },
  miner: { name: '矿工', icon: '⛏', cost: { gold: 20, labor: 4 }, attack: 0, defense: 0, miner: 6, req: null },
  civilian: { name: '普通人', icon: '☻', cost: { gold: 6 }, attack: 0, defense: 0, labor: 2, req: null },
  apc: { name: '装甲车', icon: '▤', cost: { gold: 28, labor: 8 }, attack: 3, defense: 0, armor: true, req: 'barracks' },
  tank: { name: '坦克', icon: '▦', cost: { gold: 46, labor: 16 }, attack: 4, defense: 0, armor: true, req: 'barracks' },
  siege: { name: '攻城车', icon: '▣', cost: { gold: 40, labor: 16 }, attack: 5, defense: 0, siege: 5, req: 'barracks' },
  rocket: { name: '火箭车', icon: '➹', cost: { gold: 54, labor: 20 }, attack: 6, defense: 0, ranged: true, req: 'barracks' },
  engvehicle: { name: '工程车', icon: '⛭', cost: { gold: 30, labor: 18 }, attack: 0, defense: 3, req: 'barracks' },
  flamer: { name: '喷火兵', icon: '♨', cost: { gold: 34, food: 8 }, attack: 4, defense: 0, burn: 4, req: 'barracks' },
  fighter: { name: '战斗机', icon: '✈', cost: { gold: 50, labor: 18 }, attack: 5, defense: 0, air: true, req: 'capital' },
  bomber: { name: '轰炸机', icon: '🛩', cost: { gold: 70, labor: 26 }, attack: 8, defense: 0, bomber: true, req: 'capital' },
  aaa: { name: '防空导弹', icon: '⌖', cost: { gold: 40, labor: 16 }, attack: 0, defense: 0, intercept: true, req: 'capital' },
  missile: { name: '导弹', icon: '⇡', cost: { gold: 120, labor: 40 }, attack: 10, defense: 0, strategic: 'missile', req: 'capital' },
  nuke: { name: '核弹', icon: '☢', cost: { gold: 200, labor: 60 }, attack: 15, defense: 0, strategic: 'nuke', req: 'capital' },
  hbomb: { name: '氢弹', icon: '✸', cost: { gold: 320, labor: 90 }, attack: 25, defense: 0, strategic: 'super', req: 'capital' },
  bunker: { name: '地堡', icon: '⬢', cost: { gold: 60, labor: 30 }, attack: 0, defense: 90, oncePerGame: true, req: null },
  fleet: { name: '舰队', icon: '⚓', cost: { gold: 42, labor: 14 }, attack: 3, defense: 0, naval: true, req: 'port' },
};

// Attack-capable unit ids (contribute to a city's offensive power).
export const ATTACK_UNIT_IDS = Object.keys(UNIT_TYPES).filter(id => UNIT_TYPES[id].attack > 0);

export const BUILDINGS = {
  nuclear: { id: 'nuclear', name: '核电站', icon: '☢', cost: { gold: 90, labor: 40 }, desc: '每回合金币×20；占用后该城无法训练单位（持续到本局结束）' },
};

export const RESOURCE_NAMES = {
  gold: '金币',
  food: '粮食',
  labor: '劳力',
  influence: '影响',
};

export const MAP_MARKER_TYPES = {
  grain: { name: '粮食', icon: '◌', color: '#b98021' },
  ore: { name: '矿产', icon: '◆', color: '#366f93' },
  relic: { name: '遗迹', icon: '△', color: '#9f3730' },
  shop: { name: '商店', icon: '田', color: '#7a3f7d' },
  storm: { name: '风暴', icon: '◍', color: '#6d8aa6' },
};

export const CITY_DEFS = [
  { id: 'c_aurea', name: '金鸢城', x: 570, y: 575, type: 'capital', level: 3, owner: 'player', tags: ['capital', 'trade'] },
  { id: 'c_westmill', name: '西磨镇', x: 420, y: 535, type: 'resource', level: 2, owner: 'player', tags: ['resource'] },
  { id: 'c_pineford', name: '松渡', x: 320, y: 410, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_southgate', name: '南关', x: 560, y: 750, type: 'barracks', level: 2, owner: 'player', tags: ['barracks'] },
  { id: 'c_oldport', name: '旧港', x: 785, y: 700, type: 'port', level: 2, owner: null, tags: ['port'] },
  { id: 'c_ashbridge', name: '灰桥', x: 745, y: 500, type: 'town', level: 2, owner: null, tags: [] },
  { id: 'c_larkfield', name: '云雀田', x: 655, y: 380, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_copper', name: '铜市', x: 900, y: 575, type: 'resource', level: 2, owner: null, tags: ['resource', 'trade'] },
  { id: 'c_riverwatch', name: '河望堡', x: 955, y: 410, type: 'fortress', level: 2, owner: null, tags: ['fortress'] },
  { id: 'c_northmere', name: '北沼', x: 455, y: 275, type: 'village', level: 1, owner: null, tags: [] },

  { id: 'c_redspire', name: '赤塔', x: 1340, y: 360, type: 'capital', level: 3, owner: 'crimson', tags: ['capital'] },
  { id: 'c_emberfall', name: '烬落', x: 1200, y: 315, type: 'barracks', level: 2, owner: 'crimson', tags: ['barracks'] },
  { id: 'c_scarletmine', name: '绯矿', x: 1465, y: 480, type: 'resource', level: 2, owner: 'crimson', tags: ['resource', 'trade'] },
  { id: 'c_bloodford', name: '红渡', x: 1265, y: 525, type: 'town', level: 2, owner: null, tags: [] },
  { id: 'c_eastgate', name: '东门堡', x: 1085, y: 470, type: 'fortress', level: 2, owner: null, tags: ['fortress'] },
  { id: 'c_cinderport', name: '炭港', x: 1535, y: 655, type: 'port', level: 2, owner: null, tags: ['port'] },
  { id: 'c_redfarm', name: '赤原', x: 1405, y: 235, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_blackhill', name: '黑丘', x: 1580, y: 360, type: 'town', level: 2, owner: null, tags: [] },

  { id: 'c_blueharbor', name: '青港', x: 1265, y: 805, type: 'capital', level: 3, owner: 'azure', tags: ['capital', 'port', 'trade'] },
  { id: 'c_tideglass', name: '潮璃', x: 1115, y: 760, type: 'resource', level: 2, owner: 'azure', tags: ['resource', 'trade'] },
  { id: 'c_reefwatch', name: '礁望', x: 1425, y: 835, type: 'port', level: 2, owner: 'azure', tags: ['port'] },
  { id: 'c_mistden', name: '雾营', x: 1225, y: 660, type: 'barracks', level: 2, owner: null, tags: ['barracks'] },
  { id: 'c_saltmarket', name: '盐市', x: 1010, y: 875, type: 'resource', level: 2, owner: null, tags: ['resource', 'trade'] },
  { id: 'c_pearl', name: '珍珠岛', x: 1575, y: 865, type: 'village', level: 1, owner: null, tags: ['island'] },

  { id: 'c_crowisle', name: '鸦岛', x: 250, y: 815, type: 'port', level: 1, owner: null, tags: ['port', 'island'] },
  { id: 'c_stonehook', name: '石钩', x: 210, y: 655, type: 'village', level: 1, owner: null, tags: ['island'] },
  { id: 'c_sunreach', name: '日伸港', x: 225, y: 210, type: 'port', level: 2, owner: null, tags: ['port', 'island'] },
  { id: 'c_highnest', name: '高巢', x: 380, y: 165, type: 'fortress', level: 2, owner: null, tags: ['fortress', 'island'] },
  { id: 'c_midreef', name: '中礁', x: 1015, y: 705, type: 'port', level: 1, owner: null, tags: ['port', 'island'] },
  { id: 'c_lonebell', name: '孤钟', x: 1710, y: 560, type: 'port', level: 1, owner: null, tags: ['port', 'island'] },
  { id: 'c_whale', name: '鲸背', x: 1680, y: 750, type: 'village', level: 1, owner: null, tags: ['island'] },
  { id: 'c_fogbank', name: '雾岸', x: 860, y: 260, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_silverfen', name: '银沼', x: 1035, y: 250, type: 'resource', level: 2, owner: null, tags: ['resource', 'trade'] },
  { id: 'c_gatecross', name: '界桥', x: 1030, y: 570, type: 'city', level: 2, owner: null, tags: [] },
  { id: 'c_whitecliff', name: '白崖', x: 720, y: 265, type: 'town', level: 1, owner: null, tags: [] },
  { id: 'c_glassbay', name: '璃湾', x: 850, y: 840, type: 'port', level: 1, owner: null, tags: ['port'] },
  { id: 'c_drywell', name: '旱井', x: 1130, y: 150, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_moonpass', name: '月隘', x: 1530, y: 190, type: 'fortress', level: 1, owner: null, tags: ['fortress'] },
  { id: 'c_amberholm', name: '琥珀洲', x: 1760, y: 860, type: 'resource', level: 1, owner: null, tags: ['resource', 'island'] },
];

export const MAP_MARKERS = [
  { id: 'm_grain_1', type: 'grain', x: 300, y: 520 },
  { id: 'm_grain_2', type: 'grain', x: 610, y: 660 },
  { id: 'm_grain_3', type: 'grain', x: 1380, y: 255 },
  { id: 'm_grain_4', type: 'grain', x: 1500, y: 760 },
  { id: 'm_ore_1', type: 'ore', x: 490, y: 365 },
  { id: 'm_ore_2', type: 'ore', x: 805, y: 615 },
  { id: 'm_ore_3', type: 'ore', x: 1120, y: 735 },
  { id: 'm_ore_4', type: 'ore', x: 1650, y: 805 },
  { id: 'm_relic_1', type: 'relic', x: 555, y: 285 },
  { id: 'm_relic_2', type: 'relic', x: 1185, y: 190 },
  { id: 'm_relic_3', type: 'relic', x: 1570, y: 395 },
  { id: 'm_shop_1', type: 'shop', x: 1025, y: 520 },
  { id: 'm_shop_2', type: 'shop', x: 730, y: 865 },
  { id: 'm_shop_3', type: 'shop', x: 1775, y: 705 },
  { id: 'm_storm_1', type: 'storm', x: 220, y: 930 },
  { id: 'm_storm_2', type: 'storm', x: 915, y: 930 },
  { id: 'm_storm_3', type: 'storm', x: 1715, y: 480 },
];

const roadPairs = [
  ['c_aurea', 'c_westmill'], ['c_aurea', 'c_southgate'], ['c_aurea', 'c_ashbridge'], ['c_aurea', 'c_larkfield'],
  ['c_westmill', 'c_pineford'], ['c_westmill', 'c_northmere'], ['c_pineford', 'c_northmere'], ['c_southgate', 'c_oldport'],
  ['c_oldport', 'c_copper'], ['c_ashbridge', 'c_larkfield'], ['c_ashbridge', 'c_copper'], ['c_larkfield', 'c_riverwatch'],
  ['c_copper', 'c_gatecross'], ['c_riverwatch', 'c_gatecross'], ['c_riverwatch', 'c_fogbank'], ['c_fogbank', 'c_silverfen'],
  ['c_silverfen', 'c_emberfall'], ['c_silverfen', 'c_eastgate'], ['c_gatecross', 'c_eastgate'], ['c_gatecross', 'c_mistden'],
  ['c_eastgate', 'c_emberfall'], ['c_eastgate', 'c_bloodford'], ['c_emberfall', 'c_redspire'], ['c_redspire', 'c_redfarm'],
  ['c_redspire', 'c_scarletmine'], ['c_redspire', 'c_blackhill'], ['c_scarletmine', 'c_bloodford'], ['c_scarletmine', 'c_cinderport'],
  ['c_blackhill', 'c_lonebell'], ['c_bloodford', 'c_mistden'], ['c_mistden', 'c_blueharbor'], ['c_mistden', 'c_tideglass'],
  ['c_blueharbor', 'c_tideglass'], ['c_blueharbor', 'c_reefwatch'], ['c_blueharbor', 'c_saltmarket'], ['c_tideglass', 'c_saltmarket'],
  ['c_reefwatch', 'c_pearl'], ['c_reefwatch', 'c_whale'], ['c_lonebell', 'c_whale'], ['c_stonehook', 'c_crowisle'],
  ['c_sunreach', 'c_highnest'], ['c_whitecliff', 'c_larkfield'], ['c_whitecliff', 'c_fogbank'], ['c_drywell', 'c_silverfen'],
  ['c_drywell', 'c_emberfall'], ['c_moonpass', 'c_redfarm'], ['c_moonpass', 'c_blackhill'], ['c_amberholm', 'c_whale'],
  ['c_amberholm', 'c_pearl'],
];

const seaPairs = [
  ['c_oldport', 'c_crowisle'], ['c_oldport', 'c_midreef'], ['c_midreef', 'c_blueharbor'], ['c_midreef', 'c_cinderport'],
  ['c_cinderport', 'c_lonebell'], ['c_lonebell', 'c_reefwatch'], ['c_sunreach', 'c_oldport'], ['c_sunreach', 'c_cinderport'],
  ['c_crowisle', 'c_saltmarket'], ['c_reefwatch', 'c_pearl'], ['c_oldport', 'c_glassbay'], ['c_glassbay', 'c_saltmarket'],
];

export const ROUTE_CANDIDATES = roadPairs.map(([from, to]) => makeCandidate(from, to, 'road'));
export const SEA_ROUTE_CANDIDATES = seaPairs.map(([from, to]) => makeCandidate(from, to, 'sea'));
export const ALL_ROUTE_CANDIDATES = [...ROUTE_CANDIDATES, ...SEA_ROUTE_CANDIDATES];

// Each faction opens with a capital and two adjacent cities (design: 首都 + 2 相邻城).
export const INITIAL_ROUTES = [
  ['c_aurea', 'c_westmill', 'player', 'road'],
  ['c_aurea', 'c_southgate', 'player', 'road'],
  ['c_redspire', 'c_emberfall', 'crimson', 'road'],
  ['c_redspire', 'c_scarletmine', 'crimson', 'road'],
  ['c_blueharbor', 'c_tideglass', 'azure', 'road'],
  ['c_blueharbor', 'c_reefwatch', 'azure', 'road'],
];

export const STARTING_RESOURCES = {
  gold: 120,
  food: 70,
  labor: 55,
  influence: 8,
};

function makeCandidate(from, to, kind) {
  const a = CITY_DEFS.find(city => city.id === from);
  const b = CITY_DEFS.find(city => city.id === to);
  const distance = Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  const sea = kind === 'sea';
  return {
    id: candidateId(from, to, kind),
    from,
    to,
    kind,
    distance,
    buildCost: sea
      ? { gold: Math.round(distance / 7) + 22, labor: Math.round(distance / 18) + 8 }
      : { gold: Math.round(distance / 12) + 10, labor: Math.round(distance / 28) + 5 },
  };
}

export function candidateId(from, to, kind = 'road') {
  return `${kind}_${[from, to].sort().join('__')}`;
}
