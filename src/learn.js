// 🎓 learn cards: short, kid-friendly explanations with a small picture, opened from the
// 🎓 button on a message. Nothing here is required to play.

// SVG path for a gear with square-ish teeth
function gearPath(cx, cy, r, teeth, depth = 7) {
  const pts = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const corners = [
      [r - depth, a],
      [r, a + step * 0.12],
      [r, a + step * 0.45],
      [r - depth, a + step * 0.57],
    ];
    for (const [rad, ang] of corners) pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function gear(cx, cy, r, teeth, fill, extra = '') {
  return `<path d="${gearPath(cx, cy, r, teeth)}" fill="${fill}" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/>${extra}`;
}

// One tooth highlighted in yellow, with a label pointing at it
const toothR = 50;
const toothStep = (Math.PI * 2) / 16;
const tx = 100 + (toothR - 3) * Math.cos(-Math.PI / 2 + toothStep * 0.3);
const ty = 75 + (toothR - 3) * Math.sin(-Math.PI / 2 + toothStep * 0.3);

const topics = {
  teeth: {
    title: 'What are gear teeth?',
    text: 'Teeth are the little bumps around the edge of a gear. They fit into the gaps in the chain, like fingers into a glove, so the chain can grab the gear and never slip.',
    art: `<svg viewBox="0 0 220 150" aria-hidden="true">
      ${gear(100, 75, toothR, 16, '#cfd4dc')}
      <circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="9" fill="#ffcf4a" stroke="var(--ink)" stroke-width="2"/>
      <path d="M${(tx + 12).toFixed(1)},${(ty - 6).toFixed(1)} Q160,8 178,30" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
      <text x="160" y="52" font-size="17" font-weight="900" fill="var(--ink)">a tooth!</text>
    </svg>`,
  },
  chain: {
    title: 'How does the chain work?',
    text: 'The chain is a loop of tiny links. When you push the pedal, the big gear turns, and its teeth pull the chain along. The chain then pulls the little gear on the back wheel.',
    art: `<svg viewBox="0 0 220 150" aria-hidden="true">
      <rect x="40" y="42" width="150" height="66" rx="33" fill="none" stroke="var(--ink)" stroke-width="6" stroke-dasharray="7 5"/>
      ${gear(158, 75, 32, 16, '#cfd4dc')}
      ${gear(62, 75, 18, 8, '#cfd4dc')}
      <path d="M85 30 L125 30" stroke="#17c3b2" stroke-width="5" stroke-linecap="round"/>
      <path d="M118 22 L128 30 L118 38" fill="none" stroke="#17c3b2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  twice: {
    title: 'Why does the wheel spin twice?',
    text: 'The big gear has twice as many teeth as the little gear. When the big gear goes around once, it pulls enough chain to turn the little gear around twice. The little gear is stuck to the wheel, so the wheel spins twice too!',
    art: `<svg viewBox="0 0 220 150" aria-hidden="true">
      ${gear(70, 78, 46, 16, '#cfd4dc')}
      ${gear(170, 78, 24, 8, '#cfd4dc')}
      <text x="70" y="140" font-size="14" font-weight="900" text-anchor="middle" fill="var(--ink)">big gear: 1 turn</text>
      <text x="170" y="140" font-size="14" font-weight="900" text-anchor="middle" fill="var(--ink)">little: 2 turns</text>
      <text x="170" y="34" font-size="22" font-weight="900" text-anchor="middle" fill="#ee4b3c">×2</text>
    </svg>`,
  },
};

export function showLearn(topic) {
  const t = topics[topic];
  if (!t) return;
  document.getElementById('learn-art').innerHTML = t.art;
  document.getElementById('learn-title').textContent = t.title;
  document.getElementById('learn-text').textContent = t.text;
  const card = document.getElementById('learn');
  card.hidden = false;
  document.getElementById('learn-ok').onclick = () => (card.hidden = true);
}
