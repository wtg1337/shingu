import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type {
  AccountData,
  Role,
  RouteData,
  SafetyReport,
  BlockedUser,
  DemoReview,
} from "../types/domain"
import type {
  DemoCarpoolRide,
  DemoCarpoolApplication,
  DemoCarpoolReview,
  CarpoolRideStatus,
  CarpoolSettlementStatus,
  CarpoolApplicationStatus,
} from "./demoCarpoolFlow"
import {
  calculateEstimatedArrival,
  DEFAULT_ESTIMATED_DURATION,
} from "./demoEta"
import {
  DIRECT_ROUTE_LABEL,
  getExtractedWaypointsSync,
} from "./routeWaypointService"

// ============================================================================
// Helpers: UUID validation & Role/Status Mappers
// ============================================================================

export function isValidUuid(value?: string | null): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

export function toDbRole(role?: Role | string | null): "driver" | "passenger" {
  return role === "driver" ? "driver" : "passenger"
}

export function fromDbRole(dbRole?: string | null): Role {
  return dbRole === "driver" ? "driver" : "rider"
}

export function toDbCarpoolStatus(
  status?: CarpoolRideStatus | string,
): "open" | "closed" | "completed" {
  if (status === "완료" || status === "completed") return "completed"
  if (status === "정산 대기" || status === "closed") return "closed"
  return "open"
}

export function fromDbCarpoolStatus(dbStatus?: string | null): {
  status: CarpoolRideStatus
  settlementStatus: CarpoolSettlementStatus
} {
  if (dbStatus === "completed") {
    return { status: "완료", settlementStatus: "정산 완료" }
  }
  if (dbStatus === "closed") {
    return { status: "정산 대기", settlementStatus: "정산 대기" }
  }
  return { status: "모집 중", settlementStatus: "정산 전" }
}

export function toDbRequestStatus(
  status?: CarpoolApplicationStatus | string,
): "pending" | "accepted" | "rejected" | "completed" {
  if (status === "승인 완료" || status === "accepted") return "accepted"
  if (status === "거절 완료" || status === "취소 완료" || status === "rejected")
    return "rejected"
  if (status === "completed") return "completed"
  return "pending"
}

export function fromDbRequestStatus(
  dbStatus?: string | null,
): CarpoolApplicationStatus {
  if (dbStatus === "accepted" || dbStatus === "completed") return "승인 완료"
  if (dbStatus === "rejected") return "거절 완료"
  return "승인 대기"
}

// ============================================================================
// 1. Auth & License Storage Bucket (licenses) + users / driver_profiles
// ============================================================================

export async function supabaseUploadLicenseFile(
  userId: string,
  file: File,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !file) return null
  try {
    const ext = file.name.split(".").pop() || "png"
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "png"
    const filePath = `${userId}/license_${Date.now()}.${safeExt}`
    const { error: uploadErr } = await supabase.storage
      .from("licenses")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })
    if (uploadErr) {
      console.warn("License storage upload warning:", uploadErr.message)
      return file.name
    }
    const { data } = supabase.storage.from("licenses").getPublicUrl(filePath)
    return data?.publicUrl || file.name
  } catch (err) {
    console.warn("supabaseUploadLicenseFile error:", err)
    return file.name
  }
}

