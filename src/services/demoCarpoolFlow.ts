import {
  calculateEstimatedArrival,
  DEFAULT_ESTIMATED_DURATION,
} from "./demoEta"
import {
  DIRECT_ROUTE_LABEL,
  fetchRouteWaypointsFromMapBackend,
  getExtractedWaypointsSync,
} from "./routeWaypointService"
import {
  supabaseGetRides,
  supabaseCreateRide,
  supabaseUpdateRideStatus,
  supabaseGetApplications,
  supabaseCreateApplication,
  supabaseUpdateApplicationStatus,
  supabaseGetReviews,
  supabaseSubmitReview,
  supabaseRecordCarpoolSettlement,
} from "./supabaseService"
import {
  getOrCreateCarpoolChatRoom,
  sendRealtimeChatMessage,
} from "./realtimeChatService"
import { refundDemoPoints } from "./demoPoints"
import { showAppToast } from "./dialogService"
import { supabase, isSupabaseConfigured } from "../lib/supabase"

export type CarpoolRideStatus = "모집 중" | "정산 대기" | "완료"
export type CarpoolSettlementStatus = "정산 전" | "정산 대기" | "정산 완료"
export type CarpoolApplicationStatus = "승인 대기" | "승인 완료" | "거절 완료" | "취소 완료"

export type DemoCarpoolRide = {
  id: string
  driverId: string
  driverName: string
  start: string
  destination: string
  date: string
  time: string
  vehicle: string
  totalSeats: number
  price: number
  note: string
  waypoints: string
  waypointsList?: string[]
  estimatedDuration: number
  estimatedArrival: string
  arrivalTimeManual: boolean
  smokingPreference: string
  genderPreference: string
  status: CarpoolRideStatus
  settlementStatus: CarpoolSettlementStatus
  endedAt: string | null
  settledAt: string | null
  createdAt: string
}

export type DemoCarpoolApplication = {
  id: string
  rideId: string
  riderId: string
  riderName: string
  driverId: string
  createdAt: string
  status: CarpoolApplicationStatus
}

export type DemoCarpoolReview = {
  id: string
  rideId: string
  authorId: string
  targetId: string
  rating: number
  keywords: string[]
  content: string
  createdAt: string
}

export type DemoCarpoolEvent = {
  id: string
  type: "reservation-cancelled" | "application-rejected"
  applicationId: string
  title: string
  message: string
  createdAt: string
}

export type DemoCarpoolState = {
  rides: DemoCarpoolRide[]
  applications: DemoCarpoolApplication[]
  reviews: DemoCarpoolReview[]
  events: DemoCarpoolEvent[]
}

const STORAGE_KEY = "shingu-carpool-flow-v1"
const EMPTY_STATE: DemoCarpoolState = {
  rides: [],
  applications: [],
  reviews: [],
  events: [],
}
const listeners = new Set<() => void>()

function isStateValid(value: unknown): value is DemoCarpoolState {
  if (!value || typeof value !== "object") return false
  const state = value as Partial<DemoCarpoolState>
  return (
    Array.isArray(state.rides) &&
    state.rides.every(
      (ride) =>
        ride &&
        typeof ride.id === "string" &&
        typeof ride.start === "string" &&
        typeof ride.destination === "string" &&
        typeof ride.date === "string" &&
        typeof ride.time === "string" &&
        Number.isSafeInteger(ride.totalSeats) &&
        Number.isSafeInteger(ride.price),
    ) &&
    Array.isArray(state.applications) &&
    state.applications.every(
      (application) =>
        application &&
        typeof application.id === "string" &&
        typeof application.rideId === "string" &&
        ["승인 대기", "승인 완료", "거절 완료", "취소 완료"].includes(
          application.status,
        ),
    ) &&
    Array.isArray(state.reviews) &&
    state.reviews.every(
      (review) =>
        review &&
        typeof review.id === "string" &&
        typeof review.rideId === "string" &&
        Number.isInteger(review.rating) &&
        Array.isArray(review.keywords),
    )
  )
}

