import gsap from 'gsap';
import { ScrambleTextPlugin } from '../vendor.js';
import { DEFAULT_SCRAMBLE_CHARS } from '../utils/scrambleChars.js';

function splitIntoVisualLines(el) {
  const text = el.innerText || '';
  if (text.trim().length === 0) return [];
  if (text.includes('\n')) return text.split('\n').filter((line) => line.length > 0);
  const firstChild = el.firstChild;
  if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) return [text];
  const range = document.createRange();
  const lines = [];
  let current = '';
  let lastTop = null;
  const len = firstChild.length;
  for (let i = 0; i < text.length && i < len; i++) {
    range.setStart(firstChild, i);
    range.setEnd(firstChild, i + 1);
    const rect = range.getBoundingClientRect();
    if (lastTop !== null && Math.abs(rect.top - lastTop) > 2) {
      if (current.length > 0) lines.push(current);
      current = '';
    }
    current += text[i];
    lastTop = rect.top;
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [text];
}


function buildScrambledPlaceholder(text, charSet = DEFAULT_SCRAMBLE_CHARS) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    result += ch === ' ' ? ch : charSet[Math.floor(Math.random() * charSet.length)];
  }
  return result;
}


export function useDualLayerScramble(options) {
  let targetEl = null; // e.current
  let timelineRef = null; // D.current
  let originalText = ''; // t.current
  let originalHTML = ''; // r.current
  let originalSize = null; // n.current  ({ width, height })
  let lineData = []; // l.current
  let lineSpanEls = []; // a.current
  let isAnimatingFlag = false; // o.current
  let isPreparedFlag = false; // c.current

  function ref(el) {

    targetEl = el;
    if (!targetEl) return;
    const text = targetEl.innerText ?? '';
    if (text.trim().length > 0) {
      originalText = text;
      originalHTML = targetEl.innerHTML;
      originalSize = { width: targetEl.offsetWidth, height: targetEl.offsetHeight };
    }
  }

  function killTimelineOnly() {
    // C
    if (timelineRef) {
      timelineRef.kill();
      timelineRef = null;
      isAnimatingFlag = false;
    }
  }

  function prepareLines() {
    // F
    if (!targetEl || isPreparedFlag) return;
    const el = targetEl;
    if (0 === (originalText || el.innerText || '').trim().length) return;
    originalSize = originalSize ?? { width: el.offsetWidth, height: el.offsetHeight };

    const lines = splitIntoVisualLines(el);
    const measureEl = document.createElement('div');
    measureEl.style.cssText = `
			position: absolute;
			visibility: hidden;
			pointer-events: none;
			white-space: nowrap;
		`;
    const computed = window.getComputedStyle(el);
    measureEl.style.font = computed.font;
    measureEl.style.fontSize = computed.fontSize;
    measureEl.style.fontFamily = computed.fontFamily;
    measureEl.style.fontWeight = computed.fontWeight;
    measureEl.style.letterSpacing = computed.letterSpacing;
    measureEl.style.textTransform = computed.textTransform;
    document.body.appendChild(measureEl);
    lineData = lines.map((text) => {
      measureEl.textContent = text;
      return { text, width: measureEl.offsetWidth, height: measureEl.offsetHeight };
    });
    document.body.removeChild(measureEl);

    const maxLineWidth = Math.max(...lineData.map((d) => d.width));
    const totalHeight = lineData.reduce((sum, d) => sum + d.height, 0);
    const finalWidth = Math.max(originalSize?.width ?? 0, maxLineWidth);
    const finalHeight = Math.max(originalSize?.height ?? 0, totalHeight);

    isPreparedFlag = true;
    gsap.set(el, { width: finalWidth, height: finalHeight, display: 'inline-block', overflow: 'hidden' });
    el.innerHTML = '';
    lineSpanEls = [];
    lineData.forEach((lineInfo) => {
      const span = document.createElement('span');
      span.style.cssText = `
				display: block;
				opacity: 0;
				width: ${lineInfo.width}px;
				height: ${lineInfo.height}px;
				overflow: hidden;
				white-space: nowrap;
			`;
      span.innerText = lineInfo.text;
      el.appendChild(span);
      lineSpanEls.push(span);
    });
    gsap.set(el, { opacity: 1 });
  }

  function scramble(overrideOptions) {
    // h / H
    if (!targetEl) return null;
    if (isAnimatingFlag) return timelineRef;
    prepareLines();

    const merged = { ...options, ...overrideOptions };
    const dur = merged.duration ?? 1;
    const speed = merged.speed ?? 1;
    const charSet = merged.chars ?? DEFAULT_SCRAMBLE_CHARS;
    const firstColor = merged.firstColorClass ?? 'scramble-brand';
    const secondColor = merged.secondColorClass ?? 'scramble-foreground';
    const staggerValue = merged.stagger ?? 0.08;

    if (lineData.length === 0 || lineSpanEls.length === 0) return null;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lineSpanEls.forEach((el, i) => {
        const info = lineData[i];
        if (info) el.innerText = info.text;
        el.style.opacity = '1';
        el.className = el.className.replace(/\bscramble-\w+\b/g, '');
      });
      merged.onComplete?.();
      return null;
    }

    killTimelineOnly();
    isAnimatingFlag = true;
    timelineRef = gsap.timeline({
      onComplete: () => {
        isAnimatingFlag = false;
        timelineRef = null;
        merged.onComplete?.();
      },
    });

    lineSpanEls.forEach((el, i) => {
      const info = lineData[i];
      if (!info) return;
      const text = info.text;
      const startTime = i * staggerValue;
      const scrambledPlaceholder = buildScrambledPlaceholder(text, charSet);
      const nonWhitespaceCount = text.replace(/\s/g, '').length;
      const blankText = text.replace(/[^\s]/g, ' ');

      timelineRef?.add(() => {
        gsap.set(el, { opacity: 1 });
        el.innerText = blankText;
      }, startTime);
      timelineRef?.to(
        el,
        {
          duration: dur,
          scrambleText: { text: scrambledPlaceholder, chars: charSet, speed, revealDelay: 0.1, oldClass: firstColor, newClass: firstColor },
          ease: 'none',
        },
        startTime
      );
      timelineRef?.to(
        el,
        {
          duration: dur,
          scrambleText: { text, chars: charSet, speed, revealDelay: 0.1, oldClass: firstColor, newClass: secondColor },
          ease: 'none',
        },
        startTime + (nonWhitespaceCount > 0 ? dur / nonWhitespaceCount : 0)
      );
    });

    return timelineRef;
  }

  function kill() {
    killTimelineOnly();
    if (targetEl && isPreparedFlag) {
      targetEl.innerHTML = originalHTML || originalText;
      gsap.set(targetEl, { opacity: 0, width: 'auto', height: 'auto', overflow: 'visible' });
      lineSpanEls = [];
      lineData = [];
      isPreparedFlag = false;
    }
  }

  return {
    ref,
    scramble,
    kill,
    get isAnimating() {
      return isAnimatingFlag;
    },
  };
}

