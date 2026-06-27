// V8 static map data. Coordinates use the 1920x1080 world space.

export const WORLD = { width: 1920, height: 1080 };

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

export const CITY_TYPES = {
  village: { name: '村镇', radius: 14, defense: 2, tax: 4, growth: 4 },
  town: { name: '市镇', radius: 17, defense: 4, tax: 7, growth: 5 },
  city: { name: '城市', radius: 21, defense: 7, tax: 11, growth: 6 },
  great: { name: '大城', radius: 25, defense: 10, tax: 16, growth: 7 },
  capital: { name: '首都', radius: 31, defense: 14, tax: 20, growth: 8 },
  port: { name: '港口', radius: 21, defense: 6, tax: 10, growth: 6 },
  barracks: { name: '军营城', radius: 21, defense: 8, tax: 9, growth: 5 },
  trade: { name: '商贸城', radius: 21, defense: 6, tax: 14, growth: 7 },
  fortress: { name: '要塞', radius: 22, defense: 13, tax: 8, growth: 4 },
};

export const UNIT_TYPES = {
  infantry: { name: '步兵', icon: '♟', cost: { gold: 14, food: 4 }, power: 2, siege: 1, speed: 1 },
  cavalry: { name: '骑兵', icon: '♞', cost: { gold: 24, food: 6 }, power: 3, routeDamage: 2, speed: 2 },
  engineer: { name: '工兵', icon: '⚒', cost: { gold: 20, labor: 10 }, power: 1, repair: 2, speed: 1 },
  siege: { name: '攻城车', icon: '▣', cost: { gold: 38, labor: 16 }, power: 5, siege: 5, speed: 1 },
  guard: { name: '守卫', icon: '◆', cost: { gold: 18, food: 5 }, power: 2, defense: 3, speed: 1 },
  fleet: { name: '舰队', icon: '⚓', cost: { gold: 42, labor: 14 }, power: 5, naval: 4, speed: 2 },
};

export const RESOURCE_NAMES = {
  gold: '金币',
  food: '粮食',
  labor: '劳力',
  influence: '影响',
};

