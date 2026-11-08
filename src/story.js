// The flat storybook garage (art/story.svg). Before the workbench: tap the bike to zoom in
// and build. After: the bike comes back finished, the daughter rides off, Mom waves and
// the dog chases after her. The art's CSS lives in style.css under "Storybook garage".
import { feel } from './feel.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Story {
  constructor() {
    this.root = document.getElementById('story');
    this.art = document.getElementById('story-art');
    this.caption = document.getElementById('story-caption');
  }

  async load() {
    if (this.svg) return;
    // Same ?v= version stamp as this file, so a new release never shows old art
    const version = new URL(import.meta.url).search;
    const res = await fetch(new URL(`../art/story.svg${version}`, import.meta.url));
    this.art.innerHTML = await res.text();
    this.svg = this.art.querySelector('svg');
    this.fit();
    window.addEventListener('resize', () => this.fit());
  }

  // Phones crop in on the people and the bike (leaving room under them for the caption);
  // bigger screens see the whole garage
  fit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let box = '0 160 800 820';
    if (h > w * 1.1) box = '50 330 660 560';
    else if (h < 520) box = '0 380 800 600';
    this.svg.setAttribute('viewBox', box);
  }

  show() {
    this.root.hidden = false;
    document.body.classList.add('in-story');
  }

  hide() {
    this.root.hidden = true;
    document.body.classList.remove('in-story');
  }

  // Zoom from (or into) a point on the art, measured in screen pixels
  aimAt(el) {
    const r = el.getBoundingClientRect();
    const s = this.svg.getBoundingClientRect();
    this.svg.style.transformOrigin = `${r.left + r.width / 2 - s.left}px ${r.top + r.height / 2 - s.top}px`;
  }

  // The opening scene. onEnter runs once the player taps the bike and the zoom finishes.
  async before(onEnter) {
    await this.load();
    this.root.className = 'before';
    this.show();
    this.caption.textContent = 'Mom and her daughter are finishing her new bike while Ninja naps. Tap the bike to help with the gears!';
    const targets = [this.svg.querySelector('#st-bike'), this.svg.querySelector('#st-tap')];
    const go = async () => {
      for (const t of targets) t.removeEventListener('click', go);
      feel('whoosh');
      this.aimAt(targets[0]);
      this.root.classList.add('zoom');
      await wait(900);
      this.hide();
      this.root.classList.remove('zoom');
      onEnter();
    };
    for (const t of targets) t.addEventListener('click', go);
  }

  // The ending: zoom back out to the finished bike, then the ride. onDone runs at the end.
  async after(onDone) {
    await this.load();
    // 'reset' snaps the rider and dog back home instantly when the ride is watched again
    this.root.className = 'after reset';
    this.show();
    this.aimAt(this.svg.querySelector('#st-bike')); // measure before zooming
    this.root.classList.add('zoom');
    this.svg.getBoundingClientRect(); // apply the zoomed-in start before animating out
    requestAnimationFrame(() => this.root.classList.remove('zoom', 'reset'));
    this.caption.textContent = 'The bike is ready!';
    await wait(1500);
    feel('bell');
    this.root.classList.add('mounted');
    this.caption.textContent = 'She puts on her helmet and hops on…';
    await wait(1100);
    this.root.classList.add('riding', 'cheer', 'chase');
    this.caption.textContent = "And she's off! Mom waves, and Ninja races after her.";
    setTimeout(() => feel('woof'), 700);
    setTimeout(() => feel('woof'), 1500);
    await wait(4300);
    onDone();
  }
}
