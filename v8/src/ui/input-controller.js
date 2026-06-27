import { hitTestCity, hitTestRoute, screenToWorld } from '../render/map-renderer.js';

export function createInputController(canvas, getState, getCamera, handlers) {
  canvas.addEventListener('mousemove', (event) => {
    const world = eventToWorld(canvas, getCamera(), event);
    const state = getState();
    const city = hitTestCity(state, world.x, world.y);
    const route = city ? null : hitTestRoute(state, world.x, world.y);
    handlers.onHover?.(city ? { kind: 'city', id: city.id } : route ? { kind: 'route', id: route.id } : null);
  });

  canvas.addEventListener('mouseleave', () => handlers.onHover?.(null));

  canvas.addEventListener('click', (event) => {
    const world = eventToWorld(canvas, getCamera(), event);
    const state = getState();
    const city = hitTestCity(state, world.x, world.y);
    if (city) {
      handlers.onSelect?.({ kind: 'city', id: city.id });
      return;
    }
    const route = hitTestRoute(state, world.x, world.y);
    if (route) handlers.onSelect?.({ kind: 'route', id: route.id });
    else handlers.onSelect?.(null);
  });
}

function eventToWorld(canvas, camera, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  return screenToWorld(camera, x, y);
}