const LEGACY_SAMPLE_NAMES = new Set([
  "김민준",
  "박지훈",
  "한소희",
  "최유진",
  "이서연",
  "정우진",
])

function readState(): DemoCarpoolState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
    if (!isStateValid(parsed)) return EMPTY_STATE
    const cleanRides = parsed.rides.filter(
      (ride) =>
        ride.driverId !== "demo-driver" &&
        !LEGACY_SAMPLE_NAMES.has((ride.driverName || "").trim()),
    )
    const validRideIds = new Set(cleanRides.map((r) => r.id))
    const cleanApplications = parsed.applications.filter(
      (app) =>
        validRideIds.has(app.rideId) &&
        app.riderId !== "demo-rider" &&
        !LEGACY_SAMPLE_NAMES.has((app.riderName || "").trim()),
    )
    const cleanReviews = parsed.reviews.filter((rev) =>
      validRideIds.has(rev.rideId),
    )
    return {
      rides: cleanRides.map((ride) => {
        const estimatedDuration =
          Number.isSafeInteger(ride.estimatedDuration) &&
          ride.estimatedDuration > 0
            ? ride.estimatedDuration
            : DEFAULT_ESTIMATED_DURATION
        const extracted = getExtractedWaypointsSync(
          ride.start,
          ride.destination,
          ride.waypointsList ?? ride.waypoints ?? ride.note ?? "",
        )
        return {
          ...ride,
          waypoints: extracted.formatted || DIRECT_ROUTE_LABEL,
          waypointsList: extracted.waypointsList,
          estimatedDuration,
          estimatedArrival:
            ride.estimatedArrival ||
            calculateEstimatedArrival(ride.date, ride.time, estimatedDuration),
          arrivalTimeManual: ride.arrivalTimeManual === true,
        }
      }),
      applications: cleanApplications,
      reviews: cleanReviews,
      events: Array.isArray(parsed.events) ? parsed.events : [],
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return EMPTY_STATE
  }
}

let snapshot = readState()

function save(next: DemoCarpoolState) {
  snapshot = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  listeners.forEach((listener) => listener())
}

export function resetCarpoolFlow() {
  save({
    rides: [],
    applications: [],
    reviews: [],
    events: [],
  })
}

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

