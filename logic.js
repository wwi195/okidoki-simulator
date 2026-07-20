'use strict';

// ===== 所持金・メダル =====
const MEDAL_UNIT_PRICE = 20; // 円/枚
const INVEST_YEN = 5000;
const INVEST_MEDALS = INVEST_YEN / MEDAL_UNIT_PRICE; // 250

// ===== 小役確率（全設定共通） =====
const KOYAKU_PROB = {
  replay: 1 / 5.05,
  cherry: 1 / 32.13,
  suika: 1 / 128.00,
  kakuteiyaku: 1 / 8192.00,
  kakuteiCherry: 1 / 10922.67,
  chudanCherry: 1 / 32768.00,
};

// ===== 共通ベル確率（設定別） =====
// 押し順を問わず払い戻しあり。通常時もボーナス中も成立する。
const COMMON_BELL_PROB = {
  1: 1 / 168.04,
  2: 1 / 158.30,
  3: 1 / 149.63,
  4: 1 / 141.85,
  5: 1 / 134.85,
  6: 1 / 128.50,
};

// ===== 中/右1stベル確率（設定別） =====
// 正解押し順を知らないと取りこぼす役。通常時は発動しない(=ハズレ扱い)ため
// KOYAKU_PAYOUT.firstBellは0。
const FIRST_BELL_PROB = {
  1: 1 / 5.29,
  2: 1 / 5.29,
  3: 1 / 5.29,
  4: 1 / 5.29,
  5: 1 / 5.30,
  6: 1 / 5.30,
};

// ===== 小役払出（枚数） =====
const KOYAKU_PAYOUT = {
  firstBell: 0,
  commonBell: 7,
  cherry: 1,
  suika: 4,
  kakuteiyaku: 1,
  kakuteiCherry: 1,
  chudanCherry: 1,
};

// 1G分の成立役抽選（BIG/REG自体はここでは決めない。契機役の判定のみ）
const YAKU_ORDER = [
  'replay', 'firstBell', 'commonBell', 'cherry', 'suika',
  'kakuteiyaku', 'kakuteiCherry', 'chudanCherry',
];

