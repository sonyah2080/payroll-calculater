/**
 * ============================================================================
 * 4대보험 및 세금 요율 설정 (2026년 최신 개정 요율)
 * ============================================================================
 */
const RATES_CONFIG = {
  // 국민연금 (2026년 근로자 부담분 4.75%)
  NP: {
    RATE: 0.0475,
    MIN_BASE: 390000,   // 국민연금 기준소득월액 하한선
    MAX_BASE: 6170000   // 국민연금 기준소득월액 상한선
  },
  // 건강보험 (2026년 근로자 부담분 3.595%)
  HI: {
    RATE: 0.03595
  },
  // 장기요양보험 (건강보험료의 13.14%)
  LT: {
    RATE_OF_HI: 0.1314
  },
  // 고용보험 (실업급여 근로자 부담분 0.9%)
  EI: {
    RATE: 0.009
  },
  // 지방소득세 (소득세의 10%)
  LOCAL_TAX: {
    RATE: 0.10
  }
};

// 국세청 근로소득 간이세액표 핵심 구간 데이터 (단위: 원)
// [과세급여 이상, 미만, [공제대상가족수 1인, 2인, 3인, 4인, ...]]
const NTS_TAX_TABLE = [
  { min: 0, max: 1060000, taxes: [0, 0, 0, 0, 0, 0, 0] },
  { min: 1060000, max: 1100000, taxes: [1320, 0, 0, 0, 0, 0, 0] },
  { min: 1100000, max: 1200000, taxes: [3300, 0, 0, 0, 0, 0, 0] },
  { min: 1200000, max: 1300000, taxes: [6600, 0, 0, 0, 0, 0, 0] },
  { min: 1300000, max: 1400000, taxes: [9900, 0, 0, 0, 0, 0, 0] },
  { min: 1400000, max: 1500000, taxes: [13200, 0, 0, 0, 0, 0, 0] },
  { min: 1500000, max: 1600000, taxes: [16500, 0, 0, 0, 0, 0, 0] },
  { min: 1600000, max: 1700000, taxes: [19800, 0, 0, 0, 0, 0, 0] },
  { min: 1700000, max: 1800000, taxes: [23100, 0, 0, 0, 0, 0, 0] },
  { min: 1800000, max: 1900000, taxes: [26400, 0, 0, 0, 0, 0, 0] },
  { min: 1900000, max: 2000000, taxes: [29700, 0, 0, 0, 0, 0, 0] },
  { min: 2000000, max: 2100000, taxes: [15470, 0, 0, 0, 0, 0, 0] },
  { min: 2100000, max: 2200000, taxes: [18250, 0, 0, 0, 0, 0, 0] },
  { min: 2200000, max: 2300000, taxes: [25600, 11100, 0, 0, 0, 0, 0] },
  { min: 2300000, max: 2400000, taxes: [29160, 14660, 0, 0, 0, 0, 0] }, // 과세 230만 원 -> 1인 29,160원
  { min: 2400000, max: 2500000, taxes: [36910, 22410, 10260, 0, 0, 0, 0] },
  { min: 2500000, max: 2600000, taxes: [42910, 28410, 16260, 0, 0, 0, 0] },
  { min: 2600000, max: 2700000, taxes: [50660, 36160, 24010, 0, 0, 0, 0] },
  { min: 2700000, max: 2800000, taxes: [58410, 43910, 31760, 12610, 0, 0, 0] },
  { min: 2800000, max: 2900000, taxes: [66160, 51660, 39510, 20360, 0, 0, 0] },
  { min: 2900000, max: 3000000, taxes: [73910, 59410, 47260, 28110, 0, 0, 0] },
  { min: 3000000, max: 3100000, taxes: [81660, 67160, 55010, 35860, 16710, 0, 0] }
];

/**
 * 간이세액표 데이터 조회 함수
 */
function lookupNtsTaxTable(taxableSalary, dependents = 1) {
  if (taxableSalary <= 1060000) return 0;

  const row = NTS_TAX_TABLE.find(item => taxableSalary >= item.min && taxableSalary < item.max);
  if (!row) return null; // 구간에 없으면 공식 산식 타도록 null 반환

  const depIdx = Math.max(1, Math.min(dependents, 11)) - 1;
  const tax = row.taxes[depIdx] !== undefined ? row.taxes[depIdx] : row.taxes[row.taxes.length - 1];

  return tax;
}

/**
 * ============================================================================
 * [추가] 종합소득세 기본세율표 (퇴직소득세 산출용)
 * ============================================================================
 */
const BASIC_TAX_TABLE = [
  { over: 1000000000, rate: 0.45, deduction: 65940000 },
  { over: 500000000, rate: 0.42, deduction: 35940000 },
  { over: 300000000, rate: 0.40, deduction: 25940000 },
  { over: 150000000, rate: 0.38, deduction: 19940000 },
  { over: 88000000, rate: 0.35, deduction: 15440000 },
  { over: 50000000, rate: 0.24, deduction: 5760000 },
  { over: 14000000, rate: 0.15, deduction: 1260000 },
  { over: 0, rate: 0.06, deduction: 0 }
];

// 과세표준(taxBase)을 입력받아 산출세액을 반환하는 함수
function getBasicTax(taxBase) {
  for (let bracket of BASIC_TAX_TABLE) {
    if (taxBase > bracket.over) {
      return (taxBase * bracket.rate) - bracket.deduction;
    }
  }
  return 0;
}