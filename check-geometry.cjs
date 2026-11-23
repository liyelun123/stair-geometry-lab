'use strict';
// 独立手算样例和边界校验。可选：安装 Node.js 后运行 node check-geometry.cjs。
const assert = require('node:assert/strict');
const G = require('./geometry.js');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const a = G.calculate({...G.defaults,risers:16});
assert.equal(a.rise,187.5);
assert.equal(a.treads,15);
assert.equal(a.run,4200);
assert.equal(a.length,5400);
close(a.area,5.94);
const b = G.calculate(G.defaults);
close(b.rise,500/3);
assert.equal(b.treads,17);
assert.equal(b.run,4760);
assert.equal(b.length,5960);
close(b.area,6.556);
close(b.run-a.run,560);
close(b.rise-a.rise,-125/6);
// 增加一级应恰好多出一段踏面，且整段仍准确到达目标标高。
for(let n=12;n<=24;n++) {
  const p={...G.defaults,risers:n};
  const m=G.calculate(p),outline=G.profile(p);
  assert.equal(outline.length,2*n+2);
  assert.equal(Math.max(...outline.map(p=>p[0])),m.length);
  close(Math.max(...outline.map(p=>p[1])),p.height);
  close(m.rise*n,p.height);
  const verticals=outline.slice(1,-2).filter((pt,i)=>pt[0]===outline[i][0]&&pt[1]>outline[i][1]);
  assert.equal(verticals.length,n);
  assert.equal(m.run,(n-1)*p.tread);
}
for(const height of [2400,4200]) for(const risers of [12,24]) for(const tread of [200,350]) {
  const m=G.calculate({...G.defaults,height,risers,tread});
  assert.ok(m.area>0 && m.pitch>0 && m.pitch<90);
}
for(const [key,range] of Object.entries(G.limits)) {
  for(const value of [NaN,Infinity,range[0]-1,range[1]+1]) assert.throws(()=>G.calculate({...G.defaults,[key]:value}),RangeError);
}
assert.throws(()=>G.calculate({...G.defaults,risers:16.5}),RangeError);
console.log('PASS: hand-calculated 16/18-riser examples, all 13 riser counts, extrema and invalid inputs.');
