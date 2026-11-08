import { useEffect, useRef, useState, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import { itineraryMapPoints, boundsOf, type MapPoint } from '../../lib/itineraryMapPoints';

const DAY_COLORS = [
  '#2563eb', // Day 1: Blue
  '#059669', // Day 2: Emerald
  '#d97706', // Day 3: Amber
  '#7c3aed', // Day 4: Violet
  '#e11d48', // Day 5: Rose
  '#0891b2', // Day 6: Cyan
  '#ea580c', // Day 7: Orange
  '#4f46e5', // Day 8: Indigo
  '#16a34a', // Day 9: Green
  '#0284c7', // Day 10: Sky
];

export interface ItineraryMapProps {
  itinerary: unknown;
  className?: string;
  defaultCollapsed?: boolean;
}

export default function ItineraryMap({ itinerary, className = '' }: ItineraryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // Leaflet references
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  const [L, setL] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');

  // Extract points & skipped count purely
  const { points, skipped } = useMemo(() => itineraryMapPoints(itinerary), [itinerary]);

  // Unique days present in map points
  const daysWithPoints = useMemo(() => {
    const daySet = new Set<number>();
    for (const pt of points) {
      daySet.add(pt.day);
    }
    return Array.from(daySet).sort((a, b) => a - b);
  }, [points]);

  // Points filtered by day selector
  const filteredPoints = useMemo(() => {
    if (selectedDay === 'all') return points;
    return points.filter((p) => p.day === selectedDay);
  }, [points, selectedDay]);

  // 1. Dynamic Leaflet import (keeps Leaflet in its own lazy chunk)
  useEffect(() => {
    let isMounted = true;
    import('leaflet').then((leafletModule) => {
      if (isMounted) {
        setL(leafletModule.default || leafletModule);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize map instance
  useEffect(() => {
    if (!L || !mapContainerRef.current || points.length === 0) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        attributionControl: true,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      // OpenStreetMap standard raster tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, [L, points.length]);

  // 3. Render markers and adjust bounds when filteredPoints or map changes
  useEffect(() => {
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    if (filteredPoints.length === 0) return;

    filteredPoints.forEach((point: MapPoint) => {
      const color = DAY_COLORS[(point.day - 1) % DAY_COLORS.length];

      // Custom divIcon without image files (no broken Vite assets)
      const icon = L.divIcon({
        className: 'travalastic-div-icon',
        html: `<div style="background-color: ${color}; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 700; font-size: 11px; font-family: ui-sans-serif, system-ui, sans-serif;">${point.order}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([point.lat, point.lon], { icon });

      // Directions link using mobile's exact URL format
      const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.lat)},${encodeURIComponent(point.lon)}`;
      const popupHtml = `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; line-height: 1.4; min-width: 150px; padding: 2px;">
          <div style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase; margin-bottom: 2px;">Day ${point.day} · Stop ${point.order}</div>
          <div style="font-weight: 600; color: #0f172a; margin-bottom: 6px;">${point.title}</div>
          <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; color: #2563eb; font-weight: 600; text-decoration: underline;">
            Directions &rarr;
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml);
      layer.addLayer(marker);
    });

    // Invalidate size to ensure tiles render correctly in newly mounted/sized containers
    map.invalidateSize();

    if (filteredPoints.length === 1) {
      map.setView([filteredPoints[0].lat, filteredPoints[0].lon], 13);
    } else {
      const bounds = boundsOf(filteredPoints);
      if (bounds) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
    }
  }, [L, filteredPoints]);

  // If 0 points with real coordinates exist, show text fallback rather than an empty grey box
  if (points.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-5 text-center ${className}`}>
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
          📍
        </div>
        <p className="text-sm font-semibold text-slate-800 mb-0.5">No map coordinates available</p>
        <p className="text-xs text-slate-500">
          None of the places in this itinerary have saved geographic coordinates to display.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 overflow-hidden ${className}`}>
      {/* Header & Day Filter */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🗺️</span>
          <h3 className="text-sm font-semibold text-slate-900">Itinerary Map</h3>
          <span className="text-xs text-slate-400 font-mono">({points.length})</span>
        </div>

        {daysWithPoints.length > 1 && (
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                selectedDay === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            {daysWithPoints.map((dayNum) => (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dayNum)}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  selectedDay === dayNum
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Day {dayNum}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map view container */}
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-lg overflow-hidden border border-slate-100 z-0 bg-slate-100"
        aria-label="Itinerary places map"
      />

      {/* Skipped locations notice */}
      {skipped > 0 && (
        <p className="text-xs text-slate-400 mt-2 px-0.5 flex items-start gap-1.5">
          <span className="text-slate-400">ℹ</span>
          <span>
            {skipped === 1 ? '1 activity has' : `${skipped} activities have`} no saved location and{' '}
            {skipped === 1 ? 'is' : 'are'} not shown.
          </span>
        </p>
      )}

      {/* Keyboard-accessible list of stops with Directions link */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Stops ({filteredPoints.length})
        </p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {filteredPoints.map((pt) => {
            const color = DAY_COLORS[(pt.day - 1) % DAY_COLORS.length];
            const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pt.lat)},${encodeURIComponent(pt.lon)}`;
            return (
              <div
                key={`${pt.day}-${pt.order}-${pt.lat}-${pt.lon}`}
                className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {pt.order}
                  </span>
                  <span className="text-slate-700 truncate font-medium">
                    Day {pt.day} · {pt.title}
                  </span>
                </div>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-semibold text-[11px] hover:underline flex-shrink-0"
                >
                  Directions &rarr;
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

