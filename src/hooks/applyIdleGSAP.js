import { gsap } from '../vendor.js';

import {
  getPageTransitionContext,
  subscribePageTransition
} from './page-enter/PageEnterProvider.js';

 function applyIdleGSAP(callback, options = {}) {
  const { dependencies = [], scope } = options;
  void dependencies;

  let context = null;
  let isIdle = getPageTransitionContext().phase === 'idle';

  function setup() {
    if (context) context.revert();
    context = gsap.context((self) => {
      callback(self);
    }, scope);
  }

  function teardown() {
    if (context) {
      context.revert();
      context = null;
    }
  }

  function handlePhaseChange(ctx) {
    const phase = ctx.phase;
    let nextIsIdle = isIdle;
    if (phase === 'idle') nextIsIdle = true;
    else if (phase === 'holding') nextIsIdle = false;
    if (nextIsIdle === isIdle) return;
    isIdle = nextIsIdle;
    if (isIdle) setup();
    else teardown();
  }

  const unsubscribe = subscribePageTransition(handlePhaseChange);
  if (isIdle) setup();

  function destroy() {
    unsubscribe();
    teardown();
  }

  return { destroy };
}
