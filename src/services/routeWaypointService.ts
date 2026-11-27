export type GeoCoord = {
  lat: number
  lng: number
}

export type WaypointNode = {
  name: string
  lat: number
  lng: number
  category?: "station" | "intersection" | "ic" | "road" | "landmark"
}

export type RouteWaypointExtractionResult = {
  start: string
  destination: string
  startCoord: GeoCoord | null
  endCoord: GeoCoord | null
  waypointsList: string[]
  waypointObjects: WaypointNode[]
  formatted: string
  estimatedDurationMinutes: number
  distanceKm: number
  fromCache?: boolean
  fallbackUsed?: boolean
}

export type RouteMetricsSummary = {
  distanceKm: number
  estimatedDurationMinutes: number
  fromCache?: boolean
  fallbackUsed?: boolean
}

const WAYPOINT_CACHE_KEY = "shingu-route-waypoints-cache-v1"
export const DIRECT_ROUTE_LABEL = "직행 (경유지 없음)"
const inFlightRouteRequests = new Map<
  string,
  Promise<RouteWaypointExtractionResult>
>()

function estimateFallbackMetricsFromCoords(
  startCoord: GeoCoord,
  endCoord: GeoCoord,
): { distanceKm: number; estimatedDurationMinutes: number } {
  const straightDistKm = haversineDistanceKm(startCoord, endCoord)
  if (straightDistKm < 0.35) {
    return {
      distanceKm: Number(Math.max(0.1, straightDistKm).toFixed(1)),
      estimatedDurationMinutes: 5,
    }
  }
  return {
    distanceKm: Number((straightDistKm * 1.28).toFixed(1)),
    estimatedDurationMinutes: Math.max(
      8,
      Math.min(90, Math.round(straightDistKm * 3.2 + 6)),
    ),
  }
}

export function formatRouteMetricsSummary(
  distanceKm?: number | null,
  estimatedDurationMinutes?: number | null,
): string {
  const safeDistance =
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    distanceKm > 0
      ? distanceKm
      : 5.0
  const safeDuration =
    typeof estimatedDurationMinutes === "number" &&
    Number.isFinite(estimatedDurationMinutes) &&
    estimatedDurationMinutes > 0
      ? Math.round(estimatedDurationMinutes)
      : 20
  return `예상 거리 ${safeDistance.toFixed(1)}km · 예상 소요 ${safeDuration}분`
}

// 단순 내비게이션 안내 문구 필터링 정규식
const NAVIGATION_NOISE_PATTERNS = [
  /좌회전/,
  /우회전/,
  /유턴/,
  /직진/,
  /출발지?/,
  /도착지?/,
  /진입/,
  /진출/,
  /방면/,
  /고가도로/,
  /지하차도/,
  /터널\s*진입/,
  /로터리/,
  /회전교차로/,
  /램프/,
  /톨게이트/,
  /요금소/,
  /인터체인지\s*진입/,
  /분기점\s*진입/,
  /왼쪽\s*차로/,
  /오른쪽\s*차로/,
  /차선\s*유지/,
  /약\s*\d+\s*(m|km)/i,
  /^\d+m$/i,
  /^unnamed/i,
  /^road$/i,
  /^경유지\s*없음$/,
  /^등록된\s*주요\s*경유지\s*없음$/,
]

