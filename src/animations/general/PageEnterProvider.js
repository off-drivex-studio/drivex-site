import { getPageTransitionState } from '../hooks/usePageTransition.js';
import {
  getPreloaderState,
  subscribePreloader,
} from '../PreloaderProvider/PreloaderProvider.js';


let currentEnterState = {
  phase: 'complete',
  register: () => {},
  unregister: () => {},
  prefersReducedMotion: false,
};
let enterSubscribers = [];

function notifyEnter() {
  for (const cb of enterSubscribers) cb(currentEnterState);
}

export function getPageEnterState() {
  return currentEnterState;
}

export function subscribePageEnter(cb) {
  enterSubscribers.push(cb);
  return function unsubscribe() {
    const idx = enterSubscribers.indexOf(cb);
    if (idx !== -1) enterSubscribers.splice(idx, 1);
  };
}

function compareByPriority(a, b) {
  return a.priority - b.priority;
}

export function initPageEnterProvider(parentElement, props = {}) {
  const { children: childInitializers = [] } = props;

  let localPhase = 'waiting';
  let prefersReducedMotion = false;

  const registry = new Map(); // I.current
  let alreadyFired = false; // P.current
  let fireTimer = null;
  let completeTimer = null;

  const childInstances = [];

  function register(id, trigger, priority = 0) {
    registry.set(id, { id, trigger, priority: priority ?? 0 });
  }

  function unregister(id) {
    registry.delete(id);
  }

  function fire() {
    if (alreadyFired) return;
    alreadyFired = true;
    localPhase = 'entering';
    publishState();

    const entries = Array.from(registry.values());
    entries.sort(compareByPriority);

    let lastPriority = -Infinity;
    let cumulativeDelay = 0;
    for (const entry of entries) {
      if (entry.priority > lastPriority) {
        lastPriority = entry.priority;
        if (cumulativeDelay > 0) cumulativeDelay += 0.08;
      }
      entry.trigger(cumulativeDelay);
    }

    if (completeTimer) clearTimeout(completeTimer);
    completeTimer = setTimeout(() => {
      localPhase = 'complete';
      publishState();
    }, 1e3 * (cumulativeDelay + 1));
  }

  function publishState() {
    currentEnterState = {
      phase: localPhase,
      register,
      unregister,
      prefersReducedMotion,
    };
    notifyEnter();
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  prefersReducedMotion = reducedMotionQuery.matches;
  function onReducedMotionChange(e) {
    prefersReducedMotion = e.matches;
    publishState();
  }
  reducedMotionQuery.addEventListener('change', onReducedMotionChange);

  let lastPageTransitionPhase = null;
  function onPageTransitionChange() {
    const { phase: w } = getPageTransitionState();
    if (lastPageTransitionPhase === w) return;
    lastPageTransitionPhase = w;
    if (w === 'entering' || w === 'holding') {
      localPhase = 'waiting';
      alreadyFired = false;
      publishState();
    }
  }

  function maybeScheduleFire(preloaderPhase, pageTransitionPhase) {
    if (fireTimer) {
      clearTimeout(fireTimer);
      fireTimer = null;
    }
    const preloaderReady =
      preloaderPhase === 'revealing' || preloaderPhase === 'hidden';
    if (
      (pageTransitionPhase === 'exiting' || pageTransitionPhase === 'idle') &&
      localPhase === 'waiting' &&
      preloaderReady
    ) {
      fireTimer = setTimeout(() => {
        fire();
      }, 250);
    }
  }

  function applyExternalState() {
    const { phase: preloaderPhase } = getPreloaderState();
    const { phase: pageTransitionPhase } = getPageTransitionState();
    onPageTransitionChange();
    maybeScheduleFire(preloaderPhase, pageTransitionPhase);
  }

  publishState();
  const unsubscribePreloader = subscribePreloader(applyExternalState);

  const el = document.createElement('div');
  for (const initChild of childInitializers) {
    if (typeof initChild !== 'function') continue;
    const inst = initChild(el, {});
    if (inst) childInstances.push(inst);
  }

  function destroy() {
    if (fireTimer) {
      clearTimeout(fireTimer);
      fireTimer = null;
    }
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    unsubscribePreloader();
    childInstances.forEach((inst) => inst?.destroy?.());
    childInstances.length = 0;

    currentEnterState = {
      phase: 'complete',
      register: () => {},
      unregister: () => {},
      prefersReducedMotion: false,
    };
    notifyEnter();

    el.remove();
  }

  if (parentElement) parentElement.appendChild(el);
  return { el, destroy };
}
