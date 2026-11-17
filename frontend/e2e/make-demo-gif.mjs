// Turns the video recorded by e2e/demo.spec.ts into docs/screenshots/demo.gif.
// Keeps [start, cutFrom] and [cutTo, end] from test-results/demo/cuts.json, so the blank first
// frames and Pyodide's first download are left out. Run by `npm run e2e:demo`.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const DIR = 'test-results/demo';
const OUT = '../docs/screenshots/demo.gif';
const FPS = Number(process.env['GIF_FPS'] ?? 10);
const WIDTH = Number(process.env['GIF_WIDTH'] ?? 960);
const COLORS = Number(process.env['GIF_COLORS'] ?? 128);

const video = readFileSync(`${DIR}/video.txt`, 'utf8').trim();
const { start, cutFrom, cutTo, end } = JSON.parse(readFileSync(`${DIR}/cuts.json`, 'utf8'));
const keep = `between(t,${start},${cutFrom})+between(t,${cutTo},${end})`;

const filter = [
  `[0:v]fps=${FPS},select='${keep}',setpts=N/${FPS}/TB,scale=${WIDTH}:-1:flags=lanczos,split[a][b]`,
  `[a]palettegen=max_colors=${COLORS}:stats_mode=diff[p]`,
  `[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
].join(';');

execFileSync(process.env['FFMPEG'] ?? 'ffmpeg', ['-y', '-v', 'error', '-i', video, '-filter_complex', filter, OUT], {
  stdio: 'inherit',
});

const seconds = cutFrom - start + (end - cutTo);
const mb = statSync(OUT).size / 1024 / 1024;
console.log(`${OUT}: ${seconds.toFixed(1)} s, ${WIDTH}px wide, ${FPS} fps, ${mb.toFixed(2)} MB`);
