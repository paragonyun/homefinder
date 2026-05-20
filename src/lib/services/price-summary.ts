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
