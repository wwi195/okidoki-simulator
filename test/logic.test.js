'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../logic.js');

function withMockRandom(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[Math.min(i++, values.length - 1)];
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

test('placeholder: module loads', () => {
  assert.equal(typeof logic, 'object');
});

test('medal economics: 20 yen/medal, 5000 yen invests 250 medals', () => {
  assert.equal(logic.MEDAL_UNIT_PRICE, 20);
  assert.equal(logic.INVEST_YEN, 5000);
  assert.equal(logic.INVEST_MEDALS, 250);
});

test('KOYAKU_PROB has the 6 common-across-settings role probabilities', () => {
  assert.equal(logic.KOYAKU_PROB.replay, 1 / 5.05);
  assert.equal(logic.KOYAKU_PROB.cherry, 1 / 32.13);
  assert.equal(logic.KOYAKU_PROB.suika, 1 / 128.00);
  assert.equal(logic.KOYAKU_PROB.kakuteiyaku, 1 / 8192.00);
  assert.equal(logic.KOYAKU_PROB.kakuteiCherry, 1 / 10922.67);
  assert.equal(logic.KOYAKU_PROB.chudanCherry, 1 / 32768.00);
});

test('COMMON_BELL_PROB has the setting-dependent common bell probability', () => {
  assert.equal(logic.COMMON_BELL_PROB[1], 1 / 168.04);
  assert.equal(logic.COMMON_BELL_PROB[2], 1 / 158.30);
  assert.equal(logic.COMMON_BELL_PROB[3], 1 / 149.63);
  assert.equal(logic.COMMON_BELL_PROB[4], 1 / 141.85);
  assert.equal(logic.COMMON_BELL_PROB[5], 1 / 134.85);
  assert.equal(logic.COMMON_BELL_PROB[6], 1 / 128.50);
});

test('FIRST_BELL_PROB has the setting-dependent 中/右1stベル probability (never pays out in normal mode)', () => {
  assert.equal(logic.FIRST_BELL_PROB[1], 1 / 5.29);
  assert.equal(logic.FIRST_BELL_PROB[2], 1 / 5.29);
  assert.equal(logic.FIRST_BELL_PROB[3], 1 / 5.29);
  assert.equal(logic.FIRST_BELL_PROB[4], 1 / 5.29);
  assert.equal(logic.FIRST_BELL_PROB[5], 1 / 5.30);
  assert.equal(logic.FIRST_BELL_PROB[6], 1 / 5.30);
});

test('KOYAKU_PAYOUT has payout medals for each paying small role', () => {
  assert.equal(logic.KOYAKU_PAYOUT.firstBell, 0); // 通常時は押し順を知らないため発動しない(=ハズレ扱い)
  assert.equal(logic.KOYAKU_PAYOUT.commonBell, 7);
  assert.equal(logic.KOYAKU_PAYOUT.cherry, 1);
  assert.equal(logic.KOYAKU_PAYOUT.suika, 4);
  assert.equal(logic.KOYAKU_PAYOUT.kakuteiyaku, 1);
  assert.equal(logic.KOYAKU_PAYOUT.kakuteiCherry, 1);
  assert.equal(logic.KOYAKU_PAYOUT.chudanCherry, 1);
});

test('rollYaku picks the role whose cumulative probability range contains the draw', () => {
  // cumulative thresholds at setting 1, in table order:
  // replay < replay+firstBell < +commonBell(s1) < +cherry < +suika < +kakuteiyaku < +kakuteiCherry < +chudanCherry < miss
  assert.equal(withMockRandom([0], () => logic.rollYaku(1)), 'replay');
  assert.equal(withMockRandom([0.99999], () => logic.rollYaku(1)), 'miss');
});

test('rollYaku lands in a middle role interval, not just the endpoints', () => {
  const afterReplayAndBell = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1];
  assert.equal(withMockRandom([afterReplayAndBell + 0.00001], () => logic.rollYaku(1)), 'commonBell');
});

test('MISS_PAYOUT_SHARE moves 25% of the residual (post-named-role) probability to a 1-medal payout', () => {
  assert.equal(logic.MISS_PAYOUT_SHARE, 0.25);
  assert.equal(logic.KOYAKU_PAYOUT.missPayout, 1);
});

test('rollYaku splits the residual into missPayout(25%) then miss(75%)', () => {
  const namedCum = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1] + logic.COMMON_BELL_PROB[1]
    + logic.KOYAKU_PROB.cherry + logic.KOYAKU_PROB.suika + logic.KOYAKU_PROB.kakuteiyaku
    + logic.KOYAKU_PROB.kakuteiCherry + logic.KOYAKU_PROB.chudanCherry;
  const missPayoutThreshold = namedCum + (1 - namedCum) * logic.MISS_PAYOUT_SHARE;

  assert.equal(withMockRandom([namedCum + 0.0000001], () => logic.rollYaku(1)), 'missPayout');
  assert.equal(withMockRandom([missPayoutThreshold - 0.0000001], () => logic.rollYaku(1)), 'missPayout');
  assert.equal(withMockRandom([missPayoutThreshold + 0.0000001], () => logic.rollYaku(1)), 'miss');
});

test('triggerBucket classifies confirmed-BIG roles, cherry, suika, and everything else', () => {
  assert.equal(logic.triggerBucket('chudanCherry'), 'confirmed');
  assert.equal(logic.triggerBucket('kakuteiCherry'), 'confirmed');
  assert.equal(logic.triggerBucket('kakuteiyaku'), 'confirmed');
  assert.equal(logic.triggerBucket('cherry'), 'cherry');
  assert.equal(logic.triggerBucket('suika'), 'suika');
  assert.equal(logic.triggerBucket('replay'), 'other');
  assert.equal(logic.triggerBucket('firstBell'), 'other');
  assert.equal(logic.triggerBucket('commonBell'), 'other');
  assert.equal(logic.triggerBucket('miss'), 'other');
  assert.equal(logic.triggerBucket('missPayout'), 'other');
});

