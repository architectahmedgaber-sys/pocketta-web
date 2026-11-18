// Draws "my month" as a picture and shares it (or saves it when the phone cannot share files).
const W = 1080, H = 1500;
const PALETTE = ['#8DD5B3', '#FFC857', '#7CB7FF', '#FF9E7A', '#D6A2E8'];
const short = (v) => Math.round(v).toLocaleString('en-US');

function draw(d) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1F6B4F'); g.addColorStop(1, '#0C3526');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const m = 90, font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const t = (s, x, y, size, { bold = false, color = '#fff', alpha = 1, align = 'left' } = {}) => {
    c.font = `${bold ? '700 ' : ''}${size}px ${font}`; c.fillStyle = color; c.globalAlpha = alpha; c.textAlign = align; c.fillText(s, x, y); c.globalAlpha = 1;
  };
  t('Pocketta', m, 130, 40, { bold: true, alpha: 0.8 });
  t(d.month, m, 250, 84, { bold: true });
  t('Spent', m, 380, 40, { alpha: 0.8 });
  t(`${short(d.spent)} ${d.currency}`, m, 490, 120, { bold: true });
  if (d.previousSpent > 0) {
    const pct = Math.trunc((d.spent - d.previousSpent) / d.previousSpent * 100);
    const [txt, col] = pct > 0 ? [`▲ ${pct}% vs last month`, '#FFB4A9'] : pct < 0 ? [`▼ ${-pct}% vs last month`, '#A9F0CF'] : ['＝ vs last month', '#fff'];
    t(txt, m, 570, 44, { bold: true, color: col });
  }
  const colW = (W - 2 * m) / 2, left = d.income - d.spent;
  t('Income', m, 700, 36, { alpha: 0.8 }); t(short(d.income), m, 770, 64, { bold: true });
  t('Left', m + colW, 700, 36, { alpha: 0.8 }); t(short(left), m + colW, 770, 64, { bold: true, color: left < 0 ? '#FFB4A9' : '#fff' });
  t('Where it went', m, 900, 36, { alpha: 0.8 });
  const total = Math.max(d.spent, 1);
  let y = 950;
  d.categories.slice(0, 5).forEach(([name, v], i) => {
    t(name, m, y + 36, 38, { bold: true });
    t(short(v), W - m, y + 36, 38, { alpha: 0.86, align: 'right' });
    const by = y + 54, bw = W - 2 * m;
    c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.roundRect(m, by, bw, 18, 9); c.fill();
    c.fillStyle = PALETTE[i % PALETTE.length]; c.beginPath(); c.roundRect(m, by, bw * Math.min(Math.max(v / total, 0.02), 1), 18, 9); c.fill();
    y += 96;
  });
  return cv;
}

/** Returns 'shared', 'saved' or 'cancelled'. */
export async function shareMonth(d) {
  const cv = draw(d);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('no picture');
  const file = new File([blob], 'pocketta-month.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My month' }); return 'shared'; }
  } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return 'saved';
}