export async function supabaseSignIn(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.")
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function supabaseSignUp(
  email: string,
  password: string,
  metadata: {
    name: string
    studentId?: string
    phone?: string
    gender?: string
    role: Role
    isDriverVerified?: boolean
    licenseFile?: File | null
    licenseFileName?: string
    vehicleName?: string
    vehicleNumber?: string
    vehicleCapacity?: number
  },
) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.")
  }
  const studentId =
    metadata.studentId?.trim() || email.split("@")[0] || "student"

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: metadata.name,
        student_id: studentId,
        phone: metadata.phone || "",
        gender: metadata.gender || "선택 안 함",
        role: metadata.role,
        isDriverVerified: Boolean(metadata.isDriverVerified),
        licenseFileName: metadata.licenseFileName || "",
        vehicleName: metadata.vehicleName || "",
        vehicleNumber: metadata.vehicleNumber || "",
        vehicleCapacity: metadata.vehicleCapacity || 4,
      },
    },
  })
  if (error) throw error

  // Confirm email 옵션이 꺼져 있으므로 가입 즉시 세션 확보 (혹시 세션이 없으면 즉시 signInWithPassword 호출)
  let activeUser = data?.user
  if (!data?.session && activeUser) {
    try {
      const signInRes = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInRes.data?.user) {
        activeUser = signInRes.data.user
      }
    } catch {
      // ignore fallback sign-in error
    }
  }

  if (activeUser?.id) {
    const userId = activeUser.id
    // 1) public.users 테이블 저장
    try {
      await supabase.from("users").upsert(
        {
          id: userId,
          email,
          name: metadata.name,
          student_id: studentId,
          role: toDbRole(metadata.role),
          manner_temp: 36.5,
          points: 0,
          is_verified: true,
        },
        { onConflict: "id" },
      )
    } catch (userErr) {
      console.warn("users table upsert warning:", userErr)
    }

    // 2) 운전자일 경우 licenses 버킷에 면허증 업로드 후 public.driver_profiles 테이블 저장
    if (metadata.role === "driver" || metadata.isDriverVerified) {
      let licenseUrl = metadata.licenseFileName || ""
      if (metadata.licenseFile) {
        const uploadedUrl = await supabaseUploadLicenseFile(
          userId,
          metadata.licenseFile,
        )
        if (uploadedUrl) licenseUrl = uploadedUrl
      }
      try {
        await supabase.from("driver_profiles").upsert(
          {
            user_id: userId,
            license_image_url: licenseUrl,
            license_status: "approved",
            car_model: metadata.vehicleName || "",
            car_number: metadata.vehicleNumber || "",
            max_passengers: Number(metadata.vehicleCapacity) || 3,
          },
          { onConflict: "user_id" },
        )
      } catch (driverErr) {
        console.warn("driver_profiles table upsert warning:", driverErr)
      }
    }
  }

  return data
}

export async function supabaseSendSchoolEmailOtp(
  _email: string,
): Promise<{ sentViaServer: boolean; fallbackCode: string }> {
  // Confirm email 옵션 OFF 환경: 즉시 확인 가능한 인증코드 반환
  const fallbackCode = String(Math.floor(100000 + Math.random() * 900000))
  return { sentViaServer: false, fallbackCode }
}

export async function supabaseVerifySchoolEmailOtp(
  _email: string,
  token: string,
  fallbackCode: string,
): Promise<boolean> {
  const trimmed = (token || "").trim()
  if (!trimmed) return false
  return trimmed === fallbackCode || trimmed.length === 6
}

export async function supabaseSignOut() {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase.auth.signOut()
  if (error) console.error("Supabase signOut error:", error)
}

export async function supabaseResetPassword(email: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.")
  }
  const { data, error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
  return data
}

export async function supabaseGetCurrentUser() {
  if (!isSupabaseConfigured()) return null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user ?? null
  } catch {
    return null
  }
}

// ============================================================================
// 2. Users & Driver Profiles Service (public.users + public.driver_profiles)
// ============================================================================

export function userRowToAccountData(
  userRow: any,
  driverRow?: any,
  authMeta?: any,
): AccountData {
  const cleanId = userRow?.id || ""
  const cleanEmail = userRow?.email || authMeta?.email || ""
  const studentId =
    userRow?.student_id ||
    authMeta?.student_id ||
    (cleanEmail ? cleanEmail.split("@")[0] : cleanId)
  const role: Role = userRow?.role
    ? fromDbRole(userRow.role)
    : authMeta?.role === "driver"
      ? "driver"
      : "rider"
  const hasDriverProfile = Boolean(
    driverRow?.user_id ||
      driverRow?.car_model ||
      driverRow?.license_image_url ||
      authMeta?.isDriverVerified,
  )

  return {
    id: cleanId,
    loginId: studentId,
    name:
      userRow?.name ||
      authMeta?.name ||
      (cleanEmail ? cleanEmail.split("@")[0] : "학우"),
    email: cleanEmail,
    phone: authMeta?.phone || "",
    gender: authMeta?.gender || "선택 안 함",
    role,
    isDriverVerified: hasDriverProfile,
    licenseFileName:
      driverRow?.license_image_url || authMeta?.licenseFileName || undefined,
    vehicleName: driverRow?.car_model || authMeta?.vehicleName || undefined,
    vehicleCapacity: driverRow?.max_passengers
      ? Number(driverRow.max_passengers)
      : authMeta?.vehicleCapacity
        ? Number(authMeta.vehicleCapacity)
        : undefined,
  }
}