function yakuProb(key, setting) {
  if (key === 'commonBell') return COMMON_BELL_PROB[setting];
  if (key === 'firstBell') return FIRST_BELL_PROB[setting];
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

// ===== モード移行抽選表の共通ヘルパー =====
// 与えられた出現率(%)の合計が100未満なら、残りを「stay」(現モード維持)として補う。
// 100以上（レンジ補間の誤差で超過した場合）は全項目を比例縮小して合計を100にする。
// どちらの場合も必ず合計100%の分布を返す。
//
// Precondition: `raw` is expected to represent only the "moving" outcomes of a
// transition row. If `raw` already contains its own `stay` key (e.g. a row that
// explicitly enumerates a stay percentage as part of an already-100%-summing
// set), that key participates in the sum like any other — the function's own
// added-`stay`-remainder branch will never trigger for such a row, since the
// sum is already ~100. Callers must not pass a `raw` object whose own `stay`
// key does NOT already reflect the true remainder unless they intend the whole
// object (including that `stay` value) to be proportionally rescaled.
function normalizeDistribution(raw) {
  const sum = Object.values(raw).reduce((s, v) => s + v, 0);
  if (sum < 100 - 1e-9) {
    return { ...raw, stay: 100 - sum };
  }
  const factor = 100 / sum;
  const result = {};
  for (const k in raw) result[k] = raw[k] * factor;
  return result;
}

// Relies on Object.entries() iteration order, which follows insertion order for
// string keys — safe for named mode/outcome keys like 'normalA'/'stay'. It is
// NOT safe if any outcome key were an integer-index string (e.g. '0', '1'):
// per the JS spec, such keys are reordered to the front regardless of insertion
// order, which would break the intended cumulative-range walk. Every
// distribution in this codebase uses named keys, never numeric-string keys, so
// this is a documented constraint, not a current bug.
function rollFromDistribution(dist) {
  const r = Math.random() * 100;
  let cum = 0;
  for (const [outcome, pct] of Object.entries(dist)) {
    cum += pct;
    if (r < cum) return outcome;
  }
  const keys = Object.keys(dist);
  return keys[keys.length - 1];
}

// ===== ボーナス当選時のモード移行抽選表 =====
const MODE_TRANSITION_TABLE = {
  normalA: {
    chudanCherry: { type: 'fixed', outcomes: { tengoku: 75.00, dokidoki: 24.22, superDokidoki: 0.78 } },
    confirmed: { type: 'fixed', outcomes: { stay: 45.31, normalB: 25.00, tengoku: 25.00, dokidoki: 4.69 } },
    suika: {
      type: 'oddEven',
      odd: { type: 'fixed', outcomes: { normalB: 50.00, tengoku: 20.31, dokidoki: 1.56 } },
      even: { type: 'range', ranges: { normalB: [57.81, 60.94] }, fixed: { tengoku: 20.31, dokidoki: 1.56 } },
      exceptions: { 3: { tengoku: 21.88 }, 6: { tengoku: 23.44 } },
    },
    other: { type: 'range', ranges: { normalB: [25.00, 39.06], tengoku: [10.16, 11.72] }, fixed: { dokidoki: 0.78 } },
  },
  normalB: {
    chudanCherry: { type: 'fixed', outcomes: { tengoku: 50.00, dokidoki: 49.22, superDokidoki: 0.78 } },
    confirmed: { type: 'fixed', outcomes: { stay: 25.00, tengoku: 50.00, dokidoki: 25.00 } },
    suika: { type: 'range', ranges: { tengoku: [59.38, 67.97], dokidoki: [15.63, 20.31] } },
    other: { type: 'range', ranges: { tengoku: [42.19, 54.69], dokidoki: [7.81, 10.16] } },
  },
  tengoku: {
    cherry: { type: 'fixed', outcomes: { stay: 99.22, dokidoki: 0.78 } },
    chudanCherry: { type: 'fixed', outcomes: { dokidoki: 100 } },
    confirmed: { type: 'fixed', outcomes: { stay: 93.75, dokidoki: 6.25 } },
    suika: { type: 'fixed', outcomes: { stay: 98.44, dokidoki: 1.56 } },
    other: {
      type: 'oddEven',
      odd: { type: 'fixed', outcomes: { stay: 74.22, hikimodoshi: 7.81, normalA: 13.28, normalB: 3.91, dokidoki: 0.78 } },
      even: { type: 'fixed', outcomes: { stay: 64.84, hikimodoshi: 17.19, normalA: 13.28, normalB: 3.91, dokidoki: 0.78 } },
    },
  },
  dokidoki: {
    chudanCherry: { type: 'fixed', outcomes: { superDokidoki: 100 } },
    confirmed: { type: 'fixed', outcomes: { stay: 96.88, superDokidoki: 3.13 } },
    cherry: { type: 'fixed', outcomes: { stay: 99.61, superDokidoki: 0.39 } },
    suika: { type: 'fixed', outcomes: { stay: 99.22, superDokidoki: 0.78 } },
    other: { type: 'fixed', outcomes: { hosho: 17.97, stay: 81.64, superDokidoki: 0.39 } },
  },
  superDokidoki: {
    chudanCherry: { type: 'fixed', outcomes: { stay: 100 } },
    confirmed: { type: 'fixed', outcomes: { stay: 100 } },
    cherry: { type: 'fixed', outcomes: { stay: 100 } },
    suika: { type: 'fixed', outcomes: { stay: 100 } },
    other: { type: 'fixed', outcomes: { stay: 90.63, hosho: 9.38 } },
  },
  hosho: {
    chudanCherry: { type: 'fixed', outcomes: { tengoku: 75.00, dokidoki: 24.22, superDokidoki: 0.78 } },
    confirmed: { type: 'fixed', outcomes: { stay: 75.00, tengoku: 22.66, dokidoki: 2.34 } },
    suika: { type: 'fixed', outcomes: { stay: 91.41, tengoku: 7.81, dokidoki: 0.78 } },
    cherry: { type: 'fixed', outcomes: { stay: 95.70, tengoku: 3.91, dokidoki: 0.39 } },
    other: { type: 'fixed', outcomes: { normalA: 65.23, normalB: 10.16, hikimodoshi: 20.31, tengoku: 3.91, dokidoki: 0.39 } },
  },
  hikimodoshi: {
    chudanCherry: { type: 'fixed', outcomes: { tengoku: 75.00, dokidoki: 24.22, superDokidoki: 0.78 } },
    confirmed: { type: 'fixed', outcomes: { normalB: 50.00, tengoku: 45.31, dokidoki: 4.69 } },
    suika: {
      type: 'range',
      ranges: { normalA: [21.88, 25.00], normalB: [39.06, 45.31], tengoku: [31.25, 34.38] },
      fixed: { dokidoki: 1.56 },
    },
    other: {
      type: 'range',
      ranges: { normalA: [32.03, 50.00], normalB: [32.81, 51.56], tengoku: [15.63, 17.19] },
      fixed: { dokidoki: 0.78 },
    },
  },
  chance: {
    chudanCherry: { type: 'fixed', outcomes: { tengoku: 50.00, dokidoki: 42.19, superDokidoki: 7.81 } },
    confirmed: { type: 'fixed', outcomes: { normalB: 25.00, tengoku: 65.63, dokidoki: 7.03, superDokidoki: 2.34 } },
    suika: { type: 'fixed', outcomes: { normalB: 65.63, tengoku: 31.25, dokidoki: 2.34, superDokidoki: 0.78 } },
    other: { type: 'fixed', outcomes: { normalB: 82.81, tengoku: 15.63, dokidoki: 1.17, superDokidoki: 0.39 } },
  },
};

// oddEvenの奇偶分岐内にある'range'行専用の補間。
// 通常のinterpolateBySettingは設定1〜6全体の階段カーブを使うが、
// oddEven分岐は奇数{1,3,5}または偶数{2,4,6}という3設定だけの部分集合に
// しか登場しないため、その部分集合の最小設定を0・最大設定を1とする
// 独自の直線補間を行う（例: suika偶数分岐は設定2で最小値、設定6で最大値）。
function interpolateWithinParity(min, max, setting) {
  const first = setting % 2 === 0 ? 2 : 1; // 部分集合の最初の設定（2 or 1）
  const position = (setting - first) / 4; // 設定2,4,6 or 1,3,5 → 0, 0.5, 1
  return min + position * (max - min);
}

function computeRawOutcomes(row, setting, useLocalInterpolation) {
  if (row.type === 'fixed') return { ...row.outcomes };
  if (row.type === 'range') {
    const raw = { ...(row.fixed || {}) };
    for (const [k, [min, max]] of Object.entries(row.ranges)) {
      raw[k] = useLocalInterpolation
        ? interpolateWithinParity(min, max, setting)
        : interpolateBySetting(min, max, setting);
    }
    return raw;
  }
  if (row.type === 'oddEven') {
    const branch = setting % 2 === 0 ? row.even : row.odd;
    const raw = computeRawOutcomes(branch, setting, true);
    if (row.exceptions && row.exceptions[setting]) {
      Object.assign(raw, row.exceptions[setting]);
    }
    return raw;
  }
  throw new Error('unknown mode transition row type: ' + row.type);
}

// role: transitionRole()の戻り値（'chudanCherry'|'confirmed'|'cherry'|'suika'|'other'）
function resolveModeTransition(mode, role, setting) {
  const modeTable = MODE_TRANSITION_TABLE[mode];
  const row = modeTable[role] || modeTable.other;
  const raw = computeRawOutcomes(row, setting);

  // 元データが既に「stay」を明示的な出現率として含んでいる行（=原資料が
  // 「残り全部」ではなく完結した内訳として提示している行）は、それ自体が
  // 完全な分布として扱う。normalizeDistribution（合計が100未満なら残余を
  // stayとして追加、100以上なら比例縮小）を適用すると、原資料側の丸め
  // （合計が99.xx/100.0xになる程度の誤差）まで歪めてstay値を書き換えて
  // しまうため、ここではnormalizeDistributionを通さずそのまま返す。
  if (Object.prototype.hasOwnProperty.call(raw, 'stay')) {
    return { ...raw };
  }

  const result = normalizeDistribution(raw);

  // normalizeDistributionが残余として新規に追加したstayは、浮動小数点演算
  // の丸め誤差で例えば28.13が28.129999999999995になることがあるため、
  // 元データの精度（小数点以下2桁）に丸め直す。ただし、設定2〜5の補間の
  // ように残余そのものが真に小数第3位以下まで意味を持つ値の場合は丸めては
  // いけない（丸めると合計100%からずれてしまう）。そのためズレが浮動小数点
  // 誤差相当（1e-6未満）の場合にのみ丸めを適用する。合計が100以上で比例縮小
  // されたケース（stayが存在しない）はここには来ない。
  if (Object.prototype.hasOwnProperty.call(result, 'stay')) {
    const rounded = Math.round(result.stay * 100) / 100;
    if (Math.abs(rounded - result.stay) < 1e-6) {
      result.stay = rounded;
    }
  }
  return result;
}

// ===== ボーナス中の払出（AT型・ゲーム数固定） =====
// 通常時は隠れている押し順ベルがボーナス中は表示されるため取りこぼしがなくなり、
// 差枚（賭け枚数控除後）でゲームあたり一定レートの純増となる。内部抽選は無い。
const BONUS_PAYOUT_TABLE = {
  big: { games: 70, netMedalsPerGame: 3.0 },
  reg: { games: 30, netMedalsPerGame: 3.0 },
};

// type: 'big' | 'reg'
function resolveBonusPayout(type) {
  const { games, netMedalsPerGame } = BONUS_PAYOUT_TABLE[type];
  return { games, netMedals: games * netMedalsPerGame };
}

// ===== ゲームループ =====
const BET_MEDALS = 3; // 1Gあたりの賭け枚数

// リセット・設定変更時の初期モード振分け（全設定共通）
const RESET_MODE_DISTRIBUTION = { normalA: 57.03, normalB: 9.77, chance: 33.20 };

function rollResetMode() {
  return rollFromDistribution(RESET_MODE_DISTRIBUTION);
}

// ボーナス非当選が続いた場合の強制当選しきい値（モード別、全設定共通）
const CEILING_GAMES = {
  normalA: 1000, normalB: 1000,
  hikimodoshi: 200, chance: 200,
  hosho: 32, tengoku: 32, dokidoki: 32, superDokidoki: 32,
};

// state: { mode, medals, games, gamesSinceLastBonus }
// 戻り値: { state: 更新後state, bonus: null | 'big' | 'reg' }
function playGame(state, setting) {
  const yaku = rollYaku(setting);
  const spinNet = yaku === 'replay' ? 0 : (KOYAKU_PAYOUT[yaku] || 0) - BET_MEDALS;

  let medals = state.medals + spinNet;
  let games = state.games + 1;
  let mode = state.mode;
  let gamesSinceLastBonus = state.gamesSinceLastBonus + 1;
  let bonus = null;

  const bucket = triggerBucket(yaku);
  const naturalWin = rollBonusTrigger(state.mode, bucket, setting);
  const ceilingWin = !naturalWin && gamesSinceLastBonus >= CEILING_GAMES[state.mode];

  if (naturalWin || ceilingWin) {
    const type = rollBigOrReg(setting);
    const payout = resolveBonusPayout(type);
    medals += payout.netMedals;
    games += payout.games;
    bonus = type;
    gamesSinceLastBonus = 0;

    const role = naturalWin ? transitionRole(yaku) : transitionRole('ceiling');
    const dist = resolveModeTransition(state.mode, role, setting);
    const outcome = rollFromDistribution(dist);
    mode = outcome === 'stay' ? state.mode : outcome;
  }

  return { state: { mode, medals, games, gamesSinceLastBonus }, bonus, yaku };
}

// initialState: { mode, medals, games }。totalGames到達までplayGameを繰り返す
// （ボーナス消化G込みの累計のため、最終gamesはtotalGamesを超えうる）
function simulate(setting, initialState, totalGames) {
  let state = initialState;
  const stats = { bigCount: 0, regCount: 0 };
  while (state.games < totalGames) {
    const result = playGame(state, setting);
    state = result.state;
    if (result.bonus === 'big') stats.bigCount++;
    if (result.bonus === 'reg') stats.regCount++;
  }
  return { state, stats };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEDAL_UNIT_PRICE,
    INVEST_YEN,
    INVEST_MEDALS,
    KOYAKU_PROB,
    COMMON_BELL_PROB,
    FIRST_BELL_PROB,
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
    normalizeDistribution,
    rollFromDistribution,
    MODE_TRANSITION_TABLE,
    resolveModeTransition,
    BONUS_PAYOUT_TABLE,
    resolveBonusPayout,
    BET_MEDALS,
    RESET_MODE_DISTRIBUTION,
    rollResetMode,
    CEILING_GAMES,
    playGame,
    simulate,
  };
}
