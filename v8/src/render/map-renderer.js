import { ALL_ROUTE_CANDIDATES, CITY_TYPES, FACTIONS, WORLD, candidateId } from '../data/map-data.js';
import { activeRoutes, cityById } from '../core/game-state.js';
import { calculateInfluenceRadius } from '../systems/growth-system.js';

const LANDMASSES = [
  { x: 305, y: 210, points: [[-190, -78], [-88, -150], [72, -142], [170, -62], [150, 58], [30, 130], [-150, 96], [-205, 20]] },
  { x: 620, y: 560, points: [[-390, -170], [-245, -285], [-35, -260], [190, -205], [380, -70], [405, 105], [250, 220], [-70, 240], [-300, 110]] },
  { x: 265, y: 790, points: [[-135, -95], [35, -130], [168, -22], [118, 100], [-38, 140], [-168, 40]] },
  { x: 920, y: 230, points: [[-165, -82], [-15, -135], [145, -82], [178, 54], [42, 128], [-130, 86]] },
  { x: 1348, y: 388, points: [[-292, -172], [-96, -255], [146, -238], [330, -95], [285, 115], [82, 220], [-216, 140], [-340, -16]] },
  { x: 1268, y: 782, points: [[-252, -116], [-72, -180], [192, -135], [318, -6], [194, 142], [-112, 158], [-274, 38]] },
  { x: 1690, y: 690, points: [[-132, -135], [40, -160], [158, -48], [126, 108], [-15, 172], [-162, 48]] },
  { x: 850, y: 850, points: [[-86, -70], [62, -86], [126, 20], [46, 98], [-96, 68]] },
];

export function renderMap(ctx, state, assets, camera, timeMs) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#b9c0ac';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  applyCamera(ctx, camera);
  drawBackground(ctx);
  drawInfluence(ctx, state);
  drawRouteCandidates(ctx, state);
  drawRoutes(ctx, state, timeMs);
  drawCities(ctx, state);
  drawSelection(ctx, state);
  ctx.restore();
}

export function hitTestCity(state, worldX, worldY) {
  const cities = Object.values(state.cities).sort((a, b) => b.level - a.level);
  for (const city of cities) {
    const radius = CITY_TYPES[city.type].radius + city.level * 2 + 8;
    if (Math.hypot(worldX - city.x, worldY - city.y) <= radius) return city;
  }
  return null;
}

export function hitTestRoute(state, worldX, worldY) {
  let best = null;
  for (const route of Object.values(state.routes)) {
    const a = cityById(state, route.from);
    const b = cityById(state, route.to);
    if (!a || !b) continue;
    const distance = pointToSegmentDistance(worldX, worldY, a.x, a.y, b.x, b.y);
    if (distance < 14 && (!best || distance < best.distance)) best = { route, distance };
  }
  return best?.route || null;
}

export function screenToWorld(camera, screenX, screenY) {
  return {
    x: (screenX - camera.x) / camera.scale,
    y: (screenY - camera.y) / camera.scale,
  };
}

export function fitCamera(canvas) {
  const scale = Math.min(canvas.width / WORLD.width, canvas.height / WORLD.height);
  return {
    scale,
    x: (canvas.width - WORLD.width * scale) / 2,
    y: (canvas.height - WORLD.height * scale) / 2,
  };
}

function applyCamera(ctx, camera) {
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.scale, camera.scale);
}

