const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const CHROME = 'C:\\Users\\13281\\.cache\\hyperframes\\chrome\\chrome-headless-shell\\win64-131.0.6778.85\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const HTML = process.env.SITE_URL || ('file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
const OUT = path.resolve(__dirname, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  const bad = [];
  p.on('requestfailed', r => bad.push('REQ ' + r.url()));
  p.on('pageerror', e => bad.push('JS ' + e.message));
  await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await p.goto(HTML, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  async function flipTo(i) {
    await p.evaluate(n => document.querySelectorAll('#dots button')[n].click(), i);
    await new Promise(r => setTimeout(r, 1900)); // 弹簧+面板入场
  }

  await p.screenshot({ path: path.join(OUT, 'pg0.png') });
  console.log('pg0');

  // 翻页中途抓一帧(机位拉远)
  await p.evaluate(() => document.querySelectorAll('#dots button')[1].click());
  await new Promise(r => setTimeout(r, 320));
  await p.screenshot({ path: path.join(OUT, 'pg0to1_mid.png') });
  await new Promise(r => setTimeout(r, 1700));
  await p.screenshot({ path: path.join(OUT, 'pg1.png') });
  console.log('pg1');

  // 扰动
  await p.click('#perturbBtn');
  await new Promise(r => setTimeout(r, 2600));
  await p.screenshot({ path: path.join(OUT, 'pg1_chaos.png') });
  await p.click('#resetBtn');
  console.log('pg1 chaos');

  // 拖拽旋转视角
  await p.mouse.move(500, 500);
  await p.mouse.down();
  await p.mouse.move(760, 360, { steps: 12 });
  await p.mouse.up();
  await new Promise(r => setTimeout(r, 1500));
  await p.screenshot({ path: path.join(OUT, 'pg1_rotated.png') });
  console.log('pg1 rotated');

  // 乱纪元分屏:鼠标两侧
  await flipTo(2);
  await p.mouse.move(360, 520);
  await new Promise(r => setTimeout(r, 1300));
  await p.screenshot({ path: path.join(OUT, 'pg2_left.png') });
  await p.mouse.move(1300, 520);
  await new Promise(r => setTimeout(r, 1300));
  await p.screenshot({ path: path.join(OUT, 'pg2_right.png') });
  console.log('pg2');

  await flipTo(3);
  await p.screenshot({ path: path.join(OUT, 'pg3.png') });
  await flipTo(4);
  await p.screenshot({ path: path.join(OUT, 'pg4.png') });
  await flipTo(5);
  await p.screenshot({ path: path.join(OUT, 'pg5.png') });
  console.log('pg3-5');

  // 手机
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.evaluate(() => document.querySelectorAll('#dots button')[0].click());
  await new Promise(r => setTimeout(r, 1800));
  await p.screenshot({ path: path.join(OUT, 'mobile_p0.png') });
  await p.evaluate(() => document.querySelectorAll('#dots button')[2].click());
  await new Promise(r => setTimeout(r, 2200));
  await p.screenshot({ path: path.join(OUT, 'mobile_p2.png') });

  console.log('problems:', bad.length ? bad.join(' | ') : 'none');
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
