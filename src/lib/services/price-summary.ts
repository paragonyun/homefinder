import { getAreaBucket } from "../../utils/area-bucket";

export type PriceSummaryTransaction = {
  deal_date: string;
  exclusive_area_m2: number | string;
  deal_amount_krw: number | string;
  cancel_yn: string | null;
};

export type AreaPriceSummary = {
  areaBucket: string;
  exclusiveAreaMinM2: number;
  exclusiveAreaMaxM2: number;
  latestDealDate: string;
  latestPriceKrw: number;
  averagePriceKrw: number;
  minPriceKrw: number;
  maxPriceKrw: number;
  transactionCount: number;
};

export type MonthlyPriceTrend = {
  month: string;
  areaBucket: string;
  averagePriceKrw: number;
  transactionCount: number;
};

export type MonthlyPriceTrendLine = {
  areaBucket: string;
  points: Array<{
    month: string;
    averagePriceKrw: number;
    transactionCount: number;
  }>;
  totalTransactionCount: number;
  isSparse: boolean;
};

type NormalizedTransaction = {
  dealDate: string;
  month: string;
  areaBucket: string;
  exclusiveAreaM2: number;
  dealAmountKrw: number;
};

export function summarizeApartmentPrices(
  transactions: PriceSummaryTransaction[],
) {
  const activeTransactions = transactions
    .filter((transaction) => transaction.cancel_yn !== "O")
    .map(normalizeTransaction)
    .filter((transaction): transaction is NormalizedTransaction => Boolean(transaction));

  return {
    areaSummaries: summarizeByArea(activeTransactions),
    monthlyTrend: summarizeByMonth(activeTransactions),
  };
}

export function buildMonthlyPriceTrendLines(
  monthlyTrend: MonthlyPriceTrend[],
  maxMonths = 12,
): MonthlyPriceTrendLine[] {
  const recentMonths = Array.from(
    new Set(monthlyTrend.map((point) => point.month)),
  )
    .sort()
    .slice(-maxMonths);
  const recentMonthSet = new Set(recentMonths);

  return Array.from(
    groupBy(
      monthlyTrend.filter((point) => recentMonthSet.has(point.month)),
      (point) => point.areaBucket,
    ),
  )
    .map(([areaBucket, points]) => {
      const sortedPoints = [...points]
        .sort((left, right) => left.month.localeCompare(right.month))
        .map((point) => ({
          month: point.month,
          averagePriceKrw: point.averagePriceKrw,
          transactionCount: point.transactionCount,
        }));
      const totalTransactionCount = sortedPoints.reduce(
        (sum, point) => sum + point.transactionCount,
        0,
      );

      return {
        areaBucket,
        points: sortedPoints,
        totalTransactionCount,
        isSparse: sortedPoints.length < 3 || totalTransactionCount < 4,
      } satisfies MonthlyPriceTrendLine;
    })
    .sort((left, right) => compareAreaBucket(left.areaBucket, right.areaBucket));
}

export function getLatestTransactionMonth(
  transactions: PriceSummaryTransaction[],
) {
  return transactions.reduce<string | null>((latestMonth, transaction) => {
    const month = getTransactionMonth(transaction);

    if (!month) {
      return latestMonth;
    }

    return !latestMonth || month > latestMonth ? month : latestMonth;
  }, null);
}

export function filterTransactionsByMonth<T extends PriceSummaryTransaction>(
  transactions: T[],
  month: string | null,
) {
  if (!month) {
    return [];
  }

  return transactions.filter(
    (transaction) => getTransactionMonth(transaction) === month,
  );
}

function normalizeTransaction(
  transaction: PriceSummaryTransaction,
): NormalizedTransaction | null {
  const exclusiveAreaM2 = Number(transaction.exclusive_area_m2);
  const dealAmountKrw = Number(transaction.deal_amount_krw);

  if (!Number.isFinite(exclusiveAreaM2) || !Number.isFinite(dealAmountKrw)) {
    return null;
  }

  return {
    dealDate: transaction.deal_date,
    month: transaction.deal_date.slice(0, 7),
    areaBucket: getAreaBucket(exclusiveAreaM2),
    exclusiveAreaM2,
    dealAmountKrw,
  };
}

function getTransactionMonth(transaction: PriceSummaryTransaction) {
  return /^\d{4}-\d{2}/.test(transaction.deal_date)
    ? transaction.deal_date.slice(0, 7)
    : null;
}

function summarizeByArea(transactions: NormalizedTransaction[]) {
  return Array.from(groupBy(transactions, (transaction) => transaction.areaBucket))
    .map(([areaBucket, bucketTransactions]) => {
      const sortedByDate = [...bucketTransactions].sort((left, right) =>
        right.dealDate.localeCompare(left.dealDate),
      );
      const prices = bucketTransactions.map((transaction) => transaction.dealAmountKrw);
      const areas = bucketTransactions.map((transaction) => transaction.exclusiveAreaM2);
      const latest = sortedByDate[0];

      return {
        areaBucket,
        exclusiveAreaMinM2: Math.min(...areas),
        exclusiveAreaMaxM2: Math.max(...areas),
        latestDealDate: latest.dealDate,
        latestPriceKrw: latest.dealAmountKrw,
        averagePriceKrw: average(prices),
        minPriceKrw: Math.min(...prices),
        maxPriceKrw: Math.max(...prices),
        transactionCount: bucketTransactions.length,
      } satisfies AreaPriceSummary;
    })
    .sort((left, right) => right.latestDealDate.localeCompare(left.latestDealDate));
}

function summarizeByMonth(transactions: NormalizedTransaction[]) {
  return Array.from(
    groupBy(
      transactions,
      (transaction) => `${transaction.month}|${transaction.areaBucket}`,
    ),
  )
    .map(([key, bucketTransactions]) => {
      const [month, areaBucket] = key.split("|");

      return {
        month,
        areaBucket,
        averagePriceKrw: average(
          bucketTransactions.map((transaction) => transaction.dealAmountKrw),
        ),
        transactionCount: bucketTransactions.length,
      } satisfies MonthlyPriceTrend;
    })
    .sort(
      (left, right) =>
        left.month.localeCompare(right.month) ||
        compareAreaBucket(left.areaBucket, right.areaBucket),
    );
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function compareAreaBucket(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right);
}
