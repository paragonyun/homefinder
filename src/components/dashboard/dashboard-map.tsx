"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import {
  calculateDashboardMapViewport,
  filterDashboardMapApartments,
  getDashboardMapPins,
  shouldStartDashboardMapDrag,
  type DashboardMapPin,
} from "@/lib/services/dashboard-map";
import type { DashboardApartmentSummary } from "@/lib/services/dashboard-model";
import { formatKrw } from "@/utils/format-price";

const tileSize = 256;
const minZoom = 10;
const maxZoom = 15;
const defaultMapSize = { width: 920, height: 420 };

type DashboardMapPanelProps = {
  apartments: DashboardApartmentSummary[];
};

type Point = {
  x: number;
  y: number;
};

export function DashboardMapPanel({
  apartments,
}: Readonly<DashboardMapPanelProps>) {
  const [showExcluded, setShowExcluded] = useState(false);
  const mapApartments = useMemo(
    () =>
      apartments.map((apartment) => ({
        id: apartment.id,
        name: apartment.name,
        address: apartment.address,
        lat: apartment.lat,
        lng: apartment.lng,
        status: apartment.status,
        latestPriceKrw: apartment.latestPriceKrw,
        latestDealDate: apartment.latestDealDate,
        gangnamMinutes: apartment.gangnamMinutes,
        yeouidoMinutes: apartment.yeouidoMinutes,
        score: apartment.score.totalScore,
      })),
    [apartments],
  );
  const visibleApartments = useMemo(
    () => filterDashboardMapApartments(mapApartments, showExcluded),
    [mapApartments, showExcluded],
  );
  const pins = useMemo(
    () => getDashboardMapPins(visibleApartments),
    [visibleApartments],
  );
  const viewport = useMemo(() => calculateDashboardMapViewport(pins), [pins]);
  const missingCoordinateCount = visibleApartments.length - pins.length;
  const excludedCount = mapApartments.filter(
    (apartment) => apartment.status === "excluded",
  ).length;

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Map
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">
            서울 후보 위치
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            좌표가 저장된 {pins.length.toLocaleString("ko-KR")}개 단지를 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {missingCoordinateCount > 0 ? (
            <span className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              좌표 미확인 {missingCoordinateCount.toLocaleString("ko-KR")}개
            </span>
          ) : null}
          {excludedCount > 0 ? (
            <button
              type="button"
              role="switch"
              aria-checked={showExcluded}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setShowExcluded((current) => !current)}
            >
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 rounded-full transition ${
                  showExcluded ? "bg-slate-700" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                    showExcluded ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
              제외 단지 표시
            </button>
          ) : null}
        </div>
      </div>

      <DashboardMapCanvas
        key={getMapResetKey(pins)}
        pins={pins}
        viewport={viewport}
      />
    </section>
  );
}