export function isNavigationInstructionNoise(rawLabel: string): boolean {
  const trimmed = (rawLabel || "").trim()
  if (!trimmed || trimmed.length < 2) return true
  if (/^\d+$/.test(trimmed)) return true
  return NAVIGATION_NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function isValidCoord(coord: unknown): coord is GeoCoord {
  if (!coord || typeof coord !== "object") return false
  const c = coord as Partial<GeoCoord>
  return (
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    c.lat >= 33 &&
    c.lat <= 39 &&
    c.lng >= 124 &&
    c.lng <= 132
  )
}

// 성남·신구대 및 수도권 주요 역/거점/교차로/IC/간선도로 실제 지리 좌표 데이터베이스
const KNOWN_HUBS: WaypointNode[] = [
  { name: "신구대학교", lat: 37.4486, lng: 127.1685, category: "landmark" },
  { name: "신구대사거리", lat: 37.4472, lng: 127.1654, category: "intersection" },
  { name: "단대오거리역", lat: 37.444, lng: 127.1567, category: "station" },
  { name: "신흥역", lat: 37.4409, lng: 127.1474, category: "station" },
  { name: "수진역", lat: 37.4374, lng: 127.1408, category: "station" },
  { name: "모란역", lat: 37.4321, lng: 127.1291, category: "station" },
  { name: "모란사거리", lat: 37.4312, lng: 127.1285, category: "intersection" },
  { name: "태평역", lat: 37.4401, lng: 127.1277, category: "station" },
  { name: "가천대역", lat: 37.4486, lng: 127.1267, category: "station" },
  { name: "복정역", lat: 37.4707, lng: 127.1266, category: "station" },
  { name: "복정교차로", lat: 37.4682, lng: 127.1272, category: "intersection" },
  { name: "산성역", lat: 37.4571, lng: 127.1499, category: "station" },
  { name: "남한산성입구역", lat: 37.4515, lng: 127.1598, category: "station" },
  { name: "성남시청", lat: 37.4201, lng: 127.1262, category: "landmark" },
  { name: "성남시청교차로", lat: 37.4192, lng: 127.1258, category: "intersection" },
  { name: "야탑역", lat: 37.4112, lng: 127.1287, category: "station" },
  { name: "야탑사거리", lat: 37.4118, lng: 127.1295, category: "intersection" },
  { name: "이매역", lat: 37.3956, lng: 127.1282, category: "station" },
  { name: "서현역", lat: 37.3851, lng: 127.1235, category: "station" },
  { name: "수내역", lat: 37.3785, lng: 127.1143, category: "station" },
  { name: "정자역", lat: 37.367, lng: 127.1081, category: "station" },
  { name: "미금역", lat: 37.3501, lng: 127.1088, category: "station" },
  { name: "오리역", lat: 37.3398, lng: 127.109, category: "station" },
  { name: "판교역", lat: 37.3948, lng: 127.1112, category: "station" },
  { name: "판교IC", lat: 37.4002, lng: 127.0942, category: "ic" },
  { name: "성남IC", lat: 37.4342, lng: 127.1195, category: "ic" },
  { name: "송파IC", lat: 37.4778, lng: 127.1263, category: "ic" },
  { name: "수서역", lat: 37.4873, lng: 127.1019, category: "station" },
  { name: "수서IC", lat: 37.4895, lng: 127.1045, category: "ic" },
  { name: "장지역", lat: 37.4787, lng: 127.1262, category: "station" },
  { name: "문정역", lat: 37.4859, lng: 127.1225, category: "station" },
  { name: "가락시장역", lat: 37.4925, lng: 127.1182, category: "station" },
  { name: "송파역", lat: 37.4998, lng: 127.1122, category: "station" },
  { name: "석촌역", lat: 37.5054, lng: 127.1069, category: "station" },
  { name: "잠실역", lat: 37.5133, lng: 127.1001, category: "station" },
  { name: "잠실사거리", lat: 37.5138, lng: 127.1021, category: "intersection" },
  { name: "위례중앙광장", lat: 37.4728, lng: 127.1428, category: "landmark" },
  { name: "남위례역", lat: 37.4628, lng: 127.1391, category: "station" },
  { name: "강남역", lat: 37.4979, lng: 127.0276, category: "station" },
  { name: "양재역", lat: 37.4841, lng: 127.0346, category: "station" },
  { name: "양재IC", lat: 37.4625, lng: 127.0418, category: "ic" },
  { name: "내곡IC", lat: 37.4562, lng: 127.0785, category: "ic" },
  { name: "세곡동사거리", lat: 37.4651, lng: 127.1052, category: "intersection" },
  { name: "사당역", lat: 37.4765, lng: 126.9816, category: "station" },
  { name: "천호역", lat: 37.5386, lng: 127.1238, category: "station" },
  { name: "강동역", lat: 37.5358, lng: 127.1324, category: "station" },
  { name: "둔촌동역", lat: 37.5278, lng: 127.1362, category: "station" },
  { name: "올림픽공원역", lat: 37.5165, lng: 127.1308, category: "station" },
  { name: "하남시청역", lat: 37.542, lng: 127.206, category: "station" },
  { name: "서하남IC", lat: 37.5134, lng: 127.1565, category: "ic" },
  { name: "경기광주역", lat: 37.4098, lng: 127.2533, category: "station" },
  { name: "삼동역", lat: 37.4095, lng: 127.2031, category: "station" },
  { name: "이배재터널", lat: 37.4315, lng: 127.1842, category: "road" },
  { name: "갈마터널", lat: 37.419, lng: 127.1695, category: "road" },
  { name: "성남대로", lat: 37.436, lng: 127.128, category: "road" },
  { name: "산성대로", lat: 37.4425, lng: 127.152, category: "road" },
  { name: "희망로", lat: 37.4455, lng: 127.161, category: "road" },
  { name: "분당수서로", lat: 37.428, lng: 127.115, category: "road" },
  { name: "송파대로", lat: 37.484, lng: 127.123, category: "road" },
  { name: "죽전역", lat: 37.3248, lng: 127.1074, category: "station" },
  { name: "기흥역", lat: 37.2756, lng: 127.1159, category: "station" },
  { name: "광교중앙역", lat: 37.2885, lng: 127.0515, category: "station" },
  { name: "수원역", lat: 37.2659, lng: 127.0001, category: "station" },
]

function normalizePlaceName(name: string): string {
  return (name || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/(정문|후문|남문|북문|역\s*\d+번출구|\d+번출구|캠퍼스)$/g, "")
}

function haversineDistanceKm(a: GeoCoord, b: GeoCoord): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const calc =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng
  return R * 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc))
}