test('transitionRole keeps chudanCherry and confirmed(kakuteiCherry/kakuteiyaku) separate', () => {
  assert.equal(logic.transitionRole('chudanCherry'), 'chudanCherry');
  assert.equal(logic.transitionRole('kakuteiCherry'), 'confirmed');
  assert.equal(logic.transitionRole('kakuteiyaku'), 'confirmed');
  assert.equal(logic.transitionRole('cherry'), 'cherry');
  assert.equal(logic.transitionRole('suika'), 'suika');
  assert.equal(logic.transitionRole('replay'), 'other');
  assert.equal(logic.transitionRole('ceiling'), 'other'); // 天井強制当選も「上記以外」扱い
});

test('SETTING_POSITION is the even-favoring stepped curve from 0 to 1', () => {
  assert.deepEqual(logic.SETTING_POSITION, { 1: 0.00, 2: 0.25, 3: 0.35, 4: 0.65, 5: 0.75, 6: 1.00 });
});

test('interpolateBySetting maps a [min,max] range through SETTING_POSITION', () => {
  assert.equal(logic.interpolateBySetting(10, 20, 1), 10);
  assert.equal(logic.interpolateBySetting(10, 20, 6), 20);
  assert.equal(logic.interpolateBySetting(10, 20, 2), 10 + 0.25 * 10);
  assert.equal(logic.interpolateBySetting(10, 20, 4), 10 + 0.65 * 10);
});

test('BONUS_PROB_TABLE has BIG/REG base probability per setting', () => {
  assert.equal(logic.BONUS_PROB_TABLE[1].big, 1 / 394.1);
  assert.equal(logic.BONUS_PROB_TABLE[1].reg, 1 / 632.1);
  assert.equal(logic.BONUS_PROB_TABLE[6].big, 1 / 322.6);
  assert.equal(logic.BONUS_PROB_TABLE[6].reg, 1 / 452.1);
});

test('rollBigOrReg splits by each setting\'s base BIG:REG probability ratio', () => {
  const bigShare1 = (1 / 394.1) / (1 / 394.1 + 1 / 632.1);
  assert.equal(withMockRandom([0], () => logic.rollBigOrReg(1)), 'big');
  assert.equal(withMockRandom([bigShare1 + 0.001], () => logic.rollBigOrReg(1)), 'reg');
});

test('modeGroupKey maps the 8 internal modes to their 4 win-rate groups', () => {
  assert.equal(logic.modeGroupKey('normalA'), 'normalAB');
  assert.equal(logic.modeGroupKey('normalB'), 'normalAB');
  assert.equal(logic.modeGroupKey('hikimodoshi'), 'hikimodoshi');
  assert.equal(logic.modeGroupKey('chance'), 'chance');
  assert.equal(logic.modeGroupKey('hosho'), 'heavenGroup');
  assert.equal(logic.modeGroupKey('tengoku'), 'heavenGroup');
  assert.equal(logic.modeGroupKey('dokidoki'), 'heavenGroup');
  assert.equal(logic.modeGroupKey('superDokidoki'), 'heavenGroup');
});

