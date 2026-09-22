import { useEffect, useRef } from "react";

export type Track = {
  id: string;
  label: string;
  color: string;
  points: [number, number][];
};

export default function RouteMap({ tracks }: { tracks: Track[] }) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;

      if (!mapRef.current) {
        const mobile = window.matchMedia("(max-width: 767px)").matches;
        mapRef.current = L.map(el.current, {
          dragging: !mobile,
          touchZoom: !mobile,
          scrollWheelZoom: false,
        }).setView([-12.97, -38.5], 7);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      if (layerRef.current) map.removeLayer(layerRef.current);
      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      const bounds: [number, number][] = [];
      for (const t of tracks) {
        if (t.points.length === 0) continue;
        bounds.push(...t.points);
        L.polyline(t.points, { color: t.color, weight: 4, opacity: 0.85 })
          .bindTooltip(t.label)
          .addTo(group);
        const firstPoint = t.points[0];
        const lastPoint = t.points[t.points.length - 1];
        if (!firstPoint || !lastPoint) continue;
        L.circleMarker(firstPoint, { radius: 6, color: t.color, fillOpacity: 1 })
          .bindTooltip(`${t.label} — início`)
          .addTo(group);
        L.circleMarker(lastPoint, {
          radius: 6,
            color: t.color,
          fillColor: t.color,
          fillOpacity: 1,
        })
          .bindTooltip(`${t.label} — fim`)
          .addTo(group);
      }
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
    };
  }, [tracks]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    },
    [],
  );

  return (
    <div
      ref={el}
      aria-label="Mapa das rotas selecionadas"
      className="h-[55dvh] min-h-80 w-full touch-pan-y rounded-lg border md:h-[65vh]"
    />
  );
}
