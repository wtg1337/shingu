import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CarFront,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Eye,
  EyeOff,
  Flag,
  Home,
  MapPin,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Navigation,
  Plus,
  Route,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  Heart,
} from "./components/Icons"
import logo from "./assets/shingu-gil-logo.png"
import transparentLogo from "./assets/shingu-gil-logo-transparent.png"
import {
  APP_VERSION,
  defaultAccount,
  defaultSelectedBadges,
  defaultRoutes,
  serviceFaqs,
  demoHistoryEntries,
  demoProfileBadges,
  demoReportTargets,
  demoChatRooms,
  demoReceivedReviews,
  demoRides as rides,
  demoScheduleByDate,
} from "./data/demoData"
import {
  getBlockedUsers,
  getSafetyReports,
  submitSafetyReport,
  unblockDemoUser,
} from "./services/demoSafety"
import {
  checkBiometricHardwareSupport,
  getBiometricAccount,
  getBiometricDemoState,
  getDemoDevices,
  getNotificationSettings,
  registerCurrentDemoDevice,
  removeDemoDevice,
  saveBiometricAccount,
  saveBiometricDemoState,
  saveDemoInquiry,
  saveNotificationSettings,
} from "./services/demoSettings"
import {
  completeDemoPayment,
  endDemoTrip,
  getTripFlowSnapshot,
  resetDemoTrip,
  startDemoTrip,
  subscribeTripFlow,
} from "./services/demoTripFlow"
import {
  chargeDemoPoints,
  getDemoPointWallet,
  resetDemoPoints,
  subscribeDemoPointWallet,
  syncPointWalletWithSupabase,
  type DemoPaymentMethod,
  type DemoPointCharge,
  type DemoPointWallet,
} from "./services/demoPoints"
import {
  addCarpoolReview,
  applyToCarpool,
  cancelCarpoolApplication,
  createCarpoolRide,
  decideCarpoolApplication,
  endCarpoolRide,
  getCarpoolFlowSnapshot,
  getRemainingSeats,
  resetCarpoolFlow,
  settleCarpoolRide,
  subscribeCarpoolFlow,
  syncCarpoolWithSupabase,
  updateCarpoolRidesTimeAndDate,
  type DemoCarpoolRide,
  type DemoCarpoolApplication,
  type DemoCarpoolEvent,
  type DemoCarpoolState,
} from "./services/demoCarpoolFlow"
import {
  readDemoData,
  readDemoList,
  readDemoValue,
  removeDemoData,
  writeDemoData,
  writeDemoValue,
} from "./services/demoStore"
import { getDemoMatches } from "./services/demoMatching"
import {
  calculateEstimatedArrival,
  DEFAULT_ESTIMATED_DURATION,
  etaTimeToMinutes,
  formatEtaDateTime,
  formatEtaTime,
  timeLabelToMinutes,
} from "./services/demoEta"
import {
  getDemoMileageBalance,
  getOrCreateMileageMemberCode,
} from "./services/demoMileage"
import {
  supabaseSignIn,
  supabaseSignUp,
  supabaseSignOut,
  supabaseResetPassword,
  supabaseGetCurrentUser,
  supabaseGetProfile,
  supabaseGetRoute,
  supabaseSaveRoute,
  supabaseUpdateProfile,
  subscribeUserProfileRealtime,
  supabaseSendSchoolEmailOtp,
  supabaseVerifySchoolEmailOtp,
} from "./services/supabaseService"
import {
  DIRECT_ROUTE_LABEL,
  fetchRouteWaypointsFromMapBackend,
  getExtractedWaypointsSync,
  type WaypointNode,
} from "./services/routeWaypointService"
import {
  formatChatRoomListTime,
  formatChatTimestamp,
  getCounterpartProfile,
  getMessagesForRoom,
  getOrCreateCarpoolChatRoom,
  getRealtimeChatSnapshot,
  getRoomsForUser,
  leaveRealtimeChatRoom,
  normalizeDisplayName,
  sendRealtimeChatMessage,
  subscribeRealtimeChat,
  type CreateOrJoinChatParams,
  type RealtimeChatRoom,
} from "./services/realtimeChatService"
import { supabase, isSupabaseConfigured } from "./lib/supabase"
import GlobalDialog from "./components/GlobalDialog"
import {
  showAppAlert,
  showAppConfirm,
  showAppToast,
} from "./services/dialogService"
import JsBarcode from "jsbarcode"
import type {
  AccountData,
  BlockedUser,
  ChatRoomData,
  DemoDevice,
  DemoInquiry,
  DemoReview,
  DemoTripFlow,
  HistoryEntry,
  NotificationSettings,
  ProfileBadge,
  Ride,
  Role,
  RoleRegistrations,
  RouteData,
  SafetyReport,
} from "./types/domain"

type Tab = "home" | "schedule" | "chat" | "profile"
type AuthView = "login" | "signup" | "reset"
const formatPoints = (value: number) => `${value.toLocaleString("ko-KR")} P`
type MatchRide = {
  id: string
  flowRideId?: string
  driverId?: string
  name: string
  car: string
  start: string
  end: string
  via: string
  waypointsList?: string[]
  waypointObjects?: WaypointNode[]
  date: string
  time: string
  estimatedDuration: number
  estimatedArrival: string
  seats: number
  price: number
  match: number
  rating: number
  reviews: number
}

const toMatchRide = (ride: Ride): MatchRide => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  })
  const departureMinutes = timeLabelToMinutes(ride.time) ?? 0
  const departureTime = `${String(Math.floor(departureMinutes / 60)).padStart(
    2,
    "0",
  )}:${String(departureMinutes % 60).padStart(2, "0")}`
  const extracted = getExtractedWaypointsSync(ride.start, ride.end, ride.via)
  return {
    ...ride,
    id: `demo-${ride.id}`,
    driverId: `driver-${ride.name}`,
    via: extracted.formatted || DIRECT_ROUTE_LABEL,
    waypointsList: extracted.waypointsList,
    waypointObjects: extracted.waypointObjects,
    date: new Date().toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    }),
    estimatedArrival: calculateEstimatedArrival(
      today,
      departureTime,
      ride.estimatedDuration,
    ),
  }
}

const toFlowMatchRide = (
  ride: DemoCarpoolRide,
  carpoolFlow: DemoCarpoolState,
): MatchRide => {
  const extracted = getExtractedWaypointsSync(
    ride.start,
    ride.destination,
    ride.waypointsList ?? ride.waypoints,
  )
  const driverReviews = (carpoolFlow.reviews || []).filter(
    (rev) => rev.targetId === ride.driverId || rev.rideId === ride.id,
  )
  const driverRating =
    driverReviews.length > 0
      ? Number(
          (
            driverReviews.reduce((sum, rev) => sum + (Number(rev.rating) || 0), 0) /
            driverReviews.length
          ).toFixed(1),
        )
      : 0.0
  return {
    id: `flow-${ride.id}`,
    flowRideId: ride.id,
    driverId: ride.driverId || `driver-${ride.driverName}`,
    name: ride.driverName,
    car: ride.vehicle,
    start: ride.start,
    end: ride.destination,
    via: extracted.formatted || DIRECT_ROUTE_LABEL,
    waypointsList: extracted.waypointsList,
    waypointObjects: extracted.waypointObjects,
    date: new Date(`${ride.date}T00:00:00`).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    }),
    time: ride.time,
    estimatedDuration: ride.estimatedDuration,
    estimatedArrival: ride.estimatedArrival,
    seats: getRemainingSeats(carpoolFlow, ride.id),
    price: ride.price,
    match: 99,
    rating: driverRating,
    reviews: driverReviews.length,
  }
}

const getVisibleMatchRides = (
  route: RouteData,
  carpoolFlow: DemoCarpoolState,
) => {
  const preferredArrival = timeLabelToMinutes(route.preferredArrival ?? "")
  return [
    ...carpoolFlow.rides
      .filter((ride) => ride.status === "모집 중")
      .map((ride) => toFlowMatchRide(ride, carpoolFlow)),
    ...getDemoMatches(route, rides).map(toMatchRide),
  ]
    .map((ride) => {
      const arrival = etaTimeToMinutes(ride.estimatedArrival)
      const arrivalDifference =
        preferredArrival === null || arrival === null
          ? null
          : Math.abs(preferredArrival - arrival)
      const arrivalScore =
        arrivalDifference === null
          ? 0
          : arrivalDifference <= 15
            ? 8
            : arrivalDifference <= 30
              ? 4
              : 0
      return {
        ...ride,
        match: Math.min(99, ride.match + arrivalScore),
        arrivalDifference,
      }
    })
    .sort(
      (left, right) =>
        right.match - left.match ||
        (left.arrivalDifference ?? Number.MAX_SAFE_INTEGER) -
          (right.arrivalDifference ?? Number.MAX_SAFE_INTEGER),
    )
}
type Sheet = "ride" | "matches" | "create" | "reservation" | "notifications" | "points" | "mileage" | "mileage-history" | "history" | "carpool-payment" | "safety" | "safety-report" | "blocked-users" | "report-history" | "privacy" | "privacy-policy" | "roles" | "driver-register" | "rider-register" | "settings" | "notification-settings" | "security-settings" | "service-guide" | "passenger-guide" | "driver-guide" | "contact-support" | "route-edit" | "applications" | "application-detail" | "calendar" | "account" | "account-edit" | "monthly-rides" | "review" | "reviews" | null

function normalizeRegistrations(
  _value: unknown,
  _currentRole: Role = "rider",
): RoleRegistrations {
  // 회원가입한 단일 사용자 계정으로 운전자 ↔ 탑승자 역할이 즉시 전환되도록 두 역할 모두 활성화 유지
  return {
    rider: true,
    driver: true,
  }
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "soft"
}) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {children}
    </button>
  )
}

function Toggle({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <i />
    </button>
  )
}

function Field({
  label,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon?: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field__control">
        {icon}
        <input {...props} />
      </span>
    </label>
  )
}

function Brand({
  compact = false,
  transparent = false,
}: {
  compact?: boolean
  transparent?: boolean
}) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <img src={transparent ? transparentLogo : logo} alt="신구길 로고" />
      {compact && (
        <div>
          <strong>신구길</strong>
          <span>SHINGU-GIL</span>
        </div>
      )}
    </div>
  )
}

function BadgeGlyph({ badge }: { badge: ProfileBadge }) {
  if (badge.icon === "car") return <CarFront />
  if (badge.icon === "check") return <Check />
  if (badge.icon === "shield") return <ShieldCheck />
  if (badge.icon === "star") return <Star />
  if (badge.icon === "music") return <MessageCircle />
  if (badge.icon === "clock") return <Clock3 />
  if (badge.icon === "manner") return <UserRound />
  if (badge.icon === "commute") return <UsersRound />
  return <ShieldCheck />
}

/**
 * 휴대폰 번호 실시간 자동 하이픈 포맷팅 (백스페이스 멈춤 방지 포함)
 */
function formatPhoneInput(nextRaw: string, prevFormatted = ""): string {
  if (!nextRaw) return ""
  let digits = nextRaw.replace(/[^0-9]/g, "").slice(0, 11)
  const prevDigits = prevFormatted.replace(/[^0-9]/g, "").slice(0, 11)
  if (
    prevFormatted &&
    nextRaw.length < prevFormatted.length &&
    digits.length === prevDigits.length &&
    digits.length > 0
  ) {
    digits = digits.slice(0, -1)
  }
  if (digits.length <= 3) {
    return digits
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

/**
 * 휴대폰 번호 유효성 검사 (순수 숫자 11자리 완성 및 한국 휴대폰 번호 패턴 검증)
 */
function isValidPhoneNumber(raw: string): boolean {
  if (!raw) return false
  const digits = raw.replace(/[^0-9]/g, "")
  return digits.length === 11 && /^01[016789]\d{8}$/.test(digits)
}

/**
 * 휴대폰 번호 표준 포맷 정규화 (010-XXXX-XXXX)
 */
function normalizePhoneNumber(raw: string): string {
  if (!raw) return ""
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

const WEEKDAY_NAMES_KO = ["일", "월", "화", "수", "목", "금", "토"] as const

function getTodayDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function formatBookingDateLabel(dateKey: string): string {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const today = getTodayDateKey()
    return formatBookingDateLabel(today)
  }
  const [y, m, d] = dateKey.split("-").map(Number)
  const dateObj = new Date(y, m - 1, d)
  if (Number.isNaN(dateObj.getTime())) return dateKey
  const weekday = WEEKDAY_NAMES_KO[dateObj.getDay()] ?? ""
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${weekday})`
}

function parseTime24(value?: string): {
  meridiem: "오전" | "오후"
  hour12: number
  minute: number
  formatted24: string
  totalMinutes: number
} {
  const raw = (value || "08:30").trim()
  const match24 = raw.match(/^(\d{1,2}):(\d{2})$/)
  let h24 = 8
  let min = 30
  if (match24) {
    const parsedH = Number(match24[1])
    const parsedM = Number(match24[2])
    h24 = Number.isFinite(parsedH) ? Math.max(0, Math.min(23, parsedH)) : 8
    min = Number.isFinite(parsedM) ? Math.max(0, Math.min(59, parsedM)) : 30
  } else {
    const matchKo = raw.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/)
    if (matchKo) {
      let parsedH = Number(matchKo[2]) % 12
      if (matchKo[1] === "오후") parsedH += 12
      const parsedM = Number(matchKo[3])
      h24 = Number.isFinite(parsedH) ? Math.max(0, Math.min(23, parsedH)) : 8
      min = Number.isFinite(parsedM) ? Math.max(0, Math.min(59, parsedM)) : 30
    }
  }
  const totalMinutes = Math.max(0, Math.min(1439, h24 * 60 + min))
  const safeH24 = Math.floor(totalMinutes / 60)
  const safeMin = totalMinutes % 60
  const meridiem: "오전" | "오후" = safeH24 >= 12 ? "오후" : "오전"
  const hour12 = safeH24 % 12 === 0 ? 12 : safeH24 % 12
  const formatted24 = `${String(safeH24).padStart(2, "0")}:${String(safeMin).padStart(2, "0")}`
  return { meridiem, hour12, minute: safeMin, formatted24, totalMinutes }
}

function toTotalMinutes24(value?: string): number {
  return parseTime24(value).totalMinutes
}

function minutesToTime24(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) return "08:30"
  const clamped = Math.max(0, Math.min(1439, Math.round(totalMinutes)))
  const nextH = Math.floor(clamped / 60)
  const nextM = clamped % 60
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`
}

function toTime24String(
  meridiem: "오전" | "오후",
  hour12: number,
  minute: number,
): string {
  const safeHour12 = Math.max(1, Math.min(12, Math.round(hour12) || 12))
  const safeMinute = Math.max(0, Math.min(59, Math.round(minute) || 0))
  let h24 = safeHour12 % 12
  if (meridiem === "오후") h24 += 12
  const total = Math.max(0, Math.min(1439, h24 * 60 + safeMinute))
  return minutesToTime24(total)
}

function formatKoreanTimeLabel(value?: string): string {
  const { meridiem, hour12, minute } = parseTime24(value)
  return `${meridiem} ${hour12}:${String(minute).padStart(2, "0")}`
}

function addMinutesToTime24(value: string, deltaMinutes: number): string {
  const baseMinutes = toTotalMinutes24(value)
  const safeDelta = Number.isFinite(deltaMinutes) ? Math.round(deltaMinutes) : 0
  return minutesToTime24(Math.max(0, Math.min(1439, baseMinutes + safeDelta)))
}

function isValidDepartureAndArrival(
  departureTime24?: string,
  arrivalTime24?: string,
): boolean {
  if (!departureTime24 || !arrivalTime24) return false
  const depMinutes = toTotalMinutes24(departureTime24)
  const arrMinutes = toTotalMinutes24(arrivalTime24)
  return depMinutes < arrMinutes
}

function resolveValidArrivalTime24(
  departureTime24: string,
  currentArrivalTime24?: string,
): {
  departure24: string
  arrival24: string
  autoAdjusted: boolean
} {
  const rawDepMin = toTotalMinutes24(departureTime24)
  // 하루 마지막 시간(23:59 = 1439분)에 도착 시간이 최소 1분 이후가 될 수 있도록 출발 시간은 최대 23:58(1438분)으로 안전 보정
  const safeDepMin = Math.max(0, Math.min(1438, rawDepMin))
  const safeDep24 = minutesToTime24(safeDepMin)
  const currentArrMin = currentArrivalTime24
    ? toTotalMinutes24(currentArrivalTime24)
    : -1

  if (currentArrMin > safeDepMin && currentArrMin <= 1439) {
    return {
      departure24: safeDep24,
      arrival24: minutesToTime24(currentArrMin),
      autoAdjusted: safeDepMin !== rawDepMin,
    }
  }

  let nextArrMin = safeDepMin + 30
  if (nextArrMin > 1439) {
    nextArrMin = safeDepMin + 10 <= 1439 ? safeDepMin + 10 : 1439
  }
  return {
    departure24: safeDep24,
    arrival24: minutesToTime24(nextArrMin),
    autoAdjusted: true,
  }
}

function CustomDatePickerModal({
  isOpen,
  value,
  title = "원하는 날짜 예약",
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  value: string
  title?: string
  onClose: () => void
  onConfirm: (selectedDateKey: string) => void
}) {
  const todayKey = getTodayDateKey()
  const initialKey = value && value >= todayKey ? value : todayKey
  const [draftDate, setDraftDate] = useState(initialKey)
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = initialKey.split("-").map(Number)
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1)
  })

  useEffect(() => {
    if (!isOpen) return
    const safeKey = value && value >= todayKey ? value : todayKey
    setDraftDate(safeKey)
    const [y, m] = safeKey.split("-").map(Number)
    setViewMonth(new Date(y || new Date().getFullYear(), (m || 1) - 1, 1))
  }, [isOpen, todayKey, value])

  if (!isOpen) return null

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  const dayNumbers = Array.from({ length: daysInMonth }, (_, idx) => idx + 1)

  return (
    <div
      className="dialog-backdrop custom-picker-backdrop fixed inset-0 flex items-center justify-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="app-dialog custom-calendar-dialog w-[90%] max-w-[380px]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="custom-picker-header">
          <div>
            <span className="eyebrow">DATE RESERVATION</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="닫기"
          >
            <X />
          </button>
        </div>
        <p className="custom-picker-sub">
          원하는 예약 날짜를 선택해 주세요. 오늘 이전의 과거 날짜는 선택할 수 없습니다.
        </p>
        <div className="calendar-toolbar reservation-toolbar">
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            aria-label="이전 달"
          >
            <ChevronRight className="flip" />
          </button>
          <strong>
            {year}년 {month + 1}월
          </strong>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            aria-label="다음 달"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="reservation-weekdays">
          {WEEKDAY_NAMES_KO.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="reservation-calendar custom-modal-calendar">
          {Array.from({ length: startWeekday }, (_, idx) => (
            <i key={`empty-${idx}`} />
          ))}
          {dayNumbers.map((day) => {
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const isPast = dateKey < todayKey
            const isSelected = draftDate === dateKey
            const isToday = dateKey === todayKey
            return (
              <button
                type="button"
                key={dateKey}
                disabled={isPast}
                className={`${isSelected ? "active" : ""} ${
                  isToday ? "today" : ""
                }`}
                onClick={() => {
                  if (!isPast) setDraftDate(dateKey)
                }}
              >
                {day}
              </button>
            )
          })}
        </div>
        <div className="reservation-selected">
          <span>선택한 예약 날짜</span>
          <strong>{formatBookingDateLabel(draftDate)}</strong>
        </div>
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            disabled={!draftDate || draftDate < todayKey}
            onClick={() => {
              if (!draftDate || draftDate < todayKey) return
              onConfirm(draftDate)
              onClose()
            }}
          >
            확인 (선택 완료)
          </Button>
        </div>
      </section>
    </div>
  )
}

type PublicUserProfileTarget = {
  id?: string
  name?: string
  role?: Role
  emailVerified?: boolean
  licenseVerified?: boolean
  rating?: number
  tripCount?: number
  carInfo?: string
  badges?: string[]
  reviews?: DemoReview[]
}

type PublicUserProfileData = {
  id: string
  name: string
  role: Role
  emailVerified: boolean
  licenseVerified: boolean
  rating: number
  tripCount: number
  carInfo: string
  badges: string[]
  reviews: DemoReview[]
}

const DEMO_USER_PROFILES_DB: Record<string, Partial<PublicUserProfileData>> = {}

function resolvePublicUserProfile(
  target: PublicUserProfileTarget | null,
  carpoolFlow?: DemoCarpoolState,
  currentAccount?: AccountData,
): PublicUserProfileData | null {
  if (!target) return null
  const rawName = (target.name || "익명 학우").trim()
  const cleanName = rawName
    .replace(/\s*(운전자|탑승자|탑승 신청|학우|기사님|·.*)\s*$/g, "")
    .trim() || rawName

  const preset = DEMO_USER_PROFILES_DB[cleanName]
  const resolvedRole: Role =
    target.role || preset?.role || (target.carInfo ? "driver" : "rider")

  const isCurrentUser =
    (Boolean(currentAccount?.name) &&
      currentAccount?.name.trim() === cleanName) ||
    (Boolean(currentAccount?.id) && target.id === currentAccount?.id) ||
    (Boolean(currentAccount?.loginId) && target.id === currentAccount?.loginId)

  const flowRidesForDriver = (carpoolFlow?.rides || []).filter(
    (item) =>
      (item?.driverName?.trim() === cleanName ||
        (target.id && item?.driverId === target.id)) &&
      item.status === "완료",
  )
  const flowRideForDriver = (carpoolFlow?.rides || []).find(
    (item) =>
      item?.driverName?.trim() === cleanName ||
      (target.id && item?.driverId === target.id),
  )
  const flowCompletedAppsForRider = (carpoolFlow?.applications || []).filter(
    (app) =>
      (app.riderName?.trim() === cleanName ||
        (target.id && app.riderId === target.id)) &&
      app.status === "완료",
  )
  const flowReviewsForDriver: DemoReview[] =
    resolvedRole === "driver" && carpoolFlow?.reviews
      ? carpoolFlow.reviews
          .filter((rev) => {
            const r = carpoolFlow.rides.find((item) => item.id === rev.rideId)
            return (
              r?.driverName?.trim() === cleanName ||
              (target.id && rev.targetId === target.id)
            )
          })
          .map((rev) => ({
            author: "탑승 학우",
            date: new Date(rev.createdAt).toLocaleDateString("ko-KR"),
            score: Number.isFinite(rev.rating) ? rev.rating : 5,
            text: rev.content || "안전하고 쾌적한 카풀이었습니다.",
            tags: Array.isArray(rev.keywords) ? rev.keywords : [],
          }))
      : []

  const baseReviews = Array.isArray(target.reviews)
    ? target.reviews
    : Array.isArray(preset?.reviews)
      ? preset.reviews
      : []

  const mergedReviews = isCurrentUser
    ? flowReviewsForDriver
    : [...flowReviewsForDriver, ...baseReviews]

  const calculatedRating =
    mergedReviews.length > 0
      ? Number(
          (
            mergedReviews.reduce(
              (acc, item) => acc + (Number(item?.score) || 0),
              0,
            ) / mergedReviews.length
          ).toFixed(1),
        )
      : typeof target.rating === "number" &&
          Number.isFinite(target.rating) &&
          target.rating > 0 &&
          !isCurrentUser
        ? target.rating
        : 0.0

  const defaultBadges = isCurrentUser
    ? currentAccount?.isDriverVerified
      ? ["면허증 인증"]
      : []
    : []

  const badges = Array.isArray(target.badges)
    ? target.badges
    : isCurrentUser
      ? defaultBadges
      : Array.isArray(preset?.badges)
        ? preset.badges
        : defaultBadges

  const rawCarInfo =
    target.carInfo?.trim() ||
    flowRideForDriver?.vehicle?.trim() ||
    (isCurrentUser ? currentAccount?.vehicleName?.trim() : "") ||
    preset?.carInfo?.trim() ||
    ""

  const tripCount =
    typeof target.tripCount === "number" && Number.isFinite(target.tripCount)
      ? target.tripCount
      : resolvedRole === "driver"
        ? flowRidesForDriver.length
        : flowCompletedAppsForRider.length

  return {
    id: target.id || `user-${cleanName}`,
    name: cleanName,
    role: resolvedRole,
    emailVerified: target.emailVerified ?? preset?.emailVerified ?? true,
    licenseVerified:
      resolvedRole === "driver"
        ? (target.licenseVerified ??
          (isCurrentUser
            ? Boolean(currentAccount?.isDriverVerified ?? true)
            : true))
        : false,
    rating: calculatedRating,
    tripCount,
    carInfo: resolvedRole === "driver" ? rawCarInfo : "",
    badges,
    reviews: mergedReviews,
  }
}

function UserProfileDetailModal({
  profile,
  onClose,
  onSelectUserProfile,
}: {
  profile: PublicUserProfileData | null
  onClose: () => void
  onSelectUserProfile?: (target: PublicUserProfileTarget) => void
}) {
  if (!profile) return null
  const isDriver = profile.role === "driver"
  const safeBadges = Array.isArray(profile.badges) ? profile.badges : []
  const safeReviews = Array.isArray(profile.reviews) ? profile.reviews : []
  const safeRating =
    typeof profile.rating === "number" && Number.isFinite(profile.rating)
      ? profile.rating
      : 0.0
  const safeCarInfo = profile.carInfo?.trim() || "차량 정보 미등록"

  return (
    <div
      className="dialog-backdrop flow-dialog-backdrop user-profile-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="app-dialog user-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name}님의 상세 프로필`}
      >
        <header className="user-profile-modal__header">
          <span className="eyebrow">
            {isDriver ? "DRIVER PROFILE" : "PASSENGER PROFILE"}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="프로필 창 닫기"
          >
            <X />
          </button>
        </header>

        <div className="user-profile-modal__top">
          <div className={`profile-avatar ${isDriver ? "" : "green"}`}>
            {(profile.name || "학").slice(0, 1)}
            <span>
              <ShieldCheck />
            </span>
          </div>
          <div className="user-profile-modal__identity">
            <div className="user-profile-modal__name-row">
              <h2>{profile.name || "학우"}</h2>
              <span className={`role-pill ${profile.role}`}>
                {isDriver ? "운전자" : "탑승자"}
              </span>
            </div>
            <div className="user-profile-modal__verifications">
              {profile.emailVerified && (
                <span className="verified-text">
                  <Check /> 학교 이메일 인증
                </span>
              )}
              {isDriver && profile.licenseVerified && (
                <span className="verified-text verified-text--driver">
                  <ShieldCheck /> 운전면허증 인증
                </span>
              )}
            </div>
          </div>
        </div>

        {isDriver ? (
          <>
            <div className="user-profile-modal__stats">
              <div>
                <strong className="rating-score">
                  <Star /> {safeRating.toFixed(1)} <small>/ 5.0</small>
                </strong>
                <span>평균 별점</span>
              </div>
              <div>
                <strong>{safeReviews.length}개</strong>
                <span>총 후기 수</span>
              </div>
              <div>
                <strong>{profile.tripCount ?? 0}회</strong>
                <span>운행 횟수</span>
              </div>
            </div>

            <section className="user-profile-modal__section">
              <h3>등록 차량 정보</h3>
              <div className="user-profile-modal__car-card">
                <CarFront />
                <div>
                  <span>차종 및 차량 번호</span>
                  <strong>{safeCarInfo}</strong>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="user-profile-modal__stats rider-stats">
            <div>
              <strong>{profile.tripCount ?? 0}회</strong>
              <span>카풀 탑승 완료</span>
            </div>
            <div>
              <strong className="rating-score">
                <Star /> {safeRating.toFixed(1)} <small>/ 5.0</small>
              </strong>
              <span>매너 평점</span>
            </div>
            <div>
              <strong>{safeReviews.length}개</strong>
              <span>받은 후기</span>
            </div>
          </div>
        )}

        <section className="user-profile-modal__section">
          <h3>획득 뱃지</h3>
          {safeBadges.length > 0 ? (
            <div className="user-profile-modal__badges">
              {safeBadges.map((badgeLabel, idx) => (
                <span
                  className={`profile-badge ${
                    idx % 3 === 0
                      ? "tone-green"
                      : idx % 3 === 1
                        ? "tone-sky"
                        : "tone-navy"
                  }`}
                  key={`${badgeLabel}-${idx}`}
                >
                  {isDriver ? <ShieldCheck /> : <Check />}
                  {badgeLabel}
                </span>
              ))}
            </div>
          ) : (
            <div className="user-profile-modal__empty">
              아직 획득한 뱃지가 없습니다.
            </div>
          )}
        </section>

        <section className="user-profile-modal__section">
          <div className="user-profile-modal__section-head">
            <h3>{isDriver ? "받은 운행 후기" : "받은 탑승 후기"}</h3>
            <span>총 {safeReviews.length}건</span>
          </div>
          {safeReviews.length > 0 ? (
            <div className="user-profile-reviews-scroll">
              {safeReviews.map((rev, idx) => (
                <article
                  className="user-profile-review-item"
                  key={`${rev?.author || "익명"}-${rev?.date || idx}-${idx}`}
                >
                  <div className="user-profile-review-item__top">
                    <strong
                      className={
                        onSelectUserProfile ? "clickable-profile-inline" : ""
                      }
                      role={onSelectUserProfile ? "button" : undefined}
                      tabIndex={onSelectUserProfile ? 0 : undefined}
                      onClick={(event) => {
                        if (!onSelectUserProfile) return
                        event.stopPropagation()
                        onSelectUserProfile({
                          name: rev?.author || "익명 학우",
                          role: isDriver ? "rider" : "driver",
                        })
                      }}
                      onKeyDown={(event) => {
                        if (
                          onSelectUserProfile &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault()
                          event.stopPropagation()
                          onSelectUserProfile({
                            name: rev?.author || "익명 학우",
                            role: isDriver ? "rider" : "driver",
                          })
                        }
                      }}
                    >
                      {rev?.author || "익명 학우"}
                    </strong>
                    <span>
                      <Star /> {(Number(rev?.score) || 5).toFixed(1)} ·{" "}
                      {rev?.date || "최근"}
                    </span>
                  </div>
                  <p>{rev?.text || "작성된 후기 내용이 없습니다."}</p>
                  {Array.isArray(rev?.tags) && rev.tags.length > 0 && (
                    <div className="review-tags">
                      {rev.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="user-profile-modal__empty">
              아직 등록된 후기가 없습니다.
            </div>
          )}
        </section>

        <Button type="button" onClick={onClose}>
          닫기
        </Button>
      </section>
    </div>
  )
}

function CustomTimePickerModal({
  isOpen,
  value,
  arrivalValue,
  initialField = "departure",
  minTime24,
  maxTime24,
  title = "시간 설정",
  subtitle = "변경한 시간은 기본 경로와 모든 예약·일정 데이터에 즉시 동기화됩니다.",
  onClose,
  onConfirm,
  onConfirmRange,
}: {
  isOpen: boolean
  value: string
  arrivalValue?: string
  initialField?: "departure" | "arrival"
  minTime24?: string
  maxTime24?: string
  title?: string
  subtitle?: string
  onClose: () => void
  onConfirm: (nextTime24: string) => void
  onConfirmRange?: (nextDeparture24: string, nextArrival24: string) => void
}) {
  const isDualMode = typeof onConfirmRange === "function"
  const [activeField, setActiveField] = useState<"departure" | "arrival">(
    initialField,
  )
  const [draftDeparture24, setDraftDeparture24] = useState(() =>
    minutesToTime24(Math.min(1438, toTotalMinutes24(value))),
  )
  const [draftArrival24, setDraftArrival24] = useState(() => {
    const resolved = resolveValidArrivalTime24(
      value || "08:30",
      arrivalValue || addMinutesToTime24(value || "08:30", 30),
    )
    return resolved.arrival24
  })
  const [autoAdjustNotice, setAutoAdjustNotice] = useState("")
  const [validationAlertMessage, setValidationAlertMessage] = useState("")

  const initialParsed = parseTime24(value)
  const [meridiem, setMeridiem] = useState<"오전" | "오후">(
    initialParsed.meridiem,
  )
  const [hour12, setHour12] = useState<number>(initialParsed.hour12)
  const [minute, setMinute] = useState<number>(initialParsed.minute)

  useEffect(() => {
    if (!isOpen) return
    const startField = isDualMode ? initialField : "departure"
    setActiveField(startField)
    setAutoAdjustNotice("")
    setValidationAlertMessage("")
    if (isDualMode) {
      const resolved = resolveValidArrivalTime24(
        value || "08:30",
        arrivalValue || addMinutesToTime24(value || "08:30", 30),
      )
      setDraftDeparture24(resolved.departure24)
      setDraftArrival24(resolved.arrival24)
      const parsedTarget = parseTime24(
        startField === "arrival" ? resolved.arrival24 : resolved.departure24,
      )
      setMeridiem(parsedTarget.meridiem)
      setHour12(parsedTarget.hour12)
      setMinute(parsedTarget.minute)
    } else {
      const parsed = parseTime24(value)
      setMeridiem(parsed.meridiem)
      setHour12(parsed.hour12)
      setMinute(parsed.minute)
    }
  }, [arrivalValue, initialField, isDualMode, isOpen, value])

  if (!isOpen) return null

  const effectiveMinMinutes = isDualMode
    ? activeField === "arrival"
      ? toTotalMinutes24(draftDeparture24)
      : null
    : minTime24
      ? toTotalMinutes24(minTime24)
      : null

  const effectiveMaxMinutes = isDualMode
    ? activeField === "departure"
      ? 1438
      : 1439
    : maxTime24
      ? toTotalMinutes24(maxTime24)
      : 1439

  const applySelectedParts = (
    nextMeridiem: "오전" | "오후",
    nextHour12: number,
    nextMinute: number,
  ) => {
    const candidate24 = toTime24String(nextMeridiem, nextHour12, nextMinute)
    const candidateMin = toTotalMinutes24(candidate24)

    if (effectiveMinMinutes !== null && candidateMin <= effectiveMinMinutes) {
      setValidationAlertMessage(
        "도착 시간은 출발 시간보다 이후로 설정해주세요.",
      )
      return
    }

    const clampedMin = Math.max(0, Math.min(effectiveMaxMinutes, candidateMin))
    const final24 = minutesToTime24(clampedMin)
    const finalParsed = parseTime24(final24)
    setMeridiem(finalParsed.meridiem)
    setHour12(finalParsed.hour12)
    setMinute(finalParsed.minute)

    if (isDualMode) {
      if (activeField === "departure") {
        const resolved = resolveValidArrivalTime24(final24, draftArrival24)
        setDraftDeparture24(resolved.departure24)
        setDraftArrival24(resolved.arrival24)
        if (resolved.autoAdjusted) {
          setAutoAdjustNotice(
            `출발 시간이 기존 도착 시간과 같거나 늦어, 도착 시간이 ${formatKoreanTimeLabel(resolved.arrival24)}(${resolved.arrival24})으로 자동 조정되었습니다.`,
          )
        } else {
          setAutoAdjustNotice("")
        }
      } else {
        setDraftArrival24(final24)
        setAutoAdjustNotice("")
      }
    }
  }

  const switchDualTab = (target: "departure" | "arrival") => {
    setActiveField(target)
    const source24 = target === "departure" ? draftDeparture24 : draftArrival24
    const parsed = parseTime24(source24)
    setMeridiem(parsed.meridiem)
    setHour12(parsed.hour12)
    setMinute(parsed.minute)
  }

  const preview24 = toTime24String(meridiem, hour12, minute)
  const previewMinutes = toTotalMinutes24(preview24)
  const previewKorean = `${meridiem} ${hour12}:${String(minute).padStart(2, "0")}`
  const minutePresets = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const isMeridiemDisabled = (targetMeridiem: "오전" | "오후") => {
    if (effectiveMinMinutes === null) return false
    // 오전의 마지막 시간은 11:59 (719분). 출발 시간이 719분 이상이면 오전 전체 선택 불가
    if (targetMeridiem === "오전" && effectiveMinMinutes >= 719) return true
    return false
  }

  const isHourDisabled = (h: number) => {
    const maxMinInHour = toTotalMinutes24(toTime24String(meridiem, h, 59))
    const minMinInHour = toTotalMinutes24(toTime24String(meridiem, h, 0))
    if (effectiveMinMinutes !== null && maxMinInHour <= effectiveMinMinutes) {
      return true
    }
    if (minMinInHour > effectiveMaxMinutes) {
      return true
    }
    return false
  }

  const isMinuteDisabled = (m: number) => {
    const candidateMin = toTotalMinutes24(toTime24String(meridiem, hour12, m))
    if (effectiveMinMinutes !== null && candidateMin <= effectiveMinMinutes) {
      return true
    }
    if (candidateMin > effectiveMaxMinutes) {
      return true
    }
    return false
  }

  const handleConfirmClick = () => {
    if (isDualMode && onConfirmRange) {
      const depMin = toTotalMinutes24(draftDeparture24)
      const arrMin = toTotalMinutes24(draftArrival24)
      if (arrMin <= depMin) {
        setValidationAlertMessage(
          "도착 시간은 출발 시간보다 이후로 설정해주세요.",
        )
        return
      }
      onConfirmRange(draftDeparture24, draftArrival24)
      onClose()
      return
    }

    if (effectiveMinMinutes !== null && previewMinutes <= effectiveMinMinutes) {
      setValidationAlertMessage(
        "도착 시간은 출발 시간보다 이후로 설정해주세요.",
      )
      return
    }
    const safeFinal24 = minutesToTime24(
      Math.max(0, Math.min(effectiveMaxMinutes, previewMinutes)),
    )
    onConfirm(safeFinal24)
    onClose()
  }

  return (
    <div
      className="dialog-backdrop custom-picker-backdrop fixed inset-0 flex items-center justify-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="app-dialog custom-time-dialog w-[90%] max-w-[380px]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="custom-picker-header">
          <div>
            <span className="eyebrow">QUICK TIME PICKER</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="닫기"
          >
            <X />
          </button>
        </div>
        {subtitle && <p className="custom-picker-sub">{subtitle}</p>}
        {isDualMode ? (
          <div className="time-dual-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeField === "departure"}
              className={activeField === "departure" ? "active" : ""}
              onClick={() => switchDualTab("departure")}
            >
              <small>희망 출발 시간</small>
              <strong>
                {formatKoreanTimeLabel(draftDeparture24)} ({draftDeparture24})
              </strong>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeField === "arrival"}
              className={activeField === "arrival" ? "active" : ""}
              onClick={() => switchDualTab("arrival")}
            >
              <small>희망 도착 시간</small>
              <strong>
                {formatKoreanTimeLabel(draftArrival24)} ({draftArrival24})
              </strong>
            </button>
          </div>
        ) : (
          <div className="time-picker-preview">
            <Clock3 />
            <div>
              <span>
                {effectiveMinMinutes !== null
                  ? `선택된 도착 시간 (출발 ${minutesToTime24(effectiveMinMinutes)} 이후)`
                  : "선택된 시간"}
              </span>
              <strong>
                {previewKorean} <small>({preview24})</small>
              </strong>
            </div>
          </div>
        )}
        {autoAdjustNotice && (
          <div className="email-code-notice time-auto-adjust-banner">
            <Clock3 />
            <span>{autoAdjustNotice}</span>
          </div>
        )}
        <div className="time-picker-section">
          <span className="time-picker-label">오전 / 오후</span>
          <div className="time-meridiem-toggle">
            {(["오전", "오후"] as const).map((item) => {
              const disabled = isMeridiemDisabled(item)
              return (
                <button
                  type="button"
                  key={item}
                  disabled={disabled}
                  className={meridiem === item ? "active" : ""}
                  onClick={() => {
                    if (disabled) {
                      setValidationAlertMessage(
                        "도착 시간은 출발 시간보다 이후로 설정해주세요.",
                      )
                      return
                    }
                    const candidateMin = toTotalMinutes24(
                      toTime24String(item, hour12, minute),
                    )
                    if (
                      effectiveMinMinutes !== null &&
                      candidateMin <= effectiveMinMinutes
                    ) {
                      const safeNextMin = Math.min(
                        1439,
                        effectiveMinMinutes + 10 <= 1439
                          ? effectiveMinMinutes + 10
                          : effectiveMinMinutes + 1,
                      )
                      const nextParsed = parseTime24(minutesToTime24(safeNextMin))
                      applySelectedParts(
                        nextParsed.meridiem,
                        nextParsed.hour12,
                        nextParsed.minute,
                      )
                      return
                    }
                    applySelectedParts(item, hour12, minute)
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
        <div className="time-picker-section">
          <span className="time-picker-label">시 (Hour)</span>
          <div className="time-hour-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
              const disabled = isHourDisabled(h)
              return (
                <button
                  type="button"
                  key={h}
                  disabled={disabled}
                  className={hour12 === h ? "active" : ""}
                  onClick={() => {
                    if (disabled) {
                      setValidationAlertMessage(
                        "도착 시간은 출발 시간보다 이후로 설정해주세요.",
                      )
                      return
                    }
                    let nextMin = minute
                    const candidateMin = toTotalMinutes24(
                      toTime24String(meridiem, h, nextMin),
                    )
                    if (
                      effectiveMinMinutes !== null &&
                      candidateMin <= effectiveMinMinutes
                    ) {
                      const minRequired = Math.min(1439, effectiveMinMinutes + 5)
                      const reqParsed = parseTime24(minutesToTime24(minRequired))
                      nextMin =
                        reqParsed.hour12 === h &&
                        reqParsed.meridiem === meridiem
                          ? reqParsed.minute
                          : 59
                    }
                    applySelectedParts(meridiem, h, nextMin)
                  }}
                >
                  {h}시
                </button>
              )
            })}
          </div>
        </div>
        <div className="time-picker-section">
          <div className="time-minute-header">
            <span className="time-picker-label">분 (Minute)</span>
            <div className="time-minute-stepper">
              <button
                type="button"
                disabled={
                  previewMinutes <= 0 ||
                  (effectiveMinMinutes !== null &&
                    previewMinutes - 1 <= effectiveMinMinutes)
                }
                onClick={() => {
                  const nextTotal = Math.max(0, previewMinutes - 1)
                  if (
                    effectiveMinMinutes !== null &&
                    nextTotal <= effectiveMinMinutes
                  ) {
                    setValidationAlertMessage(
                      "도착 시간은 출발 시간보다 이후로 설정해주세요.",
                    )
                    return
                  }
                  const parsed = parseTime24(minutesToTime24(nextTotal))
                  applySelectedParts(
                    parsed.meridiem,
                    parsed.hour12,
                    parsed.minute,
                  )
                }}
              >
                -1분
              </button>
              <strong>{String(minute).padStart(2, "0")}분</strong>
              <button
                type="button"
                disabled={previewMinutes >= effectiveMaxMinutes}
                onClick={() => {
                  const nextTotal = Math.min(
                    effectiveMaxMinutes,
                    previewMinutes + 1,
                  )
                  const parsed = parseTime24(minutesToTime24(nextTotal))
                  applySelectedParts(
                    parsed.meridiem,
                    parsed.hour12,
                    parsed.minute,
                  )
                }}
              >
                +1분
              </button>
            </div>
          </div>
          <div className="time-minute-grid">
            {minutePresets.map((m) => {
              const disabled = isMinuteDisabled(m)
              return (
                <button
                  type="button"
                  key={m}
                  disabled={disabled}
                  className={minute === m ? "active" : ""}
                  onClick={() => {
                    if (disabled) {
                      setValidationAlertMessage(
                        "도착 시간은 출발 시간보다 이후로 설정해주세요.",
                      )
                      return
                    }
                    applySelectedParts(meridiem, hour12, m)
                  }}
                >
                  {String(m).padStart(2, "0")}분
                </button>
              )
            })}
          </div>
        </div>
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="button" onClick={handleConfirmClick}>
            적용 (확인)
          </Button>
        </div>
        {validationAlertMessage && (
          <div
            className="dialog-backdrop flow-dialog-backdrop time-validation-alert-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setValidationAlertMessage("")
            }}
          >
            <section
              className="app-dialog"
              role="alertdialog"
              aria-modal="true"
            >
              <span className="dialog-icon neutral">
                <Clock3 />
              </span>
              <h2>시간 설정 안내</h2>
              <p>{validationAlertMessage}</p>
              <Button
                type="button"
                onClick={() => setValidationAlertMessage("")}
              >
                확인
              </Button>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}


type StoredMemberRecord = {
  id: string
  loginId: string
  email: string
  password: string
  name: string
  phone?: string
  gender?: string
  role?: Role
  isDriverVerified?: boolean
  licenseFileName?: string
  vehicleName?: string
  vehicleCapacity?: number
}

const DEFAULT_REGISTERED_USERS: StoredMemberRecord[] = []

function Auth({
  view,
  setView,
  onLogin,
}: {
  view: AuthView
  setView: (view: AuthView) => void
  onLogin: (
    role: Role,
    userProfile?: Partial<AccountData>,
    isNewSignup?: boolean,
  ) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role>("rider")
  const [signupEmail, setSignupEmail] = useState("")
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailVerifying, setEmailVerifying] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [issuedCode, setIssuedCode] = useState("")
  const [emailError, setEmailError] = useState("")
  const [emailNotice, setEmailNotice] = useState("")
  const [verified, setVerified] = useState(false)
  const [signupName, setSignupName] = useState("")
  const [signupId, setSignupId] = useState("")
  const [idChecked, setIdChecked] = useState(false)
  const [signupPassword, setSignupPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [phone, setPhone] = useState("")
  const [signupGender, setSignupGender] = useState("")
  const [signupTermsAgreed, setSignupTermsAgreed] = useState(true)
  const [driverLicenseSelected, setDriverLicenseSelected] = useState(false)
  const [driverLicenseFile, setDriverLicenseFile] = useState<File | null>(null)
  const [driverLicenseFileName, setDriverLicenseFileName] = useState("")
  const [driverLicenseFileSize, setDriverLicenseFileSize] = useState("")
  const [driverLicensePreview, setDriverLicensePreview] = useState<string | null>(null)
  const [driverLicenseIsPdf, setDriverLicenseIsPdf] = useState(false)
  const [driverLicenseError, setDriverLicenseError] = useState("")
  const [vehicleName, setVehicleName] = useState("")
  const [vehicleCapacity, setVehicleCapacity] = useState("5")
  const [loginId, setLoginId] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [resetId, setResetId] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [resetVerified, setResetVerified] = useState(false)
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState("")
  const [resetInlineError, setResetInlineError] = useState("")
  const [foundMember, setFoundMember] = useState<StoredMemberRecord | null>(null)
  const [resetModal, setResetModal] = useState<{
    type: "error" | "password"
    title: string
    message: string
    password?: string
    loginId?: string
    email?: string
  } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")
  const [biometricLoginModal, setBiometricLoginModal] = useState<{
    supported: boolean
    title: string
    message: string
  } | null>(null)
  const isBiometricLoginEnabled = getBiometricDemoState()
  const safeView: AuthView =
    view === "signup" || view === "reset" ? view : "login"

  const getRegisteredMembers = (): StoredMemberRecord[] => {
    const rawSavedList = readDemoData<StoredMemberRecord[]>(
      "registered-users",
      DEFAULT_REGISTERED_USERS,
    )
    const savedList = Array.isArray(rawSavedList) ? rawSavedList : []
    const merged = savedList.filter(Boolean)
    for (const def of DEFAULT_REGISTERED_USERS) {
      if (
        !merged.some(
          (item) =>
            (item?.loginId || "").toLowerCase() ===
              (def?.loginId || "").toLowerCase() &&
            (item?.email || "").toLowerCase() ===
              (def?.email || "").toLowerCase(),
        )
      ) {
        merged.push(def)
      }
    }
    const savedAccount = readDemoData<AccountData>("account", defaultAccount)
    if (savedAccount?.email && (savedAccount.loginId || savedAccount.id)) {
      const accLoginId = savedAccount.loginId || savedAccount.id || ""
      if (
        !merged.some(
          (item) =>
            (item?.email || "").toLowerCase() ===
              (savedAccount.email || "").toLowerCase() &&
            ((item?.loginId || "").toLowerCase() === accLoginId.toLowerCase() ||
              (item?.id || "").toLowerCase() === accLoginId.toLowerCase()),
        )
      ) {
        merged.unshift({
          id: savedAccount.id || accLoginId,
          loginId: accLoginId,
          email: savedAccount.email,
          password: savedAccount.password || "shingu1234!",
          name: savedAccount.name || "사용자",
          phone: savedAccount.phone,
          gender: savedAccount.gender,
          isDriverVerified: savedAccount.isDriverVerified,
          licenseFileName: savedAccount.licenseFileName,
          vehicleName: savedAccount.vehicleName,
          vehicleCapacity: savedAccount.vehicleCapacity,
        })
      }
    }
    return merged
  }

  const upsertRegisteredMember = (record: StoredMemberRecord) => {
    const current = getRegisteredMembers()
    const filtered = current.filter(
      (item) =>
        !(
          (item?.loginId || "").toLowerCase() ===
            (record?.loginId || "").toLowerCase() ||
          (item?.email || "").toLowerCase() ===
            (record?.email || "").toLowerCase()
        ),
    )
    const updated = [record, ...filtered]
    writeDemoData("registered-users", updated)
  }

  const isValidSchoolEmail = (value: string) => {
    const trimmed = (value || "").trim().toLowerCase()
    return /^[^\s@]+@(g\.)?shingu\.ac\.kr$/i.test(trimmed)
  }

  const performBiometricAutoLogin = () => {
    const savedBio = getBiometricAccount()
    if (savedBio?.account?.email || savedBio?.account?.name) {
      onLogin(savedBio.role || "rider", savedBio.account)
      return
    }
    const storedAccount = readDemoData<AccountData>("account", defaultAccount)
    const savedRole = (readDemoValue("demo-role") as Role) || "rider"
    if (storedAccount?.email || storedAccount?.name) {
      onLogin(savedRole, storedAccount)
      return
    }
    void showAppAlert({
      title: "등록된 생체인증 계정 없음",
      message:
        "먼저 로그인 또는 회원가입 후 보안 설정에서 생체인증을 등록해 주세요.",
    })
  }

  const handleBiometricLoginClick = async () => {
    setAuthError("")
    try {
      const hardware = await checkBiometricHardwareSupport()
      if (hardware.supported) {
        performBiometricAutoLogin()
        return
      }
      setBiometricLoginModal({
        supported: false,
        title: "생체인증 센서 확인 안내",
        message:
          hardware.reason ||
          "현재 기기 또는 브라우저에서는 생체인증(지문/Face ID) 하드웨어를 지원하지 않습니다. 일반 아이디/비밀번호 로그인을 유지하거나 테스트 생체인증 확인으로 로그인할 수 있습니다.",
      })
    } catch {
      setBiometricLoginModal({
        supported: false,
        title: "생체인증 센서 미지원 환경",
        message:
          "생체인증 하드웨어를 사용할 수 없는 환경입니다. 일반 로그인을 이용해 주세요.",
      })
    }
  }

  const handleSendEmailCode = async () => {
    const targetEmail = signupEmail.trim()
    if (!targetEmail) {
      setEmailError("학교 이메일 주소를 입력해 주세요.")
      setEmailNotice("")
      return
    }
    if (!isValidSchoolEmail(targetEmail)) {
      setEmailError(
        "신구대학교 이메일(@g.shingu.ac.kr 또는 @shingu.ac.kr) 형식만 가입할 수 있습니다.",
      )
      setEmailNotice("")
      return
    }
    setEmailSending(true)
    setEmailError("")
    setEmailNotice("")
    try {
      const result = await supabaseSendSchoolEmailOtp(targetEmail)
      setIssuedCode(result.fallbackCode)
      setEmailCodeSent(true)
      setVerified(false)
      setVerificationCode("")
      if (result.sentViaServer) {
        setEmailNotice(
          `${targetEmail}로 인증번호가 발송되었습니다. 메일함을 확인하거나 테스트 인증번호(${result.fallbackCode})를 입력해 주세요.`,
        )
      } else {
        setEmailNotice(
          `${targetEmail}로 인증번호가 발송되었습니다. (테스트 인증번호: ${result.fallbackCode})`,
        )
      }
    } catch {
      const fallback = String(Math.floor(100000 + Math.random() * 900000))
      setIssuedCode(fallback)
      setEmailCodeSent(true)
      setVerified(false)
      setVerificationCode("")
      setEmailNotice(
        `${targetEmail}로 인증번호가 발송되었습니다. (테스트 인증번호: ${fallback})`,
      )
    } finally {
      setEmailSending(false)
    }
  }

  const handleVerifyEmailCode = async () => {
    if (!emailCodeSent) {
      setEmailError("먼저 인증번호 발송 버튼을 눌러주세요.")
      return
    }
    const code = verificationCode.trim()
    if (!code) {
      setEmailError("인증번호를 입력해 주세요.")
      return
    }
    setEmailVerifying(true)
    setEmailError("")
    try {
      const isValid = await supabaseVerifySchoolEmailOtp(
        signupEmail.trim(),
        code,
        issuedCode,
      )
      if (isValid || (issuedCode && code === issuedCode)) {
        setVerified(true)
        setEmailError("")
        setEmailNotice("")
      } else {
        setVerified(false)
        setEmailError("인증번호가 일치하지 않습니다. 발송된 인증번호를 다시 확인해 주세요.")
      }
    } catch {
      if (issuedCode && code === issuedCode) {
        setVerified(true)
        setEmailError("")
        setEmailNotice("")
      } else {
        setVerified(false)
        setEmailError("인증번호 확인 중 오류가 발생했습니다. 인증번호를 다시 확인해 주세요.")
      }
    } finally {
      setEmailVerifying(false)
    }
  }

  const handleDriverLicenseUpload = (files: FileList | null) => {
    if (!files || files.length === 0) {
      setDriverLicenseSelected(false)
      setDriverLicenseFile(null)
      setDriverLicenseFileName("")
      setDriverLicenseFileSize("")
      setDriverLicensePreview(null)
      setDriverLicenseIsPdf(false)
      return
    }
    const file = files[0]
    const isImage = file.type.startsWith("image/")
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isImage && !isPdf) {
      setDriverLicenseError("운전면허증은 이미지(JPG, PNG 등) 또는 PDF 파일만 업로드할 수 있습니다.")
      setDriverLicenseSelected(false)
      setDriverLicenseFile(null)
      return
    }
    setDriverLicenseError("")
    setDriverLicenseSelected(true)
    setDriverLicenseFile(file)
    setDriverLicenseFileName(file.name)
    const sizeKb = Math.max(1, Math.round(file.size / 1024))
    setDriverLicenseFileSize(
      sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
    )
    setDriverLicenseIsPdf(isPdf)
    if (isImage) {
      const reader = new FileReader()
      reader.onload = () => {
        setDriverLicensePreview(typeof reader.result === "string" ? reader.result : null)
      }
      reader.onerror = () => {
        setDriverLicensePreview(null)
      }
      reader.readAsDataURL(file)
    } else {
      setDriverLicensePreview(null)
    }
  }

  const handleLogin = async (targetRole: Role) => {
    if (!loginId.trim() || !loginPassword.trim()) {
      setAuthError("아이디와 비밀번호를 입력해 주세요.")
      return
    }
    setAuthLoading(true)
    setAuthError("")
    const trimmedLoginId = loginId.trim()
    const matchedLocal = getRegisteredMembers().find(
      (item) =>
        item.loginId.toLowerCase() === trimmedLoginId.toLowerCase() ||
        item.id.toLowerCase() === trimmedLoginId.toLowerCase() ||
        item.email.toLowerCase() === trimmedLoginId.toLowerCase(),
    )
    const email = matchedLocal?.email
      ? matchedLocal.email
      : trimmedLoginId.includes("@")
        ? trimmedLoginId
        : `${trimmedLoginId}@shingu.ac.kr`
    try {
      if (isSupabaseConfigured()) {
        try {
          const result = await supabaseSignIn(email, loginPassword)
          const user = result?.user
          const meta = user?.user_metadata
          const dbProfile = user?.id ? await supabaseGetProfile(user.id) : null
          const resolvedRole: Role =
            dbProfile?.role ||
            (meta?.role === "driver" || meta?.role === "rider"
              ? meta.role
              : matchedLocal?.role || targetRole)
          const loggedInProfile: AccountData = {
            name:
              dbProfile?.name ||
              meta?.name ||
              matchedLocal?.name ||
              email.split("@")[0] ||
              "사용자",
            email: user?.email || email,
            id: user?.id || trimmedLoginId,
            loginId: dbProfile?.loginId || trimmedLoginId,
            password: loginPassword,
            phone: dbProfile?.phone || meta?.phone || matchedLocal?.phone || "",
            gender:
              dbProfile?.gender ||
              meta?.gender ||
              matchedLocal?.gender ||
              "선택 안 함",
            isDriverVerified:
              Boolean(dbProfile?.isDriverVerified) ||
              Boolean(meta?.isDriverVerified) ||
              Boolean(matchedLocal?.isDriverVerified),
            licenseFileName:
              dbProfile?.licenseFileName ||
              meta?.licenseFileName ||
              matchedLocal?.licenseFileName,
            vehicleName:
              dbProfile?.vehicleName ||
              meta?.vehicleName ||
              matchedLocal?.vehicleName,
            vehicleCapacity:
              dbProfile?.vehicleCapacity ||
              (meta?.vehicleCapacity
                ? Number(meta.vehicleCapacity)
                : matchedLocal?.vehicleCapacity),
          }
          upsertRegisteredMember({
            ...loggedInProfile,
            loginId: trimmedLoginId,
            password: loginPassword,
            role: resolvedRole,
          })
          onLogin(resolvedRole, loggedInProfile)
          return
        } catch (supabaseErr) {
          if (matchedLocal && matchedLocal.password === loginPassword) {
            onLogin(matchedLocal.role || targetRole, {
              name: matchedLocal.name,
              email: matchedLocal.email,
              id: matchedLocal.loginId,
              loginId: matchedLocal.loginId,
              password: matchedLocal.password,
              phone: matchedLocal.phone || "",
              gender: matchedLocal.gender || "선택 안 함",
              isDriverVerified: matchedLocal.isDriverVerified,
              licenseFileName: matchedLocal.licenseFileName,
              vehicleName: matchedLocal.vehicleName,
              vehicleCapacity: matchedLocal.vehicleCapacity,
            })
            return
          }
          throw supabaseErr
        }
      }
      if (matchedLocal && matchedLocal.password === loginPassword) {
        onLogin(matchedLocal.role || targetRole, {
          name: matchedLocal.name,
          email: matchedLocal.email,
          id: matchedLocal.loginId,
          loginId: matchedLocal.loginId,
          password: matchedLocal.password,
          phone: matchedLocal.phone || "",
          gender: matchedLocal.gender || "선택 안 함",
          isDriverVerified: matchedLocal.isDriverVerified,
          licenseFileName: matchedLocal.licenseFileName,
          vehicleName: matchedLocal.vehicleName,
          vehicleCapacity: matchedLocal.vehicleCapacity,
        })
        return
      }
      onLogin(targetRole, {
        id: trimmedLoginId,
        loginId: trimmedLoginId,
        name: trimmedLoginId,
        email,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다."
      setAuthError(
        msg.includes("Invalid login credentials")
          ? "아이디 또는 비밀번호가 일치하지 않습니다."
          : msg,
      )
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignupComplete = async () => {
    if (!signupEmail.trim()) {
      setStep(1)
      await showAppAlert({
        title: "이메일 미입력",
        message: "학교 이메일 주소를 입력해주세요.",
      })
      return
    }
    if (!isValidSchoolEmail(signupEmail)) {
      setStep(1)
      setEmailError(
        "신구대학교 이메일(@g.shingu.ac.kr 또는 @shingu.ac.kr) 형식만 가입할 수 있습니다.",
      )
      await showAppAlert({
        title: "학교 이메일 확인",
        message:
          "신구대학교 이메일(@g.shingu.ac.kr 또는 @shingu.ac.kr) 형식만 가입할 수 있습니다.",
      })
      return
    }
    if (!signupName.trim()) {
      setStep(3)
      await showAppAlert({
        title: "이름 미입력",
        message: "이름을 입력해주세요.",
      })
      return
    }
    if (!signupId.trim()) {
      setStep(3)
      await showAppAlert({
        title: "아이디 미입력",
        message: "아이디를 입력해주세요.",
      })
      return
    }
    if (signupId.trim().length < 4) {
      setStep(3)
      await showAppAlert({
        title: "아이디 확인",
        message: "아이디는 4자 이상 입력해 주세요.",
      })
      return
    }
    if (!signupPassword.trim()) {
      setStep(3)
      await showAppAlert({
        title: "비밀번호 미입력",
        message: "비밀번호를 입력해주세요.",
      })
      return
    }
    if (signupPassword.trim().length < 6) {
      setStep(3)
      await showAppAlert({
        title: "비밀번호 확인",
        message: "비밀번호는 6자 이상 입력해 주세요.",
      })
      return
    }
    if (!passwordConfirm.trim()) {
      setStep(3)
      await showAppAlert({
        title: "비밀번호 확인 미입력",
        message: "비밀번호 확인란을 입력해주세요.",
      })
      return
    }
    if (signupPassword !== passwordConfirm) {
      setStep(3)
      await showAppAlert({
        title: "비밀번호 불일치",
        message: "비밀번호가 일치하지 않습니다.",
      })
      return
    }
    const cleanPhone = phone.trim()
    if (!cleanPhone) {
      setStep(3)
      await showAppAlert({
        title: "전화번호 미입력",
        message: "전화번호를 입력해주세요.",
      })
      return
    }
    if (!isValidPhoneNumber(cleanPhone)) {
      setStep(3)
      await showAppAlert({
        title: "전화번호 형식 확인",
        message: "휴대폰 번호 11자리를 올바르게 입력해 주세요. (예: 010-1234-5678)",
      })
      return
    }
    if (!signupGender.trim() || signupGender === "선택하지 않음") {
      setStep(3)
      await showAppAlert({
        title: "성별 미선택",
        message: "성별을 선택해주세요.",
      })
      return
    }
    if (!signupTermsAgreed) {
      setStep(3)
      await showAppAlert({
        title: "약관 동의 필요",
        message: "필수 약관 및 개인정보 처리방침에 동의해 주세요.",
      })
      return
    }
    if (role === "driver") {
      if (!driverLicenseSelected) {
        setStep(4)
        setDriverLicenseError("운전면허증 파일(이미지 또는 PDF)을 업로드해 주세요.")
        await showAppAlert({
          title: "면허증 확인",
          message: "운전면허증 파일을 업로드해 주세요.",
        })
        return
      }
      const trimmedVehicle = vehicleName.trim()
      if (!trimmedVehicle) {
        setStep(4)
        await showAppAlert({
          title: "차종 입력 확인",
          message: "차종을 입력해 주세요. (예: 아반떼)",
        })
        return
      }
      if (!/^[a-zA-Z0-9가-힣\s\-]+$/.test(trimmedVehicle)) {
        setStep(4)
        await showAppAlert({
          title: "차종 형식 확인",
          message: "차종은 한글, 영문, 숫자로 입력해 주세요. (예: 아반떼, K5, GV70)",
        })
        return
      }
      const capNum = Number(vehicleCapacity.trim())
      if (!vehicleCapacity.trim() || !Number.isInteger(capNum) || capNum <= 0) {
        setStep(4)
        await showAppAlert({
          title: "차량 정원 확인",
          message: "차량 정원을 1명 이상 숫자로 입력해 주세요.",
        })
        return
      }
    }
    const normalizedPhone = normalizePhoneNumber(cleanPhone)

    setAuthLoading(true)
    const cleanSignupId = signupId.trim()
    const email =
      signupEmail.trim() ||
      (cleanSignupId.includes("@") ? cleanSignupId : `${cleanSignupId}@shingu.ac.kr`)
    const isDriverVerified = role === "driver" && driverLicenseSelected
    const profilePayload: Partial<AccountData> = {
      name: signupName.trim(),
      email,
      id: cleanSignupId,
      loginId: cleanSignupId,
      password: signupPassword,
      phone: normalizedPhone,
      gender: signupGender.trim(),
      role,
      isDriverVerified,
      licenseFileName: isDriverVerified ? driverLicenseFileName : undefined,
      vehicleName: role === "driver" ? vehicleName.trim() : undefined,
      vehicleCapacity: role === "driver" ? Number(vehicleCapacity) : undefined,
    }
    upsertRegisteredMember({
      id: cleanSignupId,
      loginId: cleanSignupId,
      email,
      password: signupPassword,
      name: signupName.trim(),
      phone: normalizedPhone,
      gender: signupGender.trim(),
      role,
      isDriverVerified,
      licenseFileName: isDriverVerified ? driverLicenseFileName : undefined,
      vehicleName: role === "driver" ? vehicleName.trim() : undefined,
      vehicleCapacity: role === "driver" ? Number(vehicleCapacity) : undefined,
    })
    if (isDriverVerified) {
      writeDemoData("driver-profile", {
        carModel: vehicleName.trim(),
        capacity: Number(vehicleCapacity) || 5,
        licenseVerified: true,
        licenseFileName: driverLicenseFileName,
      })
    }
    try {
      if (isSupabaseConfigured()) {
        try {
          const signUpRes = await supabaseSignUp(email, signupPassword, {
            name: signupName.trim(),
            studentId: cleanSignupId,
            phone: normalizedPhone,
            gender: signupGender.trim(),
            role,
            isDriverVerified,
            licenseFile: driverLicenseFile,
            licenseFileName: driverLicenseFileName,
            vehicleName: vehicleName.trim(),
            vehicleCapacity: Number(vehicleCapacity) || 4,
          })
          if (signUpRes?.user?.id) {
            profilePayload.id = signUpRes.user.id
          }
        } catch (supabaseErr) {
          console.warn("Supabase 회원가입 폴백 처리:", supabaseErr)
        }
      }
      // 별도의 이메일 인증 대기 화면 없이 자동 로그인되어 홈 화면으로 바로 진입
      showAppToast({
        message: "회원가입이 완료되어 자동으로 로그인되었습니다!",
        variant: "success",
      })
      onLogin(role, profilePayload, true)
    } catch (err) {
      await showAppAlert({
        title: "회원가입 실패",
        message: err instanceof Error ? err.message : "회원가입에 실패했습니다.",
        variant: "danger",
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleResetPassword = async () => {
    const trimmedId = (resetId || "").trim()
    const trimmedEmail = (resetEmail || "").trim()
    setResetInlineError("")
    if (!trimmedId || !trimmedEmail) {
      const msg = !trimmedId && !trimmedEmail
        ? "아이디와 신구대학교 이메일을 모두 입력해 주세요."
        : !trimmedId
          ? "아이디를 입력해 주세요."
          : "신구대학교 이메일을 입력해 주세요."
      setResetInlineError(msg)
      await showAppAlert({
        title: "입력 정보를 확인해 주세요",
        message: msg,
      })
      return
    }
    const members = getRegisteredMembers()
    const matched = members.find((member) => {
      const memberEmail = (member?.email || "").toLowerCase()
      const memberLoginId = (member?.loginId || "").toLowerCase()
      const memberId = (member?.id || "").toLowerCase()
      const emailMatch = memberEmail === trimmedEmail.toLowerCase()
      const emailPrefix = memberEmail.split("@")[0]?.toLowerCase() || ""
      const idMatch =
        memberLoginId === trimmedId.toLowerCase() ||
        memberId === trimmedId.toLowerCase() ||
        emailPrefix === trimmedId.toLowerCase()
      return emailMatch || idMatch
    })
    const resolvedMember: StoredMemberRecord = matched || {
      id: trimmedId,
      loginId: trimmedId,
      email: trimmedEmail,
      password: "shingu1234!",
      name: trimmedId,
      role: "rider",
    }
    // 이메일 인증번호 단계를 거치지 않고 즉시 데모 모드로 다음 단계 진행
    setFoundMember(resolvedMember)
    setResetVerified(true)
    setResetInlineError("")
  }

  const handleSaveResetNewPassword = async () => {
    if (!foundMember) return
    const nextPw = resetNewPassword.trim()
    const nextPwConfirm = resetNewPasswordConfirm.trim()
    if (!nextPw) {
      await showAppAlert({
        title: "비밀번호 미입력",
        message: "새 비밀번호를 입력해 주세요.",
      })
      return
    }
    if (nextPw.length < 6) {
      await showAppAlert({
        title: "비밀번호 확인",
        message: "비밀번호는 6자 이상 입력해 주세요.",
      })
      return
    }
    if (!nextPwConfirm) {
      await showAppAlert({
        title: "비밀번호 확인 미입력",
        message: "새 비밀번호 확인란을 입력해 주세요.",
      })
      return
    }
    if (nextPw !== nextPwConfirm) {
      await showAppAlert({
        title: "비밀번호 불일치",
        message: "새 비밀번호가 일치하지 않습니다.",
      })
      return
    }
    const updatedMember: StoredMemberRecord = {
      ...foundMember,
      password: nextPw,
    }
    upsertRegisteredMember(updatedMember)
    setFoundMember(updatedMember)
    const savedAccount = readDemoData<AccountData>("account", defaultAccount)
    if (
      savedAccount &&
      (savedAccount.loginId === foundMember.loginId ||
        savedAccount.email === foundMember.email)
    ) {
      writeDemoData("account", { ...savedAccount, password: nextPw })
    }
    await showAppAlert({
      title: "비밀번호 변경 완료",
      message: "새 비밀번호가 설정되었습니다. 변경된 비밀번호로 로그인해 주세요.",
      variant: "success",
    })
    setLoginId(foundMember.loginId)
    setResetNewPassword("")
    setResetNewPasswordConfirm("")
    setResetVerified(false)
    setView("login")
  }

  const totalSignupSteps = role === "driver" ? 4 : 3

  const handleNextSignupStep = async () => {
    if (step === 1) {
      if (!signupEmail.trim()) {
        setEmailError("학교 이메일 주소를 입력해 주세요.")
        await showAppAlert({
          title: "이메일 미입력",
          message: "학교 이메일 주소를 입력해주세요.",
        })
        return
      }
      if (!isValidSchoolEmail(signupEmail)) {
        setEmailError(
          "신구대학교 이메일(@g.shingu.ac.kr 또는 @shingu.ac.kr) 형식만 가입할 수 있습니다.",
        )
        await showAppAlert({
          title: "이메일 형식 확인",
          message:
            "신구대학교 이메일(@g.shingu.ac.kr 또는 @shingu.ac.kr) 형식만 가입할 수 있습니다.",
        })
        return
      }
      setVerified(true)
      setEmailError("")
      setStep(2)
      return
    }
    if (step === 2) {
      if (!role) {
        await showAppAlert({
          title: "역할 선택 확인",
          message: "이용하실 역할(운전자 또는 탑승자)을 선택해주세요.",
        })
        return
      }
      setStep(3)
      return
    }
    if (step === 3) {
      if (!signupName.trim()) {
        await showAppAlert({
          title: "이름 미입력",
          message: "이름을 입력해주세요.",
        })
        return
      }
      if (!signupId.trim()) {
        await showAppAlert({
          title: "아이디 미입력",
          message: "아이디를 입력해주세요.",
        })
        return
      }
      if (signupId.trim().length < 4) {
        await showAppAlert({
          title: "아이디 확인",
          message: "아이디는 4자 이상 입력해 주세요.",
        })
        return
      }
      if (!signupPassword.trim()) {
        await showAppAlert({
          title: "비밀번호 미입력",
          message: "비밀번호를 입력해주세요.",
        })
        return
      }
      if (signupPassword.trim().length < 6) {
        await showAppAlert({
          title: "비밀번호 확인",
          message: "비밀번호는 6자 이상 입력해 주세요.",
        })
        return
      }
      if (!passwordConfirm.trim()) {
        await showAppAlert({
          title: "비밀번호 확인 미입력",
          message: "비밀번호 확인란을 입력해주세요.",
        })
        return
      }
      if (signupPassword !== passwordConfirm) {
        await showAppAlert({
          title: "비밀번호 불일치",
          message: "비밀번호가 일치하지 않습니다.",
        })
        return
      }
      const cleanPhone = phone.trim()
      if (!cleanPhone) {
        await showAppAlert({
          title: "전화번호 미입력",
          message: "전화번호를 입력해주세요.",
        })
        return
      }
      if (!isValidPhoneNumber(cleanPhone)) {
        await showAppAlert({
          title: "전화번호 형식 확인",
          message: "휴대폰 번호 11자리를 올바르게 입력해 주세요. (예: 010-1234-5678)",
        })
        return
      }
      if (!signupGender.trim() || signupGender === "선택하지 않음") {
        await showAppAlert({
          title: "성별 미선택",
          message: "성별을 선택해주세요.",
        })
        return
      }
      if (!signupTermsAgreed) {
        await showAppAlert({
          title: "약관 동의 필요",
          message: "필수 약관 및 개인정보 처리방침에 동의해 주세요.",
        })
        return
      }
      if (role === "driver") {
        setStep(4)
        return
      }
      await handleSignupComplete()
      return
    }
    if (step === 4 && role === "driver") {
      if (!driverLicenseSelected) {
        setDriverLicenseError("운전면허증 파일(이미지 또는 PDF)을 업로드해 주세요.")
        await showAppAlert({
          title: "면허증 확인",
          message: "운전면허증 파일을 업로드해 주세요.",
        })
        return
      }
      const trimmedVehicle = vehicleName.trim()
      if (!trimmedVehicle) {
        await showAppAlert({
          title: "차종 입력 확인",
          message: "차종을 입력해 주세요. (예: 아반떼)",
        })
        return
      }
      if (!/^[a-zA-Z0-9가-힣\s\-]+$/.test(trimmedVehicle)) {
        await showAppAlert({
          title: "차종 형식 확인",
          message: "차종은 한글, 영문, 숫자로 입력해 주세요. (예: 아반떼, K5, GV70)",
        })
        return
      }
      const capNum = Number(vehicleCapacity.trim())
      if (!vehicleCapacity.trim() || !Number.isInteger(capNum) || capNum <= 0) {
        await showAppAlert({
          title: "차량 정원 확인",
          message: "차량 정원을 1명 이상 숫자로 입력해 주세요.",
        })
        return
      }
      await handleSignupComplete()
      return
    }
  }

  if (safeView === "reset") {
    return (
      <main className="auth auth--reset">
        <button
          type="button"
          className="icon-button auth__back"
          onClick={() => {
            if (resetVerified) {
              setResetVerified(false)
              setFoundMember(null)
              return
            }
            setResetModal(null)
            setResetInlineError("")
            setView("login")
          }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft />
        </button>
        <div className="auth__header">
          <span className="eyebrow">계정 찾기 · 데모 모드</span>
          <h1>{resetVerified ? "비밀번호 확인 및 재설정" : "비밀번호 찾기"}</h1>
          <p>
            {resetVerified
              ? "확인된 계정의 기존 비밀번호를 확인하거나 새 비밀번호를 설정할 수 있습니다."
              : "가입한 아이디와 신구대학교 이메일을 입력하면 바로 다음 단계로 진행됩니다."}
          </p>
        </div>
        {!resetVerified ? (
          <div className="form-stack">
            <Field
              label="아이디"
              placeholder="가입한 아이디 입력"
              value={resetId}
              onChange={(event) => {
                setResetId(event.target.value)
                setResetVerified(false)
                setFoundMember(null)
                setResetInlineError("")
              }}
            />
            <Field
              label="신구대학교 이메일"
              type="email"
              placeholder="student@shingu.ac.kr"
              value={resetEmail}
              onChange={(event) => {
                setResetEmail(event.target.value)
                setResetVerified(false)
                setFoundMember(null)
                setResetInlineError("")
              }}
            />
            {resetInlineError && (
              <span className="field-error">{resetInlineError}</span>
            )}
            <Button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={authLoading}
            >
              {authLoading ? "확인 중..." : "다음 (비밀번호 확인)"}
            </Button>
            <p className="helper">
              데모 모드에서는 이메일 인증번호 입력 단계 없이 즉시 비밀번호 확인 및 재설정 화면으로 이동합니다.
            </p>
          </div>
        ) : (
          foundMember && (
            <div className="form-stack">
              <section className="reset-password-card" aria-live="polite">
                <div className="reset-password-card__head">
                  <ShieldCheck />
                  <div>
                    <strong>계정 확인 완료 · 기존 비밀번호 안내</strong>
                    <small>
                      {foundMember.loginId} ({foundMember.email})
                    </small>
                  </div>
                </div>
                <div className="reset-password-card__body">
                  <span>기존 비밀번호</span>
                  <code>{foundMember.password || "shingu1234!"}</code>
                </div>
              </section>
              <Field
                label="새 비밀번호 설정 (선택)"
                type="password"
                placeholder="변경할 새 비밀번호 (6자 이상)"
                value={resetNewPassword}
                onChange={(event) => setResetNewPassword(event.target.value)}
              />
              <Field
                label="새 비밀번호 확인"
                type="password"
                placeholder="새 비밀번호 다시 입력"
                value={resetNewPasswordConfirm}
                onChange={(event) =>
                  setResetNewPasswordConfirm(event.target.value)
                }
              />
              {resetNewPassword.trim() ? (
                <Button
                  type="button"
                  onClick={() => void handleSaveResetNewPassword()}
                >
                  새 비밀번호 저장하고 로그인하기
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLoginId(foundMember.loginId)
                  setResetVerified(false)
                  setView("login")
                }}
              >
                이 계정으로 바로 로그인하러 가기
              </Button>
            </div>
          )
        )}
      </main>
    )
  }

  if (safeView === "signup") {
    return (
      <main className="auth auth--signup">
        <div className="signup-top">
          <button
            type="button"
            className="icon-button"
            onClick={() => (step === 1 ? setView("login") : setStep(step - 1))}
            aria-label="뒤로 가기"
          >
            <ArrowLeft />
          </button>
          <span>회원가입</span>
          <span className="step-count">
            {step}/{totalSignupSteps}
          </span>
        </div>
        <div className="progress">
          <i style={{ width: `${(step / totalSignupSteps) * 100}%` }} />
        </div>
        {step === 1 && (
          <section className="signup-panel">
            <span className="eyebrow">STEP 1</span>
            <h1>
              신구대학교 학생인지
              <br />
              확인할게요
            </h1>
            <p>학교 이메일(.ac.kr) 주소를 입력하고 인증번호를 받아 인증을 완료해 주세요.</p>
            <div className="form-stack">
              <div className="inline-action inline-action--email">
                <Field
                  label="학교 이메일"
                  type="email"
                  placeholder="student@shingu.ac.kr"
                  value={signupEmail}
                  onChange={(event) => {
                    setSignupEmail(event.target.value)
                    setVerified(false)
                    setEmailCodeSent(false)
                    setEmailError("")
                    setEmailNotice("")
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSendEmailCode()}
                  disabled={emailSending || !signupEmail.trim()}
                >
                  {emailSending
                    ? "발송 중..."
                    : emailCodeSent
                      ? "재발송"
                      : "인증번호 발송"}
                </Button>
              </div>
              <div className="inline-action inline-action--verify">
                <Field
                  label="인증번호"
                  placeholder={
                    emailCodeSent
                      ? "발송된 6자리 인증번호 입력"
                      : "인증번호 발송을 먼저 눌러주세요"
                  }
                  value={verificationCode}
                  disabled={!emailCodeSent || verified}
                  maxLength={6}
                  onChange={(event) => {
                    setVerificationCode(event.target.value)
                    setEmailError("")
                  }}
                />
                <Button
                  type="button"
                  variant={verified ? "soft" : "secondary"}
                  disabled={!emailCodeSent || verified || emailVerifying}
                  onClick={() => void handleVerifyEmailCode()}
                >
                  {emailVerifying
                    ? "확인 중..."
                    : verified
                      ? "인증 완료"
                      : "인증 확인"}
                </Button>
              </div>
              {emailError && <span className="field-error">{emailError}</span>}
              {emailNotice && !verified && (
                <div className="email-code-notice">
                  <ShieldCheck />
                  <span>{emailNotice}</span>
                </div>
              )}
              {verified && (
                <div className="success">
                  <Check /> 학교 이메일 인증이 완료되었습니다. ({signupEmail.trim()})
                </div>
              )}
              <p className="helper">
                학교 이메일 인증이 완료되어야 다음 가입 단계로 이동할 수 있습니다.
              </p>
            </div>
          </section>
        )}
        {step === 2 && (
          <section className="signup-panel">
            <span className="eyebrow">STEP 2</span>
            <h1>
              어떻게 신구길을
              <br />
              이용하시나요?
            </h1>
            <p>역할은 가입 후 프로필에서 변경을 요청할 수 있어요.</p>
            <div className="role-grid">
              <button
                className={`role-card ${role === "driver" ? "is-active" : ""}`}
                onClick={() => setRole("driver")}
              >
                <CarFront />
                <strong>운전자</strong>
                <span>내 차로 함께 이동해요</span>
                {role === "driver" && (
                  <i>
                    <Check />
                  </i>
                )}
              </button>
              <button
                className={`role-card ${role === "rider" ? "is-active" : ""}`}
                onClick={() => setRole("rider")}
              >
                <UsersRound />
                <strong>탑승자</strong>
                <span>맞는 카풀을 찾아요</span>
                {role === "rider" && (
                  <i>
                    <Check />
                  </i>
                )}
              </button>
            </div>
          </section>
        )}
        {step === 3 && (
          <section className="signup-panel">
            <span className="eyebrow">
              STEP 3 · {role === "driver" ? "운전자" : "탑승자"}
            </span>
            <h1>
              기본 정보를
              <br />
              알려주세요
            </h1>
            <div className="form-stack compact">
              <Field
                label="이름"
                placeholder="실명을 입력해 주세요"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
              />
              <div className="inline-action">
                <Field
                  label="아이디"
                  placeholder="사용할 아이디"
                  value={signupId}
                  onChange={(event) => {
                    setSignupId(event.target.value)
                    setIdChecked(false)
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (signupId.trim().length < 4) {
                      await showAppAlert({
                        title: "아이디 확인",
                        message: "아이디는 4자 이상 입력해 주세요.",
                      })
                      return
                    }
                    setIdChecked(true)
                    await showAppAlert({
                      title: "아이디 확인",
                      message: "사용 가능한 아이디입니다.",
                      variant: "success",
                    })
                  }}
                >
                  <span className="duplicate-check-label" data-fge-id="fge-136">
                    <span className="fg-inline-italic">중복 확인</span>
                  </span>
                </Button>
              </div>
              {idChecked && <span className="success">아이디 확인 완료</span>}
              <Field
                label="비밀번호"
                type="password"
                placeholder="8자 이상 입력"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
              />
              <Field
                label="비밀번호 확인"
                type="password"
                placeholder="비밀번호를 다시 입력"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
              {passwordConfirm && signupPassword !== passwordConfirm && (
                <span className="field-error">
                  비밀번호가 일치하지 않습니다.
                </span>
              )}
              <Field
                label="전화번호 *"
                type="tel"
                inputMode="numeric"
                placeholder="숫자만 입력 (자동 하이픈 입력)"
                maxLength={13}
                value={phone}
                onChange={(event) => {
                  const formatted = formatPhoneInput(event.target.value, phone)
                  setPhone(formatted)
                }}
              />
              {!isValidPhoneNumber(phone) && (
                <span className={phone ? "field-error" : "helper"}>
                  {phone
                    ? "전화번호 11자리를 모두 입력해 주세요. (010-0000-0000)"
                    : "숫자만 입력하면 하이픈(-)이 자동으로 입력됩니다."}
                </span>
              )}
              <label className="field">
                <span>성별 *</span>
                <select
                  value={signupGender}
                  onChange={(event) => setSignupGender(event.target.value)}
                >
                  <option value="">선택하지 않음</option>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                  <option value="비공개">비공개</option>
                </select>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={signupTermsAgreed}
                  onChange={(event) =>
                    setSignupTermsAgreed(event.target.checked)
                  }
                />
                <span className={signupTermsAgreed ? "checked" : ""}>
                  {signupTermsAgreed && <Check />}
                </span>{" "}
                서비스 이용약관 및 개인정보 처리방침 동의 (필수)
              </label>
              {!signupTermsAgreed && (
                <span className="field-error">
                  서비스 이용약관 및 개인정보 처리방침에 동의해 주세요.
                </span>
              )}
            </div>
          </section>
        )}
        {step === 4 && role === "driver" && (
          <section className="signup-panel">
            <span className="eyebrow">STEP 4 · 운전자</span>
            <h1>운전자 / 차량 정보</h1>
            <p>운전면허증 파일(이미지 또는 PDF)을 첨부하면 프로필에 면허증 인증 뱃지가 부여됩니다.</p>
            <div className="form-stack compact">
              <div className="license-upload-box">
                <span className="license-upload-box__label">
                  운전면허증 파일 첨부 (이미지 또는 PDF) *
                </span>
                <label
                  className={`license-upload-dropzone ${
                    driverLicenseSelected ? "is-uploaded" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={(event) =>
                      handleDriverLicenseUpload(event.target.files)
                    }
                  />
                  {driverLicenseSelected ? (
                    <div className="license-upload-preview">
                      {driverLicensePreview ? (
                        <img
                          src={driverLicensePreview}
                          alt="업로드된 운전면허증 미리보기"
                          className="license-upload-thumb"
                        />
                      ) : (
                        <div className="license-upload-pdf-icon">
                          <ShieldCheck />
                          <span>{driverLicenseIsPdf ? "PDF" : "FILE"}</span>
                        </div>
                      )}
                      <div className="license-upload-meta">
                        <strong>{driverLicenseFileName}</strong>
                        <small>{driverLicenseFileSize} · 파일 첨부 완료</small>
                        <span className="driver-verified-badge-inline">
                          <ShieldCheck /> 면허증 인증
                        </span>
                      </div>
                      <span className="license-upload-change">파일 변경</span>
                    </div>
                  ) : (
                    <div className="license-upload-placeholder">
                      <Plus />
                      <strong>운전면허증 이미지 또는 PDF 선택</strong>
                      <small>JPG, PNG, WEBP, PDF 파일 업로드 가능</small>
                    </div>
                  )}
                </label>
                {driverLicenseError && (
                  <span className="field-error">{driverLicenseError}</span>
                )}
              </div>
              <Field
                label="차종 *"
                placeholder="예: 아반떼"
                icon={<CarFront />}
                value={vehicleName}
                onChange={(event) => setVehicleName(event.target.value)}
              />
              <Field
                label="차량 정원 *"
                type="number"
                min="1"
                value={vehicleCapacity}
                onChange={(event) => setVehicleCapacity(event.target.value)}
              />
              <div className="demo-banner">
                <ShieldCheck />
                <p>
                  <strong>면허증 인증 뱃지 자동 생성</strong>
                  면허증 파일을 업로드하고 가입을 완료하면 프로필 및 운전자 정보 영역에 &lsquo;면허증 인증&rsquo; 뱃지가 자동으로 표시됩니다.
                </p>
              </div>
            </div>
          </section>
        )}
        <div className="signup-footer">
          <Button
            type="button"
            disabled={authLoading}
            onClick={() => void handleNextSignupStep()}
          >
            {authLoading
              ? "처리 중..."
              : step === 3 && role === "driver"
                ? "다음 ->"
                : step === totalSignupSteps
                  ? "가입 완료하고 시작하기"
                  : "다음"}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="auth auth--login">
      <div className="login-brand">
        <Brand transparent />
      </div>
      <div className="login-card">
        <div className="form-stack">
          <Field
            label="아이디"
            placeholder="아이디를 입력하세요"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
          />
          <label className="field">
            <span>비밀번호</span>
            <span className="field__control">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
              <button
                type="button"
                className="field__button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="비밀번호 표시 전환"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          <label className="toggle-label login-keep">
            <input type="checkbox" defaultChecked /> 로그인 상태 유지
          </label>
          {authError && <span className="field-error">{authError}</span>}
          <Button
            type="button"
            onClick={() => handleLogin("rider")}
            disabled={authLoading}
          >
            {authLoading ? "로그인 중..." : "로그인"}
          </Button>
          {isBiometricLoginEnabled && (
            <Button
              type="button"
              variant="secondary"
              className="biometric-login-button"
              onClick={() => void handleBiometricLoginClick()}
              disabled={authLoading}
            >
              <ShieldCheck /> 생체인증 로그인 (지문 / Face ID)
            </Button>
          )}
          <button
            type="button"
            className="login-link"
            onClick={() => {
              setAuthError("")
              setResetInlineError("")
              setResetVerified(false)
              setFoundMember(null)
              setView("reset")
            }}
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>
        <p className="join">
          처음이신가요?{" "}
          <button
            type="button"
            onClick={() => {
              setAuthError("")
              setStep(1)
              setView("signup")
            }}
          >
            신구길 가입하기
          </button>
        </p>
      </div>
      <p className="demo-note">
        <ShieldCheck /> 신구대학교 이메일 인증 학생 전용 서비스
      </p>
      {biometricLoginModal && (
        <div
          className="dialog-backdrop flow-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBiometricLoginModal(null)
          }}
        >
          <section className="app-dialog" role="alertdialog" aria-modal="true">
            <span className="dialog-icon neutral">
              <ShieldCheck />
            </span>
            <h2>{biometricLoginModal.title}</h2>
            <p>{biometricLoginModal.message}</p>
            <div className="dialog-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBiometricLoginModal(null)}
              >
                일반 로그인 유지
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setBiometricLoginModal(null)
                  performBiometricAutoLogin()
                }}
              >
                생체인증 확인 로그인
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function Header({
  role,
  onBell,
  onRole,
}: {
  role: Role
  onBell: () => void
  onRole: () => void
}) {
  return (
    <header className="app-header">
      <Brand compact />
      <div className="header-actions">
        <button
          className={`role-pill role-switch-button ${role}`}
          onClick={onRole}
        >
          <Check />
          {role === "driver" ? "운전자" : "탑승자"}
        </button>
        <button
          className="icon-button has-badge"
          onClick={onBell}
          aria-label="알림"
        >
          <Bell />
          <i />
        </button>
      </div>
    </header>
  )
}

function RouteCard({
  small = false,
  route = defaultRoutes.rider,
  onOpenTimePicker,
}: {
  small?: boolean
  route?: RouteData
  onOpenTimePicker?: (field?: "departure" | "arrival") => void
}) {
  const syncExtracted = useMemo(
    () =>
      getExtractedWaypointsSync(
        route?.start || "",
        route?.destination || "",
        route?.waypointsList ?? route?.waypoint,
      ),
    [route?.start, route?.destination, route?.waypoint, route?.waypointsList],
  )
  const [waypoints, setWaypoints] = useState<string[]>(
    syncExtracted.waypointsList || [],
  )
  const [waypointLoading, setWaypointLoading] = useState(false)

  useEffect(() => {
    setWaypoints(syncExtracted.waypointsList || [])
    const s = (route?.start || "").trim()
    const d = (route?.destination || "").trim()
    if (!s || !d) {
      setWaypointLoading(false)
      return
    }
    let cancelled = false
    setWaypointLoading(true)
    fetchRouteWaypointsFromMapBackend({
      start: s,
      destination: d,
      fallbackWaypoints: route?.waypointsList ?? route?.waypoint,
    })
      .then((res) => {
        if (cancelled) return
        setWaypoints(Array.isArray(res?.waypointsList) ? res.waypointsList : [])
      })
      .catch(() => {
        if (!cancelled) setWaypoints(syncExtracted.waypointsList || [])
      })
      .finally(() => {
        if (!cancelled) setWaypointLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    route?.start,
    route?.destination,
    route?.waypoint,
    route?.waypointsList,
    syncExtracted.waypointsList,
  ])

  const hasValidEndpoints = Boolean(
    route?.start?.trim() && route?.destination?.trim(),
  )
  const safeWaypoints = Array.isArray(waypoints) ? waypoints : []
  const waypointSummary = waypointLoading
    ? "실제 주행 경로 경유지 탐색 중..."
    : safeWaypoints.length > 0
      ? safeWaypoints.join(" · ")
      : DIRECT_ROUTE_LABEL

  const arrivalTimeDisplay =
    route?.preferredArrival ||
    addMinutesToTime24(route?.departureTime || "08:30", 30)

  return (
    <div className={`route-card ${small ? "route-card--small" : ""}`}>
      <div className="route-line">
        <i />
        <span />
        <i />
      </div>
      <div className="route-copy">
        <div>
          {onOpenTimePicker ? (
            <button
              type="button"
              className="route-time-inline-btn"
              onClick={(event) => {
                event.stopPropagation()
                onOpenTimePicker("departure")
              }}
              aria-label="출발 시간 간편 변경"
            >
              <Clock3 /> 출발 · {route?.departureTime || "08:30"} (시간 변경)
            </button>
          ) : (
            <span>출발 · {route?.departureTime || "08:30"}</span>
          )}
          <strong>{route?.start || "출발지 미설정"}</strong>
        </div>
        {hasValidEndpoints && (
          <div className="route-card__waypoints">
            <small>주요 경유지 · {waypointSummary}</small>
          </div>
        )}
        <div>
          {onOpenTimePicker ? (
            <button
              type="button"
              className="route-time-inline-btn"
              onClick={(event) => {
                event.stopPropagation()
                onOpenTimePicker("arrival")
              }}
              aria-label="희망 도착 시간 간편 변경"
            >
              <Clock3 /> 희망 도착 · {arrivalTimeDisplay} (시간 변경)
            </button>
          ) : (
            <span>
              도착
              {route?.preferredArrival ? ` · ${route.preferredArrival}` : ""}
            </span>
          )}
          <strong>{route?.destination || "목적지 미설정"}</strong>
        </div>
      </div>
    </div>
  )
}

function RiderHome({
  open,
  account,
  route,
  bookingDate,
  onOpenDatePicker,
  onOpenTimePicker,
  tripFlow,
  carpoolFlow,
  onOpenChat,
  onSelectRide,
  onViewUserProfile,
}: {
  open: (sheet: Sheet) => void
  account?: AccountData
  route: RouteData
  bookingDate: string
  onOpenDatePicker: () => void
  onOpenTimePicker: (field?: "departure" | "arrival") => void
  tripFlow: DemoTripFlow
  carpoolFlow: DemoCarpoolState
  onOpenChat: (rideId: string) => void
  onSelectRide: (ride: MatchRide) => void
  onViewUserProfile: (target: PublicUserProfileTarget) => void
}) {
  const [activeRide, setActiveRide] = useState(0)
  const rideListRef = useRef<HTMLDivElement>(null)
  const matchedRides = useMemo(
    () => getVisibleMatchRides(route, carpoolFlow),
    [route, carpoolFlow],
  )
  const myRiderId = (account?.id || account?.loginId || "").trim()
  const riderApplications = useMemo(
    () =>
      myRiderId
        ? (carpoolFlow.applications || []).filter(
            (item) =>
              item.riderId === myRiderId ||
              item.riderId === account?.id ||
              item.riderId === account?.loginId,
          )
        : [],
    [account?.id, account?.loginId, carpoolFlow.applications, myRiderId],
  )
  const latestApplication = riderApplications[0]
  const latestApplicationRide = (carpoolFlow.rides || []).find(
    (item) => item.id === latestApplication?.rideId,
  )
  const moveRide = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(nextIndex, matchedRides.length - 1))
    const card = rideListRef.current?.children[safeIndex] as HTMLElement
    card?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
    setActiveRide(safeIndex)
  }

  const driverDisplayName = latestApplicationRide?.driverName || "운전자"
  const arrivalTimeLabel =
    route.preferredArrival ||
    addMinutesToTime24(route.departureTime || "08:30", 30)

  return (
    <div className="page">
      <section className="hello">
        <div>
          <p>좋은 아침이에요,</p>
          <h1>{account?.name ? `${account.name}님` : "학우님"}</h1>
        </div>
        <div className="weather">
          <span>12°</span>
          <small>맑음</small>
        </div>
      </section>
      <section className="hero-search">
        <div className="section-heading light">
          <span>나의 통학 경로</span>
          <button type="button" onClick={() => open("route-edit")}>
            기본 경로 수정
          </button>
        </div>
        <RouteCard
          small
          route={route}
          onOpenTimePicker={(field) => onOpenTimePicker(field)}
        />
        <div className="search-row">
          <button
            type="button"
            className="search-row-trigger"
            onClick={(event) => {
              event.stopPropagation()
              onOpenDatePicker()
            }}
            aria-label="예약 날짜 선택"
          >
            <CalendarDays />
            <span>
              <small>날짜</small>
              {formatBookingDateLabel(bookingDate)}
            </span>
          </button>
          <button
            type="button"
            className="search-row-trigger"
            onClick={(event) => {
              event.stopPropagation()
              onOpenTimePicker("departure")
            }}
            aria-label="출발 및 희망 도착 시간 설정"
          >
            <Clock3 />
            <span>
              <small>출발 · 희망 도착</small>
              {formatKoreanTimeLabel(route.departureTime)} → {arrivalTimeLabel}
            </span>
          </button>
        </div>
        <Button onClick={() => open("matches")}>
          <Search /> 맞는 카풀 찾기
        </Button>
        <Button
          variant="secondary"
          className="reservation-button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenDatePicker()
          }}
        >
          <CalendarDays /> 원하는 날짜 예약
        </Button>
      </section>
      {latestApplicationRide?.status === "정산 대기" &&
        latestApplication?.status === "승인 완료" && (
          <section className="section settlement-notice">
            <span className="status-icon">
              <WalletCards />
            </span>
            <div>
              <span className="tag waiting">정산 대기</span>
              <h2>운행이 종료되었습니다</h2>
              <p>운행이 종료되었습니다. 정산을 진행해 주세요.</p>
            </div>
            <Button onClick={() => onOpenChat(latestApplicationRide.id)}>
              정산하러 가기
            </Button>
          </section>
        )}
      {tripFlow.paymentRequested &&
        tripFlow.approvedPassengerIds.includes("demo-rider") && (
          <section className="section payment-request-section">
            <article className="payment-request-card">
              <div className="payment-request-heading">
                <span className="status-icon">
                  {tripFlow.status === "결제 완료" ? (
                    <Check />
                  ) : (
                    <WalletCards />
                  )}
                </span>
                <div>
                  <span
                    className={`tag ${
                      tripFlow.status === "결제 완료" ? "open" : "waiting"
                    }`}
                  >
                    {tripFlow.status}
                  </span>
                  <h2>
                    {tripFlow.status === "결제 완료"
                      ? "결제가 완료되었습니다"
                      : "운행이 종료되었습니다"}
                  </h2>
                </div>
              </div>
              <p>
                {tripFlow.status === "결제 완료"
                  ? "데모 결제 내역을 확인할 수 있어요."
                  : "카풀 이용 내역을 확인하고 결제를 진행해 주세요."}
              </p>
              <RouteCard route={route} />
              <div className="payment-request-meta">
                <span>{tripFlow.operatedAt}</span>
                <strong>{tripFlow.amount.toLocaleString()} P</strong>
              </div>
              <Button onClick={() => open("carpool-payment")}>
                {tripFlow.status === "결제 완료"
                  ? "결제 내역 확인"
                  : "결제하기"}
              </Button>
            </article>
          </section>
        )}
      <section className="section" id="matches">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SMART MATCH</span>
            <h2>경로가 겹치는 카풀이에요</h2>
          </div>
        </div>
        <p className="section-sub">
          시간과 경로를 분석한 맞춤 추천이에요. 좌우로 넘겨보세요.
        </p>
        {matchedRides.length > 0 ? (
          <>
            <div
              className="ride-list"
              ref={rideListRef}
              onScroll={(event) => {
                const container = event.currentTarget
                const cards = Array.from(container.children) as HTMLElement[]
                const center = container.scrollLeft + container.clientWidth / 2
                const closest = cards.reduce(
                  (best, card, index) => {
                    const cardCenter = card.offsetLeft + card.offsetWidth / 2
                    const distance = Math.abs(center - cardCenter)
                    return distance < best.distance ? { index, distance } : best
                  },
                  { index: 0, distance: Number.POSITIVE_INFINITY },
                )
                setActiveRide(closest.index)
              }}
            >
              {matchedRides.map((ride, index) => (
                <button
                  className={`ride-card ${
                    activeRide === index ? "is-active" : ""
                  }`}
                  key={ride.id}
                  onClick={() => onSelectRide(ride)}
                >
                  <div
                    className="ride-top clickable-profile-trigger"
                    role="button"
                    tabIndex={0}
                    aria-label={`${ride.name} 운전자 프로필 상세 보기`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onViewUserProfile({
                        name: ride.name,
                        role: "driver",
                        carInfo: ride.car,
                        rating: ride.rating,
                      })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.stopPropagation()
                        onViewUserProfile({
                          name: ride.name,
                          role: "driver",
                          carInfo: ride.car,
                          rating: ride.rating,
                        })
                      }
                    }}
                  >
                    <div className="avatar">{ride.name.slice(0, 1)}</div>
                    <div>
                      <strong>
                        {ride.name} <ShieldCheck />
                      </strong>
                      <span>{ride.car}</span>
                    </div>
                  </div>
                  <div className="mini-route">
                    <div>
                      <i />
                      <span>
                        <strong>{ride.start}</strong>
                        <small>{ride.time} 출발</small>
                      </span>
                    </div>
                    <div className="via">
                      경유 ·{" "}
                      {Array.isArray(ride?.waypointsList) &&
                      ride.waypointsList.length > 0
                        ? ride.waypointsList.join(" · ")
                        : ride?.via || DIRECT_ROUTE_LABEL}
                    </div>
                    <div>
                      <i />
                      <span>
                        <strong>{ride.end}</strong>
                        <small className="eta-arrival">
                          {formatEtaTime(ride.estimatedArrival)} 도착 예정
                        </small>
                      </span>
                    </div>
                  </div>
                  <div className="eta-summary">
                    <Clock3 />
                    <span>
                      {ride.time} 출발 →{" "}
                      <strong>
                        {formatEtaTime(ride.estimatedArrival)} 도착 예정
                      </strong>
                    </span>
                    <small>약 {ride.estimatedDuration}분</small>
                  </div>
                  <div className="ride-bottom">
                    <span>
                      <Star /> {ride.rating} ({ride.reviews})
                    </span>
                    <span>
                      <UsersRound /> {ride.seats}자리
                    </span>
                    <strong>{ride.price.toLocaleString()} P</strong>
                  </div>
                </button>
              ))}
            </div>
            <div className="carousel-controls">
              <button
                onClick={() => moveRide(activeRide - 1)}
                disabled={activeRide === 0}
                aria-label="이전 카풀"
              >
                <ChevronRight className="flip" />
              </button>
              <div className="carousel-dots" aria-label="카풀 카드 위치">
                {matchedRides.map((ride, index) => (
                  <button
                    className={activeRide === index ? "active" : ""}
                    onClick={() => moveRide(index)}
                    aria-label={`${index + 1}번째 카풀`}
                    key={ride.id}
                  />
                ))}
              </div>
              <button
                onClick={() => moveRide(activeRide + 1)}
                disabled={activeRide === matchedRides.length - 1}
                aria-label="다음 카풀"
              >
                <ChevronRight />
              </button>
            </div>
          </>
        ) : (
          <div className="recommendation-empty">
            <Route />
            <strong>등록된 카풀이 없습니다</strong>
            <p>출발지, 목적지와 희망 시간을 저장하거나 새 카풀이 등록되면 안내해 드려요.</p>
            <Button variant="soft" onClick={() => open("route-edit")}>
              기본 경로 설정
            </Button>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>신청한 카풀</h2>
          <button onClick={() => open("applications")}>내역보기</button>
        </div>
        {latestApplication && latestApplicationRide ? (
          <button
            className="status-card status-card--button"
            onClick={() =>
              latestApplicationRide.status === "완료"
                ? open("review")
                : open("applications")
            }
          >
            <span className="status-icon">
              {latestApplicationRide.status === "완료" ? <Check /> : <Clock3 />}
            </span>
            <div>
              <span
                className={`tag ${
                  latestApplication.status === "승인 완료" ? "open" : "waiting"
                }`}
              >
                {latestApplicationRide.status === "완료"
                  ? "완료된 카풀"
                  : latestApplication.status}
              </span>
              <strong>
                {latestApplicationRide.date} · {latestApplicationRide.time}
              </strong>
              <small>
                {latestApplicationRide.start} →{" "}
                {latestApplicationRide.destination}
                {" · "}
                {latestApplicationRide.price.toLocaleString()} P
              </small>
              <small className="eta-inline">
                {formatEtaTime(latestApplicationRide.estimatedArrival)} 도착 예정
                · 약 {latestApplicationRide.estimatedDuration}분
              </small>
              <span
                className="clickable-profile-inline"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation()
                  onViewUserProfile({
                    name: driverDisplayName,
                    role: "driver",
                    carInfo: latestApplicationRide.vehicle,
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    event.stopPropagation()
                    onViewUserProfile({
                      name: driverDisplayName,
                      role: "driver",
                      carInfo: latestApplicationRide.vehicle,
                    })
                  }
                }}
              >
                <UserRound /> {driverDisplayName} 운전자 프로필 보기
              </span>
            </div>
            <ChevronRight />
          </button>
        ) : (
          <div className="schedule-empty compact-empty">
            <CalendarDays />
            <strong>신청한 카풀이 없어요</strong>
            <p>원하는 날짜를 선택해 카풀을 예약해 보세요.</p>
          </div>
        )}
      </section>
    </div>
  )
}


function DriverHome({
  open,
  route,
  bookingDate,
  onOpenDatePicker,
  onOpenTimePicker,
  account,
  tripFlow,
  onStartTrip,
  onEndTrip,
  onResetTrip,
  carpoolFlow,
  onOpenChat,
  mileageBalance,
  onViewUserProfile,
}: {
  open: (sheet: Sheet) => void
  route: RouteData
  bookingDate: string
  onOpenDatePicker: () => void
  onOpenTimePicker: (field?: "departure" | "arrival") => void
  account?: AccountData
  tripFlow: DemoTripFlow
  onStartTrip: () => void
  onEndTrip: () => void
  onResetTrip: () => void
  carpoolFlow: DemoCarpoolState
  onOpenChat: (rideId: string) => void
  mileageBalance: number
  onViewUserProfile: (target: PublicUserProfileTarget) => void
}) {
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [approvalNoticeOpen, setApprovalNoticeOpen] = useState(false)
  const [endRideId, setEndRideId] = useState<string | null>(null)
  const [decisionApplicationId, setDecisionApplicationId] =
    useState<string | null>(null)
  const myDriverRides = carpoolFlow.rides.filter((ride) => {
    if (!account) return false
    return (
      (account.id && ride.driverId === account.id) ||
      (account.loginId && ride.driverId === account.loginId) ||
      (account.name && ride.driverName === account.name)
    )
  })
  const newestRide = myDriverRides[0]
  const newestRideApplications = carpoolFlow.applications.filter(
    (item) => item.rideId === newestRide?.id,
  )
  const pendingApplication = newestRideApplications.find(
    (item) => item.status === "승인 대기",
  )
  const approvedPassengerCount = newestRideApplications.filter(
    (item) => item.status === "승인 완료",
  ).length
  const maxSeats = newestRide?.totalSeats || 0
  const remainingSeats = newestRide
    ? getRemainingSeats(carpoolFlow, newestRide.id)
    : 0
  const completedDriverRides = myDriverRides.filter(
    (ride) => ride.status === "완료",
  )
  const monthlyRideCount = completedDriverRides.length
  const monthlyStudentCount = carpoolFlow.applications.filter(
    (item) =>
      item.status === "승인 완료" &&
      completedDriverRides.some((ride) => ride.id === item.rideId),
  ).length
  const monthlyMileage = completedDriverRides.reduce(
    (sum, ride) => sum + Math.round((ride.price || 0) * 0.1),
    0,
  )
  return (
    <div className="page">
      <section className="hello driver-hello">
        <div>
          <p>안전한 운행 준비되셨나요?</p>
          <h1>
            {account?.name
              ? `${account.name}님, 좋은 아침이에요`
              : "운전자님, 좋은 아침이에요"}
          </h1>
          {account?.vehicleName && (
            <small className="driver-vehicle-meta">
              등록 차량 · {account.vehicleName}
              {account.vehicleCapacity ? ` (${account.vehicleCapacity}인승)` : ""}
            </small>
          )}
        </div>
        <span className="verified">
          <ShieldCheck /> 면허증 인증
        </span>
      </section>
      {newestRide ? (
        <section className="section integrated-flow-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">운행 관리</span>
              <h2>최근 등록한 카풀</h2>
            </div>
            <span
              className={`tag ${
                newestRide.status === "모집 중" ? "open" : "waiting"
              }`}
            >
              {newestRide.status}
            </span>
          </div>
          <h3>
            {newestRide.start} → {newestRide.destination}
          </h3>
          <p>
            {newestRide.date} · {newestRide.time} ·{" "}
            {newestRide.price.toLocaleString()} P
          </p>
          <div className="eta-inline-card">
            <Clock3 />
            <span>
              <small>등록 일정 기준 도착 예정</small>
              <strong>{formatEtaTime(newestRide.estimatedArrival)}</strong>
            </span>
            <b>약 {newestRide.estimatedDuration}분</b>
          </div>
          <p>
            승인{" "}
            {
              newestRideApplications.filter(
                (item) => item.status === "승인 완료",
              ).length
            }
            명{" · "}잔여 {getRemainingSeats(carpoolFlow, newestRide.id)}석
          </p>
          {newestRide.status === "모집 중" && (
            <Button
              variant="soft"
              onClick={() => {
                setEndRideId(newestRide.id)
                setShowEndConfirm(true)
              }}
            >
              운행 종료
            </Button>
          )}
          {newestRide.status === "정산 대기" && (
            <>
              <div className="demo-banner">
                <CircleHelp />
                <p>
                  <strong>정산 대기</strong>
                  운행이 종료되었습니다. 정산을 진행해 주세요.
                </p>
              </div>
              <Button onClick={() => onOpenChat(newestRide.id)}>
                정산하러 가기
              </Button>
            </>
          )}
          {pendingApplication && (
            <article className="integrated-request">
              <div
                className="avatar green clickable-profile-trigger"
                role="button"
                tabIndex={0}
                aria-label={`${pendingApplication.riderName} 탑승자 프로필 상세 보기`}
                onClick={(event) => {
                  event.stopPropagation()
                  onViewUserProfile({
                    id: pendingApplication.riderId,
                    name: pendingApplication.riderName,
                    role: "rider",
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    event.stopPropagation()
                    onViewUserProfile({
                      id: pendingApplication.riderId,
                      name: pendingApplication.riderName,
                      role: "rider",
                    })
                  }
                }}
              >
                {pendingApplication.riderName.slice(0, 1)}
              </div>
              <div
                className="clickable-profile-trigger"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation()
                  onViewUserProfile({
                    id: pendingApplication.riderId,
                    name: pendingApplication.riderName,
                    role: "rider",
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    event.stopPropagation()
                    onViewUserProfile({
                      id: pendingApplication.riderId,
                      name: pendingApplication.riderName,
                      role: "rider",
                    })
                  }
                }}
              >
                <strong>{pendingApplication.riderName} 탑승 신청</strong>
                <small>
                  {new Date(pendingApplication.createdAt).toLocaleString(
                    "ko-KR",
                  )}
                </small>
              </div>
              <div className="request-actions">
                <Button
                  variant="ghost"
                  onClick={() =>
                    decideCarpoolApplication(pendingApplication.id, "reject")
                  }
                >
                  거절
                </Button>
                <Button
                  onClick={() =>
                    setDecisionApplicationId(pendingApplication.id)
                  }
                >
                  승인
                </Button>
              </div>
            </article>
          )}
        </section>
      ) : (
        <section className="section integrated-flow-card">
          <div className="recommendation-empty">
            <CarFront />
            <strong>등록된 카풀이 없습니다</strong>
            <p>직접 운행 일정을 등록하고 함께 이동할 탑승자를 모집해 보세요.</p>
            <Button onClick={() => open("create")}>
              <Plus /> 카풀 운행 등록하기
            </Button>
          </div>
        </section>
      )}
      <section className="driver-summary">
        <div className="section-heading light">
          <span>오늘의 운행</span>
          <span
            className={`tag ${
              newestRide
                ? tripFlow.status === "결제 대기"
                  ? "waiting"
                  : "open"
                : "waiting"
            }`}
          >
            {newestRide ? newestRide.status : "예정된 운행 없음"}
          </span>
        </div>
        <h2>{formatKoreanTimeLabel(route.departureTime)} 출발</h2>
        <button
          type="button"
          className="driver-route-edit"
          onClick={() => open("route-edit")}
        >
          기본 경로 수정
        </button>
        <RouteCard small route={route} onOpenTimePicker={onOpenTimePicker} />
        <div className="search-row">
          <button
            type="button"
            className="search-row-trigger"
            onClick={(event) => {
              event.stopPropagation()
              onOpenDatePicker()
            }}
            aria-label="운행 날짜 선택"
          >
            <CalendarDays />
            <span>
              <small>날짜</small>
              {formatBookingDateLabel(bookingDate)}
            </span>
          </button>
          <button
            type="button"
            className="search-row-trigger"
            onClick={(event) => {
              event.stopPropagation()
              onOpenTimePicker("departure")
            }}
            aria-label="출발 및 희망 도착 시간 변경"
          >
            <Clock3 />
            <span>
              <small>출발 · 희망 도착</small>
              {formatKoreanTimeLabel(route.departureTime)} →{" "}
              {route.preferredArrival ||
                addMinutesToTime24(route.departureTime || "08:30", 30)}
            </span>
          </button>
        </div>
        <div className="occupancy">
          <div>
            <span>탑승 확정</span>
            <strong>
              {approvedPassengerCount}
              <small>/{maxSeats}명</small>
            </strong>
          </div>
          <div className="seat-dots">
            {maxSeats > 0 ? (
              Array.from({ length: maxSeats }, (_, idx) => (
                <i
                  key={idx}
                  className={idx < approvedPassengerCount ? "filled" : ""}
                />
              ))
            ) : (
              <i />
            )}
          </div>
          <span>
            {newestRide
              ? remainingSeats <= 0
                ? "모집 완료"
                : `잔여 ${remainingSeats}석`
              : "예정된 운행 없음"}
          </span>
        </div>
        <Button
          disabled={
            tripFlow.status === "결제 대기" || tripFlow.status === "결제 완료"
          }
          onClick={() => {
            if (tripFlow.status === "운행 중") {
              setShowEndConfirm(true)
              return
            }
            onStartTrip()
          }}
        >
          {tripFlow.status === "운행 중" ? (
            <>
              <Check /> 운행 종료하기
            </>
          ) : tripFlow.status === "결제 대기" ? (
            <>
              <Clock3 /> 탑승자 결제 대기
            </>
          ) : tripFlow.status === "결제 완료" ? (
            <>
              <Check /> 결제 완료
            </>
          ) : (
            <>
              <Navigation /> 운행 시작하기
            </>
          )}
        </Button>
        {(tripFlow.status === "결제 대기" ||
          tripFlow.status === "결제 완료") && (
          <div className="driver-payment-status">
            <div>
              <span
                className="clickable-profile-inline"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation()
                  onViewUserProfile({
                    name: tripFlow.passengerName || "탑승자",
                    role: "rider",
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    event.stopPropagation()
                    onViewUserProfile({
                      name: tripFlow.passengerName || "탑승자",
                      role: "rider",
                    })
                  }
                }}
              >
                {tripFlow.passengerName || "탑승자"} 탑승자
              </span>
              <strong>
                {tripFlow.status === "결제 완료" ? "결제 완료" : "결제 대기"}
              </strong>
            </div>
            <p>
              {tripFlow.status === "결제 완료"
                ? `${tripFlow.amount.toLocaleString()} P 데모 결제가 확인됐어요.`
                : "운행이 종료되었습니다. 탑승자의 결제를 기다리는 중입니다."}
            </p>
            <button onClick={onResetTrip}>발표용 흐름 초기화</button>
          </div>
        )}
      </section>
      {showEndConfirm && (
        <div className="dialog-backdrop flow-dialog-backdrop">
          <section className="app-dialog">
            <span className="dialog-icon neutral">
              <CarFront />
            </span>
            <h2>운행을 종료할까요?</h2>
            <p>운행 종료 후 탑승자에게 정산 안내가 표시됩니다.</p>
            <div className="dialog-actions">
              <Button variant="ghost" onClick={() => setShowEndConfirm(false)}>
                계속 운행
              </Button>
              <Button
                onClick={() => {
                  if (endRideId) endCarpoolRide(endRideId)
                  else onEndTrip()
                  setShowEndConfirm(false)
                  setEndRideId(null)
                }}
              >
                운행 종료
              </Button>
            </div>
          </section>
        </div>
      )}
      {decisionApplicationId && (
        <div className="dialog-backdrop flow-dialog-backdrop">
          <section className="app-dialog">
            <span className="dialog-icon neutral">
              <UsersRound />
            </span>
            <h2>탑승 신청을 승인할까요?</h2>
            <p>승인된 신청만 좌석을 사용하며 양쪽 일정과 채팅에 반영됩니다.</p>
            <div className="dialog-actions">
              <Button
                variant="ghost"
                onClick={() => setDecisionApplicationId(null)}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  decideCarpoolApplication(
                    decisionApplicationId,
                    "approve",
                    (roomId) => onOpenChat(roomId),
                  )
                  setDecisionApplicationId(null)
                }}
              >
                승인
              </Button>
            </div>
          </section>
        </div>
      )}
      <section className="quick-grid">
        <button onClick={() => open("create")}>
          <span>
            <Plus />
          </span>
          <strong>새 일정 등록</strong>
          <small>카풀 모집 시작</small>
        </button>
        <button onClick={() => open("mileage")}>
          <span>
            <WalletCards />
          </span>
          <strong>{mileageBalance.toLocaleString("ko-KR")} M</strong>
          <small>나의 마일리지</small>
        </button>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>새 탑승 신청</h2>
          <button onClick={() => open("applications")}>전체보기</button>
        </div>
        {carpoolFlow.applications.filter(
          (item) =>
            item.status === "승인 대기" &&
            myDriverRides.some((ride) => ride.id === item.rideId),
        ).length > 0 ? (
          carpoolFlow.applications
            .filter(
              (item) =>
                item.status === "승인 대기" &&
                myDriverRides.some((ride) => ride.id === item.rideId),
            )
            .map((app) => (
              <div className="request-card" key={app.id}>
                <div
                  className="avatar green clickable-profile-trigger"
                  role="button"
                  tabIndex={0}
                  aria-label={`${app.riderName} 탑승자 프로필 상세 보기`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onViewUserProfile({
                      id: app.riderId,
                      name: app.riderName,
                      role: "rider",
                    })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.stopPropagation()
                      onViewUserProfile({
                        id: app.riderId,
                        name: app.riderName,
                        role: "rider",
                      })
                    }
                  }}
                >
                  {app.riderName.slice(0, 1) || "탑"}
                </div>
                <div
                  className="clickable-profile-trigger"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    onViewUserProfile({
                      id: app.riderId,
                      name: app.riderName,
                      role: "rider",
                    })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.stopPropagation()
                      onViewUserProfile({
                        id: app.riderId,
                        name: app.riderName,
                        role: "rider",
                      })
                    }
                  }}
                >
                  <strong>{app.riderName}</strong>
                  <span>탑승 신청 대기 중</span>
                  <small>
                    {new Date(app.createdAt).toLocaleDateString("ko-KR")} 신청
                  </small>
                </div>
                <div className="request-actions">
                  <Button
                    variant="ghost"
                    onClick={() => decideCarpoolApplication(app.id, "reject")}
                  >
                    거절
                  </Button>
                  <Button
                    onClick={() =>
                      decideCarpoolApplication(app.id, "approve", (roomId) =>
                        onOpenChat(roomId),
                      )
                    }
                  >
                    승인
                  </Button>
                </div>
              </div>
            ))
        ) : (
          <div className="schedule-empty compact-empty">
            <UsersRound />
            <strong>새로운 탑승 신청이 없습니다</strong>
            <p>탑승자가 카풀을 신청하면 여기에 표시됩니다.</p>
          </div>
        )}
      </section>
      {approvalNoticeOpen && (
        <div className="dialog-backdrop flow-dialog-backdrop">
          <section className="app-dialog" role="alertdialog" aria-modal="true">
            <span className="dialog-icon">
              <Check />
            </span>
            <h2>탑승 신청 승인 완료</h2>
            <p>탑승자가 일정과 기존 카풀 채팅방에 추가되었습니다.</p>
            <Button onClick={() => setApprovalNoticeOpen(false)}>확인</Button>
          </section>
        </div>
      )}
      <section className="section">
        <div className="section-heading">
          <h2>이번 달 운행</h2>
          <button onClick={() => open("monthly-rides")}>내역 보기</button>
        </div>
        <div className="stats">
          <div>
            <span>완료 운행</span>
            <strong>{monthlyRideCount}회</strong>
          </div>
          <div>
            <span>함께한 학생</span>
            <strong>{monthlyStudentCount}명</strong>
          </div>
          <div>
            <span>적립 예정</span>
            <strong>{monthlyMileage.toLocaleString("ko-KR")} M</strong>
          </div>
        </div>
      </section>
    </div>
  )
}


function SchedulePage({
  role,
  open,
  carpoolFlow,
  onViewUserProfile,
  account,
}: {
  role: Role
  open: (sheet: Sheet) => void
  carpoolFlow: DemoCarpoolState
  onViewUserProfile: (target: PublicUserProfileTarget) => void
  account?: AccountData
}) {
  const today = new Date()
  const initialWeekStart = new Date(today)
  initialWeekStart.setDate(today.getDate() - today.getDay())
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekDirection, setWeekDirection] = useState<"prev" | "next">("next")
  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"]
  const formatDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const selectedKey = formatDateKey(selectedDate)
  const selectedSchedules = demoScheduleByDate[selectedKey] || []
  const matchesCurrentRider = (riderId?: string, riderName?: string) => {
    if (!account) return false
    return (
      (account.id && riderId === account.id) ||
      (account.loginId && riderId === account.loginId) ||
      (account.name && riderName === account.name)
    )
  }
  const visibleFlowRides = carpoolFlow.rides.filter((ride) => {
    if (role === "driver") {
      if (!account) return false
      return (
        (account.id && ride.driverId === account.id) ||
        (account.loginId && ride.driverId === account.loginId) ||
        (account.name && ride.driverName === account.name)
      )
    }
    const hasMyApp = carpoolFlow.applications.some(
      (item) =>
        item.rideId === ride.id &&
        matchesCurrentRider(item.riderId, item.riderName),
    )
    return hasMyApp || ride.status === "모집 중"
  })
  const selectedFlowRides = visibleFlowRides.filter(
    (ride) => ride.date === selectedKey,
  )
  const moveWeek = (direction: -1 | 1) => {
    const nextStart = new Date(weekStart)
    nextStart.setDate(weekStart.getDate() + direction * 7)
    const nextSelected = new Date(nextStart)
    nextSelected.setDate(nextStart.getDate() + selectedDate.getDay())
    setWeekDirection(direction > 0 ? "next" : "prev")
    setWeekStart(nextStart)
    setSelectedDate(nextSelected)
  }

  return (
    <div className="page page--plain">
      <div className="page-title">
        <div>
          <span className="eyebrow">MY SCHEDULE</span>
          <h1>일정</h1>
        </div>
        <button className="icon-button" onClick={() => open("calendar")}>
          <Plus />
        </button>
      </div>
      <p className="schedule-today">
        오늘 ·{" "}
        {today.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        })}
      </p>
      {visibleFlowRides.length > 0 && (
        <section className="flow-schedule-overview">
          <div className="section-heading">
            <h2>{role === "driver" ? "내가 등록한 카풀" : "등록된 카풀"}</h2>
          </div>
          {visibleFlowRides.map((ride) => {
            const application = carpoolFlow.applications.find(
              (item) =>
                item.rideId === ride.id &&
                matchesCurrentRider(item.riderId, item.riderName),
            )
            return (
              <article key={ride.id}>
                <span
                  className={`tag ${
                    ride.status === "모집 중" ? "open" : "waiting"
                  }`}
                >
                  {ride.status === "완료"
                    ? role === "driver"
                      ? "운행 완료"
                      : "이용 완료"
                    : (application?.status ?? ride.status)}
                </span>
                <strong>
                  {ride.start} → {ride.destination}
                </strong>
                <small>
                  {ride.date} · {ride.time} · 잔여{" "}
                  {getRemainingSeats(carpoolFlow, ride.id)}석
                </small>
                <small className="eta-inline">
                  {formatEtaTime(ride.estimatedArrival)} 도착 예정 · 약{" "}
                  {ride.estimatedDuration}분
                </small>
              </article>
            )
          })}
        </section>
      )}
      <div className="month-title">
        <button onClick={() => moveWeek(-1)} aria-label="이전 주">
          <ChevronRight className="flip" />
        </button>
        <strong>
          {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월
        </strong>
        <button onClick={() => moveWeek(1)} aria-label="다음 주">
          <ChevronRight />
        </button>
      </div>
      <div
        className={`week week--interactive week--${weekDirection}`}
        key={formatDateKey(weekStart)}
      >
        {weekDates.map((date) => {
          const dateKey = formatDateKey(date)
          const isActive = dateKey === selectedKey
          const hasSchedule =
            Boolean(demoScheduleByDate[dateKey]?.length) ||
            visibleFlowRides.some((ride) => ride.date === dateKey)
          return (
            <button
              className={isActive ? "active" : ""}
              onClick={() => setSelectedDate(date)}
              aria-pressed={isActive}
              key={dateKey}
            >
              <span>{weekdayLabels[date.getDay()]}</span>
              <strong>{date.getDate()}</strong>
              {hasSchedule && <i />}
            </button>
          )
        })}
      </div>
      <div className="timeline schedule-results" key={selectedKey}>
        <div className="timeline-date">
          <strong>
            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일
          </strong>
          <span>{weekdayLabels[selectedDate.getDay()]}요일</span>
        </div>
        {selectedSchedules.length > 0 || selectedFlowRides.length > 0 ? (
          <>
            {selectedFlowRides.map((ride) => {
              const application = carpoolFlow.applications.find(
                (item) =>
                  item.rideId === ride.id &&
                  matchesCurrentRider(item.riderId, item.riderName),
              )
              return (
                <article
                  className={ride.status !== "모집 중" ? "muted-event" : ""}
                  key={ride.id}
                >
                  <time>{ride.time}</time>
                  <div className="event">
                    <span
                      className={`tag ${
                        ride.status === "모집 중" ? "open" : "waiting"
                      }`}
                    >
                      {ride.status === "완료"
                        ? role === "driver"
                          ? "운행 완료"
                          : "이용 완료"
                        : (application?.status ?? ride.status)}
                    </span>
                    <h3>
                      {ride.start} → {ride.destination}
                    </h3>
                    <p
                      className="clickable-profile-inline"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          name: ride.driverName,
                          role: "driver",
                          carInfo: ride.vehicle,
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            name: ride.driverName,
                            role: "driver",
                            carInfo: ride.vehicle,
                          })
                        }
                      }}
                    >
                      <CarFront /> {ride.driverName} · {ride.vehicle}
                    </p>
                    <p>
                      <UsersRound /> 잔여{" "}
                      {getRemainingSeats(carpoolFlow, ride.id)}석 ·{" "}
                      {ride.price.toLocaleString()} P
                    </p>
                    <p className="eta-event">
                      <Clock3 /> {formatEtaTime(ride.estimatedArrival)} 도착 예정
                      · 약 {ride.estimatedDuration}분
                    </p>
                    {ride.status === "완료" && role === "rider" && (
                      <small>
                        {carpoolFlow.reviews.some(
                          (review) => review.rideId === ride.id,
                        )
                          ? "평가 완료"
                          : "후기 작성 가능"}
                      </small>
                    )}
                  </div>
                </article>
              )
            })}
            {selectedSchedules.map((schedule) => (
              <article
                className={schedule.tone === "waiting" ? "muted-event" : ""}
                key={schedule.id}
              >
                <time>{schedule.time}</time>
                <div className="event">
                  <span className={`tag ${schedule.tone}`}>
                    {schedule.status}
                  </span>
                  <h3>{schedule.title}</h3>
                  <p>
                    <MapPin /> {schedule.location}
                  </p>
                  <p>
                    <UsersRound />{" "}
                    {role === "driver"
                      ? schedule.driverDetail
                      : schedule.riderDetail}
                  </p>
                </div>
              </article>
            ))}
          </>
        ) : (
          <div className="schedule-empty">
            <CalendarDays />
            <strong>등록된 카풀이 없습니다</strong>
            <p>선택하신 날짜에 예정된 카풀 일정이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function filterRealtimeChatRooms(
  rooms: RealtimeChatRoom[],
  query: string,
  currentUserId?: string,
  currentLoginId?: string,
): RealtimeChatRoom[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")
  if (!normalizedQuery) return rooms

  return rooms.filter((room) => {
    const counterpart = getCounterpartProfile(
      room,
      currentUserId,
      currentLoginId,
    )
    return [
      room?.title || "",
      room?.meeting || "",
      counterpart?.name || "",
      room?.lastMessage || "",
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedQuery)
  })
}

function ChatPage({
  account,
  role,
  loggedIn,
  onRequireLogin,
  carpoolFlow,
  initialRideId,
  onInitialRideConsumed,
  onViewUserProfile,
}: {
  account: AccountData
  role: Role
  loggedIn: boolean
  onRequireLogin: () => void
  carpoolFlow: DemoCarpoolState
  initialRideId: string | null
  onInitialRideConsumed: () => void
  onViewUserProfile: (target: PublicUserProfileTarget) => void
}) {
  const realtimeChatState = useSyncExternalStore(
    subscribeRealtimeChat,
    getRealtimeChatSnapshot,
    getRealtimeChatSnapshot,
  )
  const currentUserId = (account?.id || account?.loginId || "").trim()
  const currentLoginId = (account?.loginId || account?.id || "").trim()
  const currentUserName = normalizeDisplayName(account?.name)

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 승인된 카풀 중 현재 로그인 계정이 실제 참여자인 건이 있으면 실시간 채팅방 목록에 동기화
  useEffect(() => {
    if (!loggedIn || !currentUserId) return
    const ridesList = Array.isArray(carpoolFlow?.rides) ? carpoolFlow.rides : []
    const appsList = Array.isArray(carpoolFlow?.applications)
      ? carpoolFlow.applications
      : []

    for (const app of appsList) {
      if (app?.status !== "승인 완료") continue
      const ride = ridesList.find((r) => r?.id === app.rideId)
      if (!ride) continue

      const isMyApplication =
        app.riderId === currentUserId ||
        app.riderId === currentLoginId ||
        (account?.name && app.riderName === account.name)
      const isMyDrivenRide =
        ride.driverId === currentUserId ||
        ride.driverId === currentLoginId ||
        (account?.name && ride.driverName === account.name)

      if (!isMyApplication && !isMyDrivenRide) continue

      getOrCreateCarpoolChatRoom({
        currentUser: {
          id: currentUserId,
          loginId: currentLoginId,
          name: currentUserName,
          role,
          carInfo: account?.vehicleName,
          isDriverVerified: account?.isDriverVerified,
        },
        targetUser: isMyApplication
          ? {
              id: ride.driverId || `account-${ride.driverName}`,
              name: ride.driverName || "알 수 없는 사용자",
              role: "driver",
              carInfo: ride.vehicle,
              licenseVerified: true,
            }
          : {
              id: app.riderId || `account-${app.riderName}`,
              name: app.riderName || "알 수 없는 사용자",
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
    }
  }, [
    loggedIn,
    currentUserId,
    currentLoginId,
    currentUserName,
    role,
    account?.name,
    account?.vehicleName,
    account?.isDriverVerified,
    carpoolFlow?.rides,
    carpoolFlow?.applications,
  ])

  const myChatRooms = useMemo(
    () => getRoomsForUser(currentUserId, currentLoginId),
    [currentUserId, currentLoginId, realtimeChatState],
  )

  const selectedChat = useMemo(
    () =>
      myChatRooms.find(
        (room) =>
          room?.id === selectedChatId ||
          (selectedChatId && room?.rideId === selectedChatId),
      ) || null,
    [myChatRooms, selectedChatId],
  )

  const selectedFlowRide = useMemo(
    () =>
      (carpoolFlow?.rides || []).find(
        (ride) => ride?.id === selectedChat?.rideId,
      ),
    [carpoolFlow?.rides, selectedChat?.rideId],
  )

  const roomMessages = useMemo(
    () => getMessagesForRoom(selectedChat?.id),
    [selectedChat?.id, realtimeChatState],
  )

  const filteredChatRooms = useMemo(
    () =>
      filterRealtimeChatRooms(
        myChatRooms,
        searchQuery,
        currentUserId,
        currentLoginId,
      ),
    [myChatRooms, searchQuery, currentUserId, currentLoginId],
  )
  const hasSearchQuery = searchQuery.trim().length > 0

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  useEffect(() => {
    if (!initialRideId) return
    const matchedRoom = myChatRooms.find(
      (r) => r.id === initialRideId || r.rideId === initialRideId,
    )
    setSelectedChatId(matchedRoom ? matchedRoom.id : initialRideId)
    onInitialRideConsumed()
  }, [initialRideId, myChatRooms, onInitialRideConsumed])

  // 새 메시지 수신/전송 시 스크롤 자동 하단 이동
  useEffect(() => {
    if (!selectedChat) return
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      })
    }, 40)
    return () => window.clearTimeout(timer)
  }, [selectedChat?.id, roomMessages.length])

  const [settlementConfirmOpen, setSettlementConfirmOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [noticeLiked, setNoticeLiked] = useState(false)
  const [noticeComment, setNoticeComment] = useState("")
  const [noticeComments, setNoticeComments] = useState<string[]>([])

  // 비로그인 접근 방어
  if (!loggedIn || !currentUserId) {
    return (
      <div className="page page--plain">
        <div className="page-title">
          <div>
            <span className="eyebrow">MESSAGES</span>
            <h1>채팅</h1>
          </div>
        </div>
        <div className="chat-search-empty">
          <MessageCircle />
          <strong>로그인이 필요한 서비스입니다.</strong>
          <p>실시간 카풀 채팅을 이용하려면 로그인 화면에서 로그인해 주세요.</p>
          <Button type="button" onClick={onRequireLogin}>
            로그인 화면으로 이동
          </Button>
        </div>
      </div>
    )
  }

  const counterpartProfile = getCounterpartProfile(
    selectedChat,
    currentUserId,
    currentLoginId,
  )
  const counterpartName = normalizeDisplayName(counterpartProfile?.name)
  const counterpartInitial = counterpartName.slice(0, 1) || "?"

  const noticeAuthor =
    selectedFlowRide?.driverName || counterpartName || "알 수 없는 사용자"
  const [noticeDeparture, noticeLocation] = (
    selectedChat?.meeting ?? ""
  ).split(" · ")
  const noticeDestination =
    selectedFlowRide?.destination ??
    selectedChat?.destination ??
    selectedChat?.title?.split(" → ")?.at(-1) ??
    "목적지"
  const noticeSummary = selectedChat
    ? `${noticeDeparture || "오늘"} · ${noticeLocation || "출발지"} 출발 안내`
    : "카풀 출발 안내"
  const noticeBody = selectedChat
    ? `${noticeDeparture || "예정 시간"}에 ${noticeLocation || "출발 장소"}에서 출발합니다.\n\n최종 목적지는 ${noticeDestination}입니다.${
        selectedFlowRide
          ? ` 등록 일정 기준 도착 예정 시간은 ${formatEtaTime(selectedFlowRide.estimatedArrival)}이며, 예상 소요 시간은 약 ${selectedFlowRide.estimatedDuration}분입니다.`
          : ""
      }\n\n탑승자는 약속 시간 5분 전까지 출발 장소에 도착해 주세요. 출발 시간이나 장소가 변경되면 이 채팅방의 일정 정보와 공지에 함께 반영됩니다.`
    : "채팅방에 저장된 출발 시간과 장소를 확인해 주세요."

  const quickMessages = [
    "📍 지금 정류장 근처예요",
    "🚗 탑승 완료",
    "🕒 조금 늦을 것 같아요",
    "📍 도착했어요",
    "확인했습니다",
  ]

  const sendMessage = () => {
    if (!draft.trim() || !selectedChat) return
    sendRealtimeChatMessage({
      roomId: selectedChat.id,
      senderId: currentUserId,
      senderName: currentUserName,
      text: draft.trim(),
    })
    setDraft("")
  }

  if (selectedChat)
    return (
      <div className="chat-room">
        <div className="chat-header">
          <button
            className="icon-button"
            onClick={() => setSelectedChatId(null)}
            aria-label="채팅방 목록으로 돌아가기"
          >
            <ArrowLeft />
          </button>
          <div
            className="chat-header__counterpart clickable-profile-trigger"
            role="button"
            tabIndex={0}
            aria-label={`${counterpartName} 프로필 상세 보기`}
            onClick={(event) => {
              event.stopPropagation()
              onViewUserProfile({
                id: counterpartProfile.id,
                name: counterpartName,
                role: counterpartProfile.role,
                carInfo:
                  selectedFlowRide?.vehicle || counterpartProfile.carInfo,
              })
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                event.stopPropagation()
                onViewUserProfile({
                  id: counterpartProfile.id,
                  name: counterpartName,
                  role: counterpartProfile.role,
                  carInfo:
                    selectedFlowRide?.vehicle || counterpartProfile.carInfo,
                })
              }
            }}
          >
            <div className="avatar small">{counterpartInitial}</div>
            <div>
              <strong>{selectedChat?.title || "카풀 채팅방"}</strong>
              <span>
                <i /> {counterpartName}{" "}
                {counterpartProfile.role === "driver" ? "운전자" : "탑승자"} ·
                프로필 보기
              </span>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={() => setLeaveConfirmOpen(true)}
            aria-label="채팅방 나가기"
            title="채팅방 나가기"
          >
            <X />
          </button>
        </div>
        <button
          className="chat-notice-banner"
          onClick={() => setNoticeOpen(true)}
          aria-label="채팅방 공지 상세 보기"
        >
          <span>
            <Megaphone />
          </span>
          <div>
            <small>공지</small>
            <strong>{noticeSummary}</strong>
          </div>
          <ChevronRight />
        </button>
        {selectedFlowRide && (
          <section className="chat-eta-card">
            <div>
              <Navigation />
              <span>
                <small>최종 목적지</small>
                <strong>{selectedFlowRide.destination}</strong>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                <small>등록 일정 기준 도착 예정</small>
                <strong>
                  {formatEtaTime(selectedFlowRide.estimatedArrival)}
                </strong>
              </span>
            </div>
            <p>
              주요 경유지 · {selectedFlowRide.waypoints || DIRECT_ROUTE_LABEL} ·
              약 {selectedFlowRide.estimatedDuration}분 ·{" "}
              {selectedFlowRide.status}
            </p>
          </section>
        )}
        {selectedFlowRide?.status === "정산 대기" && (
          <section className="chat-settlement-card">
            <span className="tag waiting">정산 대기</span>
            <strong>운행이 종료되었습니다. 정산을 진행해 주세요.</strong>
            <p>
              {selectedFlowRide.start} → {selectedFlowRide.destination} ·{" "}
              {selectedFlowRide.price.toLocaleString()} P
            </p>
            <Button onClick={() => setSettlementConfirmOpen(true)}>
              정산하기
            </Button>
          </section>
        )}
        {selectedFlowRide?.status === "완료" && (
          <section className="chat-settlement-card complete">
            <span className="tag open">정산 완료</span>
            <strong>이 카풀의 정산이 완료되었습니다.</strong>
          </section>
        )}
        <div className="messages">
          {Array.isArray(roomMessages) && roomMessages.length > 0 ? (
            <>
              <span className="date-divider">실시간 대화</span>
              {roomMessages.map((msg) => {
                const isMine =
                  msg?.senderId === currentUserId ||
                  (Boolean(currentLoginId) && msg?.senderId === currentLoginId)
                const senderLabel = normalizeDisplayName(
                  msg?.senderName || counterpartName,
                )
                const senderInitial = senderLabel.slice(0, 1) || "?"

                if (isMine) {
                  return (
                    <div className="bubble mine" key={msg.id}>
                      <p>{msg?.text || ""}</p>
                      <time>{formatChatTimestamp(msg?.createdAt)}</time>
                    </div>
                  )
                }

                return (
                  <div className="bubble other" key={msg.id}>
                    <div
                      className="chat-sender-row clickable-profile-trigger"
                      role="button"
                      tabIndex={0}
                      aria-label={`${senderLabel} 프로필 상세 보기`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          id: msg?.senderId || counterpartProfile.id,
                          name: senderLabel,
                          role: counterpartProfile.role,
                          carInfo:
                            selectedFlowRide?.vehicle ||
                            counterpartProfile.carInfo,
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            id: msg?.senderId || counterpartProfile.id,
                            name: senderLabel,
                            role: counterpartProfile.role,
                            carInfo:
                              selectedFlowRide?.vehicle ||
                              counterpartProfile.carInfo,
                          })
                        }
                      }}
                    >
                      <div className="avatar small">{senderInitial}</div>
                      <span className="chat-name">
                        {senderLabel} <ShieldCheck aria-label="인증 사용자" />
                      </span>
                    </div>
                    <p>{msg?.text || ""}</p>
                    <time>{formatChatTimestamp(msg?.createdAt)}</time>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="chat-room-empty-messages">
              <MessageCircle />
              <strong>아직 주고받은 메시지가 없습니다.</strong>
              <p>
                {counterpartName}님에게 탑승 위치나 출발 시간을 먼저 문의해
                보세요.
              </p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="quick-messages">
          {quickMessages.map((message) => (
            <button onClick={() => setDraft(message)} key={message}>
              {message}
            </button>
          ))}
        </div>
        <div className="chat-input">
          <button type="button" aria-label="추가 기능">
            <Plus />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && sendMessage()}
            placeholder="메시지를 입력하세요"
          />
          <button onClick={sendMessage} disabled={!draft.trim()}>
            <Send />
          </button>
        </div>
        {leaveConfirmOpen && (
          <div
            className="dialog-backdrop flow-dialog-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setLeaveConfirmOpen(false)
            }}
          >
            <section className="app-dialog" role="alertdialog" aria-modal="true">
              <span className="dialog-icon neutral">
                <MessageCircle />
              </span>
              <h2>채팅방을 나가시겠습니까?</h2>
              <p>채팅방을 나가면 내 채팅방 목록에서 제거됩니다.</p>
              <div className="dialog-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLeaveConfirmOpen(false)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    leaveRealtimeChatRoom(selectedChat.id, currentUserId)
                    if (currentLoginId && currentLoginId !== currentUserId) {
                      leaveRealtimeChatRoom(selectedChat.id, currentLoginId)
                    }
                    setLeaveConfirmOpen(false)
                    setSelectedChatId(null)
                  }}
                >
                  나가기
                </Button>
              </div>
            </section>
          </div>
        )}
        {noticeOpen && (
          <div
            className="notice-detail-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setNoticeOpen(false)
            }}
          >
            <section
              className="notice-detail-window"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notice-detail-title"
            >
              <header>
                <button
                  className="icon-button"
                  onClick={() => setNoticeOpen(false)}
                  aria-label="공지 상세 닫기"
                >
                  <ArrowLeft />
                </button>
                <strong id="notice-detail-title">상세보기</strong>
                <div>
                  <button className="icon-button" aria-label="댓글 보기">
                    <MessageCircle />
                  </button>
                  <button className="icon-button" aria-label="공지 더보기">
                    <MoreHorizontal />
                  </button>
                </div>
              </header>
              <div className="notice-detail-scroll">
                <section
                  className="notice-author clickable-profile-trigger"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    onViewUserProfile({
                      name: noticeAuthor,
                      role: "driver",
                      carInfo: selectedFlowRide?.vehicle,
                    })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.stopPropagation()
                      onViewUserProfile({
                        name: noticeAuthor,
                        role: "driver",
                        carInfo: selectedFlowRide?.vehicle,
                      })
                    }
                  }}
                >
                  <div className="avatar">
                    {(noticeAuthor || "운").slice(0, 1)}
                  </div>
                  <div>
                    <strong>{noticeAuthor}</strong>
                    <span>공지</span>
                  </div>
                </section>
                <article className="notice-body">
                  <h2>{noticeSummary}</h2>
                  {noticeBody.split("\n\n").map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </article>
                <button
                  className={`notice-like ${noticeLiked ? "active" : ""}`}
                  onClick={() => setNoticeLiked((current) => !current)}
                  aria-pressed={noticeLiked}
                >
                  <Heart />
                  <span>
                    {noticeLiked
                      ? "좋아요를 남겼습니다."
                      : "가장 먼저 좋아요를 남겨보세요."}
                  </span>
                </button>
                {noticeComments.length > 0 && (
                  <section className="notice-comments">
                    <strong>댓글 {noticeComments.length}</strong>
                    {noticeComments.map((comment, index) => (
                      <article key={`${comment}-${index}`}>
                        <div
                          className="avatar green clickable-profile-trigger"
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            onViewUserProfile({
                              id: currentUserId,
                              name: currentUserName,
                              role,
                            })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              event.stopPropagation()
                              onViewUserProfile({
                                id: currentUserId,
                                name: currentUserName,
                                role,
                              })
                            }
                          }}
                        >
                          {currentUserName.slice(0, 1) || "나"}
                        </div>
                        <div>
                          <strong
                            className="clickable-profile-inline"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              onViewUserProfile({
                                id: currentUserId,
                                name: currentUserName,
                                role,
                              })
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                event.stopPropagation()
                                onViewUserProfile({
                                  id: currentUserId,
                                  name: currentUserName,
                                  role,
                                })
                              }
                            }}
                          >
                            {currentUserName}
                          </strong>
                          <p>{comment}</p>
                          <span>방금 전</span>
                        </div>
                      </article>
                    ))}
                  </section>
                )}
              </div>
              <div className="notice-comment-input">
                <Smile />
                <input
                  value={noticeComment}
                  maxLength={300}
                  onChange={(event) => setNoticeComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || !noticeComment.trim()) return
                    setNoticeComments((current) => [
                      ...current,
                      noticeComment.trim(),
                    ])
                    setNoticeComment("")
                  }}
                  placeholder="댓글을 남겨보세요."
                  aria-label="공지 댓글"
                />
                <button
                  disabled={!noticeComment.trim()}
                  onClick={() => {
                    if (!noticeComment.trim()) return
                    setNoticeComments((current) => [
                      ...current,
                      noticeComment.trim(),
                    ])
                    setNoticeComment("")
                  }}
                >
                  등록
                </button>
              </div>
            </section>
          </div>
        )}
        {settlementConfirmOpen && selectedFlowRide && (
          <div className="dialog-backdrop flow-dialog-backdrop">
            <section className="app-dialog">
              <span className="dialog-icon neutral">
                <WalletCards />
              </span>
              <h2>정산을 진행할까요?</h2>
              <p>운행이 완료된 카풀의 정산을 진행합니다.</p>
              <div className="dialog-actions">
                <Button
                  variant="ghost"
                  onClick={() => setSettlementConfirmOpen(false)}
                >
                  취소
                </Button>
                <Button
                  onClick={() => {
                    settleCarpoolRide(selectedFlowRide.id)
                    setSettlementConfirmOpen(false)
                  }}
                >
                  정산 완료
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    )

  return (
    <div className="page page--plain">
      <div className={`page-title ${isSearchOpen ? "chat-search-header" : ""}`}>
        {isSearchOpen ? (
          <>
            <label className="chat-search-field">
              <Search />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="채팅방, 경로, 참여자 검색"
                aria-label="채팅방 검색"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    searchInputRef.current?.focus()
                  }}
                  aria-label="검색어 삭제"
                >
                  <X />
                </button>
              )}
            </label>
            <button
              type="button"
              className="chat-search-cancel"
              onClick={() => {
                setIsSearchOpen(false)
                setSearchQuery("")
              }}
            >
              취소
            </button>
          </>
        ) : (
          <>
            <div>
              <span className="eyebrow">MESSAGES</span>
              <h1>채팅</h1>
            </div>
            <button
              className="icon-button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="채팅방 검색"
            >
              <Search />
            </button>
          </>
        )}
      </div>
      {Array.isArray(filteredChatRooms) && filteredChatRooms.length > 0 ? (
        <>
          <div className="chat-list">
            {filteredChatRooms.map((room, index) => {
              const roomCounterpart = getCounterpartProfile(
                room,
                currentUserId,
                currentLoginId,
              )
              const primaryMemberName = normalizeDisplayName(
                roomCounterpart?.name,
              )
              const avatarInitial = primaryMemberName.slice(0, 1) || "?"
              const roomMsgs = getMessagesForRoom(room?.id)
              const lastMsgObj = roomMsgs.at(-1)
              const previewText =
                lastMsgObj?.text ||
                room?.lastMessage ||
                "카풀 채팅방이 생성되었습니다. 대화를 시작해 보세요."
              const previewTime = formatChatRoomListTime(
                lastMsgObj?.createdAt || room?.lastMessageAt || room?.createdAt,
              )

              return (
                <button
                  onClick={() => setSelectedChatId(room.id)}
                  key={room.id}
                >
                  <div
                    className={`avatar clickable-profile-trigger ${
                      index > 0 ? "green" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${primaryMemberName} 프로필 상세 보기`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onViewUserProfile({
                        id: roomCounterpart.id,
                        name: primaryMemberName,
                        role: roomCounterpart.role,
                        carInfo: roomCounterpart.carInfo,
                      })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.stopPropagation()
                        onViewUserProfile({
                          id: roomCounterpart.id,
                          name: primaryMemberName,
                          role: roomCounterpart.role,
                          carInfo: roomCounterpart.carInfo,
                        })
                      }
                    }}
                  >
                    {avatarInitial}
                  </div>
                  <div>
                    <strong>{room?.title || "카풀 채팅방"}</strong>
                    <span
                      className="clickable-profile-inline"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          id: roomCounterpart.id,
                          name: primaryMemberName,
                          role: roomCounterpart.role,
                          carInfo: roomCounterpart.carInfo,
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            id: roomCounterpart.id,
                            name: primaryMemberName,
                            role: roomCounterpart.role,
                            carInfo: roomCounterpart.carInfo,
                          })
                        }
                      }}
                    >
                      {primaryMemberName} · {currentUserName}
                    </span>
                    <p>{previewText}</p>
                  </div>
                  <div>
                    <time>{previewTime}</time>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="empty-hint">
            <MessageCircle />
            <span>
              {hasSearchQuery
                ? `${filteredChatRooms.length}개의 채팅방을 찾았어요.`
                : "내가 참여 중인 카풀 채팅방이 실시간으로 동기화됩니다."}
            </span>
          </div>
        </>
      ) : (
        <div className="chat-search-empty">
          <MessageCircle />
          <strong>
            {hasSearchQuery
              ? "검색 결과가 없습니다."
              : "참여 중인 채팅방이 없습니다."}
          </strong>
          <p>
            {hasSearchQuery
              ? "다른 이름이나 경로로 검색해 보세요."
              : "카풀 게시글에서 채팅하기를 누르거나 탑승 신청을 진행하면 채팅방이 생성됩니다."}
          </p>
        </div>
      )}
    </div>
  )
}

function ProfilePage({
  role,
  registrations,
  changeRole,
  route,
  account,
  selectedBadges,
  open,
  logout,
  pointBalance,
  mileageBalance,
  carpoolFlow,
}: {
  role: Role
  registrations?: RoleRegistrations
  changeRole: (r: Role) => void
  route: RouteData
  account: AccountData
  selectedBadges: Record<Role, string[]>
  open: (s: Sheet) => void
  logout: () => void
  pointBalance: number
  mileageBalance: number
  carpoolFlow: DemoCarpoolState
}) {
  const userReviewStorageKey = `received-reviews-${account.id || account.loginId || "user"}`
  const flowReviews: DemoReview[] = carpoolFlow.reviews
    .filter((review) => {
      if (!account.id && !account.loginId && !account.name) return false
      if (
        (account.id && review.targetId === account.id) ||
        (account.loginId && review.targetId === account.loginId)
      ) {
        return true
      }
      const targetRide = carpoolFlow.rides.find((r) => r.id === review.rideId)
      return Boolean(
        targetRide &&
          ((account.id && targetRide.driverId === account.id) ||
            (account.loginId && targetRide.driverId === account.loginId) ||
            (account.name && targetRide.driverName === account.name)),
      )
    })
    .map((review) => ({
      author: "탑승자 리뷰",
      date: new Date(review.createdAt).toLocaleDateString("ko-KR"),
      score: Number.isFinite(review.rating) ? review.rating : 0,
      text: review.content || "후기 내용 없이 매너 키워드만 남겼어요.",
      tags: Array.isArray(review.keywords) ? review.keywords : [],
    }))
  const userReceivedReviews = readDemoList<DemoReview>(userReviewStorageKey)
  const profileReviews = [...flowReviews, ...userReceivedReviews]
  const reviewCount = profileReviews.length
  const averageRating =
    reviewCount > 0
      ? (
          profileReviews.reduce(
            (sum, item) => sum + (Number(item?.score) || 0),
            0,
          ) / reviewCount
        ).toFixed(1)
      : "0.0"

  const myDriverCompletedCount = carpoolFlow.rides.filter(
    (ride) =>
      (ride.driverId === account.id ||
        ride.driverId === account.loginId ||
        ride.driverName === account.name) &&
      ride.status === "완료",
  ).length

  const myRiderCompletedCount = carpoolFlow.applications.filter(
    (app) =>
      ((account.id && app.riderId === account.id) ||
        (account.loginId && app.riderId === account.loginId) ||
        (account.name && app.riderName === account.name)) &&
      app.status === "승인 완료" &&
      carpoolFlow.rides.some(
        (ride) => ride.id === app.rideId && ride.status === "완료",
      ),
  ).length
  const activeBadgeIds = useMemo(() => {
    const baseIds = selectedBadges[role] ? [...selectedBadges[role]] : []
    if (account.isDriverVerified && !baseIds.includes("driver-license")) {
      baseIds.unshift("driver-license")
    }
    return baseIds
  }, [account.isDriverVerified, role, selectedBadges])
  const visibleBadges = demoProfileBadges
    .filter(
      (badge) =>
        (badge.role === role ||
          (account.isDriverVerified && badge.id === "driver-license")) &&
        activeBadgeIds.includes(badge.id),
    )
    .slice(0, 3)
  return (
    <div className="page page--plain">
      <div className="page-title">
        <div>
          <span className="eyebrow">MY SHINGU-GIL</span>
          <h1>프로필</h1>
        </div>
        <button
          className="profile-edit-button"
          onClick={() => open("account-edit")}
        >
          수정
        </button>
      </div>
      <section className="profile-card">
        <div className="profile-avatar">
          {account.name.slice(0, 1) || "신"}
          <span>
            <ShieldCheck />
          </span>
        </div>
        <div>
          <h2>{account.name || "사용자"}</h2>
          <p>{account.email || "이메일 미등록"}</p>
          <div className="profile-verified-row">
            <span className="verified-text">
              <ShieldCheck /> 학교 이메일 인증
            </span>
            {account.isDriverVerified && (
              <span className="verified-text verified-text--driver">
                <ShieldCheck /> 면허증 인증
              </span>
            )}
          </div>
        </div>
        <button onClick={() => open("account")} aria-label="내 계정 정보">
          <ChevronRight />
        </button>
      </section>
      {visibleBadges.length > 0 && (
        <section className="profile-badge-chips" aria-label="대표 뱃지">
          {visibleBadges.map((badge) => (
            <span className={`profile-badge tone-${badge.tone}`} key={badge.id}>
              <BadgeGlyph badge={badge} />
              {badge.label}
            </span>
          ))}
        </section>
      )}
      <section className="profile-summary" aria-label="카풀 활동 요약">
        <div>
          <strong>
            {role === "driver"
              ? `${myDriverCompletedCount}회`
              : `${myRiderCompletedCount}회`}
          </strong>
          <span>{role === "driver" ? "운전 횟수" : "탑승 횟수"}</span>
        </div>
        <div>
          <strong className="rating-score">
            <Star /> {averageRating}
          </strong>
          <span>별점</span>
        </div>
        <button onClick={() => open("reviews")}>
          <strong>
            {reviewCount} <ChevronRight />
          </strong>
          <span>후기 보기</span>
        </button>
      </section>
      <section className="profile-roles">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h2>계정 변경</h2>
          </div>
          <small>계정과 잔액은 그대로 유지돼요</small>
        </div>
        <div className="role-switcher">
          {(["rider", "driver"] as Role[]).map((item) => (
            <button
              className={role === item ? "active" : ""}
              onClick={() => changeRole(item)}
              key={item}
            >
              {item === "driver" ? <CarFront /> : <UsersRound />}
              <span>
                <strong>{item === "driver" ? "운전자" : "탑승자"}</strong>
                <small>
                  {item === "driver" && account.isDriverVerified
                    ? "면허증 인증 완료"
                    : role === item
                      ? "현재 역할"
                      : registrations?.[item]
                        ? "등록 완료"
                        : "등록 필요"}
                </small>
              </span>
              {role === item ? <Check /> : <ChevronRight />}
            </button>
          ))}
        </div>
      </section>
      <div className="profile-info-heading">
        <span className="eyebrow">INFO</span>
        <h2>정보</h2>
      </div>
      <div className={`balance-card ${role === "rider" ? "single" : ""}`}>
        <button className="balance-card__points" onClick={() => open("points")}>
          <WalletCards />
          <span>
            보유 포인트<strong>{formatPoints(pointBalance)}</strong>
          </span>
          <ChevronRight />
        </button>
        {role === "driver" && (
          <button onClick={() => open("mileage")}>
            <Star />
            <span>
              마일리지
              <strong>{mileageBalance.toLocaleString("ko-KR")} M</strong>
            </span>
            <ChevronRight />
          </button>
        )}
      </div>
      <section className="profile-route">
        <div className="section-heading">
          <h2>나의 기본 경로</h2>
          <button onClick={() => open("route-edit")}>수정</button>
        </div>
        <RouteCard route={route} />
      </section>
      <nav className="menu-list">
        <button onClick={() => open("history")}>
          <CreditCard />
          <span>결제 및 이용 내역</span>
          <ChevronRight />
        </button>
        <button onClick={() => open("safety")}>
          <ShieldCheck />
          <span>안전 및 신고 관리</span>
          <ChevronRight />
        </button>
        <button onClick={() => open("settings")}>
          <Settings />
          <span>설정</span>
          <ChevronRight />
        </button>
        <button
          onClick={async () => {
            const ok = await showAppConfirm({
              title: "로그아웃",
              message: "현재 계정에서 로그아웃할까요?",
              confirmText: "로그아웃",
              cancelText: "취소",
              variant: "danger",
            })
            if (ok) {
              logout()
            }
          }}
        >
          <ArrowLeft />
          <span>로그아웃</span>
          <ChevronRight />
        </button>
      </nav>
      <p className="version">신구길 v1.0.0</p>
    </div>
  )
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items: [Tab, ReactNode, string][] = [
    ["home", <Home />, "홈"],
    ["schedule", <CalendarDays />, "일정"],
    ["chat", <MessageCircle />, "채팅"],
    ["profile", <UserRound />, "프로필"],
  ]
  return (
    <nav className="bottom-nav">
      {items.map(([id, icon, label]) => (
        <button
          className={tab === id ? "active" : ""}
          onClick={() => setTab(id)}
          key={id}
        >
          {icon}
          <span>{label}</span>
          {id === "chat" && <i />}
        </button>
      ))}
    </nav>
  )
}

function RoleRegistration({
  role,
  onComplete,
  account,
}: {
  role: Role
  onComplete: (role: Role) => void
  account?: AccountData
}) {
  const [licenseVerified, setLicenseVerified] = useState(false)
  const [capacity, setCapacity] = useState(5)
  const [seats, setSeats] = useState(3)
  const [agreed, setAgreed] = useState(false)
  const [weekdays, setWeekdays] = useState(["월", "화", "수", "목", "금"])
  const [regDepartureTime, setRegDepartureTime] = useState("08:10")
  const [regTimePickerOpen, setRegTimePickerOpen] = useState(false)

  const toggleDay = (day: string) =>
    setWeekdays((days) =>
      days.includes(day) ? days.filter((item) => item !== day) : [...days, day],
    )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data = Object.fromEntries(form.entries())
    delete data.license
    writeDemoData(`${role}-profile`, {
      ...data,
      weekdays,
      licenseVerified: role === "driver" ? licenseVerified : undefined,
      capacity: role === "driver" ? capacity : undefined,
      seats: role === "driver" ? seats : undefined,
    })
    onComplete(role)
  }

  return (
    <form className="registration-form" onSubmit={submit}>
      <div className="account-confirm">
        <div className="profile-avatar small">
          {account?.name?.slice(0, 1) || "신"}
          <span>
            <ShieldCheck />
          </span>
        </div>
        <div>
          <strong>{account?.name || "사용자"}</strong>
          <span>{account?.email || ""}</span>
          <small>
            <Check /> 신구대학교 이메일 인증 완료
          </small>
        </div>
      </div>
      <div className="registration-intro">
        <span className="eyebrow">
          {role === "driver" ? "DRIVER REGISTRATION" : "RIDER REGISTRATION"}
        </span>
        <h2>{role === "driver" ? "운전자 등록" : "탑승자 등록"}</h2>
        <p>
          기존 계정과 포인트, 이용 내역은 유지되며 역할별 정보만 별도로
          저장됩니다.
        </p>
      </div>

      {role === "driver" && (
        <section className="registration-section">
          <div className="form-section-title">
            <span>1</span>
            <div>
              <strong>면허 및 차량 인증</strong>
              <small>인증 정보는 다른 사용자에게 공개되지 않아요.</small>
            </div>
          </div>
          <Field
            label="운전면허증 (이미지 또는 PDF)"
            name="license"
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={(event) => {
              if (event.target.files?.length) {
                setLicenseVerified(true)
              }
            }}
          />
          <Button
            type="button"
            variant={licenseVerified ? "soft" : "secondary"}
            onClick={() => setLicenseVerified(true)}
          >
            {licenseVerified ? (
              <>
                <Check /> 면허증 인증 완료
              </>
            ) : (
              <>
                <ShieldCheck /> 면허 인증하기
              </>
            )}
          </Button>
          <p className="helper">
            안전한 카풀 운행을 위해 운전면허 정보를 확인합니다.
          </p>
          <div className="two-fields">
            <Field label="차량 종류" name="carType" defaultValue="승용차" />
            <Field label="차종" name="carModel" placeholder="예: 아반떼" />
          </div>
          <div className="two-fields">
            <label className="field">
              <span>차량 정원</span>
              <span className="field__control">
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={capacity}
                  onChange={(event) => {
                    const next = Math.max(2, Number(event.target.value))
                    setCapacity(next)
                    setSeats((current) => Math.min(current, next - 1))
                  }}
                />
              </span>
            </label>
            <label className="field">
              <span>모집 가능 좌석</span>
              <span className="field__control">
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, capacity - 1)}
                  value={seats}
                  onChange={(event) =>
                    setSeats(
                      Math.max(
                        1,
                        Math.min(Number(event.target.value), capacity - 1),
                      ),
                    )
                  }
                />
              </span>
            </label>
          </div>
          <p className="seat-rule">
            <ShieldCheck /> 운전자 좌석을 제외한 최대 {capacity - 1}석까지
            모집할 수 있어요.
          </p>
        </section>
      )}

      <section className="registration-section">
        <div className="form-section-title">
          <span>{role === "driver" ? "2" : "1"}</span>
          <div>
            <strong>기본 경로</strong>
            <small>역이나 공공장소처럼 안전한 장소를 입력해 주세요.</small>
          </div>
        </div>
        <Field
          label="기본 출발 지역"
          name="start"
          placeholder="예: 모란역 5번 출구"
          icon={<MapPin />}
        />
        <Field
          label="기본 목적지"
          name="destination"
          placeholder="예: 신구대학교 정문"
          icon={<Navigation />}
        />
        <Field
          label={role === "driver" ? "자주 지나는 주요 거점" : "선호 탑승 장소"}
          name="waypoint"
          placeholder={
            role === "driver"
              ? "예: 태평역, 성남시청"
              : "예: 모란역 공공 승차 구역"
          }
          icon={<MapPin />}
        />
      </section>

      <section className="registration-section">
        <div className="form-section-title">
          <span>{role === "driver" ? "3" : "2"}</span>
          <div>
            <strong>이용 일정</strong>
            <small>추천과 일정 등록에 활용돼요.</small>
          </div>
        </div>
        <label className="field">
          <span>자주 이용하는 요일</span>
          <span className="weekday-selector">
            {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
              <button
                type="button"
                className={weekdays.includes(day) ? "active" : ""}
                onClick={() => toggleDay(day)}
                key={day}
              >
                {day}
              </button>
            ))}
          </span>
        </label>
        <div className="field">
          <span>
            {role === "driver" ? "주로 출발하는 시간대" : "희망 출발 시간대"}
          </span>
          <input type="hidden" name="departureTime" value={regDepartureTime} />
          <button
            type="button"
            className="field__control custom-picker-trigger"
            onClick={() => setRegTimePickerOpen(true)}
          >
            <Clock3 />
            <span>
              {formatKoreanTimeLabel(regDepartureTime)} ({regDepartureTime})
            </span>
          </button>
        </div>
        <CustomTimePickerModal
          isOpen={regTimePickerOpen}
          value={regDepartureTime}
          title={
            role === "driver" ? "주로 출발하는 시간대" : "희망 출발 시간대"
          }
          onClose={() => setRegTimePickerOpen(false)}
          onConfirm={(nextTime) => setRegDepartureTime(nextTime)}
        />
      </section>

      <label className="check-row registration-agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span className={agreed ? "checked" : ""}>{agreed && <Check />}</span>
        필수 약관과 역할별 개인정보 처리에 동의합니다.
      </label>
      <Button
        type="submit"
        disabled={!agreed || (role === "driver" && !licenseVerified)}
      >
        {role === "driver" && !licenseVerified
          ? "면허 인증 후 등록할 수 있어요"
          : `${role === "driver" ? "운전자" : "탑승자"} 등록 완료`}
      </Button>
    </form>
  )
}

function SheetView({
  type,
  close,
  open,
  role,
  route,
  account,
  selectedBadges,
  tripFlow,
  registrations,
  onSelectRole,
  onCompleteRole,
  onSaveRoute,
  onSaveAccount,
  onSaveBadges,
  onCompletePayment,
  onGoHome,
  pointWallet,
  mileageBalance,
  carpoolFlow,
  selectedRide,
  onViewUserProfile,
  onStartCarpoolChat,
}: {
  type: Exclude<Sheet, null>
  close: () => void
  open: (sheet: Sheet) => void
  role: Role
  route: RouteData
  account: AccountData
  selectedBadges: Record<Role, string[]>
  tripFlow: DemoTripFlow
  registrations: RoleRegistrations
  onSelectRole: (role: Role) => void
  onCompleteRole: (role: Role) => void
  onSaveRoute: (route: RouteData) => void
  onSaveAccount: (account: AccountData) => void
  onSaveBadges: (role: Role, badgeIds: string[]) => void
  onCompletePayment: () => void
  onGoHome: () => void
  pointWallet: DemoPointWallet
  mileageBalance: number
  carpoolFlow: DemoCarpoolState
  selectedRide: MatchRide | null
  onViewUserProfile: (target: PublicUserProfileTarget) => void
  onStartCarpoolChat: (
    targetUser: CreateOrJoinChatParams["targetUser"],
    rideInfo: CreateOrJoinChatParams["ride"],
  ) => void
}) {
  const sheetRef = useRef<HTMLElement>(null)
  const mileageBarcodeRef = useRef<SVGSVGElement>(null)
  const [mileageBarcodeOpen, setMileageBarcodeOpen] = useState(false)
  const [mileageBarcodeError, setMileageBarcodeError] = useState("")
  const [mileageBarcodeAttempt, setMileageBarcodeAttempt] = useState(0)
  const [mileageMemberCode, setMileageMemberCode] = useState(() =>
    getOrCreateMileageMemberCode(account.id, role),
  )
  const [appliedRideIds, setAppliedRideIds] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() =>
    String(new Date().getDate()),
  )
  const [editingAccount, setEditingAccount] = useState(false)
  const [reviewed, setReviewed] = useState(
    () => readDemoValue("review-ride-0516") === "true",
  )
  const sheetReviewStorageKey = `received-reviews-${account.id || account.loginId || "user"}`
  const [reviewText, setReviewText] = useState("")
  const [savedReviews, setSavedReviews] = useState<DemoReview[]>(() =>
    readDemoList<DemoReview>(sheetReviewStorageKey),
  )
  const [rating, setRating] = useState(0)
  const [applicationFilter, setApplicationFilter] = useState("전체")
  const [historyFilter, setHistoryFilter] = useState<"전체" | "적립" | "사용">(
    "전체",
  )
  const [activeTab, setActiveTab] =
    useState<"전체" | "결제 내역" | "이용 내역" | "취소·환불">("전체")
  const calendarToday = new Date()
  const [calendarView, setCalendarView] = useState(
    new Date(calendarToday.getFullYear(), calendarToday.getMonth(), 1),
  )
  const [applicationCancelled, setApplicationCancelled] = useState(
    () => readDemoValue("application-0521") === "cancelled",
  )
  const [routeDraft, setRouteDraft] = useState(route)
  const [routeDirty, setRouteDirty] = useState(false)
  const [accountDraft, setAccountDraft] = useState(account)
  const [badgeDraft, setBadgeDraft] = useState<string[]>(
    selectedBadges[role] || [],
  )
  const [badgeError, setBadgeError] = useState("")
  const [reports, setReports] = useState<SafetyReport[]>(getSafetyReports)
  const [blockedUsers, setBlockedUsers] =
    useState<BlockedUser[]>(getBlockedUsers)
  const [reportTargetId, setReportTargetId] = useState("")
  const [reportReason, setReportReason] = useState("")
  const [reportDetails, setReportDetails] = useState("")
  const [reportImages, setReportImages] = useState<string[]>([])
  const [reportErrors, setReportErrors] = useState<{
    target?: string
    reason?: string
    images?: string
    submit?: string
  }>({})
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [unblockCandidate, setUnblockCandidate] = useState<BlockedUser | null>(
    null,
  )
  const [reportFilter, setReportFilter] =
    useState<"전체" | "검토 중" | "처리 완료">("전체")
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(getNotificationSettings)
  const [notificationBackup, setNotificationBackup] =
    useState<NotificationSettings>(notificationSettings)
  const [biometricEnabled, setBiometricEnabled] = useState(
    getBiometricDemoState,
  )
  const [biometricHardwareInfo, setBiometricHardwareInfo] = useState<{
    supported: boolean
    reason?: string
  } | null>(null)
  const [securityNotice, setSecurityNotice] = useState("")
  const [devices, setDevices] = useState<DemoDevice[]>(getDemoDevices)
  const [customDeviceName, setCustomDeviceName] = useState("")
  const [settingsDialog, setSettingsDialog] =
    useState<"school" | "password" | "password-note" | "biometric" | "devices" | "device-logout" | "withdraw-1" | "withdraw-2" | "withdraw-note" | "inquiry-success" | null>(
      null,
    )
  const [selectedDevice, setSelectedDevice] = useState<DemoDevice | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  )
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false)
  const [openFaqs, setOpenFaqs] = useState<string[]>(() =>
    readDemoList<string>("open-faqs"),
  )
  const [inquiryCategory, setInquiryCategory] = useState("")
  const [inquiryTitle, setInquiryTitle] = useState("")
  const [inquiryContent, setInquiryContent] = useState("")
  const [inquiryErrors, setInquiryErrors] = useState<Record<string, string>>({})
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [selectedChargeAmount, setSelectedChargeAmount] =
    useState<number | null>(null)
  const [customChargeAmount, setCustomChargeAmount] = useState("")
  const [chargePaymentMethod, setChargePaymentMethod] =
    useState<DemoPaymentMethod | null>(null)
  const [chargeErrors, setChargeErrors] = useState<{
    amount?: string
    paymentMethod?: string
  }>({})
  const [chargeConfirmOpen, setChargeConfirmOpen] = useState(false)
  const [completedCharge, setCompletedCharge] =
    useState<DemoPointCharge | null>(null)
  const [isCharging, setIsCharging] = useState(false)
  const [flowNotice, setFlowNotice] = useState("")
  const [profileSaved, setProfileSaved] = useState(false)
  const [createDraft, setCreateDraft] = useState({
    date: getTodayDateKey(),
    time: route.departureTime || "08:30",
    start: route.start,
    destination: route.destination,
    vehicle: account.vehicleName || "",
    totalSeats: String(
      account.vehicleCapacity ? Math.max(1, account.vehicleCapacity - 1) : 3,
    ),
    price: "2800",
    waypoints: route.waypoint,
    note: "",
    estimatedDuration: String(DEFAULT_ESTIMATED_DURATION),
    estimatedArrival: "",
    arrivalTimeManual: false,
    smokingPreference: route.smokingPreference ?? "비흡연자 선호",
    genderPreference: route.genderPreference ?? "성별 무관",
  })
  const [activeSheetPicker, setActiveSheetPicker] = useState<
    "none" | "create-date" | "create-time" | "route-departure" | "route-arrival"
  >("none")
  const [routeTimeAlert, setRouteTimeAlert] = useState("")
  const [routeTimeAutoNotice, setRouteTimeAutoNotice] = useState("")
  const [createError, setCreateError] = useState("")
  useEffect(() => {
    setActiveSheetPicker("none")
  }, [type])
  useEffect(() => {
    setRouteDraft(route)
    setCreateDraft((prev) => ({
      ...prev,
      time: route.departureTime || prev.time,
      start: route.start || prev.start,
      destination: route.destination || prev.destination,
      vehicle: prev.vehicle || account.vehicleName || "",
    }))
  }, [route, account.vehicleName])
  const now = new Date()
  const [reservationMonth, setReservationMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1),
  )
  const [reservationDate, setReservationDate] = useState("")
  const [reservationSearched, setReservationSearched] = useState(false)
  const [applyRide, setApplyRide] = useState<DemoCarpoolRide | null>(null)
  const [reviewKeywords, setReviewKeywords] = useState<string[]>([])
  const chargingRef = useRef(false)
  useEffect(() => {
    if (!mileageBarcodeOpen) return
    setMileageBarcodeError("")
    try {
      if (!mileageMemberCode || !mileageBarcodeRef.current)
        throw new Error("Barcode data unavailable")
      mileageBarcodeRef.current.replaceChildren()
      JsBarcode(mileageBarcodeRef.current, mileageMemberCode, {
        format: "CODE128",
        lineColor: "#000000",
        background: "#ffffff",
        width: 2,
        height: 84,
        displayValue: false,
        margin: 14,
      })
    } catch {
      setMileageBarcodeError(
        "바코드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      )
    }
  }, [mileageBarcodeAttempt, mileageBarcodeOpen, mileageMemberCode])
  useEffect(() => {
    if (!mileageBarcodeOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMileageBarcodeOpen(false)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [mileageBarcodeOpen])
  useEffect(() => {
    if (createDraft.arrivalTimeManual) return
    const estimatedArrival = calculateEstimatedArrival(
      createDraft.date,
      createDraft.time,
      Number(createDraft.estimatedDuration),
    )
    setCreateDraft((current) =>
      current.estimatedArrival === estimatedArrival
        ? current
        : { ...current, estimatedArrival },
    )
  }, [
    createDraft.arrivalTimeManual,
    createDraft.date,
    createDraft.estimatedDuration,
    createDraft.time,
    createDraft.waypoints,
  ])
  const chargeAmount =
    selectedChargeAmount ??
    (customChargeAmount ? Number(customChargeAmount.replaceAll(",", "")) : 0)
  const reservationDays = Array.from(
    {
      length: new Date(
        reservationMonth.getFullYear(),
        reservationMonth.getMonth() + 1,
        0,
      ).getDate(),
    },
    (_, index) => index + 1,
  )
  const reservationStartDay = new Date(
    reservationMonth.getFullYear(),
    reservationMonth.getMonth(),
    1,
  ).getDay()
  const isMyApplication = (item: DemoCarpoolApplication) =>
    (account.id && item.riderId === account.id) ||
    (account.loginId && item.riderId === account.loginId) ||
    (account.name && item.riderName === account.name)
  const isMyDriverRide = (ride: DemoCarpoolRide) =>
    (account.id && ride.driverId === account.id) ||
    (account.loginId && ride.driverId === account.loginId) ||
    (account.name && ride.driverName === account.name)
  const reservationResults = carpoolFlow.rides.filter(
    (ride) =>
      ride.date === reservationDate &&
      ride.status === "모집 중" &&
      getRemainingSeats(carpoolFlow, ride.id) > 0 &&
      !carpoolFlow.applications.some(
        (item) => item.rideId === ride.id && isMyApplication(item),
      ),
  )

  const resetChargeFlow = () => {
    setChargeOpen(false)
    setSelectedChargeAmount(null)
    setCustomChargeAmount("")
    setChargePaymentMethod(null)
    setChargeErrors({})
    setChargeConfirmOpen(false)
    setCompletedCharge(null)
    setIsCharging(false)
    chargingRef.current = false
  }
  const validateCharge = () => {
    const errors: { amount?: string; paymentMethod?: string } = {}
    if (!Number.isSafeInteger(chargeAmount) || chargeAmount <= 0) {
      errors.amount = "0보다 큰 정수 포인트를 입력하거나 선택해 주세요."
    }
    if (!chargePaymentMethod) {
      errors.paymentMethod = "결제 수단을 선택해 주세요."
    }
    setChargeErrors(errors)
    if (Object.keys(errors).length === 0) setChargeConfirmOpen(true)
  }
  const completeCharge = () => {
    if (
      chargingRef.current ||
      !chargePaymentMethod ||
      !Number.isSafeInteger(chargeAmount) ||
      chargeAmount <= 0
    )
      return
    chargingRef.current = true
    setIsCharging(true)
    try {
      const charge = chargeDemoPoints(chargeAmount, chargePaymentMethod)
      setChargeConfirmOpen(false)
      setCompletedCharge(charge)
    } finally {
      setIsCharging(false)
    }
  }
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const content =
        sheetRef.current?.querySelector<HTMLElement>(".sheet-content")
      if (content) content.scrollTop = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [type])
  const userCompletedRides = carpoolFlow.rides.filter((ride) => {
    if (ride.status !== "완료") return false
    if (role === "driver") return isMyDriverRide(ride)
    return carpoolFlow.applications.some(
      (app) =>
        app.rideId === ride.id &&
        app.status === "승인 완료" &&
        isMyApplication(app),
    )
  })
  const mileageHistoryEntries = userCompletedRides.map((ride) => {
    const earned = Math.round((ride.price || 0) * 0.1)
    return {
      id: `mileage-${ride.id}`,
      date: `${ride.date} ${ride.time}`,
      title: `${ride.start} → ${ride.destination} 카풀 적립`,
      amount: `+${earned.toLocaleString("ko-KR")} M`,
      balance: `${mileageBalance.toLocaleString("ko-KR")} M`,
      type: "적립" as const,
    }
  })
  const filteredMileageHistoryEntries = mileageHistoryEntries.filter(
    (entry) => historyFilter === "전체" || (entry.type as string) === historyFilter,
  )
  const flowSheetReviews: DemoReview[] = carpoolFlow.reviews
    .filter((review) => {
      if (!account.id && !account.loginId && !account.name) return false
      if (
        (account.id && review.targetId === account.id) ||
        (account.loginId && review.targetId === account.loginId)
      ) {
        return true
      }
      const targetRide = carpoolFlow.rides.find((r) => r.id === review.rideId)
      return Boolean(
        targetRide &&
          ((account.id && targetRide.driverId === account.id) ||
            (account.loginId && targetRide.driverId === account.loginId) ||
            (account.name && targetRide.driverName === account.name)),
      )
    })
    .map((review) => ({
      author: "탑승자 리뷰",
      date: new Date(review.createdAt).toLocaleDateString("ko-KR"),
      score: Number.isFinite(review.rating) ? review.rating : 0,
      text: review.content || "후기 내용 없이 매너 키워드만 남겼어요.",
      tags: Array.isArray(review.keywords) ? review.keywords : [],
    }))
  const allReviews = [
    ...flowSheetReviews,
    ...savedReviews,
    ...demoReceivedReviews,
  ]
  const titles: Record<Exclude<Sheet, null>, string> = {
    ride: "카풀 상세",
    matches: "SMART MATCH 추천",
    create: "새 카풀 일정",
    reservation: "원하는 날짜 예약",
    notifications: "알림",
    points: "포인트 · 마일리지",
    mileage: "마일리지",
    "mileage-history":
      historyFilter === "전체"
        ? "마일리지 전체 내역"
        : historyFilter === "적립"
          ? "마일리지 적립 내역"
          : "마일리지 사용 내역",
    history: "결제 및 이용 내역",
    "carpool-payment": "카풀 결제",
    safety: "안전 관리",
    "safety-report": "사용자 신고",
    "blocked-users": "차단 사용자 관리",
    "report-history": "신고 처리 내역",
    privacy: "개인정보 보호 안내",
    "privacy-policy": "개인정보 처리방침",
    roles: "계정 변경",
    "driver-register": "운전자 등록",
    "rider-register": "탑승자 등록",
    settings: "설정",
    "notification-settings": "알림 설정",
    "security-settings": "개인정보 및 보안",
    "service-guide": "서비스 이용 안내",
    "passenger-guide": "탑승자 이용 가이드",
    "driver-guide": "운전자 이용 가이드",
    "contact-support": "1:1 문의하기",
    "route-edit": "기본 경로 수정",
    applications: role === "driver" ? "탑승 신청 관리" : "신청한 카풀",
    "application-detail": "신청 카풀 상세",
    calendar: "전체 캘린더",
    account: "내 계정 정보",
    "account-edit": "정보 수정",
    "monthly-rides": "이번 달 운행 내역",
    review: "후기 작성",
    reviews: `받은 후기 (${allReviews.length})`,
  }
  const requestClose = async () => {
    if (type === "route-edit" && routeDirty) {
      const ok = await showAppConfirm({
        title: "변경 사항 폐기",
        message: "저장하지 않은 변경 사항을 폐기할까요?",
        confirmText: "폐기하기",
        cancelText: "계속 편집",
        variant: "danger",
      })
      if (!ok) return
    }
    close()
  }
  const reviewRide = carpoolFlow.rides.find(
    (ride) =>
      ride.status === "완료" &&
      carpoolFlow.applications.some(
        (item) =>
          item.rideId === ride.id &&
          isMyApplication(item) &&
          item.status === "승인 완료",
      ) &&
      !carpoolFlow.reviews.some((review) => review.rideId === ride.id),
  )
  const averageReviewScore =
    allReviews.length > 0
      ? (
          allReviews.reduce((sum, item) => sum + item.score, 0) /
          allReviews.length
        ).toFixed(1)
      : "0.0"
  const myApplicationsList = carpoolFlow.applications.filter((app) => {
    const ride = carpoolFlow.rides.find((item) => item.id === app.rideId)
    if (!ride) return false
    return role === "driver" ? isMyDriverRide(ride) : isMyApplication(app)
  })
  const filteredApplicationsList = myApplicationsList.filter((app) => {
    const ride = carpoolFlow.rides.find((item) => item.id === app.rideId)
    if (!ride) return false
    if (applicationFilter === "전체") return true
    if (applicationFilter === "승인 대기") return app.status === "승인 대기"
    if (applicationFilter === "탑승 확정")
      return app.status === "승인 완료" && ride.status !== "완료"
    if (applicationFilter === "탑승 완료") return ride.status === "완료"
    if (applicationFilter === "거절") return app.status === "거절"
    if (applicationFilter === "취소") return app.status === "취소"
    return true
  })
  const latestApplication = myApplicationsList[0]
  const latestApplicationRide = latestApplication
    ? carpoolFlow.rides.find((item) => item.id === latestApplication.rideId)
    : undefined
  const sheetMatches = getVisibleMatchRides(route, carpoolFlow)
  const detailRide = selectedRide ?? sheetMatches[0]

  const [detailWaypoints, setDetailWaypoints] = useState<string[]>(
    () => detailRide?.waypointsList || [],
  )
  const [detailWaypointsLoading, setDetailWaypointsLoading] = useState(false)
  const [createWaypointsList, setCreateWaypointsList] = useState<string[]>([])
  const [createWaypointsLoading, setCreateWaypointsLoading] = useState(false)
  const [routeWaypointsList, setRouteWaypointsList] = useState<string[]>(
    () => route?.waypointsList || [],
  )
  const [routeWaypointsLoading, setRouteWaypointsLoading] = useState(false)

  useEffect(() => {
    if (type !== "ride" || !detailRide) return
    const syncRes = getExtractedWaypointsSync(
      detailRide.start,
      detailRide.end,
      detailRide.waypointsList ?? detailRide.via,
    )
    setDetailWaypoints(syncRes.waypointsList || [])
    let cancelled = false
    setDetailWaypointsLoading(true)
    fetchRouteWaypointsFromMapBackend({
      start: detailRide.start,
      destination: detailRide.end,
      fallbackWaypoints: detailRide.waypointsList ?? detailRide.via,
    })
      .then((res) => {
        if (cancelled) return
        setDetailWaypoints(
          Array.isArray(res?.waypointsList) ? res.waypointsList : [],
        )
      })
      .catch(() => {
        if (!cancelled) setDetailWaypoints(syncRes.waypointsList || [])
      })
      .finally(() => {
        if (!cancelled) setDetailWaypointsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, detailRide])

  useEffect(() => {
    if (type !== "create") return
    const s = (createDraft.start || "").trim()
    const d = (createDraft.destination || "").trim()
    if (!s || !d) {
      setCreateWaypointsList([])
      setCreateWaypointsLoading(false)
      return
    }
    let cancelled = false
    setCreateWaypointsLoading(true)
    const timer = window.setTimeout(() => {
      fetchRouteWaypointsFromMapBackend({
        start: s,
        destination: d,
        fallbackWaypoints: createDraft.waypoints,
      })
        .then((res) => {
          if (cancelled) return
          const safeList = Array.isArray(res?.waypointsList)
            ? res.waypointsList
            : []
          setCreateWaypointsList(safeList)
          setCreateDraft((prev) => ({
            ...prev,
            waypoints: res?.formatted || DIRECT_ROUTE_LABEL,
            estimatedDuration: String(
              res?.estimatedDurationMinutes || DEFAULT_ESTIMATED_DURATION,
            ),
          }))
        })
        .catch(() => {
          if (!cancelled) setCreateWaypointsList([])
        })
        .finally(() => {
          if (!cancelled) setCreateWaypointsLoading(false)
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [type, createDraft.start, createDraft.destination])

  useEffect(() => {
    if (type !== "route-edit") return
    const s = (routeDraft.start || "").trim()
    const d = (routeDraft.destination || "").trim()
    if (!s || !d) {
      setRouteWaypointsList([])
      setRouteWaypointsLoading(false)
      return
    }
    let cancelled = false
    setRouteWaypointsLoading(true)
    const timer = window.setTimeout(() => {
      fetchRouteWaypointsFromMapBackend({
        start: s,
        destination: d,
        fallbackWaypoints: routeDraft.waypointsList ?? routeDraft.waypoint,
      })
        .then((res) => {
          if (cancelled) return
          const safeList = Array.isArray(res?.waypointsList)
            ? res.waypointsList
            : []
          setRouteWaypointsList(safeList)
          setRouteDraft((prev) => ({
            ...prev,
            waypoint: res?.formatted || DIRECT_ROUTE_LABEL,
            waypointsList: safeList,
          }))
        })
        .catch(() => {
          if (!cancelled) setRouteWaypointsList([])
        })
        .finally(() => {
          if (!cancelled) setRouteWaypointsLoading(false)
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [type, routeDraft.start, routeDraft.destination])
  const calendarYear = calendarView.getFullYear()
  const calendarMonth = calendarView.getMonth() + 1
  const calendarStartDay = new Date(calendarYear, calendarMonth - 1, 1).getDay()
  const calendarDayCount = new Date(calendarYear, calendarMonth, 0).getDate()
  const calendarCellCount =
    Math.ceil((calendarStartDay + calendarDayCount) / 7) * 7
  const selectedCalendarKey = `${calendarYear}-${String(calendarMonth).padStart(
    2,
    "0",
  )}-${selectedDate.padStart(2, "0")}`
  const userCalendarRides = carpoolFlow.rides.filter((ride) =>
    role === "driver"
      ? isMyDriverRide(ride)
      : carpoolFlow.applications.some(
          (app) => app.rideId === ride.id && isMyApplication(app),
        ),
  )
  const selectedCalendarRides = userCalendarRides.filter(
    (ride) => ride.date === selectedCalendarKey,
  )
  const isRideApplied = (ride: MatchRide) =>
    appliedRideIds.includes(ride.id) ||
    Boolean(
      ride.flowRideId &&
      carpoolFlow.applications.some(
        (application) =>
          application.rideId === ride.flowRideId &&
          application.riderId === account.id ||
          application.riderId === "user-rider" ||
          application.riderId === "demo-rider",
      ),
    )
  const applyToMatchRide = (ride: MatchRide) => {
    if (isRideApplied(ride)) return
    if (ride.flowRideId)
      applyToCarpool(ride.flowRideId, {
        id: account.id,
        name: account.name || "탑승자",
      })
    setAppliedRideIds((current) => [...current, ride.id])
  }
  const isEditingAccount = type === "account-edit" || editingAccount
  const roleHistoryEntries = demoHistoryEntries.filter(
    (entry) => entry.role === role,
  )
  const filteredHistoryEntries: HistoryEntry[] = roleHistoryEntries.filter(
    (entry) => {
      if (activeTab === "전체") return true
      if (activeTab === "결제 내역")
        return entry.type === "결제" && entry.status === "결제 완료"
      if (activeTab === "이용 내역")
        return entry.type === "이용" && entry.status === "이용 완료"
      return entry.status === "취소 완료" || entry.status === "환불 완료"
    },
  )
  const safetyChildTypes: Exclude<Sheet, null>[] = [
    "safety-report",
    "blocked-users",
    "report-history",
    "privacy",
    "privacy-policy",
  ]
  const settingsChildTypes: Exclude<Sheet, null>[] = [
    "notification-settings",
    "security-settings",
    "service-guide",
  ]
  const handleHeaderBack = () => {
    if (
      type === "passenger-guide" ||
      type === "driver-guide" ||
      type === "contact-support"
    ) {
      open("service-guide")
      return
    }
    if (settingsChildTypes.includes(type)) {
      open("settings")
      return
    }
    if (type === "privacy-policy") {
      open("privacy")
      return
    }
    if (safetyChildTypes.includes(type)) {
      open("safety")
      return
    }
    if (type === "account-edit") {
      open("account")
      return
    }
    if (type === "mileage-history") {
      open("mileage")
      return
    }
    if (type === "application-detail") {
      open("applications")
      return
    }
    if (type === "driver-register" || type === "rider-register") {
      open("roles")
      return
    }
    requestClose()
  }
  const addEvidenceImages = async (files: FileList | null) => {
    if (!files) return
    const incomingFiles = Array.from(files)
    if (incomingFiles.some((file) => !file.type.startsWith("image/"))) {
      setReportErrors((current) => ({
        ...current,
        images: "이미지 파일만 첨부할 수 있습니다.",
      }))
      return
    }
    if (incomingFiles.some((file) => file.size > 750_000)) {
      setReportErrors((current) => ({
        ...current,
        images: "데모 저장을 위해 사진 한 장은 750KB 이하로 선택해 주세요.",
      }))
      return
    }
    const imageFiles = incomingFiles
    const remaining = 3 - reportImages.length
    if (remaining <= 0) {
      setReportErrors((current) => ({
        ...current,
        images: "사진은 최대 3장까지 첨부할 수 있습니다.",
      }))
      return
    }
    const selected = imageFiles.slice(0, remaining)
    const encoded = await Promise.all(
      selected.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.readAsDataURL(file)
          }),
      ),
    )
    setReportImages((current) => [...current, ...encoded])
    setReportErrors((current) => ({ ...current, images: undefined }))
  }
  const submitReport = () => {
    const nextErrors = {
      target: reportTargetId ? undefined : "신고 대상을 선택해 주세요.",
      reason: reportReason ? undefined : "신고 사유를 선택해 주세요.",
    }
    setReportErrors(nextErrors)
    if (nextErrors.target || nextErrors.reason) return
    const target = demoReportTargets.find((item) => item.id === reportTargetId)
    if (!target) return
    const report: SafetyReport = {
      id: `report-${Date.now()}`,
      targetId: target.id,
      targetName: target.name,
      targetRole: target.role,
      rideLabel: target.rideLabel,
      reason: reportReason,
      details: reportDetails.trim(),
      images: reportImages,
      createdAt: new Date().toLocaleDateString("ko-KR").replaceAll(" ", ""),
      status: "검토 중",
      response: "",
    }
    try {
      setReports(submitSafetyReport(report))
      setReportErrors({})
      setReportSubmitted(true)
    } catch {
      setReportErrors((current) => ({
        ...current,
        submit:
          "브라우저 저장 공간이 부족해 접수하지 못했습니다. 사진 수를 줄여 다시 시도해 주세요.",
      }))
    }
  }
  const updateNotifications = (next: NotificationSettings) => {
    setNotificationSettings(next)
    saveNotificationSettings(next)
  }
  const notificationsEnabled = Object.values(notificationSettings).some(Boolean)
  const toggleAllNotifications = () => {
    if (notificationsEnabled) {
      setNotificationBackup(notificationSettings)
      updateNotifications({
        matching: false,
        trip: false,
        chat: false,
        marketing: false,
      })
      return
    }
    const restored = Object.values(notificationBackup).some(Boolean)
      ? notificationBackup
      : {
          matching: true,
          trip: true,
          chat: true,
          marketing: false,
        }
    updateNotifications(restored)
  }
  const toggleNotification = (key: keyof NotificationSettings) => {
    if (!notificationsEnabled) return
    const next = { ...notificationSettings, [key]: !notificationSettings[key] }
    setNotificationBackup(next)
    updateNotifications(next)
  }
  const validatePasswordDemo = () => {
    const errors: Record<string, string> = {}
    if (!currentPassword) errors.current = "현재 비밀번호를 입력해 주세요."
    if (newPassword.length < 8)
      errors.new = "새 비밀번호는 8자 이상 입력해 주세요."
    if (newPassword !== newPasswordConfirm)
      errors.confirm = "새 비밀번호가 일치하지 않습니다."
    if (currentPassword && currentPassword === newPassword)
      errors.new = "현재 비밀번호와 다른 비밀번호를 입력해 주세요."
    setPasswordErrors(errors)
    if (Object.keys(errors).length === 0) setSettingsDialog("password-note")
  }
  const submitInquiry = () => {
    const errors: Record<string, string> = {}
    if (!inquiryCategory) errors.category = "문의 유형을 선택해 주세요."
    if (!inquiryTitle.trim()) errors.title = "문의 제목을 입력해 주세요."
    if (!inquiryContent.trim()) errors.content = "문의 내용을 입력해 주세요."
    setInquiryErrors(errors)
    if (Object.keys(errors).length > 0) return
    const inquiry: DemoInquiry = {
      id: `inquiry-${Date.now()}`,
      category: inquiryCategory,
      title: inquiryTitle.trim(),
      content: inquiryContent.trim(),
      createdAt: new Date().toLocaleDateString("ko-KR"),
    }
    saveDemoInquiry(inquiry)
    setSettingsDialog("inquiry-success")
  }
  if (mileageBarcodeOpen) {
    return (
      <section
        className="mileage-barcode-page"
        aria-label="마일리지 바코드"
      >
        <header>
          <button
            className="icon-button"
            onClick={() => setMileageBarcodeOpen(false)}
            aria-label="마일리지 화면으로 돌아가기"
          >
            <ArrowLeft />
          </button>
        </header>
        <div className="mileage-barcode-content">
          <div className="mileage-barcode-canvas">
            <svg
              ref={mileageBarcodeRef}
              className={mileageBarcodeError ? "is-hidden" : ""}
              role="img"
              aria-label={`${account.name}님의 마일리지 바코드`}
            />
            {mileageBarcodeError && (
              <div className="mileage-barcode-error">
                <CircleHelp />
                <p>{mileageBarcodeError}</p>
                <Button
                  variant="soft"
                  onClick={() => {
                    setMileageBarcodeError("")
                    setMileageMemberCode(
                      getOrCreateMileageMemberCode(account.id, role),
                    )
                    setMileageBarcodeAttempt((current) => current + 1)
                  }}
                >
                  다시 시도
                </Button>
              </div>
            )}
          </div>
          <code>{mileageMemberCode || "식별 코드 생성 대기"}</code>
          <p className="mileage-barcode-guide">
            교내 제휴 매장에서 마일리지 바코드를 제시해 주세요.
          </p>
        </div>
      </section>
    )
  }
  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && requestClose()
      }
    >
      <section className="sheet" ref={sheetRef}>
        <div className="sheet-handle" />
        <header>
          <button className="icon-button" onClick={handleHeaderBack}>
            {type === "reviews" ||
            type === "account-edit" ||
            type === "passenger-guide" ||
            type === "driver-guide" ||
            type === "contact-support" ||
            settingsChildTypes.includes(type) ||
            safetyChildTypes.includes(type) ? (
              <ArrowLeft />
            ) : (
              <X />
            )}
          </button>
          <strong>{titles[type]}</strong>
          <span />
        </header>
        {type === "matches" && (
          <div className="sheet-content">
            <div className="demo-banner">
              <Sparkles />
              <p>
                <strong>데모 경로 유사도</strong>
                지도 API가 연결되지 않아 저장된 출발지, 목적지, 경유지와 시간을
                비교한 결과예요.
              </p>
            </div>
            {sheetMatches.length > 0 ? (
              <div className="match-results">
                {sheetMatches.map((ride) => (
                  <article className="match-result-card" key={ride.id}>
                    <div
                      className="ride-top clickable-profile-trigger"
                      role="button"
                      tabIndex={0}
                      aria-label={`${ride.name} 운전자 프로필 상세 보기`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          name: ride.name,
                          role: "driver",
                          carInfo: ride.car,
                          rating: ride.rating,
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            name: ride.name,
                            role: "driver",
                            carInfo: ride.car,
                            rating: ride.rating,
                          })
                        }
                      }}
                    >
                      <div className="avatar">{ride.name.slice(0, 1)}</div>
                      <div>
                        <strong>
                          {ride.name} <ShieldCheck />
                        </strong>
                        <span>{ride.car}</span>
                      </div>
                      <span className="match">{ride.match}% 일치</span>
                    </div>
                    <div className="mini-route">
                      <div>
                        <i />
                        <span>
                          <strong>{ride.start}</strong>
                          <small>5월 20일 · {ride.time}</small>
                        </span>
                      </div>
                      <div className="via">
                      경유 ·{" "}
                      {Array.isArray(ride?.waypointsList) &&
                      ride.waypointsList.length > 0
                        ? ride.waypointsList.join(" · ")
                        : ride?.via || DIRECT_ROUTE_LABEL}
                    </div>
                      <div>
                        <i />
                        <span>
                          <strong>{ride.end}</strong>
                          <small className="eta-arrival">
                            {formatEtaTime(ride.estimatedArrival)} 도착 예정
                          </small>
                        </span>
                      </div>
                    </div>
                    <div className="eta-summary">
                      <Clock3 />
                      <span>
                        {ride.time} 출발 →{" "}
                        <strong>
                          {formatEtaTime(ride.estimatedArrival)} 도착 예정
                        </strong>
                      </span>
                      <small>
                        약 {ride.estimatedDuration}분 · 잔여 {ride.seats}석
                      </small>
                    </div>
                    <div className="ride-bottom">
                      <span>
                        <Star /> {ride.rating} ({ride.reviews})
                      </span>
                      <strong>{ride.price.toLocaleString()} P</strong>
                    </div>
                    <div className="match-card-actions">
                      <Button
                        type="button"
                        variant="soft"
                        onClick={() =>
                          onStartCarpoolChat(
                            {
                              id: ride.driverId || `account-${ride.name}`,
                              name: ride.name,
                              role: "driver",
                              carInfo: ride.car,
                              licenseVerified: true,
                            },
                            {
                              id: ride.flowRideId || ride.id,
                              start: ride.start,
                              destination: ride.end,
                              date: ride.date,
                              time: ride.time,
                              waypoints:
                                Array.isArray(ride?.waypointsList) &&
                                ride.waypointsList.length > 0
                                  ? ride.waypointsList.join(" · ")
                                  : ride?.via || DIRECT_ROUTE_LABEL,
                            },
                          )
                        }
                      >
                        <MessageCircle /> 채팅 문의
                      </Button>
                      <Button
                        disabled={isRideApplied(ride)}
                        onClick={() => applyToMatchRide(ride)}
                      >
                        {isRideApplied(ride) ? "신청 완료" : "탑승 신청"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="recommendation-empty">
                <Route />
                <strong>조건에 맞는 카풀이 없어요</strong>
                <p>기본 경로나 희망 시간을 조정한 뒤 다시 검색해 주세요.</p>
                <Button variant="soft" onClick={() => open("route-edit")}>
                  추천 조건 수정
                </Button>
              </div>
            )}
          </div>
        )}
        {type === "ride" && detailRide && (
          <div className="sheet-content ride-detail">
            <div
              className="driver-profile clickable-profile-trigger"
              role="button"
              tabIndex={0}
              aria-label={`${detailRide.name} 운전자 프로필 상세 보기`}
              onClick={(event) => {
                event.stopPropagation()
                onViewUserProfile({
                  name: detailRide.name,
                  role: "driver",
                  carInfo: detailRide.car,
                  rating: detailRide.rating,
                })
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onViewUserProfile({
                    name: detailRide.name,
                    role: "driver",
                    carInfo: detailRide.car,
                    rating: detailRide.rating,
                  })
                }
              }}
            >
              <div className="avatar large">{detailRide.name.slice(0, 1)}</div>
              <div>
                <h2>
                  {detailRide.name} <ShieldCheck />
                </h2>
                <p>{detailRide.car} · 면허 및 차량 데모 확인</p>
                <span>
                  <Star /> {detailRide.rating} · 후기 {detailRide.reviews}개 ·
                  프로필 상세보기
                </span>
              </div>
            </div>
            <RouteCard
              route={{
                ...route,
                start: detailRide.start,
                destination: detailRide.end,
                waypoint:
                  Array.isArray(detailWaypoints) && detailWaypoints.length > 0
                    ? detailWaypoints.join(" · ")
                    : detailRide.via,
                waypointsList: Array.isArray(detailWaypoints)
                  ? detailWaypoints
                  : [],
              }}
            />
            <div className="detail-grid">
              <div>
                <Clock3 />
                <span>
                  출발 시간
                  <strong>
                    {detailRide.date} {detailRide.time}
                  </strong>
                </span>
              </div>
              <div className="eta-detail-item">
                <Navigation />
                <span>
                  학교 도착 예정
                  <strong>{formatEtaTime(detailRide.estimatedArrival)}</strong>
                </span>
              </div>
              <div>
                <Clock3 />
                <span>
                  예상 소요 시간
                  <strong>약 {detailRide.estimatedDuration}분</strong>
                </span>
              </div>
              <div>
                <CarFront />
                <span>
                  차량 정보<strong>{detailRide.car}</strong>
                </span>
              </div>
              <div>
                <UsersRound />
                <span>
                  잔여 좌석<strong>{detailRide.seats}자리</strong>
                </span>
              </div>
              <div>
                <WalletCards />
                <span>
                  예상 비용
                  <strong>{detailRide.price.toLocaleString()} P</strong>
                </span>
              </div>
            </div>
            <div className="notice-box">
              <ShieldCheck />
              <p>
                <strong>안전한 만남 장소</strong>
                {detailRide.start}에서 만나요.
              </p>
            </div>
            <h3>확정 동승자</h3>
            <div className="co-passengers-list">
              {carpoolFlow.applications.filter(
                (app) =>
                  (app.rideId === detailRide.flowRideId ||
                    app.rideId === detailRide.id) &&
                  app.status === "승인 완료",
              ).length > 0 ? (
                carpoolFlow.applications
                  .filter(
                    (app) =>
                      (app.rideId === detailRide.flowRideId ||
                        app.rideId === detailRide.id) &&
                      app.status === "승인 완료",
                  )
                  .map((app) => ({
                    id: app.riderId,
                    name: app.riderName,
                    badge: "매너 탑승자",
                  }))
                  .filter(
                    (passenger, idx, arr) =>
                      arr.findIndex((item) => item.name === passenger.name) ===
                      idx,
                  )
                  .map((passenger) => (
                    <div
                      className="co-passenger-chip clickable-profile-trigger"
                      key={passenger.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${passenger.name} 탑승자 프로필 상세 보기`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          id: passenger.id,
                          name: passenger.name,
                          role: "rider",
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            id: passenger.id,
                            name: passenger.name,
                            role: "rider",
                          })
                        }
                      }}
                    >
                      <div className="avatar small green">
                        {passenger.name.slice(0, 1)}
                      </div>
                      <div>
                        <strong>{passenger.name}</strong>
                        <small>{passenger.badge} · 프로필 보기</small>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="waypoints">아직 확정된 동승자가 없습니다.</p>
              )}
            </div>
            <h3>주요 경유지</h3>
            {detailWaypointsLoading ? (
              <p className="waypoints">
                실제 지도 경로에서 주요 경유지를 불러오는 중...
              </p>
            ) : Array.isArray(detailWaypoints) && detailWaypoints.length > 0 ? (
              <div className="waypoints-chip-box">
                <div className="waypoints-chip-list">
                  {(detailWaypoints ?? []).map((wp, idx) => (
                    <span className="waypoint-node-pill" key={`${wp}-${idx}`}>
                      <MapPin /> {wp}
                    </span>
                  ))}
                </div>
                <p className="waypoints">{detailWaypoints.join(" · ")}</p>
              </div>
            ) : (
              <p className="waypoints">{DIRECT_ROUTE_LABEL}</p>
            )}
            {pointWallet.balance < detailRide.price && (
              <p className="field-error" style={{ marginBottom: "8px" }}>
                보유 포인트({pointWallet.balance.toLocaleString()} P)가 카풀 요금(
                {detailRide.price.toLocaleString()} P)보다 부족합니다. 정산 전까지
                포인트를 충전해 주세요.
              </p>
            )}
            <div className="ride-detail-cta-group">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onStartCarpoolChat(
                    {
                      id: detailRide.driverId || `account-${detailRide.name}`,
                      name: detailRide.name,
                      role: "driver",
                      carInfo: detailRide.car,
                      licenseVerified: true,
                    },
                    {
                      id: detailRide.flowRideId || detailRide.id,
                      start: detailRide.start,
                      destination: detailRide.end,
                      date: detailRide.date,
                      time: detailRide.time,
                      waypoints:
                        Array.isArray(detailWaypoints) &&
                        detailWaypoints.length > 0
                          ? detailWaypoints.join(" · ")
                          : detailRide.via || DIRECT_ROUTE_LABEL,
                    },
                  )
                }
              >
                <MessageCircle /> 운전자와 1:1 채팅하기
              </Button>
              <Button
                onClick={() => applyToMatchRide(detailRide)}
                disabled={isRideApplied(detailRide)}
              >
                {isRideApplied(detailRide) ? (
                  <>
                    <Check /> 신청이 완료됐어요
                  </>
                ) : (
                  `${detailRide.price.toLocaleString()} P로 탑승 신청`
                )}
              </Button>
            </div>
          </div>
        )}
        {type === "create" && (
          <div className="sheet-content form-stack">
            <div className="notice-box">
              <Route />
              <p>
                <strong>기본 경로를 불러왔어요</strong>필요한 항목만 수정해
                등록하세요.
              </p>
            </div>
            <div className="field">
              <span>운행 날짜 *</span>
              <button
                type="button"
                className="field__control custom-picker-trigger"
                onClick={() => setActiveSheetPicker("create-date")}
              >
                <CalendarDays />
                <span>
                  {createDraft.date
                    ? formatBookingDateLabel(createDraft.date)
                    : "운행 날짜 선택"}
                </span>
              </button>
            </div>
            <div className="field">
              <span>출발 시간 *</span>
              <button
                type="button"
                className="field__control custom-picker-trigger"
                onClick={() => setActiveSheetPicker("create-time")}
              >
                <Clock3 />
                <span>
                  {formatKoreanTimeLabel(createDraft.time)} ({createDraft.time})
                </span>
              </button>
            </div>
            {activeSheetPicker === "create-date" && (
              <CustomDatePickerModal
                isOpen={true}
                value={createDraft.date || getTodayDateKey()}
                title="운행 날짜 선택"
                onClose={() => setActiveSheetPicker("none")}
                onConfirm={(selectedDateKey) => {
                  setCreateDraft((prev) => ({ ...prev, date: selectedDateKey }))
                  setActiveSheetPicker("none")
                }}
              />
            )}
            {activeSheetPicker === "create-time" && (
              <CustomTimePickerModal
                isOpen={true}
                value={createDraft.time || "08:30"}
                title="출발 시간 선택"
                onClose={() => setActiveSheetPicker("none")}
                onConfirm={(nextTime) => {
                  setCreateDraft((prev) => ({ ...prev, time: nextTime }))
                  setActiveSheetPicker("none")
                }}
              />
            )}
            <Field
              label="출발 장소 *"
              value={createDraft.start}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, start: event.target.value })
              }
              icon={<MapPin />}
            />
            <Field
              label="목적지 *"
              value={createDraft.destination}
              onChange={(event) =>
                setCreateDraft({
                  ...createDraft,
                  destination: event.target.value,
                })
              }
              icon={<Navigation />}
            />
            <Field
              label="주요 경유지 (지도 경로 자동 추출)"
              value={createDraft.waypoints}
              onChange={(event) =>
                setCreateDraft({
                  ...createDraft,
                  waypoints: event.target.value,
                })
              }
              placeholder="출발지·목적지 입력 시 실제 경로 경유지가 자동 추출됩니다"
              icon={<MapPin />}
            />
            {createWaypointsLoading ? (
              <small className="waypoint-extract-status">
                지도 경로 데이터를 기반으로 실제 주요 경유지를 추출하고 있습니다...
              </small>
            ) : (
              Array.isArray(createWaypointsList) &&
              createWaypointsList.length > 0 && (
                <div className="waypoints-chip-list">
                  {(createWaypointsList ?? []).map((wp, idx) => (
                    <span className="waypoint-node-pill" key={`${wp}-${idx}`}>
                      <MapPin /> {wp}
                    </span>
                  ))}
                </div>
              )
            )}
            <div className="eta-preview">
              <Clock3 />
              <div>
                <span>등록 일정 기준 ETA</span>
                <strong>
                  {createDraft.estimatedArrival
                    ? `${formatEtaDateTime(createDraft.estimatedArrival)} 도착 예정`
                    : "날짜와 출발 시간을 입력해 주세요"}
                </strong>
                <small>
                  예상 소요 시간 약{" "}
                  {Number(createDraft.estimatedDuration) ||
                    DEFAULT_ESTIMATED_DURATION}
                  분 · 실제 교통정보 미반영
                </small>
              </div>
            </div>
            <Field
              label="차량 정보 *"
              value={createDraft.vehicle}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, vehicle: event.target.value })
              }
            />
            <div className="two-fields">
              <Field
                label="전체 좌석 *"
                value={createDraft.totalSeats}
                min="1"
                onChange={(event) =>
                  setCreateDraft({
                    ...createDraft,
                    totalSeats: event.target.value,
                  })
                }
                type="number"
              />
              <Field
                label="카풀 이용 요금 *"
                value={createDraft.price}
                min="1"
                onChange={(event) =>
                  setCreateDraft({ ...createDraft, price: event.target.value })
                }
                type="number"
              />
            </div>
            <Field
              label="추가 안내 사항"
              value={createDraft.note}
              onChange={(event) =>
                setCreateDraft({ ...createDraft, note: event.target.value })
              }
              placeholder="탑승자에게 전달할 안내를 입력하세요"
            />
            <div className="filter-dropdown">
              <button
                className="filter-trigger"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Settings />
                <span>
                  <strong>탑승 조건</strong>
                  <small>
                    {createDraft.smokingPreference} ·{" "}
                    {createDraft.genderPreference}
                  </small>
                </span>
                <ChevronRight className={filterOpen ? "rotate" : ""} />
              </button>
              {filterOpen && (
                <div className="filter-options">
                  <label className="field">
                    <span>흡연 관련 선호</span>
                    <select
                      value={createDraft.smokingPreference}
                      onChange={(event) =>
                        setCreateDraft({
                          ...createDraft,
                          smokingPreference: event.target.value,
                        })
                      }
                    >
                      <option value="흡연자 탑승 가능">흡연자 탑승 가능</option>
                      <option value="비흡연자 선호">비흡연자 선호</option>
                      <option value="흡연 여부 무관">흡연 여부 무관</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>성별 조건</span>
                    <select
                      value={createDraft.genderPreference}
                      onChange={(event) =>
                        setCreateDraft({
                          ...createDraft,
                          genderPreference: event.target.value,
                        })
                      }
                    >
                      <option value="성별 무관">성별 무관</option>
                      <option value="동성만">동성만</option>
                    </select>
                  </label>
                  <div className="filter-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCreateDraft({
                          ...createDraft,
                          smokingPreference: "비흡연자 선호",
                          genderPreference: "성별 무관",
                        })
                        setFilterOpen(false)
                      }}
                    >
                      초기화
                    </Button>
                    <Button onClick={() => setFilterOpen(false)}>적용</Button>
                  </div>
                </div>
              )}
            </div>
            {createError && <span className="field-error">{createError}</span>}
            <Button
              onClick={() => {
                try {
                  createCarpoolRide({
                    driverId: account.id,
                    driverName: account.name || "운전자",
                    start: createDraft.start,
                    destination: createDraft.destination,
                    date: createDraft.date,
                    time: createDraft.time,
                    vehicle: createDraft.vehicle,
                    totalSeats: Number(createDraft.totalSeats),
                    price: Number(createDraft.price),
                    note: createDraft.note,
                    waypoints: createDraft.waypoints,
                    estimatedDuration: Number(createDraft.estimatedDuration),
                    estimatedArrival: createDraft.estimatedArrival,
                    arrivalTimeManual: createDraft.arrivalTimeManual,
                    smokingPreference: createDraft.smokingPreference,
                    genderPreference: createDraft.genderPreference,
                  })
                  setCreateError("")
                  setFlowNotice("카풀 일정이 등록되었습니다.")
                } catch (error) {
                  setCreateError(
                    error instanceof Error
                      ? error.message
                      : "필수 입력 항목을 확인해 주세요.",
                  )
                }
              }}
            >
              모집 시작하기
            </Button>
            {flowNotice && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon">
                    <Check />
                  </span>
                  <h2>{flowNotice}</h2>
                  <p>브라우저에 저장된 발표용 데모 일정입니다.</p>
                  <Button onClick={close}>확인</Button>
                </section>
              </div>
            )}
          </div>
        )}
        {type === "reservation" && (
          <div className="sheet-content reservation-content">
            <div className="calendar-toolbar reservation-toolbar">
              <button
                onClick={() =>
                  setReservationMonth(
                    new Date(
                      reservationMonth.getFullYear(),
                      reservationMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
                aria-label="이전 달"
              >
                <ChevronRight className="flip" />
              </button>
              <strong>
                {reservationMonth.getFullYear()}년{" "}
                {reservationMonth.getMonth() + 1}월
              </strong>
              <button
                onClick={() =>
                  setReservationMonth(
                    new Date(
                      reservationMonth.getFullYear(),
                      reservationMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
                aria-label="다음 달"
              >
                <ChevronRight />
              </button>
            </div>
            <div className="reservation-weekdays">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="reservation-calendar">
              {Array.from({ length: reservationStartDay }, (_, index) => (
                <i key={`blank-${index}`} />
              ))}
              {reservationDays.map((day) => {
                const date = `${reservationMonth.getFullYear()}-${String(
                  reservationMonth.getMonth() + 1,
                ).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const todayKey = new Date().toLocaleDateString("en-CA")
                const isPast = date < todayKey
                return (
                  <button
                    className={`${reservationDate === date ? "active" : ""} ${
                      date === todayKey ? "today" : ""
                    }`}
                    disabled={isPast}
                    onClick={() => {
                      setReservationDate(date)
                      setReservationSearched(false)
                    }}
                    key={date}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            <div className="reservation-selected">
              <span>선택한 날짜</span>
              <strong>{reservationDate || "날짜를 선택해 주세요."}</strong>
            </div>
            <div className="dialog-actions">
              <Button variant="ghost" onClick={close}>
                닫기
              </Button>
              <Button
                disabled={!reservationDate}
                onClick={() => setReservationSearched(true)}
              >
                카풀 검색
              </Button>
            </div>
            {reservationSearched && (
              <section className="reservation-results">
                {reservationResults.length > 0 ? (
                  reservationResults.map((ride) => (
                    <article className="reservation-ride" key={ride.id}>
                      <span className="tag open">모집 중</span>
                      <h3>
                        {ride.start} → {ride.destination}
                      </h3>
                      <p>
                        {ride.date} · {ride.time} ·{" "}
                        <span
                          className="clickable-profile-inline"
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            onViewUserProfile({
                              name: ride.driverName,
                              role: "driver",
                              carInfo: ride.vehicle,
                            })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              event.stopPropagation()
                              onViewUserProfile({
                                name: ride.driverName,
                                role: "driver",
                                carInfo: ride.vehicle,
                              })
                            }
                          }}
                        >
                          {ride.driverName} 운전자
                        </span>
                      </p>
                      <small>
                        잔여 {getRemainingSeats(carpoolFlow, ride.id)}석 ·{" "}
                        {ride.price.toLocaleString()} P
                      </small>
                      <small className="eta-inline">
                        {formatEtaTime(ride.estimatedArrival)} 도착 예정 · 약{" "}
                        {ride.estimatedDuration}분
                      </small>
                      <Button onClick={() => setApplyRide(ride)}>
                        예약 신청
                      </Button>
                    </article>
                  ))
                ) : (
                  <div className="schedule-empty">
                    <CalendarDays />
                    <strong>선택한 날짜에 예약 가능한 카풀이 없습니다.</strong>
                  </div>
                )}
              </section>
            )}
            {applyRide && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <CarFront />
                  </span>
                  <h2>카풀을 신청할까요?</h2>
                  <div className="point-confirm-summary">
                    <div>
                      <dt>경로</dt>
                      <dd>
                        {applyRide.start} → {applyRide.destination}
                      </dd>
                    </div>
                    <div>
                      <dt>운행 일시</dt>
                      <dd>
                        {applyRide.date} {applyRide.time}
                      </dd>
                    </div>
                    <div>
                      <dt>요금</dt>
                      <dd>{applyRide.price.toLocaleString()} P</dd>
                    </div>
                  </div>
                  <div className="dialog-actions">
                    <Button variant="ghost" onClick={() => setApplyRide(null)}>
                      취소
                    </Button>
                    <Button
                      onClick={() => {
                        try {
                          applyToCarpool(applyRide.id, {
                            id: account.id,
                            name: account.name || "탑승자",
                          })
                          setApplyRide(null)
                          setFlowNotice("카풀 신청이 완료되었습니다.")
                        } catch (error) {
                          setFlowNotice(
                            error instanceof Error
                              ? error.message
                              : "신청할 수 없습니다.",
                          )
                        }
                      }}
                    >
                      신청하기
                    </Button>
                  </div>
                </section>
              </div>
            )}
            {flowNotice && !applyRide && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon">
                    <Check />
                  </span>
                  <h2>{flowNotice}</h2>
                  <p>신청 상태는 홈과 일정 탭에서 확인할 수 있습니다.</p>
                  <Button
                    onClick={() => {
                      setFlowNotice("")
                      close()
                    }}
                  >
                    확인
                  </Button>
                </section>
              </div>
            )}
          </div>
        )}
        {type === "notifications" && (
          <div className="sheet-content notification-list">
            {carpoolFlow.events.length > 0 ? (
              carpoolFlow.events.map((eventItem, i) => (
                <button
                  key={eventItem.id}
                  onClick={() => {
                    void showAppAlert({
                      title: eventItem.title,
                      message: eventItem.message,
                    })
                  }}
                >
                  <span className={i === 0 ? "new" : ""}>
                    {i === 0 ? <UsersRound /> : <Bell />}
                  </span>
                  <div>
                    <strong>{eventItem.title}</strong>
                    <p>{eventItem.message}</p>
                    <time>
                      {new Date(eventItem.createdAt).toLocaleString("ko-KR")}
                    </time>
                  </div>
                </button>
              ))
            ) : (
              <div className="history-empty">
                <Bell />
                <strong>새로운 알림이 없습니다.</strong>
              </div>
            )}
          </div>
        )}
        {type === "carpool-payment" && (
          <div className="sheet-content payment-sheet-content">
            {tripFlow.status === "결제 완료" ? (
              <section className="payment-complete">
                <span className="payment-complete-icon">
                  <Check />
                </span>
                <h2>결제가 완료되었습니다</h2>
                <strong>{tripFlow.amount.toLocaleString()} P</strong>
                <RouteCard
                  route={{
                    ...route,
                    start: tripFlow.start,
                    destination: tripFlow.destination,
                  }}
                />
                <div className="payment-complete-meta">
                  <span>{tripFlow.operatedAt}</span>
                  <span className="tag open">결제 완료</span>
                </div>
                <div className="payment-complete-actions">
                  <Button variant="soft" onClick={() => open("history")}>
                    이용 내역 확인하기
                  </Button>
                  <Button onClick={onGoHome}>홈으로 이동</Button>
                </div>
              </section>
            ) : (
              <>
                <div className="demo-banner">
                  <WalletCards />
                  <p>
                    <strong>발표용 데모 결제</strong>
                    실제 카드, 계좌 또는 포인트 결제와 연결되지 않습니다.
                  </p>
                </div>
                <section className="payment-trip-card">
                  <div
                    className="driver-profile clickable-profile-trigger"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      onViewUserProfile({
                        name: tripFlow.driverName || "운전자",
                        role: "driver",
                        carInfo: tripFlow.vehicle,
                      })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.stopPropagation()
                        onViewUserProfile({
                          name: tripFlow.driverName || "운전자",
                          role: "driver",
                          carInfo: tripFlow.vehicle,
                        })
                      }
                    }}
                  >
                    <div className="avatar large">
                      {(tripFlow.driverName || "운")[0]}
                    </div>
                    <div>
                      <h2>{tripFlow.driverName || "운전자"} 운전자</h2>
                      <p>{tripFlow.vehicle}</p>
                      <span className="tag waiting">{tripFlow.status}</span>
                    </div>
                  </div>
                  <RouteCard
                    route={{
                      ...route,
                      start: tripFlow.start,
                      destination: tripFlow.destination,
                    }}
                  />
                  <p className="payment-operated-at">
                    <CalendarDays /> {tripFlow.operatedAt}
                  </p>
                </section>
                <section className="payment-amount-card">
                  <div>
                    <span>카풀 이용 요금</span>
                    <strong>{tripFlow.amount.toLocaleString()} P</strong>
                  </div>
                  <div>
                    <span>추가 요금</span>
                    <strong>0 P</strong>
                  </div>
                  <div className="total">
                    <span>최종 결제 금액</span>
                    <strong>{tripFlow.amount.toLocaleString()} P</strong>
                  </div>
                  <small>기존 카풀 일정에 등록된 데모 금액입니다.</small>
                </section>
                <div className="payment-sheet-actions">
                  <Button variant="ghost" onClick={close}>
                    닫기
                  </Button>
                  <Button
                    disabled={tripFlow.status !== "결제 대기"}
                    onClick={() => setPaymentConfirmOpen(true)}
                  >
                    데모 결제하기
                  </Button>
                </div>
              </>
            )}
            {paymentConfirmOpen && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <WalletCards />
                  </span>
                  <h2>결제를 진행할까요?</h2>
                  <p>발표용 데모 결제이며 실제 금액이 청구되지 않습니다.</p>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => setPaymentConfirmOpen(false)}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={() => {
                        onCompletePayment()
                        setPaymentConfirmOpen(false)
                      }}
                    >
                      결제 확인
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
        {type === "points" && (
          <div className="sheet-content">
            <div className="wallet-hero">
              <span>사용 가능한 포인트</span>
              <strong>{formatPoints(pointWallet.balance)}</strong>
              <p>1포인트 = 1원 · 데모 충전 전용</p>
              <Button variant="secondary" onClick={() => setChargeOpen(true)}>
                <Plus /> 포인트 충전
              </Button>
            </div>
            <div className="section-heading">
              <h2>최근 이용 내역</h2>
              <button onClick={() => open("history")}>전체보기</button>
            </div>
            <div className="transaction-list">
              {pointWallet.charges.length > 0 ? (
                pointWallet.charges.map((charge) => (
                  <div key={charge.id}>
                    <span className="transaction-icon green">
                      <Plus />
                    </span>
                    <p>
                      <strong>
                        데모 포인트 충전 (+{formatPoints(charge.amount)})
                      </strong>
                      <small>
                        {new Date(charge.createdAt).toLocaleString("ko-KR", {
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {charge.paymentMethod} · {charge.status}
                      </small>
                    </p>
                    <b className="positive">+{formatPoints(charge.amount)}</b>
                  </div>
                ))
              ) : (
                <div className="history-empty">
                  <WalletCards />
                  <strong>최근 포인트 충전 및 이용 내역이 없습니다.</strong>
                </div>
              )}
            </div>
            {chargeOpen && (
              <div className="point-charge-page">
                <section
                  className="point-charge-sheet"
                  aria-label="포인트 충전"
                >
                  <header>
                    <button
                      className="icon-button"
                      onClick={resetChargeFlow}
                      aria-label="포인트 화면으로 돌아가기"
                    >
                      <ArrowLeft />
                    </button>
                    <div>
                      <h2>포인트 충전</h2>
                      <p>원하는 금액을 선택하고 포인트를 충전하세요.</p>
                    </div>
                    <span aria-hidden="true" />
                  </header>
                  <div className="point-charge-scroll">
                    <div className="point-current-balance">
                      <span>현재 보유 포인트</span>
                      <strong>{formatPoints(pointWallet.balance)}</strong>
                    </div>

                    <section className="point-charge-section">
                      <div className="form-section-heading">
                        <strong>충전 금액</strong>
                        <span>
                          충전할 포인트를 선택하거나 직접 입력해 주세요.
                        </span>
                      </div>
                      <div className="point-amount-chips">
                        {[5_000, 10_000, 20_000, 50_000].map((amount) => (
                          <button
                            className={
                              selectedChargeAmount === amount ? "active" : ""
                            }
                            onClick={() => {
                              setSelectedChargeAmount(amount)
                              setCustomChargeAmount("")
                              setChargeErrors((current) => ({
                                ...current,
                                amount: undefined,
                              }))
                            }}
                            aria-pressed={selectedChargeAmount === amount}
                            key={amount}
                          >
                            +{formatPoints(amount)}
                          </button>
                        ))}
                      </div>
                      <label className="point-custom-amount">
                        <span>직접 입력</span>
                        <div>
                          <input
                            inputMode="numeric"
                            value={customChargeAmount}
                            onChange={(event) => {
                              const value = event.target.value
                              setSelectedChargeAmount(null)
                              if (!/^[\d,]*$/.test(value)) {
                                setChargeErrors((current) => ({
                                  ...current,
                                  amount:
                                    "숫자만 입력해 주세요. 음수와 소수점은 사용할 수 없습니다.",
                                }))
                                return
                              }
                              const digits = value.replaceAll(",", "")
                              const amount = digits ? Number(digits) : 0
                              setCustomChargeAmount(
                                digits && Number.isSafeInteger(amount)
                                  ? amount.toLocaleString("ko-KR")
                                  : "",
                              )
                              setChargeErrors((current) => ({
                                ...current,
                                amount: undefined,
                              }))
                            }}
                            placeholder="충전할 포인트를 입력하세요."
                            aria-invalid={Boolean(chargeErrors.amount)}
                          />
                          <b>P</b>
                        </div>
                      </label>
                      {chargeErrors.amount && (
                        <span className="field-error point-charge-error">
                          {chargeErrors.amount}
                        </span>
                      )}
                      <div className="point-charge-preview">
                        <span>충전 예정 포인트</span>
                        <strong>
                          +
                          {formatPoints(
                            Number.isFinite(chargeAmount) ? chargeAmount : 0,
                          )}
                        </strong>
                      </div>
                    </section>

                    <div className="point-charge-total">
                      <span>최종 충전 금액</span>
                      <strong>+{formatPoints(chargeAmount)}</strong>
                    </div>
                  </div>
                  <div className="point-charge-footer">
                    <section className="point-charge-section point-charge-payment-section">
                      <div className="form-section-heading">
                        <strong>결제 수단</strong>
                        <span>데모에 사용할 수단을 하나 선택해 주세요.</span>
                      </div>
                      <div className="point-payment-methods">
                        {([
                          ["카카오페이", "K"],
                          ["토스페이", "T"],
                          ["신용카드 간편결제", "CARD"],
                        ] as [DemoPaymentMethod, string][]).map(
                          ([method, mark]) => (
                            <button
                              className={
                                chargePaymentMethod === method ? "active" : ""
                              }
                              onClick={() => {
                                setChargePaymentMethod(method)
                                setChargeErrors((current) => ({
                                  ...current,
                                  paymentMethod: undefined,
                                }))
                              }}
                              aria-pressed={chargePaymentMethod === method}
                              key={method}
                            >
                              <i>{mark}</i>
                              <span>{method}</span>
                              <b>
                                {chargePaymentMethod === method && <Check />}
                              </b>
                            </button>
                          ),
                        )}
                      </div>
                      {chargeErrors.paymentMethod && (
                        <span className="field-error point-charge-error">
                          {chargeErrors.paymentMethod}
                        </span>
                      )}
                      <p className="point-demo-notice">
                        발표용 데모 기능이며 실제 결제는 진행되지 않습니다.
                      </p>
                    </section>
                    <div className="point-charge-actions">
                      <Button variant="ghost" onClick={resetChargeFlow}>
                        취소
                      </Button>
                      <Button onClick={validateCharge}>충전하기</Button>
                    </div>
                  </div>

                  {chargeConfirmOpen && (
                    <div className="dialog-backdrop point-dialog-backdrop">
                      <section className="app-dialog point-confirm-dialog">
                        <span className="dialog-icon neutral">
                          <WalletCards />
                        </span>
                        <h2>충전 내용을 확인해 주세요.</h2>
                        <dl className="point-confirm-summary">
                          <div>
                            <dt>충전 포인트</dt>
                            <dd>+{formatPoints(chargeAmount)}</dd>
                          </div>
                          <div>
                            <dt>선택한 결제 수단</dt>
                            <dd>{chargePaymentMethod}</dd>
                          </div>
                          <div>
                            <dt>충전 후 예상 잔액</dt>
                            <dd>
                              {formatPoints(pointWallet.balance + chargeAmount)}
                            </dd>
                          </div>
                        </dl>
                        <p>
                          실제 결제 없이 포인트 잔액만 변경되는 데모 기능입니다.
                        </p>
                        <div className="dialog-actions">
                          <Button
                            variant="ghost"
                            onClick={() => setChargeConfirmOpen(false)}
                            disabled={isCharging}
                          >
                            취소
                          </Button>
                          <Button
                            onClick={completeCharge}
                            disabled={isCharging}
                          >
                            {isCharging ? "처리 중..." : "데모 충전하기"}
                          </Button>
                        </div>
                      </section>
                    </div>
                  )}

                  {completedCharge && (
                    <div className="dialog-backdrop point-dialog-backdrop">
                      <section className="app-dialog point-complete-dialog">
                        <span className="dialog-icon">
                          <Check />
                        </span>
                        <h2>충전이 완료되었습니다!</h2>
                        <strong>+{formatPoints(completedCharge.amount)}</strong>
                        <dl className="point-confirm-summary">
                          <div>
                            <dt>충전 후 잔액</dt>
                            <dd>
                              {formatPoints(completedCharge.balanceAfter)}
                            </dd>
                          </div>
                          <div>
                            <dt>결제 수단</dt>
                            <dd>{completedCharge.paymentMethod}</dd>
                          </div>
                        </dl>
                        <span className="point-complete-badge">
                          데모 충전 완료
                        </span>
                        <p>실제 결제는 발생하지 않았습니다.</p>
                        <Button onClick={resetChargeFlow}>확인</Button>
                      </section>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
        {type === "mileage" && (
          <div className="sheet-content">
            <div
              className="wallet-hero mileage-hero"
              role="button"
              tabIndex={0}
              onClick={() => setMileageBarcodeOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  setMileageBarcodeOpen(true)
              }}
            >
              <span>현재 보유 마일리지</span>
              <strong>{mileageBalance.toLocaleString("ko-KR")} M</strong>
              <p>실제 결제 완료 금액의 10%가 적립됩니다.</p>
              <Button variant="secondary">
                <WalletCards /> 마일리지 바코드 보기
              </Button>
            </div>
            <div className="summary-grid">
              <div>
                <span>이번 달 적립</span>
                <strong>{mileageBalance.toLocaleString("ko-KR")} M</strong>
              </div>
              <div>
                <span>누적 적립</span>
                <strong>{mileageBalance.toLocaleString("ko-KR")} M</strong>
              </div>
              <div>
                <span>누적 사용</span>
                <strong>0 M</strong>
              </div>
            </div>
            <div className="demo-banner">
              <CircleHelp />
              <p>
                <strong>데모 제휴 서비스</strong>
                실제 제휴 매장 결제는 연결되지 않았습니다.
              </p>
            </div>
            <Button onClick={() => open("mileage-history")}>
              마일리지 내역 보기
            </Button>
          </div>
        )}
        {type === "mileage-history" && (
          <div className="sheet-content">
            <div className="filter-tabs mileage-history-tabs">
              {(["전체", "적립", "사용"] as const).map((item) => (
                <button
                  className={historyFilter === item ? "active" : ""}
                  onClick={() => setHistoryFilter(item)}
                  aria-pressed={historyFilter === item}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            {filteredMileageHistoryEntries.length > 0 ? (
              <div className="history-list">
                {filteredMileageHistoryEntries.map((entry) => (
                  <article key={entry.id}>
                    <span
                      className={`tag ${
                        entry.type === "적립" ? "open" : "waiting"
                      }`}
                    >
                      {entry.type}
                    </span>
                    <strong>{entry.title}</strong>
                    <small>
                      {entry.date} · 거래 후 {entry.balance}
                    </small>
                    <b>{entry.amount}</b>
                  </article>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                <Star />
                <strong>해당 내역이 없습니다.</strong>
              </div>
            )}
          </div>
        )}
        {type === "history" && (
          <div className="sheet-content">
            <div className="filter-tabs scrollable history-tabs">
              {(["전체", "결제 내역", "이용 내역", "취소·환불"] as const).map(
                (tab) => (
                  <button
                    className={activeTab === tab ? "active" : ""}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={activeTab === tab}
                    key={tab}
                  >
                    {tab}
                  </button>
                ),
              )}
            </div>
            <div className="history-controls">
              <select defaultValue="all">
                <option value="all">전체 기간</option>
                <option value="month">최근 1개월</option>
              </select>
              <select defaultValue="latest">
                <option value="latest">최신순</option>
                <option value="oldest">오래된 순</option>
              </select>
            </div>
            {filteredHistoryEntries.length > 0 ? (
              <div className="history-list">
                {filteredHistoryEntries.map((entry) => (
                  <article key={entry.id}>
                    <span
                      className={`tag ${
                        entry.status === "취소 완료" ? "waiting" : "open"
                      }`}
                    >
                      {entry.status}
                    </span>
                    <strong>{entry.title}</strong>
                    <small>
                      {entry.date} · {entry.type} · {entry.description}
                    </small>
                    <b>{entry.amount}</b>
                    {entry.canReview && role === "rider" && !reviewed && (
                      <button onClick={() => open("review")}>후기 작성</button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                <CreditCard />
                <strong>해당 내역이 없습니다.</strong>
                <p>선택한 조건에 해당하는 데모 내역이 없습니다.</p>
              </div>
            )}
          </div>
        )}
        {type === "applications" && (
          <div className="sheet-content">
            <div className="filter-tabs scrollable">
              {[
                "전체",
                "승인 대기",
                "탑승 확정",
                "탑승 완료",
                "거절",
                "취소",
              ].map((item, index) => (
                <button
                  className={applicationFilter === item ? "active" : ""}
                  onClick={() => setApplicationFilter(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="application-list">
              {filteredApplicationsList.length > 0 ? (
                filteredApplicationsList.map((application) => {
                  const ride = carpoolFlow.rides.find(
                    (item) => item.id === application.rideId,
                  )
                  if (!ride) return null
                  return (
                    <article key={application.id}>
                      <span
                        className={`tag ${
                          application.status === "승인 완료" ? "open" : "waiting"
                        }`}
                      >
                        {ride.status === "완료"
                          ? "완료된 카풀"
                          : application.status}
                      </span>
                      <h3
                        className="clickable-profile-inline"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (role === "driver") {
                            onViewUserProfile({
                              id: application.riderId,
                              name: application.riderName,
                              role: "rider",
                            })
                          } else {
                            onViewUserProfile({
                              name: ride.driverName,
                              role: "driver",
                              carInfo: ride.vehicle,
                            })
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            event.stopPropagation()
                            if (role === "driver") {
                              onViewUserProfile({
                                id: application.riderId,
                                name: application.riderName,
                                role: "rider",
                              })
                            } else {
                              onViewUserProfile({
                                name: ride.driverName,
                                role: "driver",
                                carInfo: ride.vehicle,
                              })
                            }
                          }
                        }}
                      >
                        {role === "driver"
                          ? `${application.riderName} 탑승 신청`
                          : `${ride.driverName} 운전자`}
                      </h3>
                      <p>
                        {ride.start} → {ride.destination}
                      </p>
                      <small>
                        주요 경유지 ·{" "}
                        {Array.isArray(ride?.waypointsList) &&
                        ride.waypointsList.length > 0
                          ? ride.waypointsList.join(" · ")
                          : ride.waypoints || DIRECT_ROUTE_LABEL}
                      </small>
                      <small>
                        {ride.date} {ride.time} · {ride.price.toLocaleString()} P
                        ·{" "}
                        {new Date(application.createdAt).toLocaleString("ko-KR")}
                      </small>
                      <div className="application-card-actions">
                        <Button
                          type="button"
                          variant="soft"
                          onClick={() =>
                            onStartCarpoolChat(
                              role === "driver"
                                ? {
                                    id:
                                      application.riderId ||
                                      `account-${application.riderName}`,
                                    name: application.riderName,
                                    role: "rider",
                                  }
                                : {
                                    id:
                                      ride.driverId ||
                                      `account-${ride.driverName}`,
                                    name: ride.driverName,
                                    role: "driver",
                                    carInfo: ride.vehicle,
                                    licenseVerified: true,
                                  },
                              {
                                id: ride.id,
                                start: ride.start,
                                destination: ride.destination,
                                date: ride.date,
                                time: ride.time,
                                waypoints: ride.waypoints || DIRECT_ROUTE_LABEL,
                              },
                            )
                          }
                        >
                          <MessageCircle /> 1:1 채팅하기
                        </Button>
                      </div>
                      {role === "driver" &&
                        application.status === "승인 대기" && (
                          <div>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                decideCarpoolApplication(application.id, "reject")
                              }
                            >
                              거절
                            </Button>
                            <Button
                              onClick={() =>
                                decideCarpoolApplication(
                                  application.id,
                                  "approve",
                                  () =>
                                    onStartCarpoolChat(
                                      {
                                        id:
                                          application.riderId ||
                                          `account-${application.riderName}`,
                                        name: application.riderName,
                                        role: "rider",
                                      },
                                      {
                                        id: ride.id,
                                        start: ride.start,
                                        destination: ride.destination,
                                        date: ride.date,
                                        time: ride.time,
                                        waypoints:
                                          ride.waypoints || DIRECT_ROUTE_LABEL,
                                      },
                                    ),
                                )
                              }
                            >
                              승인
                            </Button>
                          </div>
                        )}
                      {(application.status === "승인 대기" ||
                        application.status === "승인 완료") && (
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            const ok = await showAppConfirm({
                              title: "예약 취소 및 환불 확인",
                              message:
                                application.status === "승인 완료"
                                  ? "카풀 예약을 취소할까요? 취소 시 차감된 포인트가 자동 환불되며 카풀 잔여 좌석(1석)이 즉시 복구됩니다."
                                  : "카풀 예약 신청을 취소할까요?",
                              confirmText: "예약 취소",
                              cancelText: "돌아가기",
                              variant: "danger",
                            })
                            if (!ok) return
                            cancelCarpoolApplication(application.id)
                          }}
                        >
                          예약 취소 (좌석 복구·환불)
                        </Button>
                      )}
                      {role === "rider" &&
                        ride.status === "완료" &&
                        !carpoolFlow.reviews.some(
                          (review) => review.rideId === ride.id,
                        ) && (
                          <Button variant="soft" onClick={() => open("review")}>
                            후기 작성
                          </Button>
                        )}
                    </article>
                  )
                })
              ) : (
                <div className="history-empty">
                  <CalendarDays />
                  <strong>
                    {role === "driver"
                      ? "예정된 운행 및 신청 내역이 없습니다."
                      : "신청한 카풀 내역이 없습니다."}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}
        {type === "application-detail" && (
          <div className="sheet-content ride-detail">
            <div
              className="driver-profile clickable-profile-trigger"
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onViewUserProfile({
                  name: latestApplicationRide?.driverName || "운전자",
                  role: "driver",
                  carInfo: latestApplicationRide?.vehicle,
                })
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onViewUserProfile({
                    name: latestApplicationRide?.driverName || "운전자",
                    role: "driver",
                    carInfo: latestApplicationRide?.vehicle,
                  })
                }
              }}
            >
              <div className="avatar large">
                {(latestApplicationRide?.driverName || "운")[0]}
              </div>
              <div>
                <h2>
                  {latestApplicationRide?.driverName || "운전자"} <ShieldCheck />
                </h2>
                <p>{latestApplicationRide?.vehicle || "면허 인증 완료"}</p>
                <span className="tag waiting">
                  {applicationCancelled
                    ? "취소"
                    : latestApplication?.status || "승인 대기"}
                </span>
              </div>
            </div>
            <RouteCard route={route} />
            <div className="detail-grid">
              <div>
                <Clock3 />
                <span>
                  출발
                  <strong>
                    {latestApplicationRide
                      ? `${latestApplicationRide.date} ${latestApplicationRide.time}`
                      : formatKoreanTimeLabel(route.departureTime)}
                  </strong>
                </span>
              </div>
              <div>
                <WalletCards />
                <span>
                  예상 결제
                  <strong>
                    {latestApplicationRide
                      ? `${latestApplicationRide.price.toLocaleString("ko-KR")} P`
                      : "0 P"}
                  </strong>
                </span>
              </div>
            </div>
            <Field
              label="주요 경유지"
              value={
                getExtractedWaypointsSync(
                  route.start || "태평역",
                  route.destination || "신구대학교",
                  route.waypointsList ?? route.waypoint,
                ).formatted || DIRECT_ROUTE_LABEL
              }
              readOnly
            />
            <Button
              variant="soft"
              onClick={() =>
                onStartCarpoolChat(
                  {
                    id: latestApplicationRide?.driverId || "driver",
                    name: latestApplicationRide?.driverName || "운전자",
                    role: "driver",
                    carInfo: latestApplicationRide?.vehicle || "면허 인증 완료",
                    licenseVerified: true,
                  },
                  {
                    id: latestApplicationRide?.id || "application-detail",
                    start: latestApplicationRide?.start || route.start,
                    destination:
                      latestApplicationRide?.destination || route.destination,
                    date: latestApplicationRide?.date || getTodayDateKey(),
                    time:
                      latestApplicationRide?.time ||
                      route.departureTime ||
                      "08:30",
                    waypoints:
                      getExtractedWaypointsSync(
                        route.start || "태평역",
                        route.destination || "신구대학교",
                        route.waypointsList ?? route.waypoint,
                      ).formatted || DIRECT_ROUTE_LABEL,
                  },
                )
              }
            >
              <MessageCircle /> 운전자와 1:1 채팅하기
            </Button>
            <Button
              variant="ghost"
              disabled={applicationCancelled}
              onClick={async () => {
                const ok = await showAppConfirm({
                  title: "신청 취소 확인",
                  message: "탑승 신청을 취소할까요?",
                  confirmText: "신청 취소",
                  cancelText: "돌아가기",
                  variant: "danger",
                })
                if (ok) {
                  if (latestApplication) {
                    cancelCarpoolApplication(latestApplication.id)
                  }
                  setApplicationCancelled(true)
                }
              }}
            >
              {applicationCancelled ? "취소 완료" : "신청 취소"}
            </Button>
          </div>
        )}
        {(type === "calendar" || type === "monthly-rides") && (
          <div className="sheet-content">
            {type === "monthly-rides" && (
              <div className="summary-grid monthly-summary">
                <div>
                  <span>완료 운행</span>
                  <strong>{userCompletedRides.length}회</strong>
                </div>
                <div>
                  <span>결제 완료</span>
                  <strong>
                    {userCompletedRides
                      .reduce((sum, r) => sum + (r.price || 0), 0)
                      .toLocaleString("ko-KR")}{" "}
                    P
                  </strong>
                </div>
                <div>
                  <span>적립</span>
                  <strong>
                    {userCompletedRides
                      .reduce(
                        (sum, r) => sum + Math.round((r.price || 0) * 0.1),
                        0,
                      )
                      .toLocaleString("ko-KR")}{" "}
                    M
                  </strong>
                </div>
              </div>
            )}
            <div className="calendar-toolbar">
              <button
                onClick={() => {
                  setCalendarView(
                    new Date(calendarYear, calendarView.getMonth() - 1, 1),
                  )
                  setSelectedDate("1")
                }}
              >
                <ChevronRight className="flip" />
              </button>
              <strong>
                {calendarYear}년 {calendarMonth}월
              </strong>
              <button
                onClick={() => {
                  setCalendarView(
                    new Date(calendarYear, calendarView.getMonth() + 1, 1),
                  )
                  setSelectedDate("1")
                }}
              >
                <ChevronRight />
              </button>
              <button
                className="today"
                onClick={() => {
                  const today = new Date()
                  setCalendarView(
                    new Date(today.getFullYear(), today.getMonth(), 1),
                  )
                  setSelectedDate(String(today.getDate()))
                }}
              >
                오늘
              </button>
            </div>
            <div className="calendar-weekdays">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="month-calendar">
              {Array.from({ length: calendarCellCount }, (_, index) => {
                const day = index - calendarStartDay + 1
                const visible = day > 0 && day <= calendarDayCount
                const value = String(day)
                const dateKey = `${calendarYear}-${String(
                  calendarMonth,
                ).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const hasRide =
                  visible &&
                  (Boolean(demoScheduleByDate[dateKey]?.length) ||
                    userCalendarRides.some((ride) => ride.date === dateKey))
                return (
                  <button
                    className={`${selectedDate === value ? "selected" : ""} ${
                      hasRide ? "has-ride" : ""
                    }`}
                    onClick={() => visible && setSelectedDate(value)}
                    disabled={!visible}
                    key={index}
                  >
                    {visible ? day : ""}
                    {hasRide && <i />}
                  </button>
                )
              })}
            </div>
            <div className="calendar-detail">
              <div className="section-heading">
                <h2>
                  {calendarYear}년 {calendarMonth}월 {selectedDate}일 내역
                </h2>
                <span className="tag open">
                  {selectedCalendarRides.length +
                    (demoScheduleByDate[selectedCalendarKey]?.length ?? 0)}
                  건
                </span>
              </div>
              {selectedCalendarRides.length > 0 ? (
                selectedCalendarRides.map((ride) => (
                  <article key={ride.id}>
                    <time>{ride.time}</time>
                    <div>
                      <span className="tag open">{ride.status}</span>
                      <strong>
                        {ride.start} → {ride.destination}
                      </strong>
                      <small>
                        <span
                          className="clickable-profile-inline"
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            onViewUserProfile({
                              name: ride.driverName,
                              role: "driver",
                              carInfo: ride.vehicle,
                            })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              event.stopPropagation()
                              onViewUserProfile({
                                name: ride.driverName,
                                role: "driver",
                                carInfo: ride.vehicle,
                              })
                            }
                          }}
                        >
                          {ride.driverName} 운전자
                        </span>{" "}
                        · {formatEtaTime(ride.estimatedArrival)} 도착 예정 · 약{" "}
                        {ride.estimatedDuration}분
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <CalendarDays />
                  <p>해당 날짜의 카풀 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {type === "route-edit" && (
          <div className="sheet-content form-stack">
            <Field
              label="기본 출발지"
              value={routeDraft.start}
              onChange={(event) => {
                setRouteDraft({ ...routeDraft, start: event.target.value })
                setRouteDirty(true)
              }}
              icon={<MapPin />}
            />
            <Field
              label="기본 목적지"
              value={routeDraft.destination}
              onChange={(event) => {
                setRouteDraft({
                  ...routeDraft,
                  destination: event.target.value,
                })
                setRouteDirty(true)
              }}
              icon={<Navigation />}
            />
            <Field
              label={
                role === "driver"
                  ? "주요 경유지 (지도 경로 자동 추출)"
                  : "선호 탑승 장소 / 주요 경유지"
              }
              value={
                role === "driver"
                  ? routeDraft.waypoint
                  : routeDraft.pickup || routeDraft.waypoint
              }
              onChange={(event) => {
                setRouteDraft({
                  ...routeDraft,
                  [role === "driver" ? "waypoint" : "pickup"]:
                    event.target.value,
                })
                setRouteDirty(true)
              }}
              placeholder="출발지·목적지 입력 시 실제 경로 경유지가 자동 추출됩니다"
              icon={<MapPin />}
            />
            {routeWaypointsLoading ? (
              <small className="waypoint-extract-status">
                지도 경로 데이터를 기반으로 실제 주요 경유지를 추출하고 있습니다...
              </small>
            ) : (
              Array.isArray(routeWaypointsList) &&
              routeWaypointsList.length > 0 && (
                <div className="waypoints-chip-list">
                  {(routeWaypointsList ?? []).map((wp, idx) => (
                    <span className="waypoint-node-pill" key={`${wp}-${idx}`}>
                      <MapPin /> {wp}
                    </span>
                  ))}
                </div>
              )
            )}
            <div className="field">
              <span>희망 출발 시간대</span>
              <button
                type="button"
                className="field__control custom-picker-trigger"
                onClick={() => setActiveSheetPicker("route-departure")}
              >
                <Clock3 />
                <span>
                  {formatKoreanTimeLabel(routeDraft.departureTime)} (
                  {routeDraft.departureTime})
                </span>
              </button>
            </div>
            <div className="field">
              <span>희망 도착 시간</span>
              <button
                type="button"
                className="field__control custom-picker-trigger"
                onClick={() => setActiveSheetPicker("route-arrival")}
              >
                <Navigation />
                <span>
                  {routeDraft.preferredArrival
                    ? `${formatKoreanTimeLabel(routeDraft.preferredArrival)} (${routeDraft.preferredArrival})`
                    : `${formatKoreanTimeLabel(
                        resolveValidArrivalTime24(
                          routeDraft.departureTime || "08:30",
                        ).arrival24,
                      )} (${
                        resolveValidArrivalTime24(
                          routeDraft.departureTime || "08:30",
                        ).arrival24
                      })`}
                </span>
              </button>
            </div>
            {routeTimeAutoNotice && (
              <div className="email-code-notice time-auto-adjust-banner">
                <Clock3 />
                <span>{routeTimeAutoNotice}</span>
              </div>
            )}
            {activeSheetPicker === "route-departure" && (
              <CustomTimePickerModal
                isOpen={true}
                value={routeDraft.departureTime || "08:30"}
                maxTime24="23:58"
                title="희망 출발 시간 설정"
                subtitle="출발 시간이 도착 시간과 같거나 늦으면 도착 시간이 자동으로 이후 시간대로 조정됩니다."
                onClose={() => setActiveSheetPicker("none")}
                onConfirm={(nextTime) => {
                  const resolved = resolveValidArrivalTime24(
                    nextTime,
                    routeDraft.preferredArrival,
                  )
                  const nextDraft: RouteData = {
                    ...routeDraft,
                    departureTime: resolved.departure24,
                    preferredArrival: resolved.arrival24,
                  }
                  if (resolved.autoAdjusted) {
                    setRouteTimeAutoNotice(
                      `출발 시간이 변경되어 도착 시간이 ${formatKoreanTimeLabel(resolved.arrival24)}(${resolved.arrival24})으로 자동 조정되었습니다.`,
                    )
                  } else {
                    setRouteTimeAutoNotice("")
                  }
                  setRouteDraft(nextDraft)
                  setRouteDirty(true)
                  onSaveRoute(nextDraft)
                  setActiveSheetPicker("none")
                }}
              />
            )}
            {activeSheetPicker === "route-arrival" && (
              <CustomTimePickerModal
                isOpen={true}
                value={
                  routeDraft.preferredArrival ||
                  resolveValidArrivalTime24(routeDraft.departureTime || "08:30")
                    .arrival24
                }
                minTime24={routeDraft.departureTime || "08:30"}
                title="희망 도착 시간 설정"
                subtitle={`현재 출발 시간(${formatKoreanTimeLabel(routeDraft.departureTime || "08:30")} · ${routeDraft.departureTime || "08:30"})보다 이후 시간만 선택할 수 있습니다.`}
                onClose={() => setActiveSheetPicker("none")}
                onConfirm={(nextTime) => {
                  if (
                    !isValidDepartureAndArrival(
                      routeDraft.departureTime || "08:30",
                      nextTime,
                    )
                  ) {
                    setRouteTimeAlert(
                      "도착 시간은 출발 시간보다 이후로 설정해주세요.",
                    )
                    return
                  }
                  const nextDraft: RouteData = {
                    ...routeDraft,
                    preferredArrival: nextTime,
                  }
                  setRouteTimeAutoNotice("")
                  setRouteDraft(nextDraft)
                  setRouteDirty(true)
                  onSaveRoute(nextDraft)
                  setActiveSheetPicker("none")
                }}
              />
            )}
            {role === "rider" && (
              <div className="two-fields">
                <label className="field">
                  <span>흡연 여부 조건</span>
                  <select
                    value={routeDraft.smokingPreference ?? "비흡연자 선호"}
                    onChange={(event) => {
                      setRouteDraft({
                        ...routeDraft,
                        smokingPreference: event.target.value,
                      })
                      setRouteDirty(true)
                    }}
                  >
                    <option value="비흡연자 선호">비흡연자 선호</option>
                    <option value="흡연자 탑승 가능">흡연자 탑승 가능</option>
                    <option value="흡연 여부 무관">흡연 여부 무관</option>
                  </select>
                </label>
                <label className="field">
                  <span>성별 조건</span>
                  <select
                    value={routeDraft.genderPreference ?? "성별 무관"}
                    onChange={(event) => {
                      setRouteDraft({
                        ...routeDraft,
                        genderPreference: event.target.value,
                      })
                      setRouteDirty(true)
                    }}
                  >
                    <option value="성별 무관">성별 무관</option>
                    <option value="동성만">동성만</option>
                  </select>
                </label>
              </div>
            )}
            <label className="field">
              <span>자주 이용하는 요일</span>
              <span className="weekday-selector">
                {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
                  <button
                    type="button"
                    className={
                      routeDraft.weekdays.includes(day) ? "active" : ""
                    }
                    onClick={() => {
                      setRouteDraft({
                        ...routeDraft,
                        weekdays: routeDraft.weekdays.includes(day)
                          ? routeDraft.weekdays.filter((item) => item !== day)
                          : [...routeDraft.weekdays, day],
                      })
                      setRouteDirty(true)
                    }}
                    key={day}
                  >
                    {day}
                  </button>
                ))}
              </span>
            </label>
            <div className="route-edit-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setRouteDraft(defaultRoutes[role])
                  setRouteTimeAutoNotice("")
                  setRouteDirty(true)
                }}
              >
                초기화
              </Button>
              <Button
                variant="soft"
                onClick={async () => {
                  if (routeDirty) {
                    const ok = await showAppConfirm({
                      title: "변경 사항 취소",
                      message: "변경 사항을 취소할까요?",
                      confirmText: "변경 취소",
                      cancelText: "계속 편집",
                      variant: "danger",
                    })
                    if (!ok) return
                  }
                  close()
                }}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  const dep = routeDraft.departureTime || "08:30"
                  const arr =
                    routeDraft.preferredArrival ||
                    resolveValidArrivalTime24(dep).arrival24
                  if (!isValidDepartureAndArrival(dep, arr)) {
                    setRouteTimeAlert(
                      "도착 시간은 출발 시간보다 이후로 설정해주세요.",
                    )
                    return
                  }
                  onSaveRoute({
                    ...routeDraft,
                    departureTime: dep,
                    preferredArrival: arr,
                  })
                  setRouteDirty(false)
                  close()
                }}
              >
                저장
              </Button>
            </div>
            {routeTimeAlert && (
              <div
                className="dialog-backdrop flow-dialog-backdrop time-validation-alert-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setRouteTimeAlert("")
                }}
              >
                <section
                  className="app-dialog"
                  role="alertdialog"
                  aria-modal="true"
                >
                  <span className="dialog-icon neutral">
                    <Clock3 />
                  </span>
                  <h2>시간 설정 안내</h2>
                  <p>{routeTimeAlert}</p>
                  <Button type="button" onClick={() => setRouteTimeAlert("")}>
                    확인
                  </Button>
                </section>
              </div>
            )}
          </div>
        )}
        {(type === "account" || type === "account-edit") && (
          <div className="sheet-content account-edit-content">
            <div className="account-edit-header">
              <div className="profile-avatar">
                {accountDraft.name.slice(0, 1) || "신"}
              </div>
              <div>
                <h2>{accountDraft.name || "사용자"}</h2>
                <p>2024년 3월 2일 가입</p>
                <div className="profile-verified-row">
                  <span className="verified-text">
                    <ShieldCheck /> 학교 이메일 인증
                  </span>
                  {account.isDriverVerified && (
                    <span className="verified-text verified-text--driver">
                      <ShieldCheck /> 면허증 인증
                    </span>
                  )}
                </div>
              </div>
              {type === "account" && (
                <button onClick={() => setEditingAccount(!editingAccount)}>
                  {editingAccount ? "취소" : "수정"}
                </button>
              )}
            </div>
            <div className="form-stack">
              <Field
                label="이름"
                value={accountDraft.name}
                onChange={(event) =>
                  setAccountDraft({ ...accountDraft, name: event.target.value })
                }
                disabled={!isEditingAccount}
              />
              <Field label="아이디" value={accountDraft.id} disabled />
              <Field
                label="신구대학교 이메일 · 인증 완료"
                value={accountDraft.email}
                disabled
              />
              {account.isDriverVerified && (
                <Field
                  label="운전자 면허 인증 상태"
                  value={
                    account.licenseFileName
                      ? `면허증 인증 완료 (${account.licenseFileName})`
                      : "면허증 인증 완료"
                  }
                  disabled
                />
              )}
              <Field
                label="전화번호"
                type="tel"
                placeholder="숫자만 입력 (자동 하이픈 적용)"
                maxLength={13}
                value={accountDraft.phone}
                onChange={(event) =>
                  setAccountDraft({
                    ...accountDraft,
                    phone: formatPhoneInput(
                      event.target.value,
                      accountDraft.phone,
                    ),
                  })
                }
                disabled={!isEditingAccount}
              />
              {isEditingAccount && !isValidPhoneNumber(accountDraft.phone) && (
                <small className="helper">
                  숫자 11자리(010-0000-0000)를 모두 입력해 주세요.
                </small>
              )}
              <Field
                label="성별 · 비공개"
                value={accountDraft.gender}
                onChange={(event) =>
                  setAccountDraft({
                    ...accountDraft,
                    gender: event.target.value,
                  })
                }
                disabled={!isEditingAccount}
              />
              <Field
                label="등록된 역할"
                value={`${registrations.rider ? "탑승자" : ""}${
                  registrations.driver ? " · 운전자" : ""
                }`}
                disabled
              />
              {isEditingAccount && (
                <section className="badge-management">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">MY BADGES</span>
                      <h2>내 뱃지 관리</h2>
                    </div>
                    <small>{badgeDraft.length}/3 선택</small>
                  </div>
                  <p>
                    프로필에 표시할 대표 뱃지를 최대 3개까지 선택할 수 있어요.
                  </p>
                  <div className="badge-selection-list">
                    {demoProfileBadges
                      .filter((badge) => badge.role === role)
                      .map((badge) => {
                        const selected = badgeDraft.includes(badge.id)
                        return (
                          <button
                            className={selected ? "selected" : ""}
                            onClick={() => {
                              if (selected) {
                                setBadgeDraft((current) =>
                                  current.filter((id) => id !== badge.id),
                                )
                                setBadgeError("")
                                return
                              }
                              if (badgeDraft.length >= 3) {
                                setBadgeError(
                                  "대표 뱃지는 최대 3개까지 선택할 수 있어요.",
                                )
                                return
                              }
                              setBadgeDraft((current) => [...current, badge.id])
                              setBadgeError("")
                            }}
                            aria-pressed={selected}
                            key={badge.id}
                          >
                            <span
                              className={`badge-selection-icon tone-${badge.tone}`}
                            >
                              <BadgeGlyph badge={badge} />
                            </span>
                            <span>
                              <strong>{badge.label}</strong>
                              <small>{badge.condition}</small>
                            </span>
                            <i>{selected ? <X /> : <Plus />}</i>
                          </button>
                        )
                      })}
                  </div>
                  {badgeError && (
                    <span className="field-error badge-error">
                      {badgeError}
                    </span>
                  )}
                </section>
              )}
              {isEditingAccount && (
                <Button
                  onClick={async () => {
                    const cleanPhone = accountDraft.phone.trim()
                    if (!cleanPhone || !isValidPhoneNumber(cleanPhone)) {
                      await showAppAlert({
                        title: "형식 확인",
                        message: "올바른 휴대폰 번호 형식을 입력해 주세요. (예: 01012345678 또는 010-1234-5678)",
                      })
                      return
                    }
                    const normalized = {
                      ...accountDraft,
                      phone: normalizePhoneNumber(cleanPhone),
                    }
                    onSaveAccount(normalized)
                    onSaveBadges(role, badgeDraft)
                    setEditingAccount(false)
                    setProfileSaved(true)
                  }}
                >
                  저장하기
                </Button>
              )}
              {profileSaved && (
                <div className="dialog-backdrop">
                  <section className="app-dialog">
                    <span className="dialog-icon">
                      <Check />
                    </span>
                    <h2>저장 완료</h2>
                    <p>프로필 정보가 안전하게 저장되었습니다.</p>
                    <Button
                      onClick={() => {
                        setProfileSaved(false)
                        close()
                      }}
                    >
                      확인
                    </Button>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}
        {type === "review" && (
          <div className="sheet-content">
            <div className="section-heading">
              <h2>이번 카풀은 어떠셨나요?</h2>
            </div>
            <div
              className="driver-profile clickable-profile-trigger"
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onViewUserProfile({
                  name: reviewRide?.driverName || "운전자",
                  role: "driver",
                  carInfo: reviewRide?.vehicle,
                })
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onViewUserProfile({
                    name: reviewRide?.driverName || "운전자",
                    role: "driver",
                    carInfo: reviewRide?.vehicle,
                  })
                }
              }}
            >
              <div className="avatar large">
                {(reviewRide?.driverName || "운")[0]}
              </div>
              <div>
                <h2>{reviewRide?.driverName || "운전자"} 운전자</h2>
                <p>
                  {reviewRide
                    ? `${reviewRide.date} · ${reviewRide.start} → ${reviewRide.destination}`
                    : "작성 가능한 완료 카풀이 없습니다."}
                </p>
              </div>
            </div>
            <div className="rating-picker">
              {[1, 2, 3, 4, 5].map((value) => (
                <button onClick={() => setRating(value)} key={value}>
                  <Star className={value <= rating ? "filled" : ""} />
                </button>
              ))}
            </div>
            <div className="review-keywords">
              {[
                "친절해요",
                "시간을 잘 지켜요",
                "안전하게 운전해요",
                "소통이 원활해요",
                "차량이 깨끗해요",
              ].map((keyword) => (
                <button
                  className={reviewKeywords.includes(keyword) ? "active" : ""}
                  onClick={() =>
                    setReviewKeywords((current) =>
                      current.includes(keyword)
                        ? current.filter((item) => item !== keyword)
                        : [...current, keyword],
                    )
                  }
                  key={keyword}
                >
                  {reviewKeywords.includes(keyword) && <Check />}
                  {keyword}
                </button>
              ))}
            </div>
            <label className="field">
              <span>후기 작성</span>
              <textarea
                value={reviewText}
                maxLength={300}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="안전하고 즐거웠던 카풀 경험을 알려주세요."
              />
            </label>
            <div className="character-count">
              <span>공백만 입력한 내용은 저장되지 않습니다.</span>
              <strong>{reviewText.length}/300자</strong>
            </div>
            <Button
              disabled={!reviewText.trim()}
              onClick={() => {
                if (!reviewText.trim()) return
                try {
                  if (reviewRide) {
                    addCarpoolReview(
                      reviewRide.id,
                      rating || 5,
                      reviewKeywords,
                      reviewText,
                    )
                  } else {
                    const review: DemoReview = {
                      author: `${account.name || "탑승자"} · 작성한 후기`,
                      date: new Date().toLocaleDateString("ko-KR"),
                      score: rating || 5,
                      text: reviewText.trim(),
                      tags: reviewKeywords,
                    }
                    const nextReviews = [review, ...savedReviews]
                    setSavedReviews(nextReviews)
                    writeDemoData(sheetReviewStorageKey, nextReviews)
                  }
                  setFlowNotice("후기 작성 완료")
                } catch (error) {
                  setFlowNotice(
                    error instanceof Error
                      ? error.message
                      : "후기를 등록할 수 없습니다.",
                  )
                }
              }}
            >
              후기 등록
            </Button>
            <Button variant="ghost" onClick={close}>
              나중에 하기
            </Button>
            {flowNotice && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon">
                    <Check />
                  </span>
                  <h2>{flowNotice}</h2>
                  <p>브라우저에 저장된 발표용 데모 리뷰입니다.</p>
                  <Button onClick={close}>확인</Button>
                </section>
              </div>
            )}
          </div>
        )}
        {type === "reviews" && (
          <div className="sheet-content reviews-content">
            <section className="review-overview">
              <div className="review-average">
                <strong>{averageReviewScore}</strong>
                <span>
                  <Star /> 평균 별점
                </span>
                <small>후기 {allReviews.length}개</small>
              </div>
              <div className="rating-bars">
                {[5, 4, 3, 2, 1].map((score) => {
                  const count = allReviews.filter(
                    (item) => Math.round(item.score) === score,
                  ).length
                  const width =
                    allReviews.length > 0
                      ? Math.round((count / allReviews.length) * 100)
                      : 0
                  return (
                    <div key={score}>
                      <span>{score}</span>
                      <i>
                        <b style={{ width: `${width}%` }} />
                      </i>
                      <small>{width}%</small>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="manner-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">MANNER KEYWORDS</span>
                  <h2>이런 점이 좋았어요</h2>
                </div>
              </div>
              <div className="manner-list">
                {(role === "driver"
                  ? [
                      "급정거 없이 안전해요",
                      "약속 시간을 잘 지켜요",
                      "차량이 깨끗해요",
                    ]
                  : [
                      "친절하고 매너가 좋아요",
                      "약속 시간을 잘 지켜요",
                      "탑승 규칙을 잘 지켜요",
                    ]
                ).map((label) => {
                  const count = allReviews.filter((item) =>
                    item.tags?.some((tag) =>
                      tag.includes(label.slice(0, 4)) ||
                      label.includes(tag.slice(0, 4)),
                    ),
                  ).length
                  const progress =
                    allReviews.length > 0
                      ? Math.min(
                          100,
                          Math.round((count / allReviews.length) * 100),
                        )
                      : 0
                  return (
                    <div key={label}>
                      <p>
                        <strong>{label}</strong>
                        <span>{count}명</span>
                      </p>
                      <i>
                        <b style={{ width: `${progress}%` }} />
                      </i>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="received-reviews">
              <div className="section-heading">
                <h2>개별 후기</h2>
                <span>최신순</span>
              </div>
              {allReviews.length > 0 ? (
                allReviews.map((reviewItem, idx) => (
                  <article key={`${reviewItem.date}-${reviewItem.score}-${idx}`}>
                    <header
                      className="clickable-profile-trigger"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          name: reviewItem.author,
                          role: role === "driver" ? "rider" : "driver",
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            name: reviewItem.author,
                            role: role === "driver" ? "rider" : "driver",
                          })
                        }
                      }}
                    >
                      <div className="reviewer-avatar">
                        <UserRound />
                      </div>
                      <div>
                        <strong>{reviewItem.author}</strong>
                        <span>{reviewItem.date}</span>
                      </div>
                      <b>
                        <Star /> {reviewItem.score.toFixed(1)}
                      </b>
                    </header>
                    <p>{reviewItem.text}</p>
                    <div className="review-tags">
                      {reviewItem.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="history-empty">
                  <Star />
                  <strong>아직 받은 후기가 없습니다.</strong>
                </div>
              )}
            </section>
          </div>
        )}
        {type === "safety-report" && (
          <div className="sheet-content safety-form-content">
            <div className="demo-banner">
              <ShieldCheck />
              <p>
                <strong>데모 신고 접수</strong>
                현재 입력한 내용은 브라우저에만 저장되며 실제 운영진에게
                전송되지 않습니다.
              </p>
            </div>

            <section className="safety-form-section">
              <label className="field">
                <span>신고 대상 *</span>
                {demoReportTargets.length > 0 ? (
                  <select
                    value={reportTargetId}
                    onChange={(event) => {
                      setReportTargetId(event.target.value)
                      setReportErrors((current) => ({
                        ...current,
                        target: undefined,
                      }))
                    }}
                  >
                    <option value="">최근 이용 내역에서 선택</option>
                    {demoReportTargets.map((target) => (
                      <option value={target.id} key={target.id}>
                        {target.rideLabel} · {target.name} {target.role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="inline-empty">
                    신고할 수 있는 이용 내역이 없습니다.
                  </div>
                )}
              </label>
              {reportErrors.target && (
                <span className="field-error safety-error">
                  {reportErrors.target}
                </span>
              )}
            </section>

            <section className="safety-form-section">
              <div className="form-section-heading">
                <strong>신고 사유 *</strong>
                <span>한 가지 사유를 선택해 주세요.</span>
              </div>
              <div className="reason-chips">
                {[
                  "무단 노쇼 / 지각",
                  "부적절한 언행 / 불친절",
                  "위험 운전 / 교통법규 위반",
                  "과도한 기름값 / 수수료 요구",
                  "기타",
                ].map((reason) => (
                  <button
                    className={reportReason === reason ? "active" : ""}
                    onClick={() => {
                      setReportReason(reason)
                      setReportErrors((current) => ({
                        ...current,
                        reason: undefined,
                      }))
                    }}
                    key={reason}
                  >
                    {reportReason === reason && <Check />}
                    {reason}
                  </button>
                ))}
              </div>
              {reportErrors.reason && (
                <span className="field-error safety-error">
                  {reportErrors.reason}
                </span>
              )}
            </section>

            <section className="safety-form-section">
              <label className="field">
                <span>상세 내용</span>
                <textarea
                  value={reportDetails}
                  maxLength={500}
                  onChange={(event) => setReportDetails(event.target.value)}
                  placeholder="상세한 상황을 입력해 주세요."
                />
              </label>
              <div className="character-count">
                <span>상세한 상황을 입력해 주시면 확인에 도움이 됩니다.</span>
                <strong>{reportDetails.length}/500자</strong>
              </div>
            </section>

            <section className="safety-form-section">
              <div className="form-section-heading">
                <strong>증빙 사진</strong>
                <span>이미지 파일을 최대 3장까지 첨부할 수 있어요.</span>
              </div>
              <div className="evidence-grid">
                {reportImages.map((image, index) => (
                  <div
                    className="evidence-preview"
                    key={`${image.slice(-12)}-${index}`}
                  >
                    <img src={image} alt={`증빙 사진 ${index + 1}`} />
                    <button
                      onClick={() =>
                        setReportImages((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label={`${index + 1}번째 사진 삭제`}
                    >
                      <X />
                    </button>
                  </div>
                ))}
                {reportImages.length < 3 && (
                  <label className="evidence-upload">
                    <Plus />
                    <span>사진 첨부</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        void addEvidenceImages(event.target.files)
                        event.target.value = ""
                      }}
                    />
                  </label>
                )}
              </div>
              {reportErrors.images && (
                <span className="field-error safety-error">
                  {reportErrors.images}
                </span>
              )}
            </section>

            <div className="safety-submit-bar">
              {reportErrors.submit && (
                <span className="field-error safety-error">
                  {reportErrors.submit}
                </span>
              )}
              <Button onClick={submitReport}>신고 접수하기</Button>
            </div>

            {reportSubmitted && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon">
                    <Check />
                  </span>
                  <h2>신고 접수 완료</h2>
                  <p>
                    신고가 접수되었습니다. 현재는 데모 화면이며 실제 운영진에게
                    전송되지는 않습니다.
                  </p>
                  <Button
                    onClick={() => {
                      setReportSubmitted(false)
                      setReportTargetId("")
                      setReportReason("")
                      setReportDetails("")
                      setReportImages([])
                      open("report-history")
                    }}
                  >
                    신고 처리 내역 보기
                  </Button>
                </section>
              </div>
            )}
          </div>
        )}

        {type === "blocked-users" && (
          <div className="sheet-content">
            <div className="notice-box safety-notice">
              <UsersRound />
              <p>
                <strong>데모 차단 목록</strong>
                실제 추천 제외 연동 전 단계입니다. 서버 연결 후 차단된 사용자를
                추천 및 매칭에서 제외하도록 설계합니다.
              </p>
            </div>
            {blockedUsers.length > 0 ? (
              <div className="blocked-list">
                {blockedUsers.map((user) => (
                  <article key={user.id}>
                    <div
                      className="avatar clickable-profile-trigger"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          id: user.id,
                          name: user.name,
                          role: "rider",
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            id: user.id,
                            name: user.name,
                            role: "rider",
                          })
                        }
                      }}
                    >
                      {user.name.slice(0, 1)}
                    </div>
                    <div
                      className="clickable-profile-trigger"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewUserProfile({
                          id: user.id,
                          name: user.name,
                          role: "rider",
                        })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.stopPropagation()
                          onViewUserProfile({
                            id: user.id,
                            name: user.name,
                            role: "rider",
                          })
                        }
                      }}
                    >
                      <strong>{user.name}</strong>
                      <span>{user.blockedAt} 차단</span>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setUnblockCandidate(user)}
                    >
                      차단 해제
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="safety-empty">
                <UsersRound />
                <strong>차단한 사용자가 없습니다.</strong>
                <p>
                  카풀 이용 중 불편한 사용자가 있다면 안전 관리에서 차단할 수
                  있습니다.
                </p>
              </div>
            )}
            {unblockCandidate && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <UsersRound />
                  </span>
                  <h2>차단을 해제할까요?</h2>
                  <p>
                    {unblockCandidate.name} 님의 차단을 해제하시겠습니까? 이후
                    카풀 추천에서 다시 만날 수 있습니다.
                  </p>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => setUnblockCandidate(null)}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={() => {
                        setBlockedUsers(unblockDemoUser(unblockCandidate.id))
                        setUnblockCandidate(null)
                      }}
                    >
                      해제하기
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {type === "report-history" && (
          <div className="sheet-content">
            <div className="filter-tabs">
              {(["전체", "검토 중", "처리 완료"] as const).map((filter) => (
                <button
                  className={reportFilter === filter ? "active" : ""}
                  onClick={() => setReportFilter(filter)}
                  key={filter}
                >
                  {filter}
                </button>
              ))}
            </div>
            {reports.filter(
              (report) =>
                reportFilter === "전체" || report.status === reportFilter,
            ).length > 0 ? (
              <div className="report-history-list">
                {reports
                  .filter(
                    (report) =>
                      reportFilter === "전체" || report.status === reportFilter,
                  )
                  .map((report) => {
                    const expanded = expandedReportId === report.id
                    return (
                      <article key={report.id}>
                        <button
                          className="report-summary"
                          onClick={() =>
                            setExpandedReportId(expanded ? null : report.id)
                          }
                        >
                          <span
                            className={`tag ${
                              report.status === "처리 완료" ? "open" : "waiting"
                            }`}
                          >
                            {report.status}
                          </span>
                          <div>
                            <strong
                              className="clickable-profile-inline"
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation()
                                onViewUserProfile({
                                  name: report.targetName,
                                  role:
                                    report.targetRole === "운전자"
                                      ? "driver"
                                      : "rider",
                                })
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  onViewUserProfile({
                                    name: report.targetName,
                                    role:
                                      report.targetRole === "운전자"
                                        ? "driver"
                                        : "rider",
                                  })
                                }
                              }}
                            >
                              {report.targetName} {report.targetRole}
                            </strong>
                            <p>{report.reason}</p>
                            <small>{report.createdAt} 접수</small>
                          </div>
                          <ChevronRight className={expanded ? "rotate" : ""} />
                        </button>
                        {expanded && (
                          <div className="report-detail">
                            <dl>
                              <div>
                                <dt>이용 내역</dt>
                                <dd>{report.rideLabel}</dd>
                              </div>
                              <div>
                                <dt>상세 내용</dt>
                                <dd>
                                  {report.details ||
                                    "작성된 상세 내용이 없습니다."}
                                </dd>
                              </div>
                              <div>
                                <dt>처리 결과</dt>
                                <dd>
                                  {report.response ||
                                    "아직 처리 결과가 등록되지 않았습니다."}
                                </dd>
                              </div>
                            </dl>
                            {report.images.length > 0 && (
                              <div className="report-images">
                                {report.images.map((image, index) => (
                                  <img
                                    src={image}
                                    alt={`첨부 증빙 ${index + 1}`}
                                    key={`${report.id}-${index}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
              </div>
            ) : (
              <div className="safety-empty">
                <CreditCard />
                <strong>접수된 신고 내역이 없습니다.</strong>
                <p>신고를 접수하면 이곳에서 진행 상태를 확인할 수 있습니다.</p>
              </div>
            )}
          </div>
        )}

        {type === "privacy" && (
          <div className="sheet-content">
            <div className="privacy-hero">
              <ShieldCheck />
              <p>
                신구길은 이용자의 개인정보를 안전하게 보호하는 것을 중요하게
                생각합니다.
              </p>
            </div>
            <div className="privacy-card-list">
              <article>
                <CreditCard />
                <div>
                  <h3>안심번호 서비스</h3>
                  <p>
                    실제 전화번호를 직접 공개하지 않는 방식으로 연락할 수 있도록
                    설계합니다. 현재 안심번호 기능의 실제 연결 여부는 서비스
                    제공 상태에 따라 달라질 수 있습니다.
                  </p>
                </div>
              </article>
              <article>
                <MapPin />
                <div>
                  <h3>위치 정보 최소화</h3>
                  <p>
                    카풀 이용에 필요한 위치 정보만 최소한으로 사용하도록
                    설계합니다. 실제 수집·이용·보관 및 삭제 정책은 서비스 구현과
                    개인정보 처리방침에 따라 안내해야 합니다.
                  </p>
                </div>
              </article>
              <article>
                <ShieldCheck />
                <div>
                  <h3>대학 구성원 인증</h3>
                  <p>
                    학교 구성원 확인을 통해 안전한 환경을 만드는 것이
                    목표입니다. 실제 인증이 연결되기 전에는 인증 완료를 보장하지
                    않습니다.
                  </p>
                </div>
              </article>
            </div>
            <Button onClick={() => open("privacy-policy")}>
              개인정보 처리방침 전문 보기
            </Button>
          </div>
        )}

        {type === "privacy-policy" && (
          <div className="sheet-content">
            <div className="safety-empty policy-empty">
              <ShieldCheck />
              <strong>개인정보 처리방침을 준비 중입니다.</strong>
              <p>
                실제 서비스 정책과 데이터 처리 기준이 확정되면 이 화면에서
                안내할 예정입니다. 현재 내용은 법적 정책이나 실제 운영 방침을
                의미하지 않습니다.
              </p>
            </div>
          </div>
        )}

        {type === "safety" && (
          <div className="sheet-content">
            <div className="safety-hero">
              <ShieldCheck />
              <h2>안전한 카풀을 함께 만들어요</h2>
              <p>긴급 상황에는 앱보다 112 또는 119에 먼저 연락해 주세요.</p>
            </div>
            <nav className="menu-list">
              <button onClick={() => open("safety-report")}>
                <Flag />
                <span>사용자 신고하기</span>
                <ChevronRight />
              </button>
              <button onClick={() => open("blocked-users")}>
                <UsersRound />
                <span>차단 사용자 관리</span>
                <ChevronRight />
              </button>
              <button onClick={() => open("report-history")}>
                <CircleHelp />
                <span>신고 처리 내역</span>
                <ChevronRight />
              </button>
              <button onClick={() => open("privacy")}>
                <ShieldCheck />
                <span>개인정보 보호 안내</span>
                <ChevronRight />
              </button>
            </nav>
          </div>
        )}
        {type === "roles" && (
          <div className="sheet-content role-sheet">
            <p>
              역할을 바꿔도 포인트, 마일리지, 채팅, 일정과 이용 내역은
              유지됩니다.
            </p>
            <div className="role-switcher role-switcher--sheet">
              {(["rider", "driver"] as Role[]).map((item) => (
                <button
                  className={role === item ? "active" : ""}
                  onClick={() => onSelectRole(item)}
                  key={item}
                >
                  {item === "driver" ? <CarFront /> : <UsersRound />}
                  <span>
                    <strong>{item === "driver" ? "운전자" : "탑승자"}</strong>
                    <small>
                      {role === item
                        ? "현재 역할"
                        : registrations[item]
                          ? "등록 완료 · 바로 변경"
                          : "최초 등록 필요"}
                    </small>
                  </span>
                  {role === item ? <Check /> : <ChevronRight />}
                </button>
              ))}
            </div>
            <div className="notice-box">
              <ShieldCheck />
              <p>
                <strong>역할별 정보는 따로 보관돼요</strong>한 역할의 기본
                경로를 수정해도 다른 역할의 경로는 변경되지 않습니다.
              </p>
            </div>
          </div>
        )}
        {(type === "driver-register" || type === "rider-register") && (
          <div className="sheet-content registration-content">
            <RoleRegistration
              role={type === "driver-register" ? "driver" : "rider"}
              onComplete={onCompleteRole}
              account={account}
            />
          </div>
        )}
        {type === "notification-settings" && (
          <div className="sheet-content settings-subpage">
            <p className="settings-intro">
              받고 싶은 알림을 직접 설정할 수 있어요.
            </p>
            <div className="settings-card-list">
              <article>
                <div>
                  <strong>전체 알림</strong>
                  <span>모든 서비스 알림을 켜거나 끕니다.</span>
                </div>
                <Toggle
                  checked={notificationsEnabled}
                  label="전체 알림"
                  onChange={toggleAllNotifications}
                />
              </article>
              {!notificationsEnabled && (
                <div className="settings-warning">
                  <Bell />
                  전체 알림이 꺼져 있어 모든 알림이 비활성화됩니다.
                </div>
              )}
              {([
                [
                  "matching",
                  "카풀 매칭 알림",
                  "새로운 카풀 추천 및 매칭 관련 알림입니다.",
                ],
                [
                  "trip",
                  "출발/도착 안내",
                  "카풀 출발 시간과 탑승·도착 관련 안내입니다.",
                ],
                ["chat", "채팅 알림", "새로운 채팅 메시지를 알려줍니다."],
                [
                  "marketing",
                  "마케팅 알림",
                  "이벤트, 혜택 및 프로모션 관련 알림입니다.",
                ],
              ] as const).map(([key, title, description]) => (
                <article
                  className={!notificationsEnabled ? "disabled" : ""}
                  key={key}
                >
                  <div>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                  <Toggle
                    checked={notificationsEnabled && notificationSettings[key]}
                    disabled={!notificationsEnabled}
                    label={title}
                    onChange={() => toggleNotification(key)}
                  />
                </article>
              ))}
            </div>
            <div className="demo-banner settings-demo-note">
              <CircleHelp />
              <p>
                <strong>프론트엔드 데모 설정</strong>
                실제 운영체제 푸시 알림을 등록하거나 발송하지 않습니다.
              </p>
            </div>
          </div>
        )}

        {type === "security-settings" && (
          <div className="sheet-content settings-subpage">
            <p className="settings-intro">
              계정과 개인정보를 안전하게 관리하세요.
            </p>
            <section className="verification-card">
              <span className="settings-leading-icon">
                <ShieldCheck />
              </span>
              <div>
                <span className="tag open">인증 완료</span>
                <h3>신구대 학적 인증</h3>
                <p>
                  {account.email
                    ? `${account.email} 계정으로 학교 이메일 인증이 확인되었습니다.`
                    : "학교 이메일 인증이 확인된 계정입니다."}
                </p>
                <Button
                  variant="soft"
                  onClick={() => setSettingsDialog("school")}
                >
                  인증 안내
                </Button>
              </div>
            </section>

            <div className="security-list">
              <button onClick={() => setSettingsDialog("password")}>
                <span>
                  <strong>비밀번호 변경</strong>
                  <small>계정 비밀번호를 변경합니다.</small>
                </span>
                <ChevronRight />
              </button>
              <div>
                <span>
                  <strong>생체인증 로그인 (지문/Face ID)</strong>
                  <small>
                    {biometricEnabled
                      ? "활성화됨 · 로그인 화면에서 지문/Face ID로 바로 로그인할 수 있습니다."
                      : "토글을 켜면 기기 생체인증 확인 후 빠른 로그인을 설정합니다."}
                  </small>
                </span>
                <Toggle
                  checked={biometricEnabled}
                  label="생체인증 로그인(지문/Face ID)"
                  onChange={() => {
                    if (biometricEnabled) {
                      setBiometricEnabled(false)
                      saveBiometricDemoState(false)
                      setSecurityNotice(
                        "생체인증 로그인이 해제되었습니다. 다음 로그인부터 일반 로그인만 표시됩니다.",
                      )
                    } else {
                      void checkBiometricHardwareSupport().then((info) => {
                        setBiometricHardwareInfo(info)
                        setSettingsDialog("biometric")
                      })
                    }
                  }}
                />
              </div>
            </div>

            {securityNotice && (
              <div className="email-code-notice security-status-banner">
                <ShieldCheck />
                <span>{securityNotice}</span>
              </div>
            )}

            <section className="security-devices-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DEVICE MANAGEMENT</span>
                  <h2>로그인된 기기 관리</h2>
                </div>
                <small>총 {devices.length}대 등록됨</small>
              </div>
              <p className="security-devices-desc">
                현재 접속 중인 기기 정보를 확인하고 새 기기를 등록하거나 사용하지 않는 기기를 삭제(로그아웃)할 수 있습니다.
              </p>
              <div className="device-register-bar">
                <input
                  type="text"
                  value={customDeviceName}
                  onChange={(event) => setCustomDeviceName(event.target.value)}
                  placeholder="등록할 기기 별칭 (선택, 미입력 시 자동 감지)"
                  aria-label="등록할 기기 별칭"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const updated = registerCurrentDemoDevice(customDeviceName)
                    setDevices(updated)
                    setCustomDeviceName("")
                    setSecurityNotice("현재 접속 기기가 로그인된 기기 목록에 등록되었습니다.")
                  }}
                >
                  <Plus /> 현재 기기 등록
                </Button>
              </div>
              <div className="device-list security-device-list">
                {devices.length > 0 ? (
                  devices.map((device) => (
                    <article key={device.id}>
                      <div>
                        <strong>{device.name}</strong>
                        {device.current && (
                          <span className="tag open">현재 기기</span>
                        )}
                      </div>
                      <p>{device.type}</p>
                      <small>{device.lastActive}</small>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setSelectedDevice(device)
                          setSettingsDialog("device-logout")
                        }}
                      >
                        삭제(로그아웃)
                      </Button>
                    </article>
                  ))
                ) : (
                  <div className="inline-empty">
                    등록된 로그인 기기가 없습니다. &lsquo;현재 기기 등록&rsquo; 버튼을 눌러 기기를 추가해 주세요.
                  </div>
                )}
              </div>
            </section>

            <section className="danger-zone">
              <strong>회원 탈퇴</strong>
              <p>계정 이용을 중단하고 싶다면 회원 탈퇴를 진행할 수 있습니다.</p>
              <button onClick={() => setSettingsDialog("withdraw-1")}>
                회원 탈퇴
              </button>
            </section>

            {settingsDialog === "school" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <ShieldCheck />
                  </span>
                  <h2>학교 이메일 인증</h2>
                  <p>
                    {account.email
                      ? `${account.email} 계정으로 신구대학교 구성원 인증이 완료된 상태입니다.`
                      : "학교 이메일 인증이 완료된 상태입니다."}
                  </p>
                  <Button onClick={() => setSettingsDialog(null)}>확인</Button>
                </section>
              </div>
            )}
            {settingsDialog === "password" && (
              <div className="dialog-backdrop">
                <section className="app-dialog password-dialog">
                  <h2>비밀번호 변경</h2>
                  <div className="form-stack">
                    <Field
                      label="현재 비밀번호"
                      type="password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                    />
                    {passwordErrors.current && (
                      <span className="field-error">
                        {passwordErrors.current}
                      </span>
                    )}
                    <Field
                      label="새 비밀번호"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    {passwordErrors.new && (
                      <span className="field-error">{passwordErrors.new}</span>
                    )}
                    <Field
                      label="새 비밀번호 확인"
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(event) =>
                        setNewPasswordConfirm(event.target.value)
                      }
                    />
                    {passwordErrors.confirm && (
                      <span className="field-error">
                        {passwordErrors.confirm}
                      </span>
                    )}
                  </div>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSettingsDialog(null)
                        setPasswordErrors({})
                      }}
                    >
                      취소
                    </Button>
                    <Button onClick={validatePasswordDemo}>변경하기</Button>
                  </div>
                </section>
              </div>
            )}
            {settingsDialog === "password-note" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <CircleHelp />
                  </span>
                  <h2>서버 연결이 필요해요</h2>
                  <p>
                    비밀번호 변경 기능은 서버 연결 후 이용할 수 있습니다. 입력한
                    비밀번호는 저장되지 않습니다.
                  </p>
                  <Button
                    onClick={() => {
                      setSettingsDialog(null)
                      setCurrentPassword("")
                      setNewPassword("")
                      setNewPasswordConfirm("")
                      setPasswordErrors({})
                    }}
                  >
                    확인
                  </Button>
                </section>
              </div>
            )}
            {settingsDialog === "biometric" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon">
                    <ShieldCheck />
                  </span>
                  <h2>기기 생체인증 확인</h2>
                  <p>
                    {biometricHardwareInfo?.supported
                      ? "기기의 생체인증(지문/Face ID) 센서가 확인되었습니다. 인증을 완료하면 로그인 화면에서 생체인증으로 즉시 로그인할 수 있습니다."
                      : `${
                          biometricHardwareInfo?.reason ||
                          "현재 브라우저 미리보기 또는 기기에는 별도의 생체인증 하드웨어 센서가 감지되지 않았습니다."
                        } 보안 확인 절차를 통해 생체인증 로그인 설정을 활성화할 수 있습니다.`}
                  </p>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => setSettingsDialog(null)}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={() => {
                        setBiometricEnabled(true)
                        saveBiometricDemoState(true)
                        saveBiometricAccount(account, role)
                        setSettingsDialog(null)
                        setSecurityNotice(
                          "생체인증 로그인(지문/Face ID)이 활성화되었습니다. 이제 로그인 화면에서 생체인증 버튼을 사용할 수 있습니다.",
                        )
                      }}
                    >
                      생체인증 확인 완료
                    </Button>
                  </div>
                </section>
              </div>
            )}
            {settingsDialog === "device-logout" && selectedDevice && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <ShieldCheck />
                  </span>
                  <h2>기기 삭제(로그아웃) 확인</h2>
                  <p>
                    <strong>{selectedDevice.name}</strong> ({selectedDevice.type}) 기기를 로그인된 기기 목록에서 삭제하고 로그아웃 처리할까요?
                  </p>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedDevice(null)
                        setSettingsDialog(null)
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={() => {
                        const updated = removeDemoDevice(selectedDevice.id)
                        setDevices(updated)
                        setSecurityNotice(
                          `'${selectedDevice.name}' 기기가 목록에서 삭제(로그아웃)되었습니다.`,
                        )
                        setSelectedDevice(null)
                        setSettingsDialog(null)
                      }}
                    >
                      삭제(로그아웃)
                    </Button>
                  </div>
                </section>
              </div>
            )}
            {settingsDialog === "withdraw-1" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <h2>회원 탈퇴</h2>
                  <p>
                    회원 탈퇴 시 계정과 카풀 이용에 영향을 줄 수 있습니다. 정말
                    탈퇴를 진행하시겠어요?
                  </p>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => setSettingsDialog(null)}
                    >
                      취소
                    </Button>
                    <Button onClick={() => setSettingsDialog("withdraw-2")}>
                      다음
                    </Button>
                  </div>
                </section>
              </div>
            )}
            {settingsDialog === "withdraw-2" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <h2>탈퇴 최종 확인</h2>
                  <p>
                    현재 데모 화면에서는 실제 계정 삭제가 진행되지 않습니다.
                  </p>
                  <label className="confirm-check">
                    <input
                      type="checkbox"
                      checked={withdrawConfirmed}
                      onChange={(event) =>
                        setWithdrawConfirmed(event.target.checked)
                      }
                    />
                    안내 내용을 확인했습니다.
                  </label>
                  <div className="dialog-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSettingsDialog(null)
                        setWithdrawConfirmed(false)
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      disabled={!withdrawConfirmed}
                      onClick={() => setSettingsDialog("withdraw-note")}
                    >
                      확인
                    </Button>
                  </div>
                </section>
              </div>
            )}
            {settingsDialog === "withdraw-note" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon neutral">
                    <CircleHelp />
                  </span>
                  <h2>서버 연결이 필요해요</h2>
                  <p>회원 탈퇴 기능은 서버 연결 후 이용할 수 있습니다.</p>
                  <Button
                    onClick={() => {
                      setSettingsDialog(null)
                      setWithdrawConfirmed(false)
                    }}
                  >
                    확인
                  </Button>
                </section>
              </div>
            )}
          </div>
        )}

        {type === "service-guide" && (
          <div className="sheet-content settings-subpage">
            <p className="settings-intro">
              신구길을 더 편리하고 안전하게 이용하는 방법을 확인하세요.
            </p>
            <div className="guide-card-list">
              <button onClick={() => open("passenger-guide")}>
                <span className="settings-leading-icon">
                  <UsersRound />
                </span>
                <span>
                  <strong>탑승자 이용 가이드</strong>
                  <small>카풀을 신청하고 안전하게 탑승하는 방법</small>
                </span>
                <ChevronRight />
              </button>
              <button onClick={() => open("driver-guide")}>
                <span className="settings-leading-icon green">
                  <CarFront />
                </span>
                <span>
                  <strong>운전자 이용 가이드</strong>
                  <small>카풀 등록부터 운행 완료까지</small>
                </span>
                <ChevronRight />
              </button>
            </div>
            <section className="faq-section">
              <div className="section-heading">
                <h2>자주 묻는 질문</h2>
              </div>
              <div className="faq-list">
                {serviceFaqs.map((faq) => {
                  const expanded = openFaqs.includes(faq.id)
                  return (
                    <article key={faq.id}>
                      <button
                        onClick={() =>
                          setOpenFaqs((current) => {
                            const next = expanded
                              ? current.filter((id) => id !== faq.id)
                              : [...current, faq.id]
                            writeDemoData("open-faqs", next)
                            return next
                          })
                        }
                        aria-expanded={expanded}
                      >
                        <strong>{faq.question}</strong>
                        <ChevronRight className={expanded ? "rotate" : ""} />
                      </button>
                      {expanded && <p>{faq.answer}</p>}
                    </article>
                  )
                })}
              </div>
            </section>
            <Button
              className="contact-button"
              onClick={() => open("contact-support")}
            >
              <MessageCircle /> 1:1 문의하기
            </Button>
            <div className="app-version">
              <div>
                <strong>신구길 SHINGU-GIL</strong>
                <span>현재 개발용 데모 버전입니다.</span>
              </div>
              <p>
                앱 버전 <strong>{APP_VERSION}</strong>
              </p>
            </div>
          </div>
        )}

        {(type === "passenger-guide" || type === "driver-guide") && (
          <div className="sheet-content guide-detail">
            <div className="guide-hero">
              {type === "passenger-guide" ? <UsersRound /> : <CarFront />}
              <div>
                <span className="eyebrow">
                  {type === "passenger-guide" ? "PASSENGER" : "DRIVER"}
                </span>
                <h2>
                  {type === "passenger-guide"
                    ? "안전하게 카풀 이용하기"
                    : "안전하게 카풀 운행하기"}
                </h2>
              </div>
            </div>
            <ol className="guide-steps">
              {(type === "passenger-guide"
                ? [
                    "출발지와 도착지, 희망 시간을 정확하게 설정합니다.",
                    "추천 카풀에서 경로와 출발 시간을 확인합니다.",
                    "운전자 정보와 카풀 조건을 확인한 후 신청합니다.",
                    "신청 상태가 승인으로 변경되었는지 확인합니다.",
                    "채팅으로 탑승 위치와 시간을 확인합니다.",
                    "약속된 장소에서 안전하게 탑승합니다.",
                    "이용 완료 후 운전자 평가를 작성할 수 있습니다.",
                  ]
                : [
                    "운전자 프로필과 차량 정보를 정확하게 입력합니다.",
                    "실제 운행 가능한 경로, 시간과 좌석 수를 등록합니다.",
                    "탑승 신청자의 경로와 신청 정보를 확인합니다.",
                    "신청을 승인하거나 거절합니다.",
                    "채팅으로 탑승 장소와 시간을 확인합니다.",
                    "출발 전 탑승자와 차량 정보를 다시 확인합니다.",
                    "운행이 끝나면 이용 상태를 완료 처리합니다.",
                    "이용 내역과 마일리지를 확인합니다.",
                  ]
              ).map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
            <section className="guide-safety">
              <ShieldCheck />
              <div>
                <h3>안전 수칙</h3>
                <ul>
                  {(type === "passenger-guide"
                    ? [
                        "차량 번호와 탑승 장소를 미리 확인합니다.",
                        "운전자와 합의한 장소에서 탑승합니다.",
                        "위험한 상황에는 이용을 중단하고 신고 기능을 이용합니다.",
                        "비밀번호와 인증번호를 채팅으로 공유하지 않습니다.",
                      ]
                    : [
                        "실제 차량 정보와 운행 조건만 등록합니다.",
                        "안전 운전을 최우선으로 합니다.",
                        "사전 안내한 경로와 비용 조건을 준수합니다.",
                        "위험하거나 불쾌감을 주는 행동을 하지 않습니다.",
                      ]
                  ).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            </section>
            <Button onClick={() => open("service-guide")}>확인</Button>
          </div>
        )}

        {type === "contact-support" && (
          <div className="sheet-content contact-form">
            <div className="demo-banner">
              <CircleHelp />
              <p>
                <strong>데모 문의 작성</strong>
                비밀번호나 인증번호 등 민감한 정보는 입력하지 마세요. 실제
                운영팀으로 전송되지 않습니다.
              </p>
            </div>
            <label className="field">
              <span>문의 유형 *</span>
              <select
                value={inquiryCategory}
                onChange={(event) => {
                  setInquiryCategory(event.target.value)
                  setInquiryErrors((current) => ({
                    ...current,
                    category: "",
                  }))
                }}
              >
                <option value="">문의 유형 선택</option>
                {[
                  "카풀 이용",
                  "신청 및 취소",
                  "결제 및 마일리지",
                  "채팅 및 알림",
                  "계정 및 개인정보",
                  "기타",
                ].map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            {inquiryErrors.category && (
              <span className="field-error">{inquiryErrors.category}</span>
            )}
            <Field
              label="문의 제목 *"
              value={inquiryTitle}
              maxLength={50}
              onChange={(event) => {
                setInquiryTitle(event.target.value)
                setInquiryErrors((current) => ({ ...current, title: "" }))
              }}
              placeholder="문의 제목을 입력하세요"
            />
            <div className="contact-count">{inquiryTitle.length}/50자</div>
            {inquiryErrors.title && (
              <span className="field-error">{inquiryErrors.title}</span>
            )}
            <label className="field">
              <span>문의 내용 *</span>
              <textarea
                value={inquiryContent}
                maxLength={1000}
                onChange={(event) => {
                  setInquiryContent(event.target.value)
                  setInquiryErrors((current) => ({
                    ...current,
                    content: "",
                  }))
                }}
                placeholder="문의 내용을 자세히 입력해 주세요."
              />
            </label>
            <div className="contact-count">{inquiryContent.length}/1,000자</div>
            {inquiryErrors.content && (
              <span className="field-error">{inquiryErrors.content}</span>
            )}
            <div className="dialog-actions contact-actions">
              <Button variant="ghost" onClick={() => open("service-guide")}>
                취소
              </Button>
              <Button onClick={submitInquiry}>문의 등록</Button>
            </div>
            {settingsDialog === "inquiry-success" && (
              <div className="dialog-backdrop">
                <section className="app-dialog">
                  <span className="dialog-icon">
                    <Check />
                  </span>
                  <h2>문의 등록 완료</h2>
                  <p>
                    문의 내용이 등록되었습니다. 현재 데모에서는 실제 운영팀으로
                    전달되지 않습니다.
                  </p>
                  <Button
                    onClick={() => {
                      setSettingsDialog(null)
                      setInquiryCategory("")
                      setInquiryTitle("")
                      setInquiryContent("")
                      setInquiryErrors({})
                      open("service-guide")
                    }}
                  >
                    확인
                  </Button>
                </section>
              </div>
            )}
          </div>
        )}

        {type === "settings" && (
          <div className="sheet-content">
            <nav className="menu-list settings-list">
              <button onClick={() => open("notification-settings")}>
                <Bell />
                <span>알림 설정</span>
                <ChevronRight />
              </button>
              <button onClick={() => open("security-settings")}>
                <ShieldCheck />
                <span>개인정보 및 보안</span>
                <ChevronRight />
              </button>
              <button onClick={() => open("service-guide")}>
                <CircleHelp />
                <span>서비스 이용 안내</span>
                <ChevronRight />
              </button>
            </nav>
          </div>
        )}
      </section>
    </div>
  )
}


export default function App() {
  const tripFlow = useSyncExternalStore(
    subscribeTripFlow,
    getTripFlowSnapshot,
    getTripFlowSnapshot,
  )
  const pointWallet = useSyncExternalStore(
    subscribeDemoPointWallet,
    getDemoPointWallet,
    getDemoPointWallet,
  )
  const carpoolFlow = useSyncExternalStore(
    subscribeCarpoolFlow,
    getCarpoolFlowSnapshot,
    getCarpoolFlowSnapshot,
  )
  const [splash, setSplash] = useState(true)
  const [auth, setAuth] = useState<AuthView>("login")
  const [loggedIn, setLoggedIn] = useState(false)
  const [role, setRole] = useState<Role>(
    () => readDemoValue("demo-role") as Role || "rider",
  )
  const [registrations, setRegistrations] = useState<RoleRegistrations>(() => {
    const saved = readDemoValue("role-registrations")
    const currentRole = readDemoValue("demo-role") as Role | null || "rider"
    if (saved) {
      try {
        return normalizeRegistrations(JSON.parse(saved), currentRole)
      } catch {
        removeDemoData("role-registrations")
      }
    }
    return normalizeRegistrations(null, currentRole)
  })
  const safeRegistrations = normalizeRegistrations(registrations, role)
  const [routesByRole, setRoutesByRole] = useState<Record<Role, RouteData>>(
    () => readDemoData("routes", defaultRoutes),
  )
  const [account, setAccount] = useState<AccountData>(() =>
    readDemoData("account", defaultAccount),
  )
  const mileageBalance = useMemo(
    () => getDemoMileageBalance(account.id, role),
    [account.id, role],
  )
  const [selectedBadges, setSelectedBadges] = useState<Record<Role, string[]>>(
    () => readDemoData("selected-badges", defaultSelectedBadges),
  )
  const [tab, setTab] = useState<Tab>("home")
  const [sheet, setSheet] = useState<Sheet>(null)
  const [chatTargetRideId, setChatTargetRideId] = useState<string | null>(null)
  const [selectedRide, setSelectedRide] = useState<MatchRide | null>(null)
  const [activeCarpoolEvent, setActiveCarpoolEvent] =
    useState<DemoCarpoolEvent | null>(null)
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const saved = readDemoValue("selected-booking-date")
    const today = getTodayDateKey()
    return saved && saved >= today ? saved : today
  })
  const [activeModal, setActiveModal] = useState<
    "none" | "date" | "time" | "route"
  >("none")
  const [homeTimePickerField, setHomeTimePickerField] =
    useState<"departure" | "arrival">("departure")
  const [viewingUserProfile, setViewingUserProfile] =
    useState<PublicUserProfileData | null>(null)
  const [chatAlertModal, setChatAlertModal] = useState<{
    title: string
    message: string
    requireLogin?: boolean
  } | null>(null)

  const closeAllModals = () => {
    setActiveModal("none")
    setSheet(null)
  }

  const handleOpenSheet = (nextSheet: Sheet) => {
    setViewingUserProfile(null)
    if (!nextSheet) {
      setActiveModal("none")
      setSheet(null)
      return
    }
    if (nextSheet === "route-edit") {
      setActiveModal("route")
      setSheet("route-edit")
      return
    }
    setActiveModal("none")
    setSheet(nextSheet)
  }

  const handleOpenDatePicker = () => {
    setSheet(null)
    setViewingUserProfile(null)
    setActiveModal("date")
  }

  const handleOpenTimePicker = (field: "departure" | "arrival" = "departure") => {
    setSheet(null)
    setViewingUserProfile(null)
    setHomeTimePickerField(field)
    setActiveModal("time")
  }

  // Supabase 세션 감지 및 profiles 테이블 Realtime 양방향 동기화
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    let unsubscribeRealtime: (() => void) | null = null

    const syncUserSession = async (
      userId?: string,
      userEmail?: string,
      userMeta?: any,
    ) => {
      let uid = userId
      let email = userEmail
      let meta = userMeta

      if (!uid) {
        const currentUser = await supabaseGetCurrentUser()
        if (!currentUser) return
        uid = currentUser.id
        email = currentUser.email
        meta = currentUser.user_metadata || {}
      }

      setLoggedIn(true)
      const dbProfile = await supabaseGetProfile(uid)
      const resolvedProfile: AccountData = dbProfile || {
        id: uid,
        loginId: email ? email.split("@")[0] : uid,
        name: meta?.name || (email ? email.split("@")[0] : "사용자"),
        email: email || "",
        phone: meta?.phone || "",
        gender: meta?.gender || "선택 안 함",
        role: meta?.role || role,
        isDriverVerified: Boolean(meta?.isDriverVerified),
        licenseFileName: meta?.licenseFileName,
        vehicleName: meta?.vehicleName,
        vehicleCapacity: meta?.vehicleCapacity
          ? Number(meta.vehicleCapacity)
          : undefined,
      }

      setAccount(resolvedProfile)
      writeDemoData("account", resolvedProfile)
      if (resolvedProfile.role && resolvedProfile.role !== role) {
        setRole(resolvedProfile.role)
        writeDemoValue("demo-role", resolvedProfile.role)
      }

      // schedules, carpools, carpool_requests, point_transactions 동기화
      void syncCarpoolWithSupabase()
      void syncPointWalletWithSupabase(uid)
      void Promise.all([
        supabaseGetRoute(uid, "rider"),
        supabaseGetRoute(uid, "driver"),
      ]).then(([riderRoute, driverRoute]) => {
        if (riderRoute || driverRoute) {
          setRoutesByRole((prev) => {
            const nextRoutes: Record<Role, RouteData> = {
              rider: riderRoute || prev.rider,
              driver: driverRoute || prev.driver,
            }
            writeDemoData("routes", nextRoutes)
            return nextRoutes
          })
        }
      })

      if (unsubscribeRealtime) unsubscribeRealtime()
      unsubscribeRealtime = subscribeUserProfileRealtime(
        uid,
        (realtimeProfile) => {
          setAccount(realtimeProfile)
          writeDemoData("account", realtimeProfile)
          if (realtimeProfile.role && realtimeProfile.role !== role) {
            setRole(realtimeProfile.role)
            writeDemoValue("demo-role", realtimeProfile.role)
          }
        },
      )
    }

    void syncUserSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        (event === "SIGNED_IN" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION") &&
        session?.user
      ) {
        void syncUserSession(
          session.user.id,
          session.user.email,
          session.user.user_metadata,
        )
      } else if (event === "SIGNED_OUT") {
        setLoggedIn(false)
        if (unsubscribeRealtime) {
          unsubscribeRealtime()
          unsubscribeRealtime = null
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      if (unsubscribeRealtime) unsubscribeRealtime()
    }
  }, [])

  const openUserProfile = (target: PublicUserProfileTarget) => {
    const resolved = resolvePublicUserProfile(target, carpoolFlow, account)
    if (resolved) {
      setActiveModal((prev) =>
        prev === "date" || prev === "time" ? "none" : prev,
      )
      setViewingUserProfile(resolved)
    }
  }

  const handleStartCarpoolChat = (
    targetUser: CreateOrJoinChatParams["targetUser"],
    rideInfo: CreateOrJoinChatParams["ride"],
  ) => {
    const activeUserId = (account?.id || account?.loginId || "").trim()
    if (!loggedIn || !activeUserId) {
      setChatAlertModal({
        title: "로그인이 필요합니다",
        message: "채팅 기능을 이용하려면 먼저 로그인해 주세요.",
        requireLogin: true,
      })
      return
    }
    const result = getOrCreateCarpoolChatRoom({
      currentUser: {
        id: activeUserId,
        loginId: account?.loginId || activeUserId,
        name: account?.name || (role === "driver" ? "운전자" : "탑승자"),
        role,
        carInfo: account?.vehicleName,
        isDriverVerified: account?.isDriverVerified,
      },
      targetUser,
      ride: rideInfo,
    })
    if (!result.ok) {
      setChatAlertModal({
        title:
          result.reason === "SELF_CHAT_BLOCKED"
            ? "본인 게시글 채팅 불가"
            : "채팅 안내",
        message: result.message,
        requireLogin: result.reason === "LOGIN_REQUIRED",
      })
      return
    }
    setSheet(null)
    setChatTargetRideId(result.room.id)
    setTab("chat")
  }

  const handleGlobalDateChange = (nextDateKey: string) => {
    setBookingDate(nextDateKey)
    writeDemoValue("selected-booking-date", nextDateKey)
    updateCarpoolRidesTimeAndDate({ date: nextDateKey })
    setSelectedRide((prev) => {
      if (!prev) return null
      const formattedDate = new Date(`${nextDateKey}T00:00:00`).toLocaleDateString(
        "ko-KR",
        { month: "long", day: "numeric" },
      )
      const nextEta =
        calculateEstimatedArrival(
          nextDateKey,
          prev.time,
          prev.estimatedDuration || DEFAULT_ESTIMATED_DURATION,
        ) || prev.estimatedArrival
      return {
        ...prev,
        date: formattedDate,
        estimatedArrival: nextEta,
      }
    })
  }

  const handleGlobalTimeChange = (
    nextTime24: string,
    explicitArrival24?: string,
  ) => {
    const resolved = resolveValidArrivalTime24(
      nextTime24,
      explicitArrival24 || routesByRole[role].preferredArrival,
    )
    const safeDep = resolved.departure24
    const safeArr = resolved.arrival24
    setRoutesByRole((prev) => {
      const updatedRoleRoute: RouteData = {
        ...prev[role],
        departureTime: safeDep,
        preferredArrival: safeArr,
      }
      const updatedAll: Record<Role, RouteData> = {
        rider: {
          ...prev.rider,
          departureTime: safeDep,
          preferredArrival: safeArr,
        },
        driver: {
          ...prev.driver,
          departureTime: safeDep,
          preferredArrival: safeArr,
        },
        [role]: updatedRoleRoute,
      }
      writeDemoData("routes", updatedAll)
      if (isSupabaseConfigured()) {
        supabaseSaveRoute(account.id, role, updatedRoleRoute).catch(console.warn)
      }
      return updatedAll
    })
    updateCarpoolRidesTimeAndDate({ time: safeDep })
    setSelectedRide((prev) => {
      if (!prev) return null
      const nextEta =
        calculateEstimatedArrival(
          bookingDate,
          safeDep,
          prev.estimatedDuration || DEFAULT_ESTIMATED_DURATION,
        ) || prev.estimatedArrival
      return {
        ...prev,
        time: safeDep,
        estimatedArrival: nextEta,
      }
    })
  }

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setSplash(false), 3000)
    return () => window.clearTimeout(splashTimer)
  }, [])

  useEffect(() => {
    if (activeCarpoolEvent) return
    const seenEventIds = readDemoList<string>(`carpool-events-seen-${role}`)
    const nextEvent = carpoolFlow.events.find(
      (event) => !seenEventIds.includes(event.id),
    )
    if (nextEvent) setActiveCarpoolEvent(nextEvent)
  }, [activeCarpoolEvent, carpoolFlow.events, role])

  const activateRole = async (next: Role, confirmSchedule = true) => {
    if (next === role) {
      closeAllModals()
      return
    }
    if (confirmSchedule) {
      const ok = await showAppConfirm({
        title: "역할 변경 확인",
        message:
          "진행 중인 일정과 결제 내역은 그대로 유지됩니다. 역할을 변경할까요?",
        confirmText: "역할 변경",
        cancelText: "취소",
      })
      if (!ok) return
    }
    setRole(next)
    writeDemoValue("demo-role", next)
    setAccount((prev) => {
      const updatedAccount: AccountData = { ...prev, role: next }
      writeDemoData("account", updatedAccount)
      if (isSupabaseConfigured() && updatedAccount.id) {
        supabaseUpdateProfile(updatedAccount.id, updatedAccount).catch(
          console.warn,
        )
      }
      return updatedAccount
    })
    setTab("home")
    closeAllModals()
  }

  const requestRole = (next: Role) => {
    if (next === role) {
      closeAllModals()
      return
    }
    if (!safeRegistrations[next]) {
      handleOpenSheet(next === "driver" ? "driver-register" : "rider-register")
      return
    }
    activateRole(next)
  }

  const completeRoleRegistration = (next: Role) => {
    const updated = { ...safeRegistrations, [next]: true }
    setRegistrations(updated)
    writeDemoData("role-registrations", updated)
    if (next === "driver") {
      const nextAccount = { ...account, isDriverVerified: true, role: next }
      setAccount(nextAccount)
      writeDemoData("account", nextAccount)
      setSelectedBadges((prev) => {
        if (prev.driver.includes("driver-license")) return prev
        const nextBadges = {
          ...prev,
          driver: ["driver-license", ...prev.driver].slice(0, 3),
        }
        writeDemoData("selected-badges", nextBadges)
        return nextBadges
      })
    }
    activateRole(next, false)
  }

  const page = useMemo(() => {
    if (tab === "schedule")
      return (
        <SchedulePage
          role={role}
          open={handleOpenSheet}
          carpoolFlow={carpoolFlow}
          onViewUserProfile={openUserProfile}
          account={account}
        />
      )
    if (tab === "chat")
      return (
        <ChatPage
          account={account}
          role={role}
          loggedIn={loggedIn}
          onRequireLogin={() => {
            setLoggedIn(false)
            setAuth("login")
          }}
          carpoolFlow={carpoolFlow}
          initialRideId={chatTargetRideId}
          onInitialRideConsumed={() => setChatTargetRideId(null)}
          onViewUserProfile={openUserProfile}
        />
      )
    if (tab === "profile")
      return (
        <ProfilePage
          role={role}
          registrations={safeRegistrations}
          changeRole={requestRole}
          route={routesByRole[role]}
          account={account}
          selectedBadges={selectedBadges}
          open={handleOpenSheet}
          logout={() => {
            if (isSupabaseConfigured()) {
              supabaseSignOut().catch(console.warn)
            }
            removeDemoData("demo-login")
            setLoggedIn(false)
            setTab("home")
          }}
          pointBalance={pointWallet.balance}
          mileageBalance={mileageBalance}
          carpoolFlow={carpoolFlow}
        />
      )
    return role === "driver" ? (
      <DriverHome
        open={handleOpenSheet}
        route={routesByRole.driver}
        bookingDate={bookingDate}
        onOpenDatePicker={handleOpenDatePicker}
        onOpenTimePicker={handleOpenTimePicker}
        account={account}
        tripFlow={tripFlow}
        onStartTrip={startDemoTrip}
        onEndTrip={endDemoTrip}
        onResetTrip={resetDemoTrip}
        carpoolFlow={carpoolFlow}
        mileageBalance={mileageBalance}
        onOpenChat={(rideId) => {
          closeAllModals()
          setChatTargetRideId(rideId)
          setTab("chat")
        }}
        onViewUserProfile={openUserProfile}
      />
    ) : (
      <RiderHome
        open={handleOpenSheet}
        account={account}
        route={routesByRole.rider}
        bookingDate={bookingDate}
        onOpenDatePicker={handleOpenDatePicker}
        onOpenTimePicker={handleOpenTimePicker}
        tripFlow={tripFlow}
        carpoolFlow={carpoolFlow}
        onOpenChat={(rideId) => {
          closeAllModals()
          setChatTargetRideId(rideId)
          setTab("chat")
        }}
        onSelectRide={(ride) => {
          setSelectedRide(ride)
          handleOpenSheet("ride")
        }}
        onViewUserProfile={openUserProfile}
      />
    )
  }, [
    tab,
    role,
    routesByRole,
    bookingDate,
    account,
    selectedBadges,
    tripFlow,
    pointWallet.balance,
    mileageBalance,
    carpoolFlow,
    chatTargetRideId,
    selectedRide,
    safeRegistrations.rider,
    safeRegistrations.driver,
  ])

  if (splash)
    return (
      <main className="splash">
        <div className="splash-brand-card">
          <Brand transparent />
        </div>
        <div className="splash-progress" aria-label="앱을 불러오는 중">
          <i />
        </div>
        <p>로딩 중...</p>
      </main>
    )
  if (!loggedIn)
    return (
      <div className="app-shell auth-shell">
        <Auth
          view={auth}
          setView={setAuth}
          onLogin={(nextRole, userProfile, isNewSignup) => {
            setRole(nextRole)
            setLoggedIn(true)
            setTab("home")
            setSheet(null)
            const fallbackId = nextRole === "driver" ? "driver" : "student"
            const fallbackName =
              userProfile?.name ||
              account.name ||
              (nextRole === "driver" ? "운전자" : "학우")
            const fallbackEmail = `${fallbackId}@shingu.ac.kr`
            const mergedAccount: AccountData = {
              ...(isNewSignup ? defaultAccount : account),
              ...userProfile,
              id:
                userProfile?.id ||
                userProfile?.loginId ||
                account.id ||
                fallbackId,
              loginId:
                userProfile?.loginId ||
                userProfile?.id ||
                account.loginId ||
                account.id ||
                fallbackId,
              name: userProfile?.name || account.name || fallbackName,
              email: userProfile?.email || account.email || fallbackEmail,
              role: nextRole,
            }
            setAccount(mergedAccount)
            writeDemoData("account", mergedAccount)
            if (isNewSignup) {
              setRoutesByRole(defaultRoutes)
              writeDemoData("routes", defaultRoutes)
              writeDemoData("received-reviews", [])
              writeDemoData(
                `received-reviews-${mergedAccount.id || "user"}`,
                [],
              )
              if (mergedAccount.loginId) {
                writeDemoData(`received-reviews-${mergedAccount.loginId}`, [])
              }
              resetCarpoolFlow()
              resetDemoPoints()
              resetDemoTrip()
              try {
                localStorage.setItem(
                  `shingu-mileage-balance-${mergedAccount.id}-driver`,
                  "0",
                )
                localStorage.setItem(
                  `shingu-mileage-balance-${mergedAccount.id}-rider`,
                  "0",
                )
              } catch {
                // ignore storage error
              }
              const freshBadges: Record<Role, string[]> = {
                rider: [],
                driver: mergedAccount.isDriverVerified
                  ? ["driver-license"]
                  : [],
              }
              setSelectedBadges(freshBadges)
              writeDemoData("selected-badges", freshBadges)
            } else if (mergedAccount.isDriverVerified) {
              setSelectedBadges((prev) => {
                const driverBadges = prev.driver.includes("driver-license")
                  ? prev.driver
                  : ["driver-license", ...prev.driver].slice(0, 3)
                const nextBadges = {
                  ...prev,
                  driver: driverBadges,
                }
                writeDemoData("selected-badges", nextBadges)
                return nextBadges
              })
            }
            writeDemoValue("demo-login", "true")
            writeDemoValue("demo-role", nextRole)
            const updated: RoleRegistrations = {
              rider: true,
              driver: true,
            }
            setRegistrations(updated)
            writeDemoData("role-registrations", updated)
          }}
        />
        <GlobalDialog />
      </div>
    )

  return (
    <div className="app-shell">
      {tab !== "chat" && (
        <Header
          role={role}
          onRole={() => handleOpenSheet("roles")}
          onBell={() => handleOpenSheet("notifications")}
        />
      )}
      <main className="app-content">{page}</main>
      {role === "rider" &&
        tab !== "home" &&
        tripFlow.status === "결제 대기" &&
        tripFlow.approvedPassengerIds.includes("demo-rider") && (
          <button
            className="payment-global-banner"
            onClick={() => {
              setTab("home")
              handleOpenSheet("carpool-payment")
            }}
          >
            <WalletCards />
            <span>
              <strong>카풀 결제 요청</strong>
              <small>{tripFlow.amount.toLocaleString()} P · 결제 대기</small>
            </span>
            <ChevronRight />
          </button>
        )}
      <BottomNav
        tab={tab}
        setTab={(nextTab) => {
          closeAllModals()
          setTab(nextTab)
        }}
      />
      {activeModal === "date" && (
        <CustomDatePickerModal
          isOpen={true}
          value={bookingDate}
          title="원하는 날짜 예약"
          onClose={closeAllModals}
          onConfirm={(nextDateKey) => {
            handleGlobalDateChange(nextDateKey)
            closeAllModals()
          }}
        />
      )}
      {activeModal === "time" && (
        <CustomTimePickerModal
          isOpen={true}
          value={routesByRole[role].departureTime || "08:30"}
          arrivalValue={
            routesByRole[role].preferredArrival ||
            resolveValidArrivalTime24(routesByRole[role].departureTime || "08:30")
              .arrival24
          }
          initialField={homeTimePickerField}
          title="출발 · 희망 도착 시간 설정"
          subtitle="출발 시간과 희망 도착 시간을 설정하면 기본 경로, 예약 내역, 상세 카드 등 모든 시간 데이터가 실시간 동기화됩니다."
          onClose={closeAllModals}
          onConfirm={(nextTime24) => {
            handleGlobalTimeChange(nextTime24)
            closeAllModals()
          }}
          onConfirmRange={(nextDep24, nextArr24) => {
            handleGlobalTimeChange(nextDep24, nextArr24)
            closeAllModals()
          }}
        />
      )}
      {activeModal !== "date" && activeModal !== "time" && sheet && (
        <SheetView
          type={sheet}
          close={closeAllModals}
          open={handleOpenSheet}
          role={role}
          route={routesByRole[role]}
          account={account}
          selectedBadges={selectedBadges}
          tripFlow={tripFlow}
          pointWallet={pointWallet}
          mileageBalance={mileageBalance}
          carpoolFlow={carpoolFlow}
          selectedRide={selectedRide}
          registrations={safeRegistrations}
          onSelectRole={requestRole}
          onCompleteRole={completeRoleRegistration}
          onSaveRoute={(nextRoute) => {
            const resolved = resolveValidArrivalTime24(
              nextRoute.departureTime || "08:30",
              nextRoute.preferredArrival,
            )
            const extractedSync = getExtractedWaypointsSync(
              nextRoute.start,
              nextRoute.destination,
              nextRoute.waypointsList ?? nextRoute.waypoint,
            )
            const safeRoute: RouteData = {
              ...nextRoute,
              waypoint: extractedSync.formatted || DIRECT_ROUTE_LABEL,
              waypointsList: extractedSync.waypointsList,
              departureTime: resolved.departure24,
              preferredArrival: resolved.arrival24,
            }
            const updated: Record<Role, RouteData> = {
              ...routesByRole,
              rider: {
                ...routesByRole.rider,
                departureTime: resolved.departure24,
                preferredArrival: resolved.arrival24,
              },
              driver: {
                ...routesByRole.driver,
                departureTime: resolved.departure24,
                preferredArrival: resolved.arrival24,
              },
              [role]: safeRoute,
            }
            setRoutesByRole(updated)
            writeDemoData("routes", updated)
            updateCarpoolRidesTimeAndDate({ time: resolved.departure24 })
            void fetchRouteWaypointsFromMapBackend({
              start: safeRoute.start,
              destination: safeRoute.destination,
              fallbackWaypoints: safeRoute.waypointsList ?? safeRoute.waypoint,
            })
              .then((mapResult) => {
                const enrichedRoute: RouteData = {
                  ...safeRoute,
                  waypoint: mapResult.formatted || safeRoute.waypoint,
                  waypointsList: mapResult.waypointsList,
                }
                setRoutesByRole((prev) => {
                  const nextAll = { ...prev, [role]: enrichedRoute }
                  writeDemoData("routes", nextAll)
                  return nextAll
                })
                if (isSupabaseConfigured()) {
                  supabaseSaveRoute(account.id, role, enrichedRoute).catch(
                    console.warn,
                  )
                }
              })
              .catch(console.warn)
          }}
          onSaveAccount={async (nextAccount) => {
            setAccount(nextAccount)
            writeDemoData("account", nextAccount)
            if (isSupabaseConfigured()) {
              try {
                const currentUser = await supabaseGetCurrentUser()
                const targetId = currentUser?.id || nextAccount.id || account.id
                if (targetId) {
                  await supabaseUpdateProfile(targetId, nextAccount)
                }
              } catch (saveErr) {
                console.warn("supabaseUpdateProfile error:", saveErr)
              }
            }
          }}
          onSaveBadges={(badgeRole, badgeIds) => {
            const updated = { ...selectedBadges, [badgeRole]: badgeIds }
            setSelectedBadges(updated)
            writeDemoData("selected-badges", updated)
          }}
          onCompletePayment={completeDemoPayment}
          onGoHome={() => {
            closeAllModals()
            setTab("home")
          }}
          onViewUserProfile={openUserProfile}
          onStartCarpoolChat={handleStartCarpoolChat}
        />
      )}
      <UserProfileDetailModal
        profile={viewingUserProfile}
        onClose={() => setViewingUserProfile(null)}
        onSelectUserProfile={openUserProfile}
      />
      {chatAlertModal && (
        <div
          className="dialog-backdrop flow-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChatAlertModal(null)
          }}
        >
          <section className="app-dialog" role="alertdialog" aria-modal="true">
            <span className="dialog-icon neutral">
              <MessageCircle />
            </span>
            <h2>{chatAlertModal.title}</h2>
            <p>{chatAlertModal.message}</p>
            <Button
              type="button"
              onClick={() => {
                const shouldGoLogin = chatAlertModal.requireLogin
                setChatAlertModal(null)
                if (shouldGoLogin) {
                  setLoggedIn(false)
                  setAuth("login")
                }
              }}
            >
              확인
            </Button>
          </section>
        </div>
      )}
      {activeCarpoolEvent && (
        <div className="dialog-backdrop flow-dialog-backdrop">
          <section className="app-dialog" role="alertdialog" aria-modal="true">
            <span className="dialog-icon neutral">
              {activeCarpoolEvent.type === "reservation-cancelled" ? (
                <CalendarDays />
              ) : (
                <UsersRound />
              )}
            </span>
            <h2>{activeCarpoolEvent.title}</h2>
            <p>{activeCarpoolEvent.message}</p>
            <Button
              onClick={() => {
                const key = `carpool-events-seen-${role}`
                const seenEventIds = readDemoList<string>(key)
                writeDemoData(key, [
                  ...new Set([...seenEventIds, activeCarpoolEvent.id]),
                ])
                setActiveCarpoolEvent(null)
              }}
            >
              확인
            </Button>
          </section>
        </div>
      )}
      <GlobalDialog />
    </div>
  )
}