test('WIN_RATE_TABLE has RB/BB win rates (%) per mode group, role, and setting 1-6', () => {
  // +1ポイント調整は機械割が過剰になったため撤回し、元の実測値に戻した
  assert.deepEqual(logic.WIN_RATE_TABLE.normalAB.suika.rb, [1.83, 1.98, 2.14, 2.29, 2.44, 2.59]);
  assert.deepEqual(logic.WIN_RATE_TABLE.normalAB.suika.bb, [1.83, 1.98, 2.14, 2.29, 2.44, 2.59]);
  assert.deepEqual(logic.WIN_RATE_TABLE.normalAB.cherry.rb, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(logic.WIN_RATE_TABLE.normalAB.cherry.bb, [0.92, 1.07, 1.22, 1.37, 1.53, 1.68]);
  assert.deepEqual(logic.WIN_RATE_TABLE.heavenGroup.other.rb, [3.66, 3.66, 3.66, 3.66, 3.66, 3.66]);
  assert.deepEqual(logic.WIN_RATE_TABLE.heavenGroup.other.bb, [8.54, 8.54, 8.54, 8.54, 8.54, 8.54]);
  assert.deepEqual(logic.WIN_RATE_TABLE.heavenGroup.suika.bb, [12.50, 13.26, 14.03, 14.79, 15.55, 16.31]);
  assert.deepEqual(logic.WIN_RATE_TABLE.heavenGroup.cherry.bb, [6.25, 6.63, 7.01, 7.39, 7.78, 8.16]);
  assert.deepEqual(logic.WIN_RATE_TABLE.hikimodoshi.suika.bb, [4.58, 4.96, 5.34, 5.72, 6.10, 6.48]);
  assert.deepEqual(logic.WIN_RATE_TABLE.hikimodoshi.cherry.bb, [2.29, 2.67, 3.05, 3.43, 3.81, 4.20]);
  assert.deepEqual(logic.WIN_RATE_TABLE.chance.suika.bb, [5.49, 5.95, 6.41, 6.87, 7.32, 7.78]);
  assert.deepEqual(logic.WIN_RATE_TABLE.chance.cherry.bb, [2.75, 3.20, 3.66, 4.12, 4.58, 5.04]);
});

test('rollBonusTrigger: confirmed bucket always wins regardless of roll', () => {
  assert.equal(withMockRandom([0.999999], () => logic.rollBonusTrigger('normalA', 'confirmed', 1)), true);
});

test('rollBonusTrigger: other/cherry/suika buckets roll against the exact per-setting rate (rb+bb)/100', () => {
  const p = (logic.WIN_RATE_TABLE.normalAB.cherry.rb[0] + logic.WIN_RATE_TABLE.normalAB.cherry.bb[0]) / 100;
  assert.equal(withMockRandom([0], () => logic.rollBonusTrigger('normalA', 'cherry', 1)), true);
  assert.equal(withMockRandom([p + 0.0001], () => logic.rollBonusTrigger('normalA', 'cherry', 1)), false);
});

test('rollBonusTypeNatural: confirmed/cherry buckets are BIG-only', () => {
  assert.equal(withMockRandom([0.999999], () => logic.rollBonusTypeNatural('normalA', 'confirmed', 1)), 'big');
  assert.equal(withMockRandom([0.999999], () => logic.rollBonusTypeNatural('normalA', 'cherry', 1)), 'big');
});

test('rollBonusTypeNatural: suika bucket splits by its own rb/(rb+bb) ratio (currently 50:50)', () => {
  const rbShare = logic.WIN_RATE_TABLE.normalAB.suika.rb[0]
    / (logic.WIN_RATE_TABLE.normalAB.suika.rb[0] + logic.WIN_RATE_TABLE.normalAB.suika.bb[0]);
  assert.equal(withMockRandom([rbShare - 0.0001], () => logic.rollBonusTypeNatural('normalA', 'suika', 1)), 'reg');
  assert.equal(withMockRandom([rbShare], () => logic.rollBonusTypeNatural('normalA', 'suika', 1)), 'big');
});

test('rollBonusTypeNatural: other bucket splits by the mode-group\'s per-setting rb/(rb+bb) ratio', () => {
  // normalAB.other setting1: rb=0.14, bb=0.18 -> rb share = 0.14/0.32 = 0.4375
  const rbShare = logic.WIN_RATE_TABLE.normalAB.other.rb[0]
    / (logic.WIN_RATE_TABLE.normalAB.other.rb[0] + logic.WIN_RATE_TABLE.normalAB.other.bb[0]);
  assert.equal(withMockRandom([rbShare - 0.0001], () => logic.rollBonusTypeNatural('normalA', 'other', 1)), 'reg');
  assert.equal(withMockRandom([rbShare], () => logic.rollBonusTypeNatural('normalA', 'other', 1)), 'big');
});

test('rollBonusTypeCeiling: 0G early ceiling is BIG-only', () => {
  assert.equal(withMockRandom([0.999999], () => logic.rollBonusTypeCeiling(0)), 'big');
});

test('rollBonusTypeCeiling: a normal (non-zero) ceiling splits RB:BB fixed 40:60, independent of setting', () => {
  assert.equal(withMockRandom([0.3999], () => logic.rollBonusTypeCeiling(1000)), 'reg');
  assert.equal(withMockRandom([0.40], () => logic.rollBonusTypeCeiling(1000)), 'big');
  assert.equal(withMockRandom([0.3999], () => logic.rollBonusTypeCeiling(32)), 'reg');
  assert.equal(withMockRandom([0.3999], () => logic.rollBonusTypeCeiling(100)), 'reg');
});

test('normalizeDistribution adds a stay remainder when outcomes sum under 100', () => {
  const result = logic.normalizeDistribution({ a: 30, b: 20 });
  assert.equal(result.a, 30);
  assert.equal(result.b, 20);
  assert.equal(result.stay, 50);
});

test('normalizeDistribution proportionally scales down when outcomes sum to exactly 100 or more', () => {
  const exact = logic.normalizeDistribution({ a: 60, b: 40 });
  assert.equal(exact.a, 60);
  assert.equal(exact.b, 40);
  assert.equal(exact.stay, undefined);

  const over = logic.normalizeDistribution({ a: 60, b: 60 });
  assert.equal(over.a, 50);
  assert.equal(over.b, 50);
  assert.equal(over.stay, undefined);
});

test('rollFromDistribution picks the outcome whose cumulative range contains the draw', () => {
  const dist = { a: 30, b: 20, stay: 50 };
  assert.equal(withMockRandom([0], () => logic.rollFromDistribution(dist)), 'a');
  assert.equal(withMockRandom([0.35], () => logic.rollFromDistribution(dist)), 'b');
  assert.equal(withMockRandom([0.99], () => logic.rollFromDistribution(dist)), 'stay');
});

test('normalA chudanCherry/confirmed transitions are fixed', () => {
  assert.deepEqual(logic.resolveModeTransition('normalA', 'chudanCherry', 1),
    { tengoku: 75.00, dokidoki: 24.22, superDokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'confirmed', 1),
    { stay: 45.31, normalB: 25.00, tengoku: 25.00, dokidoki: 4.69 });
});

test('normalA suika transition: odd settings fixed, even settings ranged, with setting3/5 exceptions', () => {
  // ユーザー提供の実測データ(設定1-6)と照合済み。天国23.44%の例外は設定6ではなく設定5に付く。
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 1),
    { normalB: 50.00, tengoku: 20.31, dokidoki: 1.56, stay: 28.13 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 2),
    { normalB: 57.81, tengoku: 20.31, dokidoki: 1.56, stay: 20.32 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 3),
    { normalB: 50.00, tengoku: 21.88, dokidoki: 1.56, stay: 26.56 });
  const s4 = logic.resolveModeTransition('normalA', 'suika', 4);
  assert.equal(s4.tengoku, 20.31);
  assert.ok(Math.abs(s4.normalB - 59.375) < 1e-9);
  assert.equal(s4.dokidoki, 1.56);
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 5),
    { normalB: 50.00, tengoku: 23.44, dokidoki: 1.56, stay: 25.00 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 6),
    { normalB: 60.94, tengoku: 20.31, dokidoki: 1.56, stay: 17.19 });
});

