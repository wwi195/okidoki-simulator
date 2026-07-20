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

test('MODE_WIN_RATE_RANGES has the 4 groups with other/cherry/suika ranges as probabilities (0-1)', () => {
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.normalAB.other, [1 / 297.89, 1 / 234.06]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.normalAB.cherry, [0.0092, 0.0168]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.normalAB.suika, [0.0366, 0.0519]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.hikimodoshi.other, [1 / 119.16, 1 / 93.62]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.hikimodoshi.cherry, [0.0229, 0.0420]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.hikimodoshi.suika, [0.0916, 0.1297]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.chance.other, [1 / 99.30, 1 / 78.02]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.chance.cherry, [0.0275, 0.0504]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.chance.suika, [0.1099, 0.1556]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.heavenGroup.other, [1 / 8.19, 1 / 8.19]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.heavenGroup.cherry, [0.0625, 0.0816]);
  assert.deepEqual(logic.MODE_WIN_RATE_RANGES.heavenGroup.suika, [0.2500, 0.3263]);
});

test('rollBonusTrigger: confirmed bucket always wins regardless of roll', () => {
  assert.equal(withMockRandom([0.999999], () => logic.rollBonusTrigger('normalA', 'confirmed', 1)), true);
});

test('rollBonusTrigger: other/cherry/suika buckets roll against the interpolated group rate', () => {
  const p = logic.interpolateBySetting(...logic.MODE_WIN_RATE_RANGES.normalAB.cherry, 1);
  assert.equal(withMockRandom([0], () => logic.rollBonusTrigger('normalA', 'cherry', 1)), true);
  assert.equal(withMockRandom([p + 0.0001], () => logic.rollBonusTrigger('normalA', 'cherry', 1)), false);
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

test('normalA suika transition: odd settings fixed, even settings ranged, with setting3/6 exceptions', () => {
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 1),
    { normalB: 50.00, tengoku: 20.31, dokidoki: 1.56, stay: 28.13 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 3),
    { normalB: 50.00, tengoku: 21.88, dokidoki: 1.56, stay: 26.56 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 2),
    { normalB: 57.81, tengoku: 20.31, dokidoki: 1.56, stay: 20.32 });
  assert.deepEqual(logic.resolveModeTransition('normalA', 'suika', 6),
    { normalB: 60.94, tengoku: 23.44, dokidoki: 1.56, stay: 14.06 });
});

test('normalA other (cherry falls back to it too) is ranged with a fixed dokidoki', () => {
  const s1 = logic.resolveModeTransition('normalA', 'other', 1);
  assert.equal(s1.normalB, 25.00);
  assert.equal(s1.tengoku, 10.16);
  assert.equal(s1.dokidoki, 0.78);
  assert.ok(Math.abs(s1.stay - 64.06) < 1e-9);
  const s6 = logic.resolveModeTransition('normalA', 'other', 6);
  assert.equal(s6.normalB, 39.06);
  assert.equal(s6.tengoku, 11.72);
  assert.equal(s6.dokidoki, 0.78);
  assert.ok(Math.abs(s6.stay - 48.44) < 1e-9);
  assert.deepEqual(logic.resolveModeTransition('normalA', 'cherry', 1), s1); // cherryはotherにフォールバック
});

test('normalB rows: fixed chudanCherry/confirmed, ranged suika/other', () => {
  assert.deepEqual(logic.resolveModeTransition('normalB', 'chudanCherry', 1),
    { tengoku: 50.00, dokidoki: 49.22, superDokidoki: 0.78 });
  assert.deepEqual(logic.resolveModeTransition('normalB', 'confirmed', 1),
    { stay: 25.00, tengoku: 50.00, dokidoki: 25.00 });
  const suikaS1 = logic.resolveModeTransition('normalB', 'suika', 1);
  assert.equal(suikaS1.tengoku, 59.38);
  assert.equal(suikaS1.dokidoki, 15.63);
  const suikaS6 = logic.resolveModeTransition('normalB', 'suika', 6);
  assert.equal(suikaS6.tengoku, 67.97);
  assert.equal(suikaS6.dokidoki, 20.31);
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

test('hikimodoshi confirmed sums to exactly 100 with no stay; suika/other ranged and always valid', () => {
  assert.deepEqual(logic.resolveModeTransition('hikimodoshi', 'confirmed', 1),
    { normalB: 50.00, tengoku: 45.31, dokidoki: 4.69 });
  const suikaS1 = logic.resolveModeTransition('hikimodoshi', 'suika', 1);
  const sumS1 = Object.values(suikaS1).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sumS1 - 100) < 1e-6);
  const suikaS6 = logic.resolveModeTransition('hikimodoshi', 'suika', 6);
  const sumS6 = Object.values(suikaS6).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sumS6 - 100) < 1e-6);
  assert.equal(suikaS6.stay, undefined); // s6は合計100超のため比例縮小され、stayは付かない
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
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0 };
  // r1=0 -> rollYaku(1) = 'replay'; r2 high -> rollBonusTrigger('normalA','other',1) = false
  const result = withMockRandom([0, 0.999999], () => logic.playGame(state, 1));
  assert.deepEqual(result.state, { mode: 'normalA', medals: 0, games: 1, gamesSinceLastBonus: 1 });
  assert.equal(result.bonus, null);
});

