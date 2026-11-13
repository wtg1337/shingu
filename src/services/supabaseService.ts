import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type {
  AccountData,
  Ride,
  Role,
  RouteData,
  SafetyReport,
  BlockedUser,
  DemoReview,
} from "../types/domain"
import type {
  DemoCarpoolRide,
  DemoCarpoolApplication,
} from "./demoCarpoolFlow"

// ============================================================================
// 1. Auth Service
// ============================================================================

export async function supabaseSignIn(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.")
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
  metadata: { name: string; phone?: string; gender?: string; role: Role },
) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.")
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: metadata.name,
        phone: metadata.phone || "010-0000-0000",
        gender: metadata.gender || "선택 안 함",
        role: metadata.role,
      },
    },
  })
  if (error) throw error
  return data
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
// 2. Profiles Service
// ============================================================================

export async function supabaseGetProfile(userId: string) {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    console.warn("supabaseGetProfile failed:", err)
    return null
  }
}

export async function supabaseUpdateProfile(
  userId: string,
  account: Partial<AccountData>,
) {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        name: account.name,
        phone: account.phone,
        gender: account.gender,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseUpdateProfile failed:", err)
    return false
  }
}

// ============================================================================
// 3. Routes Service
// ============================================================================

export async function supabaseGetRoute(userId: string, role: Role): Promise<RouteData | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle()
    if (error || !data) return null
    return {
      start: data.start_point,
      destination: data.destination,
      waypoint: data.waypoint || "",
      pickup: data.pickup || "",
      weekdays: data.weekdays || ["월", "화", "수", "목", "금"],
      departureTime: data.departure_time,
      preferredArrival: data.preferred_arrival,
      smokingPreference: data.smoking_preference || "비흡연자 선호",
      genderPreference: data.gender_preference || "성별 무관",
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
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase.from("routes").upsert(
      {
        user_id: userId,
        role,
        start_point: route.start,
        destination: route.destination,
        waypoint: route.waypoint,
        pickup: route.pickup,
        weekdays: route.weekdays,
        departure_time: route.departureTime,
        preferred_arrival: route.preferredArrival,
        smoking_preference: route.smokingPreference,
        gender_preference: route.genderPreference,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,role" },
    )
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseSaveRoute failed:", err)
    return false
  }
}

// ============================================================================
// 4. Rides Service (카풀 운행)
// ============================================================================

export async function supabaseGetRides(): Promise<DemoCarpoolRide[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data.map((item) => ({
      id: String(item.id),
      driverId: "demo-driver",
      driverName: item.driver_name,
      start: item.start_point,
      destination: item.destination,
      date: item.date,
      time: item.departure_time,
      vehicle: item.car_info,
      totalSeats: item.total_seats,
      price: item.price,
      note: item.note || "",
      waypoints: item.waypoints || "",
      estimatedDuration: item.estimated_duration || 25,
      estimatedArrival: item.arrival_time,
      arrivalTimeManual: false,
      smokingPreference: item.smoking_preference || "비흡연자 선호",
      genderPreference: item.gender_preference || "성별 무관",
      status: item.status,
      settlementStatus: item.settlement_status,
      endedAt: item.ended_at,
      settledAt: item.settled_at,
      createdAt: item.created_at,
    }))
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
    const { data, error } = await supabase
      .from("rides")
      .insert({
        driver_id: driverId || null,
        driver_name: ride.driverName,
        car_info: ride.vehicle,
        start_point: ride.start,
        destination: ride.destination,
        waypoints: ride.waypoints,
        date: ride.date,
        departure_time: ride.time,
        estimated_duration: ride.estimatedDuration,
        arrival_time: ride.estimatedArrival,
        seats: ride.totalSeats,
        total_seats: ride.totalSeats,
        price: ride.price,
        smoking_preference: ride.smokingPreference,
        gender_preference: ride.genderPreference,
        note: ride.note,
        status: ride.status,
        settlement_status: ride.settlementStatus,
      })
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.warn("supabaseCreateRide failed:", err)
    return null
  }
}

