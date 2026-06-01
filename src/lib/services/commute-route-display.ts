import type {
  CommuteRouteStep,
  CommuteRouteStepMode,
} from "../../types/commute";

export type TransitRouteSegment = {
  mode: CommuteRouteStepMode;
  label: string;
  durationMinutes: number | null;
  flexGrow: number;
};

export function buildTransitRouteSegments(
  routeSteps: CommuteRouteStep[],
): TransitRouteSegment[] {
  return routeSteps
    .filter((step) => step.mode !== "driving")
    .map((step) => ({
      mode: step.mode,
      label: getTransitRouteSegmentLabel(step),
      durationMinutes: step.durationMinutes,
      flexGrow: Math.max(step.durationMinutes ?? 1, 1),
    }));
}

export function buildTransitRouteHeadline(routeSteps: CommuteRouteStep[]) {
  const routeNames = routeSteps
    .filter((step) => step.mode === "bus" || step.mode === "subway")
    .map((step) => step.routeName)
    .filter((routeName): routeName is string => Boolean(routeName));

  return routeNames.length > 0 ? routeNames.join(" → ") : "상세 경로";
}

function getTransitRouteSegmentLabel(step: CommuteRouteStep) {
  if (step.mode === "transfer") {
    return "환승";
  }

  return step.routeName ?? step.title;
}
