/**
 * WGS-84（GPS / iPhone 定位 / Apple 地图）与 GCJ-02（高德、腾讯等国内地图）互转。
 *
 * Apple 地图、`maps.apple.com` 链接、浏览器 geolocation 都使用 WGS-84，
 * 而高德瓦片使用 GCJ-02。数据库里始终保存 WGS-84，只有显示到高德地图上时才转成 GCJ-02，
 * 用户在高德地图上点选时再转回 WGS-84 保存，避免坐标偏移约 500 米。
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

export interface LatLng {
  latitude: number;
  longitude: number;
}

function outOfChina(latitude: number, longitude: number): boolean {
  return (
    longitude < 72.004 ||
    longitude > 137.8347 ||
    latitude < 0.8293 ||
    latitude > 55.8271
  );
}

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

function delta(latitude: number, longitude: number): { lat: number; lng: number } {
  let dLat = transformLat(longitude - 105.0, latitude - 35.0);
  let dLng = transformLng(longitude - 105.0, latitude - 35.0);
  const radLat = (latitude / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: dLat, lng: dLng };
}

/** WGS-84 → GCJ-02（用于在高德瓦片上显示） */
export function wgs84ToGcj02(latitude: number, longitude: number): LatLng {
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  const d = delta(latitude, longitude);
  return { latitude: latitude + d.lat, longitude: longitude + d.lng };
}

/** GCJ-02 → WGS-84（用于把高德地图上点选的位置存回数据库） */
export function gcj02ToWgs84(latitude: number, longitude: number): LatLng {
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  let wLat = latitude;
  let wLng = longitude;
  // 迭代逼近，误差可到米级
  for (let i = 0; i < 3; i += 1) {
    const g = wgs84ToGcj02(wLat, wLng);
    wLat += latitude - g.latitude;
    wLng += longitude - g.longitude;
  }
  return { latitude: wLat, longitude: wLng };
}
