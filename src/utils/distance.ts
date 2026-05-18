export function formatDistanceMeters(distanceM: number | null | undefined) {
  if (distanceM == null) {
    return "거리 미계산";
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distanceM)}m`;
}
