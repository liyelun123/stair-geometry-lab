/* 几何计算独立于界面。单位统一为 mm；平台是最上一级踏面。 */
(function (root) {
  'use strict';
  const limits = Object.freeze({
    height: [2400, 4200], risers: [12, 24], tread: [200, 350],
    width: [800, 1600], landing: [800, 1800]
  });
  const defaults = Object.freeze({height: 3000, risers: 18, tread: 280, width: 1100, landing: 1200});
  function calculate(input) {
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
        throw new RangeError(key + ' 超出本实验的参数范围');
      }
    }
    if (!Number.isInteger(input.risers)) throw new RangeError('上升级数必须是整数');
    const rise = input.height / input.risers;
    const treads = input.risers - 1;
    const run = treads * input.tread;
    const length = run + input.landing;
    return {
      ...input, rise, treads, run, length,
      area: length * input.width / 1000000,
      // 连续踏步鼻口连线的倾角；不是 H / 水平投影长。
      pitch: Math.atan2(rise, input.tread) * 180 / Math.PI,
      stride: 2 * rise + input.tread
    };
  }
  function profile(input) {
    const m = calculate(input);
    const points = [[0, 0]];
    for (let i = 0; i < m.risers; i++) {
      points.push([i * m.tread, (i + 1) * m.rise]);
      if (i < m.risers - 1) points.push([(i + 1) * m.tread, (i + 1) * m.rise]);
    }
    points.push([m.length, m.height], [m.length, 0]);
    return points;
  }
  const api = Object.freeze({limits, defaults, calculate, profile});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StairGeometry = api;
})(typeof window !== 'undefined' ? window : this);