export async function supabaseUpdateRideStatus(
  rideId: string,
  status: string,
  extra?: { endedAt?: string | null; settledAt?: string | null; settlementStatus?: string },
) {
  if (!isSupabaseConfigured()) return false
  try {
    const updates: Record<string, unknown> = { status }
    if (extra?.endedAt !== undefined) updates.ended_at = extra.endedAt
    if (extra?.settledAt !== undefined) updates.settled_at = extra.settledAt
    if (extra?.settlementStatus) updates.settlement_status = extra.settlementStatus

    const { error } = await supabase.from("rides").update(updates).eq("id", rideId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseUpdateRideStatus failed:", err)
    return false
  }
}

export async function supabaseDeleteRide(rideId: string) {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase.from("rides").delete().eq("id", rideId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseDeleteRide failed:", err)
    return false
  }
}

// ============================================================================
// 5. Carpool Applications (탑승 신청)
// ============================================================================

export async function supabaseGetApplications(): Promise<DemoCarpoolApplication[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from("carpool_applications")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data.map((item) => ({
      id: String(item.id),
      rideId: String(item.ride_id),
      riderId: "demo-rider",
      riderName: item.rider_name,
      driverId: "demo-driver",
      createdAt: item.created_at,
      status: item.status,
    }))
  } catch (err) {
    console.warn("supabaseGetApplications failed:", err)
    return []
  }
}

export async function supabaseCreateApplication(
  rideId: string,
  riderName: string,
  riderId?: string,
) {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await supabase
      .from("carpool_applications")
      .insert({
        ride_id: rideId,
        rider_name: riderName,
        rider_id: riderId || null,
        status: "승인 대기",
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
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase
      .from("carpool_applications")
      .update({ status })
      .eq("id", applicationId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseUpdateApplicationStatus failed:", err)
    return false
  }
}

// ============================================================================
// 6. Point Wallet & Charges
// ============================================================================

export async function supabaseGetPointBalance(userId: string): Promise<number | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await supabase
      .from("point_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle()
    if (error || !data) return null
    return data.balance
  } catch (err) {
    console.warn("supabaseGetPointBalance failed:", err)
    return null
  }
}

export async function supabaseChargePoints(
  userId: string,
  amount: number,
  paymentMethod: string,
  currentBalance: number,
) {
  if (!isSupabaseConfigured()) return null
  const newBalance = currentBalance + amount
  try {
    // 1) 기록 삽입
    await supabase.from("point_charges").insert({
      user_id: userId,
      amount,
      payment_method: paymentMethod,
      balance_after: newBalance,
      status: "충전 완료",
    })

    // 2) 잔액 upsert
    await supabase.from("point_wallets").upsert(
      {
        user_id: userId,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    return newBalance
  } catch (err) {
    console.warn("supabaseChargePoints failed:", err)
    return null
  }
}

// ============================================================================
// 7. Safety Reports & Blocked Users
// ============================================================================

export async function supabaseSubmitSafetyReport(report: SafetyReport) {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase.from("safety_reports").insert({
      target_id: report.targetId,
      target_name: report.targetName,
      target_role: report.targetRole,
      ride_label: report.rideLabel,
      reason: report.reason,
      details: report.details,
      images: report.images || [],
      status: report.status || "검토 중",
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
    const { data, error } = await supabase
      .from("safety_reports")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data.map((item) => ({
      id: String(item.id),
      targetId: item.target_id,
      targetName: item.target_name,
      targetRole: item.target_role as "운전자" | "탑승자",
      rideLabel: item.ride_label,
      reason: item.reason,
      details: item.details,
      images: item.images || [],
      createdAt: item.created_at,
      status: item.status,
      response: item.response || "",
    }))
  } catch (err) {
    console.warn("supabaseGetSafetyReports failed:", err)
    return []
  }
}

export async function supabaseGetBlockedUsers(): Promise<BlockedUser[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from("blocked_users")
      .select("*")
      .order("blocked_at", { ascending: false })
    if (error || !data) return []
    return data.map((item) => ({
      id: String(item.id),
      name: item.blocked_user_name,
      blockedAt: item.blocked_at,
    }))
  } catch (err) {
    console.warn("supabaseGetBlockedUsers failed:", err)
    return []
  }
}

export async function supabaseBlockUser(userId: string, name: string) {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase.from("blocked_users").insert({
      blocked_user_id: userId,
      blocked_user_name: name,
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseBlockUser failed:", err)
    return false
  }
}

export async function supabaseUnblockUser(userId: string) {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("id", userId)
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseUnblockUser failed:", err)
    return false
  }
}

// ============================================================================
// 8. Reviews
// ============================================================================

export async function supabaseSubmitReview(review: DemoReview, rideId?: string) {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await supabase.from("reviews").insert({
      ride_id: rideId || null,
      author_name: review.author,
      rating: review.score,
      keywords: review.tags,
      content: review.text,
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn("supabaseSubmitReview failed:", err)
    return false
  }
}