// 1. 주소/장소명 -> 위도·경도 좌표 변환 (지오코딩 및 좌표 누락 방어)
export async function geocodePlaceToCoord(
  placeOrAddress: string,
  explicitCoord?: Partial<GeoCoord> | null,
): Promise<GeoCoord | null> {
  if (isValidCoord(explicitCoord)) {
    return { lat: explicitCoord.lat, lng: explicitCoord.lng }
  }
  const clean = (placeOrAddress || "").trim()
  if (!clean) return null

  // "37.4486, 127.1685" 형태 좌표 문자열인 경우 파싱
  const coordMatch = clean.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (coordMatch) {
    const lat = Number(coordMatch[1])
    const lng = Number(coordMatch[2])
    if (isValidCoord({ lat, lng })) return { lat, lng }
  }

  const normalized = normalizePlaceName(clean)
  const exactHub = KNOWN_HUBS.find((hub) => {
    const hubNorm = normalizePlaceName(hub.name)
    return (
      hubNorm === normalized ||
      clean.includes(hub.name) ||
      hub.name.includes(clean)
    )
  })
  if (exactHub) {
    return { lat: exactHub.lat, lng: exactHub.lng }
  }

  // 외부 지오코딩 API 호출 (Nominatim OpenStreetMap) - 타임아웃 및 예외 방어
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 2200)
    const query = encodeURIComponent(`${clean} 대한민국`)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    )
    window.clearTimeout(timer)
    if (response.ok) {
      const results = (await response.json()) as Array<{
        lat?: string
        lon?: string
      }>
      if (Array.isArray(results) && results.length > 0) {
        const lat = Number(results[0]?.lat)
        const lng = Number(results[0]?.lon)
        if (isValidCoord({ lat, lng })) {
          return { lat, lng }
        }
      }
    }
  } catch {
    // 네트워크 차단/타임아웃 시 안전하게 폴백
  }

  // 텍스트 해시 기반 성남/수도권 내 결정론적 유효 좌표 폴백 (NaN/null 파라미터 완전 차단)
  let hash = 0
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 10000
  }
  const latOffset = ((hash % 100) - 50) * 0.0012
  const lngOffset = ((Math.floor(hash / 100) % 100) - 50) * 0.0012
  return {
    lat: Number((37.435 + latOffset).toFixed(5)),
    lng: Number((127.135 + lngOffset).toFixed(5)),
  }
}

