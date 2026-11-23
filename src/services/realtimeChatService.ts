import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type { Role } from "../types/domain"
import { DIRECT_ROUTE_LABEL } from "./routeWaypointService"

export type ChatParticipantProfile = {
  id: string
  name: string
  role: Role
  carInfo?: string
  emailVerified?: boolean
  licenseVerified?: boolean
}

export type RealtimeChatMessage = {
  id: string
  roomId: string
  senderId: string
  senderName: string
  text: string
  createdAt: string
}

export type RealtimeChatRoom = {
  id: string
  rideId: string
  title: string
  participants: string[]
  participantProfiles: Record<string, ChatParticipantProfile>
  meeting: string
  destination: string
  waypoints: string
  lastMessage: string
  lastMessageAt: string
  createdAt: string
}

type RealtimeChatState = {
  rooms: RealtimeChatRoom[]
  messagesByRoom: Record<string, RealtimeChatMessage[]>
}

const CHAT_STORAGE_KEY = "shingu-realtime-chat-v1"
const BROADCAST_CHANNEL_NAME = "shingu-realtime-chat-channel"

const EMPTY_CHAT_STATE: RealtimeChatState = {
  rooms: [],
  messagesByRoom: {},
}

const listeners = new Set<() => void>()
let broadcastChannel: BroadcastChannel | null = null
let supabaseRealtimeInitialized = false

function normalizeUserId(rawId?: string | null): string {
  return (rawId || "").trim()
}

export function normalizeDisplayName(rawName?: string | null): string {
  const trimmed = (rawName || "").trim()
  return trimmed || "알 수 없는 사용자"
}

function readChatState(): RealtimeChatState {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return EMPTY_CHAT_STATE
    const parsed = JSON.parse(raw) as Partial<RealtimeChatState>
    if (!parsed || typeof parsed !== "object") return EMPTY_CHAT_STATE
    const rooms = Array.isArray(parsed.rooms)
      ? parsed.rooms.filter(
          (r): r is RealtimeChatRoom =>
            Boolean(r) &&
            typeof r.id === "string" &&
            Array.isArray(r.participants),
        )
      : []
    const messagesByRoom =
      parsed.messagesByRoom && typeof parsed.messagesByRoom === "object"
        ? parsed.messagesByRoom
        : {}
    return { rooms, messagesByRoom }
  } catch {
    return EMPTY_CHAT_STATE
  }
}

let stateSnapshot: RealtimeChatState = readChatState()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

function saveChatState(next: RealtimeChatState, broadcast = true) {
  stateSnapshot = next
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 스토리지 한도 초과 시 무시
  }
  if (broadcast && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "CHAT_STATE_SYNC", payload: next })
    } catch {
      // BroadcastChannel 오류 무시
    }
  }
  notifyListeners()
}

function initRealtimeTransport() {
  if (typeof window === "undefined") return

  if (!broadcastChannel && "BroadcastChannel" in window) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      broadcastChannel.onmessage = (event) => {
        if (event?.data?.type === "CHAT_STATE_SYNC") {
          stateSnapshot = readChatState()
          notifyListeners()
        }
      }
    } catch {
      broadcastChannel = null
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === CHAT_STORAGE_KEY) {
      stateSnapshot = readChatState()
      notifyListeners()
    }
  })

  if (!supabaseRealtimeInitialized && isSupabaseConfigured()) {
    supabaseRealtimeInitialized = true
    try {
      const channel = supabase.channel("shingu-live-chat")
      channel
        .on("broadcast", { event: "chat_message" }, (payload) => {
          const incoming = payload?.payload as {
            room?: RealtimeChatRoom
            message?: RealtimeChatMessage
          }
          if (!incoming?.message || !incoming?.room) return
          mergeIncomingRoomAndMessage(incoming.room, incoming.message)
        })
        .on("broadcast", { event: "chat_room_created" }, (payload) => {
          const incomingRoom = payload?.payload?.room as
            | RealtimeChatRoom
            | undefined
          if (!incomingRoom?.id) return
          mergeIncomingRoom(incomingRoom)
        })
        .subscribe()
    } catch {
      // Supabase Realtime 연결 실패 시 로컬/BroadcastChannel 폴백 유지
    }
  }
}

initRealtimeTransport()