test('normalA other (cherry falls back to it too): odd settings range tengoku(fixed normalB), even settings range normalB(fixed tengoku)', () => {
  // ユーザー提供の実測データ(設定1-6)と照合済み。SETTING_POSITIONの滑らかな
  // 補間ではなく、奇数/偶数それぞれの内部でのみ線形補間するoddEven構造だった。
  assert.deepEqual(logic.resolveModeTransition('normalA', 'other', 1),
    { normalB: 25.00, tengoku: 10.16, dokidoki: 0.78, stay: 64.06 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'other', 2),
    { normalB: 37.50, tengoku: 10.16, dokidoki: 0.78, stay: 51.56 });
  const s3 = logic.resolveModeTransition('normalA', 'other', 3);
  assert.equal(s3.normalB, 25.00);
  assert.ok(Math.abs(s3.tengoku - 10.94) < 1e-9);
  assert.equal(s3.dokidoki, 0.78);
  assert.equal(s3.stay, 63.28);
  const s4 = logic.resolveModeTransition('normalA', 'other', 4);
  assert.ok(Math.abs(s4.normalB - 38.28) < 1e-9);
  assert.equal(s4.tengoku, 10.16);
  assert.equal(s4.dokidoki, 0.78);
  assert.equal(s4.stay, 50.78);
  assert.deepEqual(logic.resolveModeTransition('normalA', 'other', 5),
    { normalB: 25.00, tengoku: 11.72, dokidoki: 0.78, stay: 62.50 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'other', 6),
    { normalB: 39.06, tengoku: 10.16, dokidoki: 0.78, stay: 50.00 });
  const s1 = logic.resolveModeTransition('normalA', 'other', 1);
  assert.deepEqual(logic.resolveModeTransition('normalA', 'cherry', 1), s1); // cherryはotherにフォールバック
});