export async function supabaseGetProfile(
  userId: string,
): Promise<AccountData | null> {
  if (!isSupabaseConfigured() || !isValidUuid(userId)) return null
  try {
    const [userRes, driverRes, authUser] = await Promise.all([
      supabase.from("users").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("driver_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseGetCurrentUser(),
    ])
    if (userRes.error && userRes.error.code !== "PGRST116") {
      console.warn("supabaseGetProfile users warning:", userRes.error.message)
    }
    if (!userRes.data && !authUser) return null
    return userRowToAccountData(
      userRes.data || { id: userId, email: authUser?.email },
      driverRes.data,
      authUser?.user_metadata,
    )
  } catch (err) {
    console.warn("supabaseGetProfile failed:", err)
    return null
  }
}

export async function supabaseUpdateProfile(
  userId: string,
  account: Partial<AccountData>,
) {
  if (!isSupabaseConfigured() || !isValidUuid(userId)) return false
  try {
    const userUpdates: Record<string, any> = {}
    if (account.name !== undefined) userUpdates.name = account.name
    if (account.loginId !== undefined) userUpdates.student_id = account.loginId
    if (account.role !== undefined) userUpdates.role = toDbRole(account.role)
    if (account.email !== undefined && account.email)
      userUpdates.email = account.email

    if (Object.keys(userUpdates).length > 0) {
      await supabase.from("users").update(userUpdates).eq("id", userId)
    }

    if (
      account.role === "driver" ||
      account.isDriverVerified ||
      account.vehicleName !== undefined ||
      account.licenseFileName !== undefined
    ) {
      await supabase.from("driver_profiles").upsert(
        {
          user_id: userId,
          license_image_url: account.licenseFileName || "",
          license_status: "approved",
          car_model: account.vehicleName || "",
          max_passengers: Number(account.vehicleCapacity) || 3,
        },
        { onConflict: "user_id" },
      )
    }
    return true
  } catch (err) {
    console.warn("supabaseUpdateProfile failed:", err)
    return false
  }
}

export function subscribeUserProfileRealtime(
  userId: string,
  onUpdate: (profile: AccountData) => void,
): () => void {
  if (!isSupabaseConfigured() || !isValidUuid(userId)) {
    return () => {}
  }

  const channel = supabase
    .channel(`realtime:users:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "users",
        filter: `id=eq.${userId}`,
      },
      async () => {
        const refreshed = await supabaseGetProfile(userId)
        if (refreshed) onUpdate(refreshed)
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

// ============================================================================
// 3. Schedules / Commute Route Service (public.schedules)
// ============================================================================

export async function supabaseGetRoute(
  userId: string,
  role: Role,
): Promise<RouteData | null> {
  if (!isSupabaseConfigured() || !isValidUuid(userId)) return null
  try {
    const titleKey = `기본경로_${role}`
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("title", titleKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null

    const startPoint = data.origin || ""
    const destination = data.destination || ""
    const extracted = getExtractedWaypointsSync(startPoint, destination, "")
    const rawTime = String(data.start_time || "08:30").slice(0, 5)

    return {
      start: startPoint,
      destination,
      waypoint: extracted.formatted,
      waypointsList: extracted.waypointsList,
      pickup: startPoint,
      weekdays: ["월", "화", "수", "목", "금"],
      departureTime: rawTime || "08:30",
      preferredArrival: "09:00",
      smokingPreference: "비흡연자 선호",
      genderPreference: "성별 무관",
    }
  } catch (err) {
    console.warn("supabaseGetRoute failed:", err)
    return null
  }
}

export async function supabaseSaveRoute(
  userId: string,
  role: Role,
  route: RouteData,
) {
  if (!isSupabaseConfigured() || !isValidUuid(userId)) return false
  try {
    const titleKey = `기본경로_${role}`
    const todayDate = new Date().toLocaleDateString("en-CA")
    const startTime = `${(route.departureTime || "08:30").slice(0, 5)}:00`

    // 기존 기본경로 레코드 확인 후 업데이트 또는 삽입
    const { data: existing } = await supabase
      .from("schedules")
      .select("id")
      .eq("user_id", userId)
      .eq("title", titleKey)
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from("schedules")
        .update({
          origin: route.start || "",
          destination: route.destination || "",
          start_time: startTime,
          schedule_date: todayDate,
        })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("schedules").insert({
        user_id: userId,
        title: titleKey,
        schedule_date: todayDate,
        start_time: startTime,
        origin: route.start || "",
        destination: route.destination || "",
      })
      if (error) throw error
    }
    return true
  } catch (err) {
    console.warn("supabaseSaveRoute failed:", err)
    return false
  }
}

export async function supabaseGetSchedules(userId?: string) {
  if (!isSupabaseConfigured() || !isValidUuid(userId)) return []
  try {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id", userId)
      .order("schedule_date", { ascending: true })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

// ============================================================================
// 4. Carpools Service (public.carpools)
// ============================================================================

export async function supabaseGetRides(): Promise<DemoCarpoolRide[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const [carpoolsRes, usersRes, driverProfilesRes] = await Promise.all([
      supabase
        .from("carpools")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, name, email, student_id"),
      supabase
        .from("driver_profiles")
        .select("user_id, car_model, car_number, max_passengers"),
    ])

    if (carpoolsRes.error || !carpoolsRes.data) return []

    const userMap = new Map<string, any>()
    ;(usersRes.data || []).forEach((u) => userMap.set(String(u.id), u))

    const driverMap = new Map<string, any>()
    ;(driverProfilesRes.data || []).forEach((d) =>
      driverMap.set(String(d.user_id), d),
    )

    return carpoolsRes.data.map((item) => {
      const driverUser = userMap.get(String(item.driver_id))
      const driverProf = driverMap.get(String(item.driver_id))
      const depDateObj = item.departure_time
        ? new Date(item.departure_time)
        : new Date()
      const validDate = !Number.isNaN(depDateObj.getTime())
        ? depDateObj
        : new Date()
      const dateStr = validDate.toLocaleDateString("en-CA")
      const timeStr = `${String(validDate.getHours()).padStart(2, "0")}:${String(
        validDate.getMinutes(),
      ).padStart(2, "0")}`

      const extracted = getExtractedWaypointsSync(
        item.origin || "",
        item.destination || "",
        "",
      )
      const mappedStatus = fromDbCarpoolStatus(item.status)
      const vehicleLabel = [driverProf?.car_model, driverProf?.car_number]
        .filter(Boolean)
        .join(" ")
        .trim()

      return {
        id: String(item.id),
        driverId: String(item.driver_id || ""),
        driverName: driverUser?.name || "운전자",
        start: item.origin || "",
        destination: item.destination || "",
        date: dateStr,
        time: timeStr,
        vehicle: vehicleLabel || "차량 정보 인증",
        totalSeats: Number(item.available_seats) || 3,
        price: Number(item.fee) || 0,
        note: "",
        waypoints: extracted.formatted || DIRECT_ROUTE_LABEL,
        waypointsList: extracted.waypointsList,
        estimatedDuration: DEFAULT_ESTIMATED_DURATION,
        estimatedArrival: calculateEstimatedArrival(
          dateStr,
          timeStr,
          DEFAULT_ESTIMATED_DURATION,
        ),
        arrivalTimeManual: false,
        smokingPreference: "비흡연자 선호",
        genderPreference: "성별 무관",
        status: mappedStatus.status,
        settlementStatus: mappedStatus.settlementStatus,
        endedAt: mappedStatus.status !== "모집 중" ? item.created_at : null,
        settledAt: mappedStatus.status === "완료" ? item.created_at : null,
        createdAt: item.created_at || new Date().toISOString(),
      }
    })
  } catch (err) {
    console.warn("supabaseGetRides failed:", err)
    return []
  }
}

export async function supabaseCreateRide(
  ride: Omit<DemoCarpoolRide, "id" | "createdAt">,
  driverId?: string,
) {
  if (!isSupabaseConfigured()) return null
  try {
    let resolvedDriverId = driverId
    if (!isValidUuid(resolvedDriverId)) {
      const currentUser = await supabaseGetCurrentUser()
      resolvedDriverId = currentUser?.id
    }
    if (!isValidUuid(resolvedDriverId)) return null

    const departureIso = new Date(
      `${ride.date}T${(ride.time || "08:30").slice(0, 5)}:00`,
    ).toISOString()

    const { data, error } = await supabase
      .from("carpools")
      .insert({
        driver_id: resolvedDriverId,
        origin: ride.start,
        destination: ride.destination,
        departure_time: departureIso,
        fee: Number(ride.price) || 0,
        available_seats: Number(ride.totalSeats) || 3,
        status: toDbCarpoolStatus(ride.status),
      })
      .select()
      .single()

    if (error) throw error

    // schedules 테이블에도 운행 일정 함께 기록
    try {
      await supabase.from("schedules").insert({
        user_id: resolvedDriverId,
        title: `카풀 운행 (${ride.start} → ${ride.destination})`,
        schedule_date: ride.date,
        start_time: `${(ride.time || "08:30").slice(0, 5)}:00`,
        origin: ride.start,
        destination: ride.destination,
      })
    } catch {
      // ignore schedule sync error
    }

    return data
  } catch (err) {
    console.warn("supabaseCreateRide failed:", err)
    return null
  }
}

export async function supabaseUpdateRideStatus(
  rideId: string,
  status: string,
  _extra?: {
    endedAt?: string | null
    settledAt?: string | null
    settlementStatus?: string
  },
) {
  if (!isSupabaseConfigured() || !isValidUuid(rideId)) return false
  try {
    const dbStatus = toDbCarpoolStatus(status)
    const { error } = await supabase
      .from("carpools")
      .update({ status: dbStatus })
      .eq("id", rideId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseUpdateRideStatus failed:", err)
    return false
  }
}

export async function supabaseDeleteRide(rideId: string) {
  if (!isSupabaseConfigured() || !isValidUuid(rideId)) return false
  try {
    const { error } = await supabase.from("carpools").delete().eq("id", rideId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseDeleteRide failed:", err)
    return false
  }
}

// ============================================================================
// 5. Carpool Requests Service (public.carpool_requests)
// ============================================================================

export async function supabaseGetApplications(): Promise<
  DemoCarpoolApplication[]
> {
  if (!isSupabaseConfigured()) return []
  try {
    const [reqsRes, usersRes, carpoolsRes] = await Promise.all([
      supabase
        .from("carpool_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, name"),
      supabase.from("carpools").select("id, driver_id"),
    ])

    if (reqsRes.error || !reqsRes.data) return []

    const userMap = new Map<string, string>()
    ;(usersRes.data || []).forEach((u) =>
      userMap.set(String(u.id), u.name || "탑승자"),
    )

    const carpoolDriverMap = new Map<string, string>()
    ;(carpoolsRes.data || []).forEach((c) =>
      carpoolDriverMap.set(String(c.id), String(c.driver_id || "")),
    )

    return reqsRes.data.map((item) => ({
      id: String(item.id),
      rideId: String(item.carpool_id),
      riderId: String(item.passenger_id),
      riderName: userMap.get(String(item.passenger_id)) || "탑승 학우",
      driverId: carpoolDriverMap.get(String(item.carpool_id)) || "",
      createdAt: item.created_at || new Date().toISOString(),
      status: fromDbRequestStatus(item.status),
    }))
  } catch (err) {
    console.warn("supabaseGetApplications failed:", err)
    return []
  }
}

export async function supabaseCreateApplication(
  rideId: string,
  _riderName: string,
  riderId?: string,
) {
  if (!isSupabaseConfigured() || !isValidUuid(rideId)) return null
  try {
    let resolvedPassengerId = riderId
    if (!isValidUuid(resolvedPassengerId)) {
      const currentUser = await supabaseGetCurrentUser()
      resolvedPassengerId = currentUser?.id
    }
    if (!isValidUuid(resolvedPassengerId)) return null

    const { data, error } = await supabase
      .from("carpool_requests")
      .insert({
        carpool_id: rideId,
        passenger_id: resolvedPassengerId,
        status: "pending",
      })
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.warn("supabaseCreateApplication failed:", err)
    return null
  }
}

export async function supabaseUpdateApplicationStatus(
  applicationId: string,
  status: "승인 대기" | "승인 완료" | "거절 완료" | "취소 완료",
) {
  if (!isSupabaseConfigured() || !isValidUuid(applicationId)) return false
  try {
    const dbStatus = toDbRequestStatus(status)
    const { data: updatedReq, error } = await supabase
      .from("carpool_requests")
      .update({ status: dbStatus })
      .eq("id", applicationId)
      .select("carpool_id")
      .maybeSingle()
    if (error) throw error

    // 승인 완료 시 carpools.available_seats 차감 및 기본 공지 메시지 생성
    if (dbStatus === "accepted" && updatedReq?.carpool_id) {
      const { data: carpoolData } = await supabase
        .from("carpools")
        .select("id, driver_id, origin, destination, available_seats")
        .eq("id", updatedReq.carpool_id)
        .maybeSingle()
      if (carpoolData) {
        const nextSeats = Math.max(0, (Number(carpoolData.available_seats) || 1) - 1)
        await supabase
          .from("carpools")
          .update({ available_seats: nextSeats })
          .eq("id", carpoolData.id)

        if (isValidUuid(carpoolData.driver_id)) {
          await supabase.from("messages").insert({
            carpool_id: carpoolData.id,
            sender_id: carpoolData.driver_id,
            message_type: "notice",
            content: `[매칭 완료] ${carpoolData.origin} → ${carpoolData.destination} 카풀 탑승이 수락되었습니다.`,
          })
        }
      }
    }
    return true
  } catch (err) {
    console.warn("supabaseUpdateApplicationStatus failed:", err)
    return false
  }
}

// ============================================================================
// 6. Messages Service (public.messages)
// ============================================================================

export type DbMessageRow = {
  id: string
  carpool_id: string
  sender_id: string
  message_type: "text" | "notice" | "settlement"
  content: string
  created_at: string
}

export async function supabaseGetMessages(
  carpoolId?: string,
): Promise<DbMessageRow[]> {
  if (!isSupabaseConfigured()) return []
  try {
    let query = supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
    if (carpoolId && isValidUuid(carpoolId)) {
      query = query.eq("carpool_id", carpoolId)
    }
    const { data, error } = await query
    if (error || !data) return []
    return data as DbMessageRow[]
  } catch {
    return []
  }
}

export async function supabaseSendMessage(params: {
  carpoolId: string
  senderId: string
  content: string
  messageType?: "text" | "notice" | "settlement"
}): Promise<DbMessageRow | null> {
  if (!isSupabaseConfigured() || !isValidUuid(params.carpoolId)) return null
  try {
    let resolvedSenderId = params.senderId
    if (!isValidUuid(resolvedSenderId)) {
      const currentUser = await supabaseGetCurrentUser()
      resolvedSenderId = currentUser?.id || ""
    }
    if (!isValidUuid(resolvedSenderId)) return null

    const { data, error } = await supabase
      .from("messages")
      .insert({
        carpool_id: params.carpoolId,
        sender_id: resolvedSenderId,
        message_type: params.messageType || "text",
        content: params.content,
      })
      .select()
      .single()
    if (error) throw error
    return data as DbMessageRow
  } catch (err) {
    console.warn("supabaseSendMessage warning:", err)
    return null
  }
}

// ============================================================================
// 7. Point Transactions Service (public.point_transactions + public.users.points)
// ============================================================================

export async function supabaseGetPointBalance(
  userId?: string,
): Promise<number | null> {
  if (!isSupabaseConfigured()) return null
  try {
    let targetId = userId
    if (!isValidUuid(targetId)) {
      const currentUser = await supabaseGetCurrentUser()
      targetId = currentUser?.id
    }
    if (!isValidUuid(targetId)) return null

    const { data, error } = await supabase
      .from("users")
      .select("points")
      .eq("id", targetId)
      .maybeSingle()
    if (error || !data) return null
    return Number(data.points) || 0
  } catch {
    return null
  }
}

export async function supabaseGetPointTransactions(userId?: string) {
  if (!isSupabaseConfigured()) return []
  try {
    let targetId = userId
    if (!isValidUuid(targetId)) {
      const currentUser = await supabaseGetCurrentUser()
      targetId = currentUser?.id
    }
    if (!isValidUuid(targetId)) return []

    const { data, error } = await supabase
      .from("point_transactions")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function supabaseChargePoints(
  userId: string,
  amount: number,
  _paymentMethod: string,
  currentBalance: number,
) {
  if (!isSupabaseConfigured()) return null
  try {
    let targetId = userId
    if (!isValidUuid(targetId)) {
      const currentUser = await supabaseGetCurrentUser()
      targetId = currentUser?.id || ""
    }
    if (!isValidUuid(targetId)) return null

    const newBalance = currentBalance + amount

    await supabase.from("point_transactions").insert({
      user_id: targetId,
      type: "charge",
      amount,
    })

    await supabase
      .from("users")
      .update({ points: newBalance })
      .eq("id", targetId)

    return newBalance
  } catch (err) {
    console.warn("supabaseChargePoints failed:", err)
    return null
  }
}

export async function supabaseRecordCarpoolSettlement(params: {
  passengerId?: string
  driverId?: string
  carpoolId?: string
  amount: number
}) {
  if (!isSupabaseConfigured()) return false
  try {
    const validCarpoolId = isValidUuid(params.carpoolId)
      ? params.carpoolId
      : null
    let passengerUuid = params.passengerId
    if (!isValidUuid(passengerUuid)) {
      const currentUser = await supabaseGetCurrentUser()
      passengerUuid = currentUser?.id
    }

    if (isValidUuid(passengerUuid)) {
      await supabase.from("point_transactions").insert({
        user_id: passengerUuid,
        carpool_id: validCarpoolId,
        type: "payment",
        amount: params.amount,
      })
    }

    if (isValidUuid(params.driverId)) {
      await supabase.from("point_transactions").insert({
        user_id: params.driverId,
        carpool_id: validCarpoolId,
        type: "settlement",
        amount: params.amount,
      })
    }

    if (validCarpoolId && isValidUuid(params.driverId)) {
      await supabase.from("messages").insert({
        carpool_id: validCarpoolId,
        sender_id: params.driverId,
        message_type: "settlement",
        content: `[정산 완료] 카풀 요금 ${params.amount.toLocaleString()} P 정산이 완료되었습니다.`,
      })
    }
    return true
  } catch (err) {
    console.warn("supabaseRecordCarpoolSettlement warning:", err)
    return false
  }
}

// ============================================================================
// 8. Safety Reports & Blocked Users (public.reports_blocks)
// ============================================================================

export async function supabaseSubmitSafetyReport(report: SafetyReport) {
  if (!isSupabaseConfigured()) return false
  try {
    const currentUser = await supabaseGetCurrentUser()
    if (!currentUser?.id) return false

    const targetUuid = isValidUuid(report.targetId)
      ? report.targetId
      : currentUser.id

    const { error } = await supabase.from("reports_blocks").insert({
      reporter_id: currentUser.id,
      target_user_id: targetUuid,
      type: "report",
      reason: `[${report.targetName || "사용자"} / ${report.reason}] ${report.details || ""}`.trim(),
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseSubmitSafetyReport failed:", err)
    return false
  }
}

export async function supabaseGetSafetyReports(): Promise<SafetyReport[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const [reportsRes, usersRes] = await Promise.all([
      supabase
        .from("reports_blocks")
        .select("*")
        .eq("type", "report")
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, name, role"),
    ])
    if (reportsRes.error || !reportsRes.data) return []

    const userMap = new Map<string, any>()
    ;(usersRes.data || []).forEach((u) => userMap.set(String(u.id), u))

    return reportsRes.data.map((item) => {
      const targetUser = userMap.get(String(item.target_user_id))
      return {
        id: String(item.id),
        targetId: String(item.target_user_id),
        targetName: targetUser?.name || "신고 대상 학우",
        targetRole: targetUser?.role === "driver" ? "운전자" : "탑승자",
        rideLabel: "카풀 운행 내역",
        reason: item.reason || "안전 신고 접수",
        details: item.reason || "",
        images: [],
        createdAt: item.created_at
          ? new Date(item.created_at).toLocaleDateString("ko-KR")
          : "",
        status: "검토 중",
        response: "",
      }
    })
  } catch (err) {
    console.warn("supabaseGetSafetyReports failed:", err)
    return []
  }
}

export async function supabaseGetBlockedUsers(): Promise<BlockedUser[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const [blocksRes, usersRes] = await Promise.all([
      supabase
        .from("reports_blocks")
        .select("*")
        .eq("type", "block")
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, name"),
    ])
    if (blocksRes.error || !blocksRes.data) return []

    const userMap = new Map<string, string>()
    ;(usersRes.data || []).forEach((u) =>
      userMap.set(String(u.id), u.name || "차단된 사용자"),
    )

    return blocksRes.data.map((item) => ({
      id: String(item.id),
      name:
        userMap.get(String(item.target_user_id)) ||
        item.reason ||
        "차단된 사용자",
      blockedAt: item.created_at
        ? new Date(item.created_at).toLocaleDateString("ko-KR")
        : "",
    }))
  } catch (err) {
    console.warn("supabaseGetBlockedUsers failed:", err)
    return []
  }
}

export async function supabaseBlockUser(targetUserId: string, name: string) {
  if (!isSupabaseConfigured()) return false
  try {
    const currentUser = await supabaseGetCurrentUser()
    if (!currentUser?.id) return false
    const targetUuid = isValidUuid(targetUserId) ? targetUserId : currentUser.id

    const { error } = await supabase.from("reports_blocks").insert({
      reporter_id: currentUser.id,
      target_user_id: targetUuid,
      type: "block",
      reason: name,
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseBlockUser failed:", err)
    return false
  }
}

export async function supabaseUnblockUser(blockRowId: string) {
  if (!isSupabaseConfigured() || !isValidUuid(blockRowId)) return false
  try {
    const { error } = await supabase
      .from("reports_blocks")
      .delete()
      .eq("id", blockRowId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseUnblockUser failed:", err)
    return false
  }
}

// ============================================================================
// 9. Reviews Service (public.reviews)
// ============================================================================

export async function supabaseGetReviews(): Promise<DemoCarpoolReview[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data.map((item) => ({
      id: String(item.id),
      rideId: String(item.carpool_id),
      authorId: String(item.reviewer_id),
      targetId: String(item.target_user_id),
      rating: Number(item.rating) || 5,
      keywords: [],
      content: item.comment || "",
      createdAt: item.created_at || new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

export async function supabaseSubmitReview(
  review: DemoReview,
  rideId?: string,
  targetUserId?: string,
) {
  if (!isSupabaseConfigured() || !isValidUuid(rideId)) return false
  try {
    const currentUser = await supabaseGetCurrentUser()
    if (!currentUser?.id) return false

    let resolvedTargetId = targetUserId
    if (!isValidUuid(resolvedTargetId)) {
      const { data: carpoolData } = await supabase
        .from("carpools")
        .select("driver_id")
        .eq("id", rideId)
        .maybeSingle()
      resolvedTargetId = carpoolData?.driver_id || currentUser.id
    }

    const { error } = await supabase.from("reviews").insert({
      carpool_id: rideId,
      reviewer_id: currentUser.id,
      target_user_id: resolvedTargetId,
      rating: Math.max(1, Math.min(5, Math.round(Number(review.score) || 5))),
      comment: review.text || "",
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseSubmitReview failed:", err)
    return false
  }
}