function DashboardMapCanvas({
  pins,
  viewport,
}: Readonly<{
  pins: DashboardMapPin[];
  viewport: ReturnType<typeof calculateDashboardMapViewport>;
}>) {
  const [center, setCenter] = useState({
    lat: viewport.centerLat,
    lng: viewport.centerLng,
  });
  const [zoom, setZoom] = useState(viewport.zoom);
  const [selectedId, setSelectedId] = useState<string | null>(pins[0]?.id ?? null);
  const [mapSize, setMapSize] = useState(defaultMapSize);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    centerPoint: Point;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      setMapSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(280, entry.contentRect.height),
      });
    });

    observer.observe(mapRef.current);

    return () => observer.disconnect();
  }, []);

  const centerPoint = projectCoordinate(center.lat, center.lng, zoom);
  const topLeft = {
    x: centerPoint.x - mapSize.width / 2,
    y: centerPoint.y - mapSize.height / 2,
  };
  const tiles = getVisibleTiles({ topLeft, size: mapSize, zoom });
  const selectedPin = pins.find((pin) => pin.id === selectedId) ?? pins[0] ?? null;

  const updateZoom = (delta: number) => {
    setZoom((current) => clampZoom(current + delta));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const targetIsInteractive =
      event.target instanceof Element &&
      Boolean(event.target.closest("button, a"));

    if (
      !shouldStartDashboardMapDrag({
        button: event.button,
        targetIsInteractive,
      })
    ) {
      return;
    }

    dragRef.current = {
      centerPoint: projectCoordinate(center.lat, center.lng, zoom),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextCenter = unprojectPoint(
      {
        x: drag.centerPoint.x - (event.clientX - drag.startX),
        y: drag.centerPoint.y - (event.clientY - drag.startY),
      },
      zoom,
    );

    setCenter(nextCenter);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <>
      <div
        ref={mapRef}
        className="relative mt-4 h-[300px] min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 touch-none sm:h-[420px]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={(event) => {
          event.preventDefault();
          updateZoom(event.deltaY < 0 ? 1 : -1);
        }}
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${zoom}-${tile.x}-${tile.y}`}
            alt=""
            className="absolute max-w-none select-none"
            draggable={false}
            height={tileSize}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.wrappedX}/${tile.y}.png`}
            style={{
              height: tileSize,
              left: tile.left,
              top: tile.top,
              width: tileSize,
            }}
            width={tileSize}
          />
        ))}

        {pins.map((pin) => {
          const point = projectCoordinate(pin.lat, pin.lng, zoom);
          const left = point.x - topLeft.x;
          const top = point.y - topLeft.y;

          if (
            left < -40 ||
            left > mapSize.width + 40 ||
            top < -40 ||
            top > mapSize.height + 40
          ) {
            return null;
          }

          return (
            <button
              key={pin.id}
              type="button"
              aria-label={`${pin.name} 지도 핀`}
              className={`absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition hover:scale-110 focus:outline-none focus:ring-4 ${
                pin.id === selectedId
                  ? "scale-125 ring-4 ring-slate-950/35"
                  : "ring-2 ring-white/70"
              } ${getPinColorClass(
                pin,
              )}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(pin.id);
              }}
              style={{ left, top }}
            />
          );
        })}

        {selectedPin ? (
          <SelectedApartmentPanel placement="overlay" pin={selectedPin} />
        ) : null}

        <div className="absolute left-3 top-3 z-20 grid overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            aria-label="지도 확대"
            className="h-9 w-9 border-b border-slate-200 text-lg font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => updateZoom(1)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="지도 축소"
            className="h-9 w-9 text-lg font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => updateZoom(-1)}
          >
            -
          </button>
        </div>

        <div className="absolute bottom-2 left-2 z-20 rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
          © OpenStreetMap contributors
        </div>
      </div>
      {selectedPin ? (
        <SelectedApartmentPanel placement="mobile" pin={selectedPin} />
      ) : null}
    </>
  );
}

function getMapResetKey(pins: DashboardMapPin[]) {
  return pins.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join("|");
}

function SelectedApartmentPanel({
  pin,
  placement,
}: Readonly<{
  pin: DashboardMapPin;
  placement: "mobile" | "overlay";
}>) {
  const panelClassName =
    placement === "overlay"
      ? "absolute right-3 top-3 z-20 hidden w-72 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:block"
      : "mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:hidden";

  return (
    <div className={panelClassName}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-keep text-sm font-semibold text-slate-950">
            {pin.name}
          </p>
          <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
            {pin.address ?? "주소 없음"}
          </p>
        </div>
        <StatusPill status={pin.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MapMetric
          label="최근가"
          value={pin.latestPriceKrw ? formatKrw(pin.latestPriceKrw) : "-"}
        />
        <MapMetric label="점수" value={`${formatScore(pin.score)}점`} />
        <MapMetric
          label="여의도"
          value={pin.yeouidoMinutes ? `${pin.yeouidoMinutes}분` : "-"}
        />
        <MapMetric
          label="강남"
          value={pin.gangnamMinutes ? `${pin.gangnamMinutes}분` : "-"}
        />
      </div>
      <Link
        href={pin.id.startsWith("mock-") ? "/apartments" : `/apartments/${pin.id}`}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
      >
        상세 보기
      </Link>
    </div>
  );
}

function MapMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function getVisibleTiles({
  size,
  topLeft,
  zoom,
}: {
  size: { height: number; width: number };
  topLeft: Point;
  zoom: number;
}) {
  const tileCount = 2 ** zoom;
  const minTileX = Math.floor(topLeft.x / tileSize);
  const maxTileX = Math.floor((topLeft.x + size.width) / tileSize);
  const minTileY = Math.floor(topLeft.y / tileSize);
  const maxTileY = Math.floor((topLeft.y + size.height) / tileSize);
  const tiles: Array<{
    left: number;
    top: number;
    wrappedX: number;
    x: number;
    y: number;
  }> = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= tileCount) {
        continue;
      }

      tiles.push({
        x,
        y,
        wrappedX: wrapTileX(x, tileCount),
        left: x * tileSize - topLeft.x,
        top: y * tileSize - topLeft.y,
      });
    }
  }

  return tiles;
}

function projectCoordinate(lat: number, lng: number, zoom: number): Point {
  const sinLat = Math.sin((clampLatitude(lat) * Math.PI) / 180);
  const scale = tileSize * 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y:
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      scale,
  };
}

function unprojectPoint(point: Point, zoom: number) {
  const scale = tileSize * 2 ** zoom;
  const lng = (point.x / scale) * 360 - 180;
  const latRadians = Math.atan(Math.sinh(Math.PI * (1 - (2 * point.y) / scale)));

  return {
    lat: (latRadians * 180) / Math.PI,
    lng,
  };
}

function clampLatitude(value: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, value));
}

function clampZoom(value: number) {
  return Math.max(minZoom, Math.min(maxZoom, value));
}

function wrapTileX(x: number, tileCount: number) {
  return ((x % tileCount) + tileCount) % tileCount;
}

function getPinColorClass(pin: DashboardMapPin) {
  if (pin.status === "interested") {
    return "bg-emerald-600";
  }

  if (pin.status === "candidate" || pin.status === "visit_planned") {
    return "bg-blue-600";
  }

  if (pin.status === "on_hold") {
    return "bg-amber-500";
  }

  return "bg-slate-500";
}

function formatScore(value: number) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  });
}
