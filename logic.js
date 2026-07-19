'use strict';

// ===== 所持金・メダル =====
const MEDAL_UNIT_PRICE = 20; // 円/枚
const INVEST_YEN = 5000;
const INVEST_MEDALS = INVEST_YEN / MEDAL_UNIT_PRICE; // 250

// ===== 小役確率（全設定共通） =====
const KOYAKU_PROB = {
  replay: 1 / 5.05,
  oshijunBell: 1 / 1.325, // 押し順ベル合算。仕様書の1/1.32〜1.33の中間値を採用
  cherry: 1 / 32.13,
  suika: 1 / 128.00,
  kakuteiyaku: 1 / 8192.00,
  kakuteiCherry: 1 / 10922.67,
  chudanCherry: 1 / 32768.00,
};

// ===== 共通ベル確率（設定別） =====
const COMMON_BELL_PROB = {
  1: 1 / 168.04,
  2: 1 / 158.30,
  3: 1 / 149.63,
  4: 1 / 141.85,
  5: 1 / 134.85,
  6: 1 / 128.50,
};

// ===== 小役払出（枚数） =====
const KOYAKU_PAYOUT = {
  oshijunBell: 7,
  commonBell: 7,
  cherry: 1,
  suika: 4,
  kakuteiyaku: 1,
  kakuteiCherry: 1,
  chudanCherry: 1,
};

// 1G分の成立役抽選（BIG/REG自体はここでは決めない。契機役の判定のみ）
const YAKU_ORDER = [
  'replay', 'oshijunBell', 'commonBell', 'cherry', 'suika',
  'kakuteiyaku', 'kakuteiCherry', 'chudanCherry',
];

function yakuProb(key, setting) {
  if (key === 'commonBell') return COMMON_BELL_PROB[setting];
  return KOYAKU_PROB[key];
}

function rollYaku(setting) {
  const r = Math.random();
  let cum = 0;
  for (const key of YAKU_ORDER) {
    cum += yakuProb(key, setting);
    if (r < cum) return key;
  }
  return 'miss';
}

// 契機役 → ボーナス抽選バケット（当選率テーブル参照用）
const CONFIRMED_YAKU = new Set(['chudanCherry', 'kakuteiCherry', 'kakuteiyaku']);

function triggerBucket(yaku) {
  if (CONFIRMED_YAKU.has(yaku)) return 'confirmed';
  if (yaku === 'cherry') return 'cherry';
  if (yaku === 'suika') return 'suika';
  return 'other';
}

// 契機役 → モード移行抽選表の行キー（chudanCherryとconfirmedを区別する）
// NOT a wrapper around triggerBucket — kept as an independent function because
// Task 8's mode-transition table gives chudanCherry its own row in every mode,
// while triggerBucket's bonus-trigger lottery always folds chudanCherry into 'confirmed'.
function transitionRole(yaku) {
  if (yaku === 'chudanCherry') return 'chudanCherry';
  if (yaku === 'kakuteiCherry' || yaku === 'kakuteiyaku') return 'confirmed';
  if (yaku === 'cherry') return 'cherry';
  if (yaku === 'suika') return 'suika';
  return 'other'; // miss/replay/oshijunBell/commonBell/ceiling(天井強制当選)
}

// ===== 設定間補間カーブ（元データが設定1・6のレンジのみの項目用） =====
// 偶数設定(2,4,6)は奇数設定に比べてモードアップ率が高いというユーザー確認済みの
// 特性を、階段状カーブで再現する近似値。実データが揃ったら差し替える。
const SETTING_POSITION = { 1: 0.00, 2: 0.25, 3: 0.35, 4: 0.65, 5: 0.75, 6: 1.00 };

function interpolateBySetting(min, max, setting) {
  return min + SETTING_POSITION[setting] * (max - min);
}

// ===== ボーナス基礎確率（設定別） =====
const BONUS_PROB_TABLE = {
  1: { big: 1 / 394.1, reg: 1 / 632.1 },
  2: { big: 1 / 377.0, reg: 1 / 584.8 },
  3: { big: 1 / 362.4, reg: 1 / 546.2 },
  4: { big: 1 / 347.6, reg: 1 / 510.5 },
  5: { big: 1 / 334.7, reg: 1 / 479.6 },
  6: { big: 1 / 322.6, reg: 1 / 452.1 },
};

// 天井到達・「上記以外」契機など、BIG/REGどちらか未確定のボーナス当選時に
// 設定別の基礎確率比率で振り分ける
function rollBigOrReg(setting) {
  const { big, reg } = BONUS_PROB_TABLE[setting];
  const bigShare = big / (big + reg);
  return Math.random() < bigShare ? 'big' : 'reg';
}

// ===== モード滞在中のボーナス当選率（グループ別レンジ、確率0-1で統一） =====
function modeGroupKey(mode) {
  if (mode === 'normalA' || mode === 'normalB') return 'normalAB';
  if (mode === 'hikimodoshi') return 'hikimodoshi';
  if (mode === 'chance') return 'chance';
  return 'heavenGroup'; // hosho, tengoku, dokidoki, superDokidoki
}

const MODE_WIN_RATE_RANGES = {
  normalAB: {
    other: [1 / 297.89, 1 / 234.06],
    cherry: [0.0092, 0.0168],
    suika: [0.0366, 0.0519],
  },
  hikimodoshi: {
    other: [1 / 119.16, 1 / 93.62],
    cherry: [0.0229, 0.0420],
    suika: [0.0916, 0.1297],
  },
  chance: {
    other: [1 / 99.30, 1 / 78.02],
    cherry: [0.0275, 0.0504],
    suika: [0.1099, 0.1556],
  },
  heavenGroup: {
    other: [1 / 8.19, 1 / 8.19], // 全設定共通
    cherry: [0.0625, 0.0816],
    suika: [0.2500, 0.3263],
  },
};

// bucket: 'confirmed' | 'cherry' | 'suika' | 'other'（triggerBucket()の戻り値）
function rollBonusTrigger(mode, bucket, setting) {
  if (bucket === 'confirmed') return true; // 中段チェリー・確定チェリー・確定役はBIG確定
  const [min, max] = MODE_WIN_RATE_RANGES[modeGroupKey(mode)][bucket];
  const p = interpolateBySetting(min, max, setting);
  return Math.random() < p;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEDAL_UNIT_PRICE,
    INVEST_YEN,
    INVEST_MEDALS,
    KOYAKU_PROB,
    COMMON_BELL_PROB,
    KOYAKU_PAYOUT,
    rollYaku,
    triggerBucket,
    transitionRole,
    SETTING_POSITION,
    interpolateBySetting,
    BONUS_PROB_TABLE,
    rollBigOrReg,
    modeGroupKey,
    MODE_WIN_RATE_RANGES,
    rollBonusTrigger,
  };
}
