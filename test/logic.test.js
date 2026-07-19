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

test('KOYAKU_PROB has the 7 common-across-settings role probabilities', () => {
  assert.equal(logic.KOYAKU_PROB.replay, 1 / 5.05);
  assert.equal(logic.KOYAKU_PROB.oshijunBell, 1 / 1.325);
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

test('KOYAKU_PAYOUT has payout medals for each paying small role', () => {
  assert.equal(logic.KOYAKU_PAYOUT.oshijunBell, 7);
  assert.equal(logic.KOYAKU_PAYOUT.commonBell, 7);
  assert.equal(logic.KOYAKU_PAYOUT.cherry, 1);
  assert.equal(logic.KOYAKU_PAYOUT.suika, 4);
  assert.equal(logic.KOYAKU_PAYOUT.kakuteiyaku, 1);
  assert.equal(logic.KOYAKU_PAYOUT.kakuteiCherry, 1);
  assert.equal(logic.KOYAKU_PAYOUT.chudanCherry, 1);
});

test('rollYaku picks the role whose cumulative probability range contains the draw', () => {
  // cumulative thresholds at setting 1, in table order:
  // replay < replay+oshijunBell < +commonBell(s1) < +cherry < +suika < +kakuteiyaku < +kakuteiCherry < +chudanCherry < miss
  assert.equal(withMockRandom([0], () => logic.rollYaku(1)), 'replay');
  assert.equal(withMockRandom([0.99999], () => logic.rollYaku(1)), 'miss');
});

test('triggerBucket classifies confirmed-BIG roles, cherry, suika, and everything else', () => {
  assert.equal(logic.triggerBucket('chudanCherry'), 'confirmed');
  assert.equal(logic.triggerBucket('kakuteiCherry'), 'confirmed');
  assert.equal(logic.triggerBucket('kakuteiyaku'), 'confirmed');
  assert.equal(logic.triggerBucket('cherry'), 'cherry');
  assert.equal(logic.triggerBucket('suika'), 'suika');
  assert.equal(logic.triggerBucket('replay'), 'other');
  assert.equal(logic.triggerBucket('oshijunBell'), 'other');
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