function mergeIncomingRoom(room: RealtimeChatRoom) {
  const current = readChatState()
  const exists = current.rooms.some((r) => r.id === room.id)
  const nextRooms = exists
    ? current.rooms.map((r) => (r.id === room.id ? { ...r, ...room } : r))
    : [room, ...current.rooms]
  saveChatState({ ...current, rooms: nextRooms }, false)
}

function mergeIncomingRoomAndMessage(
  room: RealtimeChatRoom,
  message: RealtimeChatMessage,
) {
  const current = readChatState()
  const existingMsgs = Array.isArray(current.messagesByRoom[room.id])
    ? current.messagesByRoom[room.id]
    : []
  const alreadyHasMsg = existingMsgs.some((m) => m.id === message.id)
  const nextRoomMsgs = alreadyHasMsg
    ? existingMsgs
    : [...existingMsgs, message].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )

  const roomExists = current.rooms.some((r) => r.id === room.id)
  const updatedRoom: RealtimeChatRoom = {
    ...room,
    lastMessage: message.text,
    lastMessageAt: message.createdAt,
  }
  const nextRooms = roomExists
    ? current.rooms.map((r) => (r.id === room.id ? updatedRoom : r))
    : [updatedRoom, ...current.rooms]

  saveChatState(
    {
      rooms: nextRooms,
      messagesByRoom: {
        ...current.messagesByRoom,
        [room.id]: nextRoomMsgs,
      },
    },
    false,
  )
}

