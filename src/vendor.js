import gsap from './gsap-public/esm/index.js';
import ScrollTrigger from './gsap-public/esm/ScrollTrigger.js';
import ScrambleTextPlugin from './gsap-public/esm/ScrambleTextPlugin.js';
import CustomEase from './gsap-public/esm/CustomEase.js';
import SplitText from './gsap-public/esm/SplitText.js';
import Flip from './gsap-public/esm/Flip.js';
import Lenis from 'lenis';

gsap.registerPlugin(
  ScrollTrigger,
  ScrambleTextPlugin,
  SplitText,
  CustomEase,
  Flip
);
export {
  gsap,
  ScrollTrigger,
  ScrambleTextPlugin,
  CustomEase,
  SplitText,
  Flip,
  Lenis
};