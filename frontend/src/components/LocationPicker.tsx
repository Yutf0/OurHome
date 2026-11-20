import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EntryLocation } from '../types';

interface Props {
  value: EntryLocation | null;
  onChoose: (location: EntryLocation) => void;
  onClose: () => void;
}

interface NominatimResult {
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
}

function placeName(result: NominatimResult, latitude: number, longitude: number): string {
  const address = result.address ?? {};
  const pieces = [
    result.name || address.amenity || address.building || address.shop || address.tourism,
    address.road || address.pedestrian,
    address.suburb || address.neighbourhood || address.city_district || address.district,
    address.city || address.town || address.county,
  ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);
  if (pieces.length) return pieces.slice(0, 3).join(' · ');
  if (result.display_name) return result.display_name.split(',').slice(0, 3).join(' · ');
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export default function LocationPicker({ value, onChoose, onClose }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const requestId = useRef(0);
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(
    value ? { latitude: value.latitude, longitude: value.longitude } : null
  );
  const [name, setName] = useState(value?.name ?? '');
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState('点按“定位当前位置”，或直接在地图上选一个位置。');

  const chooseCoordinates = useCallback(async (latitude: number, longitude: number) => {
    setPoint({ latitude, longitude });
    setResolving(true);
    setMessage('正在识别地点名称…');
    const currentRequest = ++requestId.current;

    if (map.current) {
      const icon = L.divIcon({
        className: 'location-pin-wrap',
        html: '<span class="location-pin"><i></i></span>',
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      });
      if (marker.current) marker.current.setLatLng([latitude, longitude]);
      else marker.current = L.marker([latitude, longitude], { icon }).addTo(map.current);
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN`
      );
      if (!response.ok) throw new Error('reverse geocoding failed');
      const result = (await response.json()) as NominatimResult;
      if (currentRequest !== requestId.current) return;
      setName(placeName(result, latitude, longitude));
      setMessage('位置已选好，也可以修改下面显示的地点名称。');
    } catch {
      if (currentRequest !== requestId.current) return;
      setName(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      setMessage('暂时无法获取地点名称，可以手动填写。');
    } finally {
      if (currentRequest === requestId.current) setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (!mapElement.current || map.current) return;
    const initialCenter: L.LatLngExpression = value
      ? [value.latitude, value.longitude]
      : [35.8617, 104.1954];
    const instance = L.map(mapElement.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView(initialCenter, value ? 16 : 4);
    map.current = instance;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      void chooseCoordinates(event.latlng.lat, event.latlng.lng);
    });
    if (value) void chooseCoordinates(value.latitude, value.longitude);

    window.setTimeout(() => instance.invalidateSize(), 0);
    return () => {
      requestId.current += 1;
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, [chooseCoordinates, value]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setMessage('当前设备不支持定位，请直接在地图上选点或手动填写。');
      return;
    }
    setLocating(true);
    setMessage('正在向 iPhone 请求定位…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocating(false);
        map.current?.setView([latitude, longitude], 17, { animate: true });
        void chooseCoordinates(latitude, longitude);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setMessage('定位权限未开启。可在 iPhone 设置中允许定位，或直接在地图上选点。');
        } else {
          setMessage('暂时无法定位，请稍后重试或直接在地图上选点。');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  };

  return (
    <div className="location-layer" role="dialog" aria-modal="true" aria-labelledby="location-title">
      <div className="location-sheet">
        <header className="location-head">
          <div>
            <span>给这条日常留一枚坐标</span>
            <h2 id="location-title">选择发生地点</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭地点选择">×</button>
        </header>

        <div className="location-map" ref={mapElement} aria-label="地图，点按可选择位置" />

        <div className="location-controls">
          <button type="button" className="location-current" onClick={locateMe} disabled={locating}>
            <span aria-hidden="true">⌖</span>{locating ? '正在定位…' : '定位当前位置'}
          </button>
          <p aria-live="polite">{message}</p>
          <label htmlFor="location-name">地点名称</label>
          <input
            id="location-name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 120))}
            placeholder={point ? '例如：西湖边 · 北山街' : '选中位置后可填写名称'}
            disabled={!point || resolving}
          />
          {point && (
            <small>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</small>
          )}
        </div>

        <footer className="location-actions">
          <button type="button" className="ghost" onClick={onClose}>取消</button>
          <button
            type="button"
            className="primary"
            disabled={!point || !name.trim() || resolving}
            onClick={() => {
              if (!point || !name.trim()) return;
              onChoose({ name: name.trim(), ...point });
            }}
          >
            记录这个地点
          </button>
        </footer>
      </div>
    </div>
  );
}