export function subscribeCarpoolFlow(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCarpoolFlowSnapshot() {
  return snapshot
}

export function createCarpoolRide(
  input: Omit<DemoCarpoolRide, "id" | "driverId" | "driverName" | "status" | "settlementStatus" | "endedAt" | "settledAt" | "createdAt"> & {
    driverId?: string
    driverName?: string
  },
) {
  if (
    !input.start.trim() ||
    !input.destination.trim() ||
    !input.date ||
    !input.time ||
    !input.vehicle.trim() ||
    !Number.isSafeInteger(input.estimatedDuration) ||
    input.estimatedDuration < 1 ||
    !input.estimatedArrival ||
    !Number.isSafeInteger(input.totalSeats) ||
    input.totalSeats < 1 ||
    !Number.isSafeInteger(input.price) ||
    input.price < 1
  )
    throw new Error("필수 입력 항목을 확인해 주세요.")
  const syncExtracted = getExtractedWaypointsSync(
    input.start,
    input.destination,
    input.waypointsList ?? input.waypoints,
  )
  const ride: DemoCarpoolRide = {
    ...input,
    waypoints: syncExtracted.formatted || DIRECT_ROUTE_LABEL,
    waypointsList: syncExtracted.waypointsList,
    id: createId("carpool"),
    driverId: input.driverId || "user-driver",
    driverName: input.driverName || "운전자",
    status: "모집 중",
    settlementStatus: "정산 전",
    endedAt: null,
    settledAt: null,
    createdAt: new Date().toISOString(),
  }
  save({ ...snapshot, rides: [ride, ...snapshot.rides] })
  // Supabase carpools 테이블에 즉시 저장 (경로 API 응답을 기다리지 않음)
  if (isSupabaseConfigured()) {
    supabaseCreateRide(ride, input.driverId)
      .then((inserted) => {
        if (inserted?.id) {
          const insertedId = String(inserted.id)
          const updatedRides = snapshot.rides.map((r) =>
            r.id === ride.id ? { ...r, id: insertedId } : r,
          )
          save({ ...snapshot, rides: updatedRides })
        }
      })
      .catch((err) => {
        console.warn("createCarpoolRide supabase insert failed:", err)
      })
  }
  // 백엔드 경로 API 기반 경유지 비동기 정밀 갱신 (로컬 표시 보강)
  void fetchRouteWaypointsFromMapBackend({
    start: ride.start,
    destination: ride.destination,
    fallbackWaypoints: input.waypoints,
  })
    .then((mapResult) => {
      save({
        ...snapshot,
        rides: snapshot.rides.map((r) =>
          r.id === ride.id ||
          (r.driverId === ride.driverId &&
            r.start === ride.start &&
            r.destination === ride.destination &&
            r.date === ride.date &&
            r.time === ride.time)
            ? {
                ...r,
                waypoints:
                  mapResult.formatted || r.waypoints || DIRECT_ROUTE_LABEL,
                waypointsList: mapResult.waypointsList,
              }
            : r,
        ),
      })
    })
    .catch(console.warn)
  return ride
}

export function applyToCarpool(
  rideId: string,
  riderInfo?: { id?: string; name?: string },
) {
  const ride = snapshot.rides.find((item) => item.id === rideId)
  if (!ride || ride.status !== "모집 중")
    throw new Error("신청할 수 없는 카풀입니다.")
  const currentRiderId = riderInfo?.id || "user-rider"
  const currentRiderName = riderInfo?.name || "탑승자"
  if (
    snapshot.applications.some(
      (item) => item.rideId === rideId && item.riderId === currentRiderId,
    )
  )
    throw new Error("이미 신청한 카풀입니다.")
  const approvedCount = snapshot.applications.filter(
    (item) => item.rideId === rideId && item.status === "승인 완료",
  ).length
  if (approvedCount >= ride.totalSeats) throw new Error("남은 좌석이 없습니다.")
  const application: DemoCarpoolApplication = {
    id: createId("application"),
    rideId,
    riderId: currentRiderId,
    riderName: currentRiderName,
    driverId: ride.driverId,
    createdAt: new Date().toISOString(),
    status: "승인 대기",
  }
  save({ ...snapshot, applications: [application, ...snapshot.applications] })
  showAppToast({
    message: `${ride.start} → ${ride.destination} 카풀 탑승 신청이 접수되었습니다.`,
    variant: "success",
  })
  if (isSupabaseConfigured()) {
    supabaseCreateApplication(rideId, currentRiderName, currentRiderId)
      .then((inserted) => {
        if (inserted?.id) {
          save({
            ...snapshot,
            applications: snapshot.applications.map((a) =>
              a.id === application.id ? { ...a, id: String(inserted.id) } : a,
            ),
          })
        }
      })
      .catch(console.warn)
  }
  return application
}

export function decideCarpoolApplication(
  applicationId: string,
  decision: "approve" | "reject",
  onNavigateChat?: (roomId: string) => void,
) {
  const application = snapshot.applications.find(
    (item) => item.id === applicationId,
  )
  if (!application || application.status !== "승인 대기") return
  const ride = snapshot.rides.find((item) => item.id === application.rideId)
  if (!ride || ride.status !== "모집 중")
    throw new Error("처리할 수 없는 신청입니다.")
  const approvedCount = snapshot.applications.filter(
    (item) => item.rideId === ride.id && item.status === "승인 완료",
  ).length
  if (decision === "approve" && approvedCount >= ride.totalSeats)
    throw new Error("남은 좌석이 없습니다.")
  save({
    ...snapshot,
    applications: snapshot.applications.map((item) =>
      item.id === applicationId
        ? {
            ...item,
            status: decision === "approve" ? "승인 완료" : "거절 완료",
          }
        : item,
    ),
    events:
      decision === "reject"
        ? [
            {
              id: createId("event"),
              type: "application-rejected",
              applicationId,
              title: "탑승 신청이 거절되었습니다",
              message: `${application.riderName}님의 탑승 신청을 운전자가 거절했습니다.`,
              createdAt: new Date().toISOString(),
            },
            ...snapshot.events,
          ]
        : snapshot.events,
  })
  if (decision === "approve") {
    let createdRoomId = ""
    try {
      const chatRes = getOrCreateCarpoolChatRoom({
        currentUser: {
          id: ride.driverId,
          loginId: ride.driverId,
          name: ride.driverName || "운전자",
          role: "driver",
          carInfo: ride.vehicle,
          isDriverVerified: true,
        },
        targetUser: {
          id: application.riderId,
          name: application.riderName || "탑승자",
          role: "rider",
        },
        ride: {
          id: ride.id,
          start: ride.start,
          destination: ride.destination,
          date: ride.date,
          time: ride.time,
          waypoints: ride.waypoints,
        },
      })
      if (chatRes.ok) {
        createdRoomId = chatRes.room.id
        sendRealtimeChatMessage({
          roomId: chatRes.room.id,
          senderId: ride.driverId,
          senderName: ride.driverName || "운전자",
          text: `[매칭 완료] ${application.riderName}님의 카풀 탑승 신청이 수락되었습니다.`,
          messageType: "notice",
        })
      }
    } catch {
      // ignore chat auto-create warning
    }
    showAppToast({
      message: `${application.riderName}님의 탑승 신청을 수락했습니다. 매칭 채팅방이 열렸습니다!`,
      variant: "success",
      durationMs: 4500,
      actionLabel:
        createdRoomId && onNavigateChat ? "채팅방 바로가기" : undefined,
      onAction:
        createdRoomId && onNavigateChat
          ? () => onNavigateChat(createdRoomId)
          : undefined,
    })
  } else {
    showAppToast({
      message: `${application.riderName}님의 탑승 신청을 거절했습니다.`,
      variant: "info",
    })
  }
  if (isSupabaseConfigured()) {
    supabaseUpdateApplicationStatus(
      applicationId,
      decision === "approve" ? "승인 완료" : "거절 완료",
    ).catch(console.warn)
  }
}

export function cancelCarpoolApplication(applicationId: string) {
  const application = snapshot.applications.find(
    (item) => item.id === applicationId,
  )
  if (
    !application ||
    (application.status !== "승인 대기" && application.status !== "승인 완료")
  )
    return
  const ride = snapshot.rides.find((item) => item.id === application.rideId)
  if (!ride || ride.status !== "모집 중")
    throw new Error("취소할 수 없는 카풀입니다.")
  const wasApproved = application.status === "승인 완료"
  save({
    ...snapshot,
    applications: snapshot.applications.map((item) =>
      item.id === applicationId ? { ...item, status: "취소 완료" } : item,
    ),
    events: [
      {
        id: createId("event"),
        type: "reservation-cancelled",
        applicationId,
        title: "카풀 예약이 취소되었습니다",
        message: wasApproved
          ? `${ride.date} ${ride.time} · ${ride.start} → ${ride.destination} 예약이 취소되어 잔여 좌석 1석이 복구되고 ${ride.price.toLocaleString()} P가 환불되었습니다.`
          : `${ride.date} ${ride.time} · ${ride.start} → ${ride.destination} 예약이 취소되었습니다.`,
        createdAt: new Date().toISOString(),
      },
      ...snapshot.events,
    ],
  })
  if (wasApproved && ride.price > 0) {
    refundDemoPoints(ride.price)
  }
  showAppToast({
    message: wasApproved
      ? `예약 취소 완료 · 잔여 1석 복구 및 ${ride.price.toLocaleString()} P 자동 환불`
      : "카풀 예약 신청이 취소되었습니다.",
    variant: "info",
  })
  if (isSupabaseConfigured()) {
    supabaseUpdateApplicationStatus(applicationId, "취소 완료").catch(console.warn)
  }
}

export function requestSettlementInChat(rideId: string) {
  const ride = snapshot.rides.find((item) => item.id === rideId)
  if (!ride) return
  const approvedApps = snapshot.applications.filter(
    (item) => item.rideId === rideId && item.status === "승인 완료",
  )
  const targetApps =
    approvedApps.length > 0
      ? approvedApps
      : snapshot.applications.filter((item) => item.rideId === rideId).slice(0, 1)

  const settlementText = `[정산 요청] ${ride.start} → ${ride.destination} 운행이 종료되었습니다. 아래 버튼을 눌러 ${ride.price.toLocaleString()} P 정산을 진행해 주세요.`

  targetApps.forEach((app) => {
    const { room } = getOrCreateCarpoolChatRoom({
      currentUser: {
        id: ride.driverId,
        name: ride.driverName,
        role: "driver",
        carInfo: ride.vehicle,
        licenseVerified: true,
      },
      counterpart: {
        id: app.riderId,
        name: app.riderName,
        role: "rider",
      },
      ride: {
        id: ride.id,
        start: ride.start,
        destination: ride.destination,
        date: ride.date,
        time: ride.time,
        waypoints: ride.waypoints,
      },
    })
    sendRealtimeChatMessage({
      roomId: room.id,
      senderId: ride.driverId,
      senderName: ride.driverName,
      text: settlementText,
      messageType: "settlement",
    })
  })
}

export function endCarpoolRide(rideId: string) {
  const ride = snapshot.rides.find((item) => item.id === rideId)
  if (!ride || ride.status !== "모집 중") return
  const endedAt = new Date().toISOString()
  save({
    ...snapshot,
    rides: snapshot.rides.map((item) =>
      item.id === rideId
        ? {
            ...item,
            status: "정산 대기",
            settlementStatus: "정산 대기",
            endedAt,
          }
        : item,
    ),
  })
  if (isSupabaseConfigured()) {
    supabaseUpdateRideStatus(rideId, "정산 대기", {
      endedAt,
      settlementStatus: "정산 대기",
    }).catch(console.warn)
  }
  // 운행 종료 즉시 연결된 채팅방에 정산 요청 메시지 전송
  requestSettlementInChat(rideId)
}

export function settleCarpoolRide(
  rideId: string,
  payer?: { id?: string; name?: string },
) {
  const ride = snapshot.rides.find((item) => item.id === rideId)
  if (!ride || ride.settlementStatus !== "정산 대기") return
  const settledAt = new Date().toISOString()
  save({
    ...snapshot,
    rides: snapshot.rides.map((item) =>
      item.id === rideId
        ? {
            ...item,
            status: "완료",
            settlementStatus: "정산 완료",
            settledAt,
          }
        : item,
    ),
  })

  // 채팅방에 정산 완료 메시지 전송 (로컬 즉시 반영 + Supabase Realtime 동기화)
  const approvedApp = snapshot.applications.find(
    (item) => item.rideId === rideId && item.status === "승인 완료",
  )
  const payerId = payer?.id || approvedApp?.riderId || "user-rider"
  const payerName = payer?.name || approvedApp?.riderName || "탑승자"
  if (approvedApp || payer?.id) {
    const { room } = getOrCreateCarpoolChatRoom({
      currentUser: {
        id: payerId,
        name: payerName,
        role: "rider",
      },
      counterpart: {
        id: ride.driverId,
        name: ride.driverName,
        role: "driver",
        carInfo: ride.vehicle,
        licenseVerified: true,
      },
      ride: {
        id: ride.id,
        start: ride.start,
        destination: ride.destination,
        date: ride.date,
        time: ride.time,
        waypoints: ride.waypoints,
      },
    })
    sendRealtimeChatMessage({
      roomId: room.id,
      senderId: payerId,
      senderName: payerName,
      text: `[정산 완료] ${ride.price.toLocaleString()} P 카풀 정산이 완료되었습니다. 안전한 운행 감사합니다!`,
      messageType: "settlement",
    })
  }

  if (isSupabaseConfigured()) {
    supabaseUpdateRideStatus(rideId, "완료", {
      settledAt,
      settlementStatus: "정산 완료",
    }).catch(console.warn)
    supabaseRecordCarpoolSettlement({
      driverId: ride.driverId,
      carpoolId: ride.id,
      amount: ride.price,
    }).catch(console.warn)
  }
}

export function updateCarpoolRidesTimeAndDate(params: {
  time?: string
  date?: string
}) {
  const nextTime = params.time?.trim()
  const nextDate = params.date?.trim()
  if (!nextTime && !nextDate) return
  if (snapshot.rides.length === 0) return

  const updatedRides = snapshot.rides.map((ride) => {
    const updatedDate = nextDate || ride.date
    const updatedTime = nextTime || ride.time
    const duration =
      Number.isSafeInteger(ride.estimatedDuration) && ride.estimatedDuration > 0
        ? ride.estimatedDuration
        : DEFAULT_ESTIMATED_DURATION
    const recalculatedEta =
      calculateEstimatedArrival(updatedDate, updatedTime, duration) ||
      ride.estimatedArrival
    return {
      ...ride,
      date: updatedDate,
      time: updatedTime,
      estimatedArrival: recalculatedEta,
    }
  })

  save({
    ...snapshot,
    rides: updatedRides,
  })
}

export function addCarpoolReview(
  rideId: string,
  rating: number,
  keywords: string[],
  content: string,
  authorInfo?: { id?: string; name?: string },
) {
  const ride = snapshot.rides.find((item) => item.id === rideId)
  const currentAuthorId = authorInfo?.id || "user-rider"
  const currentAuthorName = authorInfo?.name || "탑승자"
  const approved = snapshot.applications.some(
    (item) =>
      item.rideId === rideId &&
      (item.riderId === currentAuthorId || item.riderId === "user-rider") &&
      item.status === "승인 완료",
  )
  if (!ride || ride.settlementStatus !== "정산 완료" || !approved)
    throw new Error("후기를 작성할 수 없는 카풀입니다.")
  if (
    snapshot.reviews.some(
      (item) => item.rideId === rideId && item.authorId === currentAuthorId,
    )
  )
    throw new Error("이미 후기를 작성했습니다.")
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new Error("별점을 선택해 주세요.")
  const review: DemoCarpoolReview = {
    id: createId("review"),
    rideId,
    authorId: currentAuthorId,
    targetId: ride.driverId,
    rating,
    keywords,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  save({ ...snapshot, reviews: [review, ...snapshot.reviews] })
  if (isSupabaseConfigured()) {
    supabaseSubmitReview(
      {
        author: currentAuthorName,
        date: new Date().toLocaleDateString("ko-KR"),
        score: rating,
        text: content.trim(),
        tags: keywords,
      },
      rideId,
    ).catch(console.warn)
  }
  return review
}

export function getRemainingSeats(state: DemoCarpoolState, rideId: string) {
  const ride = state.rides.find((item) => item.id === rideId)
  if (!ride) return 0
  const occupied = state.applications.filter(
    (item) => item.rideId === rideId && item.status === "승인 완료",
  ).length
  return Math.max(0, ride.totalSeats - occupied)
}

export async function syncCarpoolWithSupabase() {
  if (!isSupabaseConfigured() || typeof window === "undefined") return
  try {
    const [remoteRides, remoteApps, remoteReviews] = await Promise.all([
      supabaseGetRides(),
      supabaseGetApplications(),
      supabaseGetReviews(),
    ])

    const rideMap = new Map<string, DemoCarpoolRide>()
    remoteRides.forEach((r) => rideMap.set(r.id, r))
    // 아직 Supabase UUID가 발급되기 직전인 로컬 임시 카풀만 중복 없이 보존
    snapshot.rides.forEach((localRide) => {
      if (!localRide.id.startsWith("carpool-")) return
      const alreadySynced = remoteRides.some(
        (remote) =>
          remote.driverId === localRide.driverId &&
          remote.start === localRide.start &&
          remote.destination === localRide.destination &&
          remote.date === localRide.date &&
          remote.time === localRide.time,
      )
      if (!alreadySynced) {
        rideMap.set(localRide.id, localRide)
      }
    })

    const appMap = new Map<string, DemoCarpoolApplication>()
    remoteApps.forEach((a) => appMap.set(a.id, a))
    snapshot.applications.forEach((localApp) => {
      if (localApp.id.startsWith("application-")) {
        const alreadySynced = remoteApps.some(
          (remote) =>
            remote.rideId === localApp.rideId &&
            remote.riderId === localApp.riderId,
        )
        if (!alreadySynced) appMap.set(localApp.id, localApp)
      }
    })

    const revMap = new Map<string, DemoCarpoolReview>()
    remoteReviews.forEach((rev) => revMap.set(rev.id, rev))

    const nextState: DemoCarpoolState = {
      ...snapshot,
      rides: Array.from(rideMap.values()),
      applications: Array.from(appMap.values()),
      reviews: Array.from(revMap.values()),
    }
    if (
      JSON.stringify(nextState.rides) !== JSON.stringify(snapshot.rides) ||
      JSON.stringify(nextState.applications) !==
        JSON.stringify(snapshot.applications) ||
      JSON.stringify(nextState.reviews) !== JSON.stringify(snapshot.reviews)
    ) {
      save(nextState)
    }
  } catch (err) {
    console.warn("syncCarpoolWithSupabase error:", err)
  }
}

let carpoolRealtimeChannel: ReturnType<typeof supabase.channel> | null = null

function setupCarpoolRealtimeSubscription() {
  if (!isSupabaseConfigured() || typeof window === "undefined") return
  try {
    if (carpoolRealtimeChannel) {
      void supabase.removeChannel(carpoolRealtimeChannel)
      carpoolRealtimeChannel = null
    }
    carpoolRealtimeChannel = supabase
      .channel(`carpool-realtime-changes-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carpools" },
        () => {
          void syncCarpoolWithSupabase()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carpool_requests" },
        () => {
          void syncCarpoolWithSupabase()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        () => {
          void syncCarpoolWithSupabase()
        },
      )
      .subscribe()
  } catch (e) {
    console.warn("Supabase realtime setup failed:", e)
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return
    snapshot = readState()
    listeners.forEach((listener) => listener())
  })

  if (isSupabaseConfigured()) {
    // 초기 로드 시 Supabase 데이터 동기화 및 실시간 구독
    void syncCarpoolWithSupabase()
    setupCarpoolRealtimeSubscription()

    // 로그인 세션이 바뀌면 인증 토큰 기준으로 실시간 채널 재구독 + 즉시 동기화
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setupCarpoolRealtimeSubscription()
        void syncCarpoolWithSupabase()
      }
    })

    // 창 포커스/탭 복귀 시 즉시 최신 신청·매칭 상태 동기화
    window.addEventListener("focus", () => {
      void syncCarpoolWithSupabase()
    })
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void syncCarpoolWithSupabase()
      }
    })

    // Realtime 지연/미설정 환경에서도 새로고침 없이 반영되도록 4초 주기 자동 동기화 (화면 활성 시에만)
    window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncCarpoolWithSupabase()
      }
    }, 4000)
  }
}