export const CITY_DEFS = [
  { id: 'c_aurea', name: '金鸢城', x: 570, y: 575, type: 'capital', level: 3, owner: 'player', tags: ['capital', 'trade'] },
  { id: 'c_westmill', name: '西磨镇', x: 420, y: 535, type: 'town', level: 2, owner: 'player', tags: ['trade'] },
  { id: 'c_pineford', name: '松渡', x: 320, y: 410, type: 'village', level: 1, owner: 'player', tags: [] },
  { id: 'c_southgate', name: '南关', x: 560, y: 750, type: 'barracks', level: 2, owner: 'player', tags: ['barracks'] },
  { id: 'c_oldport', name: '旧港', x: 785, y: 700, type: 'port', level: 2, owner: 'player', tags: ['port'] },
  { id: 'c_ashbridge', name: '灰桥', x: 745, y: 500, type: 'town', level: 2, owner: null, tags: [] },
  { id: 'c_larkfield', name: '云雀田', x: 655, y: 380, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_copper', name: '铜市', x: 900, y: 575, type: 'trade', level: 2, owner: null, tags: ['trade'] },
  { id: 'c_riverwatch', name: '河望堡', x: 955, y: 410, type: 'fortress', level: 2, owner: null, tags: ['fortress'] },
  { id: 'c_northmere', name: '北沼', x: 455, y: 275, type: 'village', level: 1, owner: null, tags: [] },

  { id: 'c_redspire', name: '赤塔', x: 1340, y: 360, type: 'capital', level: 3, owner: 'crimson', tags: ['capital'] },
  { id: 'c_emberfall', name: '烬落', x: 1200, y: 315, type: 'barracks', level: 2, owner: 'crimson', tags: ['barracks'] },
  { id: 'c_scarletmine', name: '绯矿', x: 1465, y: 480, type: 'trade', level: 2, owner: 'crimson', tags: ['trade'] },
  { id: 'c_bloodford', name: '红渡', x: 1265, y: 525, type: 'town', level: 2, owner: 'crimson', tags: [] },
  { id: 'c_eastgate', name: '东门堡', x: 1085, y: 470, type: 'fortress', level: 2, owner: 'crimson', tags: ['fortress'] },
  { id: 'c_cinderport', name: '炭港', x: 1535, y: 655, type: 'port', level: 2, owner: 'crimson', tags: ['port'] },
  { id: 'c_redfarm', name: '赤原', x: 1405, y: 235, type: 'village', level: 1, owner: 'crimson', tags: [] },
  { id: 'c_blackhill', name: '黑丘', x: 1580, y: 360, type: 'town', level: 2, owner: null, tags: [] },

  { id: 'c_blueharbor', name: '青港', x: 1265, y: 805, type: 'capital', level: 3, owner: 'azure', tags: ['capital', 'port', 'trade'] },
  { id: 'c_tideglass', name: '潮璃', x: 1115, y: 760, type: 'trade', level: 2, owner: 'azure', tags: ['trade'] },
  { id: 'c_reefwatch', name: '礁望', x: 1425, y: 835, type: 'port', level: 2, owner: 'azure', tags: ['port'] },
  { id: 'c_mistden', name: '雾营', x: 1225, y: 660, type: 'barracks', level: 2, owner: 'azure', tags: ['barracks'] },
  { id: 'c_saltmarket', name: '盐市', x: 1010, y: 875, type: 'town', level: 2, owner: 'azure', tags: ['trade'] },
  { id: 'c_pearl', name: '珍珠岛', x: 1575, y: 865, type: 'village', level: 1, owner: null, tags: ['island'] },

  { id: 'c_crowisle', name: '鸦岛', x: 250, y: 815, type: 'port', level: 1, owner: null, tags: ['port', 'island'] },
  { id: 'c_stonehook', name: '石钩', x: 210, y: 655, type: 'village', level: 1, owner: null, tags: ['island'] },
  { id: 'c_sunreach', name: '日伸港', x: 225, y: 210, type: 'port', level: 2, owner: null, tags: ['port', 'island'] },
  { id: 'c_highnest', name: '高巢', x: 380, y: 165, type: 'fortress', level: 2, owner: null, tags: ['fortress', 'island'] },
  { id: 'c_midreef', name: '中礁', x: 1015, y: 705, type: 'port', level: 1, owner: null, tags: ['port', 'island'] },
  { id: 'c_lonebell', name: '孤钟', x: 1710, y: 560, type: 'port', level: 1, owner: null, tags: ['port', 'island'] },
  { id: 'c_whale', name: '鲸背', x: 1680, y: 750, type: 'village', level: 1, owner: null, tags: ['island'] },
  { id: 'c_fogbank', name: '雾岸', x: 860, y: 260, type: 'village', level: 1, owner: null, tags: [] },
  { id: 'c_silverfen', name: '银沼', x: 1035, y: 250, type: 'trade', level: 2, owner: null, tags: ['trade'] },
  { id: 'c_gatecross', name: '界桥', x: 1030, y: 570, type: 'city', level: 2, owner: null, tags: [] },
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
  ['c_sunreach', 'c_highnest'],
];

const seaPairs = [
  ['c_oldport', 'c_crowisle'], ['c_oldport', 'c_midreef'], ['c_midreef', 'c_blueharbor'], ['c_midreef', 'c_cinderport'],
  ['c_cinderport', 'c_lonebell'], ['c_lonebell', 'c_reefwatch'], ['c_sunreach', 'c_oldport'], ['c_sunreach', 'c_cinderport'],
  ['c_crowisle', 'c_saltmarket'], ['c_reefwatch', 'c_pearl'],
];

export const ROUTE_CANDIDATES = roadPairs.map(([from, to]) => makeCandidate(from, to, 'road'));
export const SEA_ROUTE_CANDIDATES = seaPairs.map(([from, to]) => makeCandidate(from, to, 'sea'));
export const ALL_ROUTE_CANDIDATES = [...ROUTE_CANDIDATES, ...SEA_ROUTE_CANDIDATES];

export const INITIAL_ROUTES = [
  ['c_aurea', 'c_westmill', 'player', 'road'],
  ['c_aurea', 'c_southgate', 'player', 'road'],
  ['c_southgate', 'c_oldport', 'player', 'road'],
  ['c_redspire', 'c_emberfall', 'crimson', 'road'],
  ['c_redspire', 'c_scarletmine', 'crimson', 'road'],
  ['c_redspire', 'c_redfarm', 'crimson', 'road'],
  ['c_blueharbor', 'c_tideglass', 'azure', 'road'],
  ['c_blueharbor', 'c_reefwatch', 'azure', 'road'],
  ['c_blueharbor', 'c_saltmarket', 'azure', 'road'],
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