test('playGame: a miss costs the full bet (net -BET_MEDALS), no bonus', () => {
  const state = { mode: 'normalA', medals: 100, games: 5, gamesSinceLastBonus: 10 };
  // r1=0.99999 -> rollYaku(1) = 'miss'; r2 high -> rollBonusTrigger('normalA','other',1) = false
  const result = withMockRandom([0.99999, 0.999999], () => logic.playGame(state, 1));
  assert.deepEqual(result.state, { mode: 'normalA', medals: 97, games: 6, gamesSinceLastBonus: 11 });
  assert.equal(result.bonus, null);
});

test('playGame: a confirmed-bucket win (kakuteiyaku) resolves BIG payout and mode transition in one call', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 50 };
  const cumBeforeKakuteiyaku = logic.KOYAKU_PROB.replay + logic.FIRST_BELL_PROB[1]
    + logic.COMMON_BELL_PROB[1] + logic.KOYAKU_PROB.cherry + logic.KOYAKU_PROB.suika;
  // r1 -> rollYaku(1) = 'kakuteiyaku' (confirmed bucket, rollBonusTrigger consumes no random)
  // r2=0 -> rollBigOrReg(1) = 'big'
  // r3=0 -> rollFromDistribution({stay:45.31, normalB:25, tengoku:25, dokidoki:4.69}) = 'stay'
  const result = withMockRandom([cumBeforeKakuteiyaku + 0.0000001, 0, 0], () => logic.playGame(state, 1));
  // trigger spin: payout 1 - BET_MEDALS(3) = -2; bonus: 70 games, +210 medals
  assert.deepEqual(result.state, { mode: 'normalA', medals: 208, games: 71, gamesSinceLastBonus: 0 });
  assert.equal(result.bonus, 'big');
  assert.equal(result.yaku, 'kakuteiyaku');
});

test('playGame: result.yaku reports the drawn role even on a losing (miss) spin', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0 };
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

test('playGame: reaching the mode ceiling forces a win even when the natural roll misses', () => {
  const state = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 999 };
  // r1=0.99999 -> rollYaku(1) = 'miss'; r2 high -> natural rollBonusTrigger = false
  // gamesSinceLastBonus becomes 1000 === CEILING_GAMES.normalA -> forced win
  // r3=0 -> rollBigOrReg(1) = 'big'
  // r4=0 -> rollFromDistribution(normalA.other dist, setting1) = first key ('dokidoki')
  const result = withMockRandom([0.99999, 0.999999, 0, 0], () => logic.playGame(state, 1));
  assert.equal(result.bonus, 'big');
  assert.deepEqual(result.state, { mode: 'dokidoki', medals: -3 + 210, games: 1 + 70, gamesSinceLastBonus: 0 });
});

test('simulate: runs playGame until the cumulative game count reaches totalGames, tallying BIG/REG', () => {
  const initialState = { mode: 'normalA', medals: 0, games: 0, gamesSinceLastBonus: 0 };
  // r1=0 -> rollYaku(1)='replay'; r2 high -> no bonus (games: 0->1)
  // r3=0.99999 -> rollYaku(1)='miss'; r4 high -> no bonus (games: 1->2, medals: 0-3=-3)
  const result = withMockRandom(
    [0, 0.999999, 0.99999, 0.999999],
    () => logic.simulate(1, initialState, 2)
  );
  assert.deepEqual(result.state, { mode: 'normalA', medals: -3, games: 2, gamesSinceLastBonus: 2 });
  assert.deepEqual(result.stats, { bigCount: 0, regCount: 0 });
});