export function subscribeRealtimeChat(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRealtimeChatSnapshot(): RealtimeChatState {
  return stateSnapshot
}

// 현재 로그인한 사용자의 ID(또는 연동된 계정 식별자)가 participants 배열에 포함된 채팅방만 필터링
export function getRoomsForUser(
  userId?: string | null,
  loginId?: string | null,
): RealtimeChatRoom[] {
  const cleanId = normalizeUserId(userId)
  const cleanLoginId = normalizeUserId(loginId)
  if (!cleanId && !cleanLoginId) return []

  const rooms = Array.isArray(stateSnapshot?.rooms) ? stateSnapshot.rooms : []
  return rooms
    .filter((room) => {
      if (!Array.isArray(room?.participants)) return false
      return room.participants.some(
        (participantId) =>
          (cleanId && participantId === cleanId) ||
          (cleanLoginId && participantId === cleanLoginId),
      )
    })
    .sort((a, b) =>
      (b.lastMessageAt || b.createdAt || "").localeCompare(
        a.lastMessageAt || a.createdAt || "",
      ),
    )
}

export function getMessagesForRoom(roomId?: string | null): RealtimeChatMessage[] {
  if (!roomId) return []
  const list = stateSnapshot?.messagesByRoom?.[roomId]
  return Array.isArray(list) ? list : []
}

// 채팅방 상대방 프로필 안전 추출 (계정 정보 누락 방어)
export function getCounterpartProfile(
  room: RealtimeChatRoom | null | undefined,
  currentUserId?: string | null,
  currentLoginId?: string | null,
): ChatParticipantProfile {
  const fallbackProfile: ChatParticipantProfile = {
    id: "unknown-user",
    name: "알 수 없는 사용자",
    role: "driver",
    carInfo: "",
    emailVerified: true,
    licenseVerified: false,
  }
  if (!room) return fallbackProfile

  const myIds = new Set(
    [normalizeUserId(currentUserId), normalizeUserId(currentLoginId)].filter(
      Boolean,
    ),
  )

  const profiles = room.participantProfiles || {}
  const counterpartId =
    (Array.isArray(room.participants)
      ? room.participants.find((pid) => !myIds.has(pid))
      : undefined) || Object.keys(profiles).find((pid) => !myIds.has(pid))

  if (counterpartId && profiles[counterpartId]) {
    const found = profiles[counterpartId]
    return {
      id: found.id || counterpartId,
      name: normalizeDisplayName(found.name),
      role: found.role === "driver" || found.role === "rider" ? found.role : "driver",
      carInfo: found.carInfo || "",
      emailVerified: found.emailVerified ?? true,
      licenseVerified:
        found.role === "driver" ? (found.licenseVerified ?? true) : false,
    }
  }

  return fallbackProfile
}

export type CreateOrJoinChatParams = {
  currentUser: {
    id?: string | null
    loginId?: string | null
    name?: string | null
    role: Role
    carInfo?: string
    isDriverVerified?: boolean
  }
  targetUser: {
    id?: string | null
    name?: string | null
    role: Role
    carInfo?: string
    licenseVerified?: boolean
  }
  ride: {
    id: string
    start: string
    destination: string
    date: string
    time: string
    waypoints?: string
  }
}

export type CreateOrJoinChatResult =
  | {
      ok: true
      room: RealtimeChatRoom
      isExisting: boolean
    }
  | {
      ok: false
      reason: "LOGIN_REQUIRED" | "SELF_CHAT_BLOCKED" | "INVALID_TARGET"
      message: string
    }

// 실제 계정 기반 채팅방 조회 또는 신규 생성 (중복 방 생성 방지 및 본인 게시글 차단)
export function getOrCreateCarpoolChatRoom(
  params: CreateOrJoinChatParams,
): CreateOrJoinChatResult {
  const myId =
    normalizeUserId(params.currentUser?.id) ||
    normalizeUserId(params.currentUser?.loginId)
  if (!myId) {
    return {
      ok: false,
      reason: "LOGIN_REQUIRED",
      message: "채팅 기능을 이용하려면 먼저 로그인해 주세요.",
    }
  }

  const myName = normalizeDisplayName(params.currentUser?.name)
  const targetName = normalizeDisplayName(params.targetUser?.name)
  const rawTargetId = normalizeUserId(params.targetUser?.id)
  const targetId =
    rawTargetId &&
    rawTargetId !== "demo-driver" &&
    rawTargetId !== "demo-rider" &&
    rawTargetId !== "user-driver" &&
    rawTargetId !== "user-rider"
      ? rawTargetId
      : `account-${targetName}`

  // 본인 게시글 채팅 차단 검증
  const isSameAccountById =
    myId === targetId ||
    (rawTargetId &&
      (rawTargetId === myId ||
        rawTargetId === normalizeUserId(params.currentUser?.loginId)))
  const isSameAccountByName =
    Boolean(params.currentUser?.name?.trim()) &&
    Boolean(params.targetUser?.name?.trim()) &&
    params.currentUser.name!.trim() === params.targetUser.name!.trim() &&
    (isSameAccountById ||
      rawTargetId === "user-driver" ||
      rawTargetId === "demo-driver" ||
      !rawTargetId)

  if (isSameAccountById || isSameAccountByName) {
    return {
      ok: false,
      reason: "SELF_CHAT_BLOCKED",
      message:
        "본인이 작성한 카풀 게시글에서는 자신과 채팅방을 생성할 수 없습니다.",
    }
  }

  const rideId = (params.ride?.id || "general").trim()
  const current = readChatState()

  // 1) 이미 해당 게시글과 두 사용자(작성자 + 신청자) 조합으로 생성된 채팅방이 있는지 확인
  const existingRoom = current.rooms.find((room) => {
    if (!Array.isArray(room.participants)) return false
    const hasMe =
      room.participants.includes(myId) ||
      (params.currentUser?.loginId
        ? room.participants.includes(params.currentUser.loginId)
        : false)
    const hasTarget =
      room.participants.includes(targetId) ||
      (rawTargetId ? room.participants.includes(rawTargetId) : false) ||
      Object.values(room.participantProfiles || {}).some(
        (p) => normalizeDisplayName(p.name) === targetName,
      )
    return room.rideId === rideId && hasMe && hasTarget
  })

  if (existingRoom) {
    return {
      ok: true,
      room: existingRoom,
      isExisting: true,
    }
  }

  // 2) 기존 채팅방이 없다면 새 채팅방 생성
  const nowIso = new Date().toISOString()
  const participantIds = Array.from(new Set([myId, targetId]))
  const myProfile: ChatParticipantProfile = {
    id: myId,
    name: myName,
    role: params.currentUser.role,
    carInfo: params.currentUser.carInfo || "",
    emailVerified: true,
    licenseVerified:
      params.currentUser.role === "driver"
        ? Boolean(params.currentUser.isDriverVerified ?? true)
        : false,
  }
  const targetProfile: ChatParticipantProfile = {
    id: targetId,
    name: targetName,
    role: params.targetUser.role,
    carInfo: params.targetUser.carInfo || "",
    emailVerified: true,
    licenseVerified:
      params.targetUser.role === "driver"
        ? Boolean(params.targetUser.licenseVerified ?? true)
        : false,
  }

  const newRoom: RealtimeChatRoom = {
    id: `room-${rideId}-${myId}-${targetId}`
      .replace(/\s+/g, "_")
      .slice(0, 96),
    rideId,
    title: `${params.ride.start || "출발지"} → ${params.ride.destination || "목적지"}`,
    participants: participantIds,
    participantProfiles: {
      [myId]: myProfile,
      [targetId]: targetProfile,
    },
    meeting: `${params.ride.date || "오늘"} ${params.ride.time || "08:30"} · ${params.ride.start || "출발지"}`,
    destination: params.ride.destination || "목적지",
    waypoints: params.ride.waypoints || DIRECT_ROUTE_LABEL,
    lastMessage: "",
    lastMessageAt: nowIso,
    createdAt: nowIso,
  }

  const nextState: RealtimeChatState = {
    rooms: [newRoom, ...current.rooms],
    messagesByRoom: {
      ...current.messagesByRoom,
      [newRoom.id]: current.messagesByRoom[newRoom.id] || [],
    },
  }
  saveChatState(nextState, true)

  if (isSupabaseConfigured()) {
    try {
      supabase
        .channel("shingu-live-chat")
        .send({
          type: "broadcast",
          event: "chat_room_created",
          payload: { room: newRoom },
        })
        .catch(() => {})
    } catch {
      // 무시
    }
  }

  return {
    ok: true,
    room: newRoom,
    isExisting: false,
  }
}

// 실시간 메시지 전송 및 DB/채널 동기화
export function sendRealtimeChatMessage(params: {
  roomId: string
  senderId: string
  senderName?: string | null
  text: string
}): RealtimeChatMessage | null {
  const cleanRoomId = (params.roomId || "").trim()
  const cleanSenderId = normalizeUserId(params.senderId)
  const cleanText = (params.text || "").trim()
  if (!cleanRoomId || !cleanSenderId || !cleanText) return null

  const current = readChatState()
  const targetRoom = current.rooms.find((r) => r.id === cleanRoomId)
  if (!targetRoom) return null

  const nowIso = new Date().toISOString()
  const message: RealtimeChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId: cleanRoomId,
    senderId: cleanSenderId,
    senderName: normalizeDisplayName(params.senderName),
    text: cleanText,
    createdAt: nowIso,
  }

  const roomMessages = Array.isArray(current.messagesByRoom[cleanRoomId])
    ? current.messagesByRoom[cleanRoomId]
    : []

  const updatedRoom: RealtimeChatRoom = {
    ...targetRoom,
    lastMessage: cleanText,
    lastMessageAt: nowIso,
  }

  const nextRooms = [
    updatedRoom,
    ...current.rooms.filter((r) => r.id !== cleanRoomId),
  ]

  saveChatState(
    {
      rooms: nextRooms,
      messagesByRoom: {
        ...current.messagesByRoom,
        [cleanRoomId]: [...roomMessages, message],
      },
    },
    true,
  )

  if (isSupabaseConfigured()) {
    try {
      supabase
        .channel("shingu-live-chat")
        .send({
          type: "broadcast",
          event: "chat_message",
          payload: { room: updatedRoom, message },
        })
        .catch(() => {})
    } catch {
      // 무시
    }
  }

  return message
}

export function leaveRealtimeChatRoom(roomId: string, userId: string): void {
  const cleanId = normalizeUserId(userId)
  if (!roomId || !cleanId) return
  const current = readChatState()
  const nextRooms = current.rooms
    .map((room) => {
      if (room.id !== roomId) return room
      const remaining = (room.participants || []).filter(
        (pid) => pid !== cleanId,
      )
      return { ...room, participants: remaining }
    })
    .filter((room) => room.participants.length > 0)

  saveChatState({ ...current, rooms: nextRooms }, true)
}

export function formatChatTimestamp(isoOrLabel?: string | null): string {
  if (!isoOrLabel) return "방금 전"
  const parsed = new Date(isoOrLabel)
  if (Number.isNaN(parsed.getTime())) return isoOrLabel
  return parsed.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatChatRoomListTime(isoOrLabel?: string | null): string {
  if (!isoOrLabel) return ""
  const parsed = new Date(isoOrLabel)
  if (Number.isNaN(parsed.getTime())) return isoOrLabel
  const now = new Date()
  const isToday =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  if (isToday) {
    return parsed.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }
  return parsed.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  })
}