function drawBackground(ctx) {
  const bg = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  bg.addColorStop(0, '#d9cfb4');
  bg.addColorStop(0.5, '#bcae8a');
  bg.addColorStop(1, '#d7c8a2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = '#8fb3bd';
  ctx.globalAlpha = 0.34;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(74, 55, 34, 0.055)';
  for (let i = 0; i < 1700; i++) {
    ctx.fillRect((i * 83) % WORLD.width, (i * 47) % WORLD.height, 2, 1);
  }

  for (const land of LANDMASSES) {
    drawLandmass(ctx, land);
  }
}

function drawLandmass(ctx, land) {
  ctx.save();
  ctx.translate(land.x, land.y);
  ctx.beginPath();
  ctx.moveTo(land.points[0][0], land.points[0][1]);
  for (let i = 1; i < land.points.length; i++) ctx.lineTo(land.points[i][0], land.points[i][1]);
  ctx.closePath();
  ctx.fillStyle = '#c5b486';
  ctx.fill();
  ctx.strokeStyle = '#6d3c32';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(67, 50, 34, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.clip();
  ctx.strokeStyle = 'rgba(87, 68, 44, 0.18)';
  ctx.lineWidth = 2;
  for (let i = -220; i < 320; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, -260);
    ctx.quadraticCurveTo(i + 80, -40, i + 20, 260);
    ctx.stroke();
  }
  ctx.restore();
}

function drawInfluence(ctx, state) {
  for (const city of Object.values(state.cities)) {
    if (!city.owner) continue;
    const faction = FACTIONS[city.owner];
    const radius = calculateInfluenceRadius(city);
    const grad = ctx.createRadialGradient(city.x, city.y, radius * 0.2, city.x, city.y, radius);
    grad.addColorStop(0, hexToRgba(faction.color, 0.28));
    grad.addColorStop(1, hexToRgba(faction.color, 0.04));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(city.x, city.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(faction.color, 0.38);
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 9]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawRouteCandidates(ctx, state) {
  if (state.selected?.kind !== 'city') return;
  const selected = cityById(state, state.selected.id);
  if (!selected || selected.owner !== 'player') return;
  ctx.save();
  ctx.setLineDash([7, 10]);
  for (const candidate of ALL_ROUTE_CANDIDATES) {
    if (candidate.from !== selected.id && candidate.to !== selected.id) continue;
    const id = candidateId(candidate.from, candidate.to, candidate.kind);
    if (state.routes[id]?.status === 'active') continue;
    const a = cityById(state, candidate.from);
    const b = cityById(state, candidate.to);
    ctx.strokeStyle = candidate.kind === 'sea' ? 'rgba(53, 103, 129, 0.45)' : 'rgba(98, 64, 44, 0.42)';
    ctx.lineWidth = candidate.kind === 'sea' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoutes(ctx, state, timeMs) {
  for (const route of Object.values(state.routes)) {
    const a = cityById(state, route.from);
    const b = cityById(state, route.to);
    if (!a || !b) continue;
    const owner = FACTIONS[route.owner];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = route.kind === 'sea' ? 5 + route.level : 4 + route.level;
    ctx.strokeStyle = route.status === 'broken'
      ? 'rgba(45, 38, 31, 0.55)'
      : (route.kind === 'sea' ? '#527f91' : owner.dark);
    if (route.kind === 'sea' || route.status === 'broken') ctx.setLineDash(route.status === 'broken' ? [18, 12] : [14, 12]);
    ctx.lineDashOffset = -timeMs / 120;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2 - (route.kind === 'sea' ? 70 : 0);
    ctx.quadraticCurveTo(midX, midY, b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawRouteJoint(ctx, a, b, route);
    if (route.trade && route.status === 'active') drawTradeDot(ctx, a, b, route, timeMs);
    ctx.restore();
  }
}

function drawRouteJoint(ctx, a, b, route) {
  const t = 0.5;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 - (route.kind === 'sea' ? 70 : 0);
  const x = quad(a.x, cx, b.x, t);
  const y = quad(a.y, cy, b.y, t);
  ctx.fillStyle = '#f3d45f';
  ctx.strokeStyle = '#5b3b17';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawTradeDot(ctx, a, b, route, timeMs) {
  const t = ((timeMs / (2400 - route.level * 260)) % 1);
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 - (route.kind === 'sea' ? 70 : 0);
  const x = quad(a.x, cx, b.x, t);
  const y = quad(a.y, cy, b.y, t);
  ctx.fillStyle = '#f2d078';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(53, 36, 18, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCities(ctx, state) {
  for (const city of Object.values(state.cities)) {
    const type = CITY_TYPES[city.type];
    const owner = city.owner ? FACTIONS[city.owner] : null;
    const r = type.radius + city.level * 2;
    ctx.save();
    ctx.translate(city.x, city.y);
    ctx.fillStyle = 'rgba(33, 24, 18, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, r + 8, r * 1.2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = owner ? owner.color : '#e8ddc3';
    ctx.strokeStyle = owner ? owner.dark : '#6e5a42';
    ctx.lineWidth = city.type === 'capital' ? 5 : 3;
    ctx.beginPath();
    drawCityShape(ctx, city, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.font = `${Math.max(13, r)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cityIcon(city), 0, city.type === 'capital' ? 1 : 0);
    if (city.siege) {
      ctx.strokeStyle = '#d5382b';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, r + 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(33, 25, 18, 0.78)';
    ctx.font = '700 20px "PingFang SC", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(city.name, city.x, city.y + r + 30);
  }
}

function drawSelection(ctx, state) {
  if (!state.selected) return;
  if (state.selected.kind === 'city') {
    const city = cityById(state, state.selected.id);
    if (!city) return;
    const r = CITY_TYPES[city.type].radius + city.level * 2 + 15;
    ctx.strokeStyle = '#fff4c4';
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(city.x, city.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (state.selected.kind === 'route') {
    const route = state.routes[state.selected.id];
    if (!route) return;
    const a = cityById(state, route.from);
    const b = cityById(state, route.to);
    ctx.strokeStyle = '#fff4c4';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function cityIcon(city) {
  if (city.type === 'capital') return '★';
  if (city.tags.includes('port')) return '⚓';
  if (city.tags.includes('barracks')) return '⚔';
  if (city.type === 'resource' || city.tags.includes('resource') || city.tags.includes('trade')) return '◆';
  if (city.type === 'fortress') return '■';
  return '●';
}

function drawCityShape(ctx, city, r) {
  if (city.type === 'capital') {
    drawStarPath(ctx, 0, 0, r + 7, r * 0.48, 5);
    return;
  }
  if (city.type === 'fortress') {
    const s = r * 1.55;
    ctx.rect(-s / 2, -s / 2, s, s);
    return;
  }
  if (city.type === 'resource' || city.tags.includes('resource') || city.tags.includes('trade')) {
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    return;
  }
  ctx.arc(0, 0, r, 0, Math.PI * 2);
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function drawStarPath(ctx, x, y, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 === 0 ? outer : inner;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function quad(a, b, c, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