function readWaypointCache(): Record<string, RouteWaypointExtractionResult> {
  try {
    const raw = localStorage.getItem(WAYPOINT_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeWaypointCache(
  key: string,
  value: RouteWaypointExtractionResult,
): void {
  try {
    const current = readWaypointCache()
    current[key] = value
    localStorage.setItem(WAYPOINT_CACHE_KEY, JSON.stringify(current))
  } catch {
    // 스토리지 용량 초과 등 무시
  }
}

function makeCacheKey(start: string, destination: string): string {
  return `${normalizePlaceName(start)}__${normalizePlaceName(destination)}`
}

// 주행 경로 폴리라인(또는 출발~도착 직선/실제 도로 코리도) 상의 주요 거점 2~4개 추출
function extractHubsAlongCorridor(
  startName: string,
  destinationName: string,
  startCoord: GeoCoord,
  endCoord: GeoCoord,
  pathCoordinates?: GeoCoord[],
): WaypointNode[] {
  const startNorm = normalizePlaceName(startName)
  const destNorm = normalizePlaceName(destinationName)
  const totalDistanceKm = haversineDistanceKm(startCoord, endCoord)

  if (totalDistanceKm < 0.45 || startNorm === destNorm) {
    return []
  }

  const dx = endCoord.lng - startCoord.lng
  const dy = endCoord.lat - startCoord.lat
  const lenSq = dx * dx + dy * dy
  if (lenSq <= 1e-9) return []

  const samplePoints: GeoCoord[] =
    Array.isArray(pathCoordinates) && pathCoordinates.length >= 2
      ? pathCoordinates
      : [
          startCoord,
          {
            lat: startCoord.lat + dy * 0.25,
            lng: startCoord.lng + dx * 0.25,
          },
          {
            lat: startCoord.lat + dy * 0.5,
            lng: startCoord.lng + dx * 0.5,
          },
          {
            lat: startCoord.lat + dy * 0.75,
            lng: startCoord.lng + dx * 0.75,
          },
          endCoord,
        ]

  const corridorRadiusKm = Math.max(1.2, Math.min(4.2, totalDistanceKm * 0.38))

  const scoredHubs = KNOWN_HUBS.map((hub) => {
    const hubNorm = normalizePlaceName(hub.name)
    if (
      hubNorm === startNorm ||
      hubNorm === destNorm ||
      startName.includes(hub.name) ||
      destinationName.includes(hub.name)
    ) {
      return null
    }

    // 출발->도착 진행률(0~1) 계산
    const progress =
      ((hub.lng - startCoord.lng) * dx + (hub.lat - startCoord.lat) * dy) /
      lenSq
    if (progress < 0.08 || progress > 0.92) return null

    // 실제 경로 폴리라인과의 최소 거리 계산
    let minDistanceToPathKm = Number.POSITIVE_INFINITY
    for (const pt of samplePoints) {
      const dist = haversineDistanceKm(hub, pt)
      if (dist < minDistanceToPathKm) minDistanceToPathKm = dist
    }

    if (minDistanceToPathKm > corridorRadiusKm) return null

    // 역/교차로/IC 가중치 부여
    const categoryBonus =
      hub.category === "station"
        ? -0.25
        : hub.category === "intersection" || hub.category === "ic"
          ? -0.18
          : 0

    return {
      hub,
      progress,
      score: minDistanceToPathKm + categoryBonus,
    }
  }).filter(
    (
      item,
    ): item is { hub: WaypointNode; progress: number; score: number } =>
      item !== null,
  )

  // 가까운 순으로 상위 후보 선별 후 출발지 -> 도착지 진행 방향(progress) 순으로 정렬
  const topCandidates = scoredHubs
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .sort((a, b) => a.progress - b.progress)

  // 너무 인접한 거점 중복 제거 후 2~4개 추출
  const selected: WaypointNode[] = []
  for (const candidate of topCandidates) {
    if (
      selected.every(
        (existing) => haversineDistanceKm(existing, candidate.hub) >= 0.45,
      )
    ) {
      selected.push(candidate.hub)
    }
    if (selected.length >= 4) break
  }

  return selected
}

// 동기식 즉시 경유지 및 예상 거리·소요시간 조회 (초기 렌더링, 카드 목록, 폴백용)
export function getExtractedWaypointsSync(
  start: string,
  destination: string,
  savedWaypoints?: string | string[] | null,
): {
  waypointsList: string[]
  waypointObjects: WaypointNode[]
  formatted: string
  distanceKm: number
  estimatedDurationMinutes: number
  fromCache?: boolean
  fallbackUsed?: boolean
} {
  const cleanStart = (start || "").trim()
  const cleanDest = (destination || "").trim()

  // 1) 캐시 확인
  if (cleanStart && cleanDest) {
    const cacheKey = makeCacheKey(cleanStart, cleanDest)
    const cached = readWaypointCache()[cacheKey]
    if (cached && Array.isArray(cached.waypointsList)) {
      const safeDistance =
        typeof cached.distanceKm === "number" &&
        Number.isFinite(cached.distanceKm) &&
        cached.distanceKm > 0
          ? Number(cached.distanceKm.toFixed(1))
          : 5.0
      const safeDuration =
        typeof cached.estimatedDurationMinutes === "number" &&
        Number.isFinite(cached.estimatedDurationMinutes) &&
        cached.estimatedDurationMinutes > 0
          ? Math.round(cached.estimatedDurationMinutes)
          : 20
      return {
        waypointsList: cached.waypointsList,
        waypointObjects: Array.isArray(cached.waypointObjects)
          ? cached.waypointObjects
          : [],
        formatted:
          cached.waypointsList.length > 0
            ? cached.waypointsList.join(" · ")
            : DIRECT_ROUTE_LABEL,
        distanceKm: safeDistance,
        estimatedDurationMinutes: safeDuration,
        fromCache: true,
        fallbackUsed: cached.fallbackUsed,
      }
    }
  }

  let fallbackDistanceKm = 5.0
  let fallbackDurationMinutes = 20

  // 2) 출발지·목적지가 모두 있으면 지리 코리도 기반 실제 거점 및 거리·시간 즉시 계산
  if (cleanStart && cleanDest) {
    const startNorm = normalizePlaceName(cleanStart)
    const destNorm = normalizePlaceName(cleanDest)
    const startHub = KNOWN_HUBS.find(
      (h) =>
        normalizePlaceName(h.name) === startNorm ||
        cleanStart.includes(h.name) ||
        h.name.includes(cleanStart),
    )
    const endHub = KNOWN_HUBS.find(
      (h) =>
        normalizePlaceName(h.name) === destNorm ||
        cleanDest.includes(h.name) ||
        h.name.includes(cleanDest),
    )

    if (startHub && endHub) {
      const estimated = estimateFallbackMetricsFromCoords(startHub, endHub)
      fallbackDistanceKm = estimated.distanceKm
      fallbackDurationMinutes = estimated.estimatedDurationMinutes

      const corridorHubs = extractHubsAlongCorridor(
        cleanStart,
        cleanDest,
        startHub,
        endHub,
      )
      if (corridorHubs.length > 0) {
        const list = corridorHubs.map((h) => h.name)
        return {
          waypointsList: list,
          waypointObjects: corridorHubs,
          formatted: list.join(" · "),
          distanceKm: fallbackDistanceKm,
          estimatedDurationMinutes: fallbackDurationMinutes,
          fallbackUsed: true,
        }
      }
    }
  }

  // 3) DB/기존 저장된 경유지 문자열/배열 정제 폴백
  const rawList = Array.isArray(savedWaypoints)
    ? savedWaypoints
    : typeof savedWaypoints === "string"
      ? savedWaypoints.split(/[·,|/]+/).map((item) => item.trim())
      : []

  const filteredSaved = rawList.filter(
    (item) => item && !isNavigationInstructionNoise(item),
  )

  if (filteredSaved.length > 0) {
    const objects: WaypointNode[] = filteredSaved.map((name) => {
      const found = KNOWN_HUBS.find((h) => h.name === name)
      return found ?? { name, lat: 37.44, lng: 127.14, category: "landmark" }
    })
    return {
      waypointsList: filteredSaved.slice(0, 4),
      waypointObjects: objects.slice(0, 4),
      formatted: filteredSaved.slice(0, 4).join(" · "),
      distanceKm: fallbackDistanceKm,
      estimatedDurationMinutes: fallbackDurationMinutes,
      fallbackUsed: true,
    }
  }

  return {
    waypointsList: [],
    waypointObjects: [],
    formatted: DIRECT_ROUTE_LABEL,
    distanceKm: fallbackDistanceKm,
    estimatedDurationMinutes: fallbackDurationMinutes,
    fallbackUsed: true,
  }
}

// 동기식 예상 거리(km)·소요 시간(분) 요약 조회 (지도 UI 없이 텍스트/배지 바인딩용)
export function getRouteMetricsSync(
  start: string,
  destination: string,
): RouteMetricsSummary {
  const sync = getExtractedWaypointsSync(start, destination)
  return {
    distanceKm: sync.distanceKm,
    estimatedDurationMinutes: sync.estimatedDurationMinutes,
    fromCache: sync.fromCache,
    fallbackUsed: sync.fallbackUsed,
  }
}

// 비동기 경로 탐색 API 기반 실제 거리·소요시간·경유지 추출 (OSRM + 지오코딩 + 코리도 정제)
export async function fetchRouteWaypointsFromMapBackend(params: {
  start: string
  destination: string
  startCoord?: Partial<GeoCoord> | null
  endCoord?: Partial<GeoCoord> | null
  fallbackWaypoints?: string | string[] | null
  metricsOnly?: boolean
}): Promise<RouteWaypointExtractionResult> {
  const cleanStart = (params.start || "").trim()
  const cleanDest = (params.destination || "").trim()

  if (!cleanStart || !cleanDest) {
    const fallback = getExtractedWaypointsSync(
      cleanStart,
      cleanDest,
      params.fallbackWaypoints,
    )
    return {
      start: cleanStart,
      destination: cleanDest,
      startCoord: null,
      endCoord: null,
      waypointsList: fallback.waypointsList,
      waypointObjects: fallback.waypointObjects,
      formatted: fallback.formatted,
      estimatedDurationMinutes: fallback.estimatedDurationMinutes || 20,
      distanceKm: fallback.distanceKm || 5,
      fallbackUsed: true,
    }
  }

  const cacheKey = makeCacheKey(cleanStart, cleanDest)
  const cached = readWaypointCache()[cacheKey]
  if (
    cached &&
    Array.isArray(cached.waypointsList) &&
    typeof cached.distanceKm === "number" &&
    typeof cached.estimatedDurationMinutes === "number"
  ) {
    return { ...cached, fromCache: true }
  }

  const inflightKey = `${cacheKey}:${params.metricsOnly ? "metrics" : "full"}`
  const existingRequest = inFlightRouteRequests.get(inflightKey)
  if (existingRequest) {
    return existingRequest
  }

  const requestPromise = (async (): Promise<RouteWaypointExtractionResult> => {
    try {
      const [startCoord, endCoord] = await Promise.all([
        geocodePlaceToCoord(cleanStart, params.startCoord),
        geocodePlaceToCoord(cleanDest, params.endCoord),
      ])

      if (!isValidCoord(startCoord) || !isValidCoord(endCoord)) {
        throw new Error("유효한 출발지·목적지 좌표를 확인할 수 없습니다.")
      }

      const straightDistKm = haversineDistanceKm(startCoord, endCoord)
      if (
        straightDistKm < 0.35 ||
        normalizePlaceName(cleanStart) === normalizePlaceName(cleanDest)
      ) {
        const directResult: RouteWaypointExtractionResult = {
          start: cleanStart,
          destination: cleanDest,
          startCoord,
          endCoord,
          waypointsList: [],
          waypointObjects: [],
          formatted: DIRECT_ROUTE_LABEL,
          estimatedDurationMinutes: 5,
          distanceKm: Number(Math.max(0.1, straightDistKm).toFixed(1)),
          fallbackUsed: false,
        }
        writeWaypointCache(cacheKey, directResult)
        return directResult
      }

      const fallbackMetrics = estimateFallbackMetricsFromCoords(
        startCoord,
        endCoord,
      )
      const precomputedHubs = extractHubsAlongCorridor(
        cleanStart,
        cleanDest,
        startCoord,
        endCoord,
      )
      // 거리·시간만 필요하거나 기존 거점 코리도로 이미 주요 경유지가 충분하면 경량 OSRM 옵션 사용
      const useLightweightOsrm =
        Boolean(params.metricsOnly) || precomputedHubs.length >= 2

      let pathCoords: GeoCoord[] = []
      let osrmStepRoadNames: string[] = []
      let durationMinutes = fallbackMetrics.estimatedDurationMinutes
      let roadDistanceKm = fallbackMetrics.distanceKm
      let osrmSucceeded = false

      // 실제 라우팅 API (OSRM Driving Route API) 호출 - 타임아웃 및 예외 방어
      try {
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 2800)
        const queryOptions = useLightweightOsrm
          ? "overview=false&steps=false"
          : "overview=simplified&geometries=geojson&steps=true"
        const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?${queryOptions}`
        const res = await fetch(url, { signal: controller.signal })
        window.clearTimeout(timer)

        if (res.ok) {
          const data = (await res.json()) as {
            routes?: Array<{
              distance?: number
              duration?: number
              geometry?: { coordinates?: Array<[number, number]> }
              legs?: Array<{
                steps?: Array<{
                  name?: string
                  ref?: string
                  maneuver?: { location?: [number, number] }
                }>
              }>
            }>
          }
          const primaryRoute = data?.routes?.[0]
          if (primaryRoute) {
            if (
              typeof primaryRoute.distance === "number" &&
              primaryRoute.distance > 0
            ) {
              roadDistanceKm = Number((primaryRoute.distance / 1000).toFixed(1))
              osrmSucceeded = true
            }
            if (
              typeof primaryRoute.duration === "number" &&
              primaryRoute.duration > 0
            ) {
              durationMinutes = Math.max(
                5,
                Math.round(primaryRoute.duration / 60),
              )
              osrmSucceeded = true
            }
            if (!useLightweightOsrm) {
              const coords = primaryRoute.geometry?.coordinates
              if (Array.isArray(coords) && coords.length > 0) {
                pathCoords = coords
                  .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
                  .filter(isValidCoord)
              }
              const steps = primaryRoute.legs?.[0]?.steps || []
              for (const step of steps) {
                const rawName = (step?.name || "").trim()
                if (
                  rawName &&
                  !isNavigationInstructionNoise(rawName) &&
                  !rawName.includes(cleanStart) &&
                  !rawName.includes(cleanDest) &&
                  !osrmStepRoadNames.includes(rawName)
                ) {
                  osrmStepRoadNames.push(rawName)
                }
              }
            }
          }
        }
      } catch {
        // 외부 라우팅 서버 오류/타임아웃 시 좌표 기반 거리·소요시간 폴백으로 안전하게 대체
      }

      const corridorHubs =
        pathCoords.length >= 2
          ? extractHubsAlongCorridor(
              cleanStart,
              cleanDest,
              startCoord,
              endCoord,
              pathCoords,
            )
          : precomputedHubs

      const mergedWaypoints: WaypointNode[] = [...corridorHubs]

      // 코리도 거점이 2개 미만이고 OSRM 도로명이 추출되었다면 정제된 주요 도로명 보강
      if (mergedWaypoints.length < 2 && osrmStepRoadNames.length > 0) {
        for (const roadName of osrmStepRoadNames) {
          if (
            mergedWaypoints.length < 4 &&
            !mergedWaypoints.some((w) => w.name === roadName)
          ) {
            mergedWaypoints.push({
              name: roadName,
              lat: (startCoord.lat + endCoord.lat) / 2,
              lng: (startCoord.lng + endCoord.lng) / 2,
              category: "road",
            })
          }
        }
      }

      const finalObjects = mergedWaypoints.slice(0, 4)
      const finalList = finalObjects.map((item) => item.name)

      const result: RouteWaypointExtractionResult = {
        start: cleanStart,
        destination: cleanDest,
        startCoord,
        endCoord,
        waypointsList: finalList,
        waypointObjects: finalObjects,
        formatted:
          finalList.length > 0 ? finalList.join(" · ") : DIRECT_ROUTE_LABEL,
        estimatedDurationMinutes: durationMinutes,
        distanceKm: roadDistanceKm,
        fallbackUsed: !osrmSucceeded,
      }

      writeWaypointCache(cacheKey, result)
      return result
    } catch {
      // 모든 예외 상황에서 앱이 멈추지 않도록 폴백 반환
      const fallback = getExtractedWaypointsSync(
        cleanStart,
        cleanDest,
        params.fallbackWaypoints,
      )
      return {
        start: cleanStart,
        destination: cleanDest,
        startCoord: null,
        endCoord: null,
        waypointsList: fallback.waypointsList,
        waypointObjects: fallback.waypointObjects,
        formatted: fallback.formatted || DIRECT_ROUTE_LABEL,
        estimatedDurationMinutes: fallback.estimatedDurationMinutes || 20,
        distanceKm: fallback.distanceKm || 5,
        fallbackUsed: true,
      }
    } finally {
      inFlightRouteRequests.delete(inflightKey)
    }
  })()

  inFlightRouteRequests.set(inflightKey, requestPromise)
  return requestPromise
}

// 거리(km)와 예상 소요 시간(분)만 경량 OSRM(overview=false&steps=false)으로 빠르게 조회
export async function fetchRouteMetrics(params: {
  start: string
  destination: string
  startCoord?: Partial<GeoCoord> | null
  endCoord?: Partial<GeoCoord> | null
}): Promise<RouteMetricsSummary> {
  const res = await fetchRouteWaypointsFromMapBackend({
    ...params,
    metricsOnly: true,
  })
  return {
    distanceKm: res.distanceKm,
    estimatedDurationMinutes: res.estimatedDurationMinutes,
    fromCache: res.fromCache,
    fallbackUsed: res.fallbackUsed,
  }
}
