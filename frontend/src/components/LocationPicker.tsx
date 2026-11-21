import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EntryLocation } from '../types';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../lib/coords';

interface Props {
  value: EntryLocation | null;
  onChoose: (location: EntryLocation) => void;
  onClose: () => void;
}

interface BdcResult {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string }>;
  };
}

function placeName(result: BdcResult, latitude: number, longitude: number): string {
  const admin = (result.localityInfo?.administrative ?? [])
    .map((item) => item.name)
    .filter(
      (item): item is string =>
        typeof item === 'string' && item.length > 0 && !/^(中华人民共和国|中国)$/.test(item)
    );

  // BigDataCloud 的 administrative 从大到小排列，取最具体的 3 级：街道 · 区 · 市
  const pieces = admin.slice(-3).reverse();
  if (pieces.length) return pieces.join(' · ');

  const fallback = [result.locality, result.city, result.principalSubdivision].filter(
    (item): item is string => Boolean(item)
  );
  if (fallback.length) return fallback.join(' · ');
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
      // 数据库里是 WGS-84，高德瓦片是 GCJ-02，显示时转换
      const shown = wgs84ToGcj02(latitude, longitude);
      const icon = L.divIcon({
        className: 'location-pin-wrap',
        html: '<span class="location-pin"><i></i></span>',
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      });
      if (marker.current) marker.current.setLatLng([shown.latitude, shown.longitude]);
      else
        marker.current = L.marker([shown.latitude, shown.longitude], { icon }).addTo(map.current);
    }

    try {
      // 国内可用的免 Key 逆地理编码；输入 WGS-84，返回中文地名
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`
      );
      if (!response.ok) throw new Error('reverse geocoding failed');
      const result = (await response.json()) as BdcResult;
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
      ? (() => {
          const shown = wgs84ToGcj02(value.latitude, value.longitude);
          return [shown.latitude, shown.longitude] as [number, number];
        })()
      : [35.8617, 104.1954];
    const instance = L.map(mapElement.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView(initialCenter, value ? 16 : 4);
    map.current = instance;
    // 高德瓦片：国内直连、中文注记，无需 Key。
    // 如果以后申请了高德官方 Key，可换成 AMap JS API。
    L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      {
        subdomains: ['1', '2', '3', '4'],
        minZoom: 3,
        maxZoom: 18,
        attribution: '&copy; 高德地图',
      }
    ).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      // 高德瓦片上点选得到的是 GCJ-02，转回 WGS-84 再保存
      const wgs = gcj02ToWgs84(event.latlng.lat, event.latlng.lng);
      void chooseCoordinates(wgs.latitude, wgs.longitude);
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
        // 浏览器定位返回 WGS-84，显示到高德地图上时转成 GCJ-02
        const { latitude, longitude } = position.coords;
        const shown = wgs84ToGcj02(latitude, longitude);
        setLocating(false);
        map.current?.setView([shown.latitude, shown.longitude], 17, { animate: true });
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
