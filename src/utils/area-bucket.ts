const standardBuckets = [59, 74, 84, 101, 114];

export function getAreaBucket(exclusiveAreaM2: number) {
  const closest = standardBuckets.reduce((best, bucket) => {
    return Math.abs(bucket - exclusiveAreaM2) < Math.abs(best - exclusiveAreaM2)
      ? bucket
      : best;
  }, standardBuckets[0]);

  return Math.abs(closest - exclusiveAreaM2) <= 3 ? String(closest) : "custom";
}
