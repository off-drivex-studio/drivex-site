
import { initScrambleText } from '../ScrambleText/ScrambleText.js';
import { clsx as cx } from 'clsx';
import gsap from 'gsap';
import {
  getPreloaderState,
  subscribePreloader,
} from '../PreloaderProvider/PreloaderProvider.js';

export function initPreloader(parentElement, props = {}) {
  let outerEl = null;
  let innerWrapperEl = null;
  let tileContainerEl = null;
  let scrambleReady = null;
  let timeline = null;
  let prefersReducedMotion = false;
  let mounted = false;
  let rafPending = false;
  let startupTimer = null;
  const childInstances = [];
  const root = document.createElement('div');
  root.setAttribute('data-theme', 'brand');
  const v = document.createElement('div');
  v.className = 'flex flex-col items-center gap-4';
  innerWrapperEl = v;

  const p = document.createElement('div');
  p.className = 'relative overflow-x-clip overflow-y-visible';
  p.style.width = '70';
  p.style.height = '16';
  tileContainerEl = p;
  const tileRefs = [];

  for (let idx = 0; idx < 4; idx++) {
    const tile = document.createElement('div');
    tile.className = 'absolute top-0 left-0 bg-foreground';
    tile.style.width = '16';
    tile.style.height = '16';
    tile.style.transform = 'translateX(-16px)';
    tile.style.transformOrigin = 'bottom right';
    tileRefs.push(tile);
    p.appendChild(tile);
  }
  v.appendChild(p);
  const g = document.createElement('div');
  g.className = 'overflow-hidden';

  function onReady(triggerFn) {
    scrambleReady = triggerFn;
  }
  const scrambleInst = initScrambleText(g, {
    revealMode: true,
    duration: 1,
    onReady,
    children: 'LOADING',
  });
  if (scrambleInst) childInstances.push(scrambleInst);
  v.appendChild(g);
  root.appendChild(v);
  outerEl = root;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  prefersReducedMotion = reducedMotionQuery.matches;

  function onReducedMotionChange(e) {
    prefersReducedMotion = e.matches;
  }
  reducedMotionQuery.addEventListener('change', onReducedMotionChange);

  function runGsapEffect(state) {
    const {
      phase: b,
      isInitialLoad: w,
      setPhase: C
    } = state;
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (timeline) {
      timeline.kill();
      timeline = null;
    }
    if (!w || b !== 'loading') return;
    if (prefersReducedMotion) {
      C('complete');
      return;
    }
    const tiles = tileRefs.filter(Boolean);
    if (tiles.length === 0) return;
    const startTimeline = () => {
      if (!scrambleReady) {
        rafPending = true;
        requestAnimationFrame(startTimeline);
        return;
      }
      rafPending = false;
      timeline = gsap.timeline();
      scrambleReady();
      tiles.forEach((tile, t) => {
        timeline.fromTo(
          tile, {
            x: t === 0 ? -16 : (t - 1) * 18,
            rotate: 0
          }, {
            x: 18 * t - 16,
            rotate: 90,
            duration: 0.7,
            ease: 'expo.inOut',
            immediateRender: false,
          },
          t === 0 ? 0 : '>-25%'
        );
      });
      const i = 2.2749999999999995;
      timeline.to(
        innerWrapperEl, {
          opacity: 0,
          duration: 0.4,
          ease: 'power3.out'
        },
        i + 0.2
      );
      const n = {
        value: 0
      };
      const s = {
        value: false
      };
      timeline.to(
        n, {
          value: 1,
          duration: 1.5,
          ease: 'expo.inOut',
          onUpdate: () => {
            if (!outerEl) return;
            const v = n.value;
            outerEl.style.clipPath =
              v <= 0 ?
              'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' :
              v >= 1 ?
              'polygon(0% 100%, 0% 100%, 0% 100%)' :
              v <= 0.5 ?
              `polygon(0% 100%, ${2 * v * 100}% 0%, 100% 0%, 100% 100%)` :
              `polygon(0% 100%, 100% ${(v - 0.5) * 200}%, 100% 100%)`;
            if (!s.value && n.value >= 0.9) {
              s.value = true;
              C('revealing');
            }
          },
        },
        i
      );
    };
    startupTimer = setTimeout(startTimeline, 100);
  }

  function applyState(state) {
    const {
      phase: b,
      isInitialLoad: w
    } = state;
    runGsapEffect(state);
    const shouldRender = w && b !== 'hidden';
    if (shouldRender) {
      const L = b === 'complete' && 'pointer-events-none';
      root.className = cx(
        'fixed inset-0 z-[10000] flex items-center justify-center bg-background',
        L
      );
      if (!mounted) {
        mounted = true;
        if (parentElement) parentElement.appendChild(root);
      }
    } else if (mounted) {
      mounted = false;
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  }
  let currentState = getPreloaderState();
  applyState(currentState);
  const unsubscribe = subscribePreloader(applyState);

  function destroy() {
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (rafPending) {
      rafPending = false;
    }
    if (timeline) {
      timeline.kill();
      timeline = null;
    }
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    unsubscribe();
    childInstances.forEach((inst) => inst?.destroy?.());
    childInstances.length = 0;
    if (mounted && root.parentNode) root.parentNode.removeChild(root);
    mounted = false;
    gsap.killTweensOf([innerWrapperEl, ...tileRefs]);
  }
  return {
    el: root,
    destroy
  };
}