// 仕様書側が小数点2桁までの表記のため、内部の線形補間結果とは最大で
// ±0.01程度ずれることがある(例: 9.375という真値が資料では9.38と丸められる)。
// これは既知の丸め誤差であり不具合ではない(コミット420730fと同じ許容範囲)。
function assertClose(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${msg}: expected ${expected}, got ${actual}`);
}

test('normalB rows: fixed chudanCherry/confirmed', () => {
  assert.deepEqual(logic.resolveModeTransition('normalB', 'chudanCherry', 1),
    { tengoku: 50.00, dokidoki: 49.22, superDokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('normalB', 'confirmed', 1),
    { stay: 25.00, tengoku: 50.00, dokidoki: 25.00 });
});

test('normalB suika: odd settings fix tengoku(59.38)/range dokidoki, even settings fix dokidoki(15.63)/range tengoku', () => {
  // ユーザー提供の実測データ(設定1-6)と照合済み。
  const expected = {
    1: { tengoku: 59.38, dokidoki: 17.19, stay: 23.43 },
    2: { tengoku: 64.84, dokidoki: 15.63, stay: 19.53 },
    3: { tengoku: 59.38, dokidoki: 18.75, stay: 21.87 },
    4: { tengoku: 66.41, dokidoki: 15.63, stay: 17.96 },
    5: { tengoku: 59.38, dokidoki: 20.31, stay: 20.31 },
    6: { tengoku: 67.97, dokidoki: 15.63, stay: 16.40 },
  };
  for (const [setting, exp] of Object.entries(expected)) {
    const r = logic.resolveModeTransition('normalB', 'suika', Number(setting));
    assertClose(r.tengoku, exp.tengoku, `setting${setting} tengoku`);
    assertClose(r.dokidoki, exp.dokidoki, `setting${setting} dokidoki`);
    assertClose(r.stay, exp.stay, `setting${setting} stay`);
  }
});

test('normalB other: odd settings fix tengoku(42.19)/range dokidoki, even settings fix dokidoki(7.81)/range tengoku', () => {
  // ユーザー提供の実測データ(設定1-6)と照合済み。
  const expected = {
    1: { tengoku: 42.19, dokidoki: 8.59, stay: 49.22 },
    2: { tengoku: 53.13, dokidoki: 7.81, stay: 39.06 },
    3: { tengoku: 42.19, dokidoki: 9.38, stay: 48.43 },
    4: { tengoku: 53.91, dokidoki: 7.81, stay: 38.28 },
    5: { tengoku: 42.19, dokidoki: 10.16, stay: 47.65 },
    6: { tengoku: 54.69, dokidoki: 7.81, stay: 37.50 },
  };
  for (const [setting, exp] of Object.entries(expected)) {
    const r = logic.resolveModeTransition('normalB', 'other', Number(setting));
    assertClose(r.tengoku, exp.tengoku, `setting${setting} tengoku`);
    assertClose(r.dokidoki, exp.dokidoki, `setting${setting} dokidoki`);
    assertClose(r.stay, exp.stay, `setting${setting} stay`);
  }
});

test('tengoku rows: cherry/chudanCherry/confirmed/suika fixed, other splits by odd/even', () => {
  assert.deepEqual(logic.resolveModeTransition('tengoku', 'cherry', 1), { stay: 99.22, dokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('tengoku', 'chudanCherry', 1), { dokidoki: 100 });
  assert.deepEqual(logic.resolveModeTransition('tengoku', 'confirmed', 1), { stay: 93.75, dokidoki: 6.25 });
  assert.deepEqual(logic.resolveModeTransition('tengoku', 'suika', 1), { stay: 98.44, dokidoki: 1.56 });
  assert.deepEqual(logic.resolveModeTransition('tengoku', 'other', 1),
    { stay: 74.22, hikimodoshi: 7.81, normalA: 13.28, normalB: 3.91, dokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('tengoku', 'other', 2),
    { stay: 64.84, hikimodoshi: 17.19, normalA: 13.28, normalB: 3.91, dokidoki: 0.78 });
});

test('dokidoki rows are all fixed', () => {
  assert.deepEqual(logic.resolveModeTransition('dokidoki', 'chudanCherry', 1), { superDokidoki: 100 });
  assert.deepEqual(logic.resolveModeTransition('dokidoki', 'confirmed', 1), { stay: 96.88, superDokidoki: 3.13 });
  assert.deepEqual(logic.resolveModeTransition('dokidoki', 'cherry', 1), { stay: 99.61, superDokidoki: 0.39 });
  assert.deepEqual(logic.resolveModeTransition('dokidoki', 'suika', 1), { stay: 99.22, superDokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('dokidoki', 'other', 1), { hosho: 17.97, stay: 81.64, superDokidoki: 0.39 });
});

test('superDokidoki: every rare role stays 100%, other can drop to hosho', () => {
  for (const role of ['chudanCherry', 'confirmed', 'cherry', 'suika']) {
    assert.deepEqual(logic.resolveModeTransition('superDokidoki', role, 1), { stay: 100 });
  }
  assert.deepEqual(logic.resolveModeTransition('superDokidoki', 'other', 1), { stay: 90.63, hosho: 9.38 });
});

test('hosho rows are all fixed and setting-independent', () => {
  assert.deepEqual(logic.resolveModeTransition('hosho', 'other', 1),
    { normalA: 65.23, normalB: 10.16, hikimodoshi: 20.31, tengoku: 3.91, dokidoki: 0.39 });
  assert.deepEqual(logic.resolveModeTransition('hosho', 'other', 6),
    { normalA: 65.23, normalB: 10.16, hikimodoshi: 20.31, tengoku: 3.91, dokidoki: 0.39 });
});

test('hikimodoshi rows: fixed chudanCherry/confirmed', () => {
  assert.deepEqual(logic.resolveModeTransition('hikimodoshi', 'chudanCherry', 1),
    { tengoku: 75.00, dokidoki: 24.22, superDokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('hikimodoshi', 'confirmed', 1),
    { normalB: 50.00, tengoku: 45.31, dokidoki: 4.69 });
});

test('hikimodoshi suika: odd settings fixed except setting3/5 exceptions, even settings ranged', () => {
  // ユーザー提供の実測データ(設定1-6)と照合済み。合計は全設定でちょうど100(stayなし)。
  const expected = {
    1: { normalA: 25.00, normalB: 42.19, tengoku: 31.25, dokidoki: 1.56 },
    2: { normalA: 25.00, normalB: 42.19, tengoku: 31.25, dokidoki: 1.56 },
    3: { normalA: 25.00, normalB: 40.63, tengoku: 32.81, dokidoki: 1.56 },
    4: { normalA: 23.44, normalB: 43.75, tengoku: 31.25, dokidoki: 1.56 },
    5: { normalA: 25.00, normalB: 39.06, tengoku: 34.38, dokidoki: 1.56 },
    6: { normalA: 21.88, normalB: 45.31, tengoku: 31.25, dokidoki: 1.56 },
  };
  for (const [setting, exp] of Object.entries(expected)) {
    const r = logic.resolveModeTransition('hikimodoshi', 'suika', Number(setting));
    assert.equal(r.stay, undefined);
    assertClose(r.normalA, exp.normalA, `setting${setting} normalA`);
    assertClose(r.normalB, exp.normalB, `setting${setting} normalB`);
    assertClose(r.tengoku, exp.tengoku, `setting${setting} tengoku`);
    assertClose(r.dokidoki, exp.dokidoki, `setting${setting} dokidoki`);
  }
});

test('hikimodoshi other: odd settings fix normalA(50)/range tengoku+normalB, even settings fix tengoku(15.63)/range normalA+normalB', () => {
  // ユーザー提供の実測データ(設定1-6)と照合済み。合計は全設定でちょうど100(stayなし)。
  const expected = {
    1: { normalA: 50.00, normalB: 33.59, tengoku: 15.63, dokidoki: 0.78 },
    2: { normalA: 33.59, normalB: 50.00, tengoku: 15.63, dokidoki: 0.78 },
    3: { normalA: 50.00, normalB: 32.81, tengoku: 16.41, dokidoki: 0.78 },
    4: { normalA: 32.81, normalB: 50.78, tengoku: 15.63, dokidoki: 0.78 },
    5: { normalA: 50.00, normalB: 32.03, tengoku: 17.19, dokidoki: 0.78 },
    6: { normalA: 32.03, normalB: 51.56, tengoku: 15.63, dokidoki: 0.78 },
  };
  for (const [setting, exp] of Object.entries(expected)) {
    const r = logic.resolveModeTransition('hikimodoshi', 'other', Number(setting));
    assert.equal(r.stay, undefined);
    assertClose(r.normalA, exp.normalA, `setting${setting} normalA`);
    assertClose(r.normalB, exp.normalB, `setting${setting} normalB`);
    assertClose(r.tengoku, exp.tengoku, `setting${setting} tengoku`);
    assertClose(r.dokidoki, exp.dokidoki, `setting${setting} dokidoki`);
  }
});

test('chance rows are all fixed', () => {
  assert.deepEqual(logic.resolveModeTransition('chance', 'chudanCherry', 1),
    { tengoku: 50.00, dokidoki: 42.19, superDokidoki: 7.81 });
  assert.deepEqual(logic.resolveModeTransition('chance', 'confirmed', 1),
    { normalB: 25.00, tengoku: 65.63, dokidoki: 7.03, superDokidoki: 2.34 });
  assert.deepEqual(logic.resolveModeTransition('chance', 'suika', 1),
    { normalB: 65.63, tengoku: 31.25, dokidoki: 2.34, superDokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('chance', 'other', 1),
    { normalB: 82.81, tengoku: 15.63, dokidoki: 1.17, superDokidoki: 0.39 });
});

test('invariant: every (mode, role, setting) distribution sums to 100', () => {
  const modes = ['normalA', 'normalB', 'tengoku', 'dokidoki', 'superDokidoki', 'hosho', 'hikimodoshi', 'chance'];
  const roles = ['chudanCherry', 'confirmed', 'cherry', 'suika', 'other'];
  for (const mode of modes) {
    for (const role of roles) {
      for (let setting = 1; setting <= 6; setting++) {
        const dist = logic.resolveModeTransition(mode, role, setting);
        const sum = Object.values(dist).reduce((s, v) => s + v, 0);
        // 実機の原資料は小数点2桁までの表記のため、一部の行（dokidoki.confirmed,
        // superDokidoki.other等）は合計が99.99〜100.02程度になる既知の丸め誤差を
        // 含む。resolveModeTransitionは、既に文字通りの`stay`を含む行を
        // normalizeDistributionで強制的に100へ再スケーリングせず、そのまま
        // 保持する設計のため、この程度のズレは想定内であり不具合ではない。
        assert.ok(Math.abs(sum - 100) < 0.02, `${mode}/${role}/setting${setting} sums to ${sum}`);
      }
    }
  }
});

test('BONUS_PAYOUT_TABLE has fixed game count and net medals/game for BIG and REG', () => {
  assert.deepEqual(logic.BONUS_PAYOUT_TABLE.big, { games: 70, netMedalsPerGame: 3.0 });
  assert.deepEqual(logic.BONUS_PAYOUT_TABLE.reg, { games: 30, netMedalsPerGame: 3.0 });
});

test('resolveBonusPayout returns games and total net medals for BIG', () => {
  assert.deepEqual(logic.resolveBonusPayout('big'), { games: 70, netMedals: 210 });
});

test('resolveBonusPayout returns games and total net medals for REG', () => {
  assert.deepEqual(logic.resolveBonusPayout('reg'), { games: 30, netMedals: 90 });
});

test('BET_MEDALS is 3 medals per game', () => {
  assert.equal(logic.BET_MEDALS, 3);
});

test('RESET_MODE_DISTRIBUTION is setting-independent: normalA/normalB/chance', () => {
  assert.deepEqual(logic.RESET_MODE_DISTRIBUTION, { normalA: 57.03, normalB: 9.77, chance: 33.20 });
});

test('rollResetMode picks a starting mode from RESET_MODE_DISTRIBUTION', () => {
  assert.equal(withMockRandom([0], () => logic.rollResetMode()), 'normalA');
  assert.equal(withMockRandom([0.99999], () => logic.rollResetMode()), 'chance');
});

test('playGame: replay costs no medals and no bet (net 0), mode unchanged, no bonus', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 1000 };
  // r1=0 -> rollYaku(1) = 'replay'; r2 high -> rollBonusTrigger('normalA','other',1) = false
  const result = withMockRandom([0, 0.999999], () => logic.playGame(state, 1));
  assert.deepEqual(result.state, { mode: 'normalA', medals: 0, games: 1, gamesSinceLastBonus: 1, ceiling: 1000 });
  assert.equal(result.bonus, null);
});

test('playGame: a miss costs the full bet (net -BET_MEDALS), no bonus', () => {
  const state = { mode: 'normalA', medals: 100, games: 5, gamesSinceLastBonus: 10, ceiling: 1000 };
  // r1=0.99999 -> rollYaku(1) = 'miss'; r2 high -> rollBonusTrigger('normalA','other',1) = false
  const result = withMockRandom([0.99999, 0.999999], () => logic.playGame(state, 1));
  assert.deepEqual(result.state, { mode: 'normalA', medals: 97, games: 6, gamesSinceLastBonus: 11, ceiling: 1000 });
  assert.equal(result.bonus, null);
});

test('playGame: a confirmed-bucket win (kakuteiyaku) resolves BIG payout and mode transition in one call', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 50, ceiling: 1000 };
  const cumBeforeKakuteiyaku = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1]
    + logic.COMMON_BELL_PROB[1] + logic.KOYAKU_PROB.cherry + logic.KOYAKU_PROB.suika;
  // r1 -> rollYaku(1) = 'kakuteiyaku' (confirmed bucket, rollBonusTrigger consumes no random)
  // r2=0.5 -> long-freeze roll fails (FREEZE_PROB.confirmed=0.05)
  // r3=0 -> rollBigOrReg(1) = 'big'
  // r4=0 -> rollFromDistribution({stay:45.31, normalB:25, tengoku:25, dokidoki:4.69}) = 'stay'
  // mode stays normalA -> rollCeiling('normalA') has no early-trigger config, deterministic 1000, no extra draw
  const result = withMockRandom([cumBeforeKakuteiyaku + 0.0000001, 0.5, 0, 0], () => logic.playGame(state, 1));
  // trigger spin: payout 1 - BET_MEDALS(3) = -2; bonus: 70 games, +210 medals
  assert.deepEqual(result.state, { mode: 'normalA', medals: 208, games: 71, gamesSinceLastBonus: 0, ceiling: 1000 });
  assert.equal(result.bonus, 'big');
  assert.equal(result.yaku, 'kakuteiyaku');
  assert.equal(result.freeze, false);
});

test('FREEZE_PROB gives the long-freeze probability per winning-role bucket (natural wins)', () => {
  assert.deepEqual(logic.FREEZE_PROB, {
    chudanCherry: 0.50, confirmed: 0.05, cherry: 0.0156, suika: 0.0156, other: 0.0006,
  });
});

test('FREEZE_PROB_CEILING is the long-freeze probability for any ceiling-triggered win (G数当選)', () => {
  assert.equal(logic.FREEZE_PROB_CEILING, 0.0003);
});

test('playGame: chudanCherry win + long-freeze roll succeeds -> forces BIG + superDokidoki', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 1000 };
  const cumBeforeChudanCherry = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1] + logic.COMMON_BELL_PROB[1]
    + logic.KOYAKU_PROB.cherry + logic.KOYAKU_PROB.suika + logic.KOYAKU_PROB.kakuteiyaku + logic.KOYAKU_PROB.kakuteiCherry;
  // r1 -> rollYaku(1) = 'chudanCherry' (confirmed bucket, rollBonusTrigger consumes no random)
  // r2=0 -> long-freeze roll succeeds (FREEZE_PROB.chudanCherry=0.50) -> forces BIG + superDokidoki,
  //          skipping rollBonusTypeNatural/resolveModeTransition entirely
  // ceiling is forced to 0 (guaranteed 0G連 on the very next spin), no rollCeiling draw consumed
  const result = withMockRandom([cumBeforeChudanCherry + 0.0000001, 0], () => logic.playGame(state, 1));
  assert.deepEqual(result.state, { mode: 'superDokidoki', medals: 208, games: 71, gamesSinceLastBonus: 0, ceiling: 0 });
  assert.equal(result.bonus, 'big');
  assert.equal(result.freeze, true);
});

test('playGame: freeze-forced ceiling(0) guarantees a BIG on the very next spin regardless of the roll (0G連)', () => {
  // spin 1: freeze succeeds -> mode=superDokidoki, ceiling=0
  const state1 = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 1000 };
  const cumBeforeChudanCherry = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1] + logic.COMMON_BELL_PROB[1]
    + logic.KOYAKU_PROB.cherry + logic.KOYAKU_PROB.suika + logic.KOYAKU_PROB.kakuteiyaku + logic.KOYAKU_PROB.kakuteiCherry;
  const result1 = withMockRandom([cumBeforeChudanCherry + 0.0000001, 0], () => logic.playGame(state1, 1));
  assert.equal(result1.state.ceiling, 0);

  // spin 2 (0G連): even with a yaku roll and a freeze roll that would normally not win/freeze,
  // isZeroCeiling forces a win, and rollBonusTypeCeiling(0) forces BIG.
  // r1=0.99999 -> rollYaku(1)='miss' (irrelevant, bonus trigger is bypassed by isZeroCeiling)
  // r2=0.99 -> long-freeze roll for the ceiling path (FREEZE_PROB_CEILING=0.0003) fails
  // r3=0 -> rollFromDistribution(superDokidoki.other: {stay:90.63, hosho:9.38}) = 'stay' (superDokidoki)
  // r4=0.99 -> rollCeiling('superDokidoki'): no early trigger -> 32
  const result2 = withMockRandom([0.99999, 0.99, 0, 0.99], () => logic.playGame(result1.state, 1));
  assert.equal(result2.bonus, 'big');
  assert.deepEqual(result2.state,
    { mode: 'superDokidoki', medals: result1.state.medals - 3 + 210, games: result1.state.games + 1 + 70, gamesSinceLastBonus: 0, ceiling: 32 });
});

test('playGame: a 0G連/0G天井 win never falls out of dokidoki, even on a roll that would hit hosho unfiltered', () => {
  // dokidoki.other unfiltered = {hosho:17.97, stay:81.64, superDokidoki:0.39}; r=5 would land in
  // hosho's 0-17.97 slice. With hosho excluded per ZERO_CEILING_FALL_TARGETS.dokidoki, it must
  // resolve to 'stay' (dokidoki) instead.
  const state = { mode: 'dokidoki', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 0 };
  // r1=0.99999 -> rollYaku(1)='miss' (irrelevant: isZeroCeiling bypasses the natural-trigger check)
  // r2=0.99 -> long-freeze roll for the ceiling path (FREEZE_PROB_CEILING=0.0003) fails
  // r3=0.05 -> rollFromDistribution(filtered dist) -> r=5, lands in 'stay' (not hosho, which no longer exists)
  // r4=0.99 -> rollCeiling('dokidoki'): no early trigger -> 32
  const result = withMockRandom([0.99999, 0.99, 0.05, 0.99], () => logic.playGame(state, 1));
  assert.equal(result.bonus, 'big');
  assert.deepEqual(result.state, { mode: 'dokidoki', medals: -3 + 210, games: 1 + 70, gamesSinceLastBonus: 0, ceiling: 32 });
});

test('playGame: chudanCherry win + long-freeze roll fails -> falls back to the normal BIG/REG + mode-transition roll', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 1000 };
  const cumBeforeChudanCherry = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1] + logic.COMMON_BELL_PROB[1]
    + logic.KOYAKU_PROB.cherry + logic.KOYAKU_PROB.suika + logic.KOYAKU_PROB.kakuteiyaku + logic.KOYAKU_PROB.kakuteiCherry;
  // r1 -> 'chudanCherry'; r2=0.99 -> freeze fails; bucket='confirmed' so rollBonusTypeNatural
  // returns 'big' without consuming a draw; r3=0 -> rollFromDistribution(normalA.chudanCherry:
  // {tengoku:75, dokidoki:24.22, superDokidoki:0.78}) = 'tengoku'
  // r4=0.99 -> rollCeiling('tengoku'): no early trigger -> CEILING_GAMES.tengoku=32
  const result = withMockRandom([cumBeforeChudanCherry + 0.0000001, 0.99, 0, 0.99], () => logic.playGame(state, 1));
  assert.deepEqual(result.state, { mode: 'tengoku', medals: 208, games: 71, gamesSinceLastBonus: 0, ceiling: 32 });
  assert.equal(result.bonus, 'big');
  assert.equal(result.freeze, false);
});

test('playGame: result.yaku reports the drawn role even on a losing (miss) spin', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 1000 };
  const result = withMockRandom([0.99999, 0.999999], () => logic.playGame(state, 1));
  assert.equal(result.yaku, 'miss');
});

test('CEILING_GAMES has per-mode forced-win thresholds (setting-independent)', () => {
  assert.deepEqual(logic.CEILING_GAMES, {
    normalA: 1000, normalB: 1000,
    hikimodoshi: 200, chance: 200,
    hosho: 32, tengoku: 32, dokidoki: 32, superDokidoki: 32,
  });
});

test('CEILING_EARLY_TRIGGER: 12.5% early-ceiling chance per mode-stay (15% was tried and reverted, overshot 機械割)', () => {
  assert.deepEqual(logic.CEILING_EARLY_TRIGGER, {
    hosho: { prob: 0.125, games: 0 },
    tengoku: { prob: 0.125, games: 0 },
    dokidoki: { prob: 0.125, games: 0 },
    superDokidoki: { prob: 0.125, games: 0 },
    hikimodoshi: { prob: 0.125, games: 100 },
    chance: { prob: 0.125, games: 100 },
  });
});

test('rollCeiling: modes without an early-trigger config always return CEILING_GAMES, no random draw consumed', () => {
  assert.equal(withMockRandom([], () => logic.rollCeiling('normalA')), 1000);
  assert.equal(withMockRandom([], () => logic.rollCeiling('normalB')), 1000);
});

test('rollCeiling: modes with an early-trigger config roll 12.5% early / 87.5% CEILING_GAMES', () => {
  assert.equal(withMockRandom([0], () => logic.rollCeiling('hosho')), 0);
  assert.equal(withMockRandom([0.124999], () => logic.rollCeiling('hosho')), 0);
  assert.equal(withMockRandom([0.125], () => logic.rollCeiling('hosho')), 32);
  assert.equal(withMockRandom([0.99], () => logic.rollCeiling('hosho')), 32);
  assert.equal(withMockRandom([0], () => logic.rollCeiling('hikimodoshi')), 100);
  assert.equal(withMockRandom([0.99], () => logic.rollCeiling('hikimodoshi')), 200);
});

test('ZERO_CEILING_FALL_TARGETS lists the fall-tier destinations excluded on a 0G連/0G天井 win', () => {
  assert.deepEqual(logic.ZERO_CEILING_FALL_TARGETS, {
    hosho: ['normalA', 'normalB', 'hikimodoshi'],
    tengoku: ['normalA', 'normalB', 'hikimodoshi'],
    dokidoki: ['hosho'],
    superDokidoki: ['hosho'],
  });
});

test('excludeFallsAndRenormalize removes fall-tier keys and rescales the remainder to 100', () => {
  const result = logic.excludeFallsAndRenormalize({ hosho: 17.97, stay: 81.64, superDokidoki: 0.39 }, ['hosho']);
  assert.equal(result.hosho, undefined);
  const sum = Object.values(result).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9);
  assertClose(result.stay / result.superDokidoki, 81.64 / 0.39, 'stay/superDokidoki ratio preserved');
});

test('playGame: reaching the mode ceiling forces a win even when the natural roll misses', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 999, ceiling: 1000 };
  // r1=0.99999 -> rollYaku(1) = 'miss'; r2 high -> natural rollBonusTrigger = false
  // gamesSinceLastBonus becomes 1000 === state.ceiling -> forced win
  // r3=0.99 -> long-freeze roll for the ceiling path (FREEZE_PROB_CEILING=0.0003) fails
  // r4=0.40 -> rollBonusTypeCeiling(1000): ceiling!=0 -> fixed 40:60 split, 0.40 is not < 0.40 -> 'big'
  // r5=0 -> rollFromDistribution(normalA.other dist, setting1) = first key ('normalB')
  // mode->normalB has no early-trigger config -> rollCeiling deterministic 1000, no extra draw
  const result = withMockRandom([0.99999, 0.999999, 0.99, 0.40, 0], () => logic.playGame(state, 1));
  assert.equal(result.bonus, 'big');
  assert.deepEqual(result.state,
    { mode: 'normalB', medals: -3 + 210, games: 1 + 70, gamesSinceLastBonus: 0, ceiling: 1000 });
});

test('simulate: runs playGame until the cumulative game count reaches totalGames, tallying BIG/REG', () => {
  const initialState = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0, ceiling: 1000 };
  // r1=0 -> rollYaku(1)='replay'; r2 high -> no bonus (games: 0->1)
  // r3=0.99999 -> rollYaku(1)='miss'; r4 high -> no bonus (games: 1->2, medals: 0-3=-3)
  const result = withMockRandom(
    [0, 0.999999, 0.99999, 0.999999],
    () => logic.simulate(1, initialState, 2)
  );
  assert.deepEqual(result.state, { mode: 'normalA', medals: -3, games: 2, gamesSinceLastBonus: 2, ceiling: 1000 });
  assert.deepEqual(result.stats, { bigCount: 0, regCount: 0 });
});
