import {
  defaultNotificationSettings,
} from "../data/demoData"
import type {
  AccountData,
  DemoDevice,
  DemoInquiry,
  NotificationSettings,
  Role,
} from "../types/domain"
import {
  readDemoData,
  readDemoList,
  readDemoValue,
  writeDemoData,
  writeDemoValue,
} from "./demoStore"

export function getNotificationSettings() {
  return readDemoData("notification-settings", defaultNotificationSettings)
}

export function saveNotificationSettings(settings: NotificationSettings) {
  writeDemoData("notification-settings", settings)
}

export function getBiometricDemoState() {
  return readDemoValue("biometric-demo") === "true"
}

export function saveBiometricDemoState(enabled: boolean) {
  writeDemoValue("biometric-demo", String(enabled))
}

export type BiometricSavedAccount = {
  account: AccountData
  role: Role
  registeredAt: string
}

export function saveBiometricAccount(account: AccountData, role: Role) {
  const payload: BiometricSavedAccount = {
    account,
    role,
    registeredAt: new Date().toLocaleString("ko-KR"),
  }
  writeDemoData("biometric-account", payload)
}

export function getBiometricAccount(): BiometricSavedAccount | null {
  return readDemoData<BiometricSavedAccount | null>("biometric-account", null)
}

export async function checkBiometricHardwareSupport(): Promise<{
  supported: boolean
  reason?: string
}> {
  try {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable !== "function"
    ) {
      return {
        supported: false,
        reason:
          "현재 브라우저 또는 기기 환경에서는 생체인증(WebAuthn) 하드웨어 API를 지원하지 않습니다.",
      }
    }
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    if (!available) {
      return {
        supported: false,
        reason:
          "현재 기기에 활성화된 지문 또는 Face ID 생체인증 센서가 감지되지 않았습니다.",
      }
    }
    return { supported: true }
  } catch {
    return {
      supported: false,
      reason:
        "보안 컨텍스트 또는 생체인증 센서 접근이 제한된 환경입니다.",
    }
  }
}

export function detectCurrentDeviceInfo(): {
  name: string
  type: string
  lastActive: string
} {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    let os = "데스크톱 OS"
    if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS"
    else if (/Android/i.test(ua)) os = "Android"
    else if (/Windows NT/i.test(ua)) os = "Windows"
    else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS"
    else if (/Linux/i.test(ua)) os = "Linux"

    let browser = "웹 브라우저"
    if (/Edg\//i.test(ua)) browser = "Microsoft Edge"
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome"
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari"
    else if (/Firefox\//i.test(ua)) browser = "Firefox"

    const nowLabel = new Date().toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    return {
      name: `${os} 기기`,
      type: `${os} · ${browser}`,
      lastActive: `최근 접속: ${nowLabel} (현재 접속 중)`,
    }
  } catch {
    return {
      name: "현재 접속 기기",
      type: "웹 브라우저 · 기본 환경",
      lastActive: "최근 접속: 방금 전",
    }
  }
}

export function getDemoDevices(): DemoDevice[] {
  try {
    const raw = readDemoValue("login-devices")
    if (raw === null) {
      const detected = detectCurrentDeviceInfo()
      const initialDevices: DemoDevice[] = [
        {
          id: "device-current-initial",
          name: detected.name,
          type: detected.type,
          lastActive: detected.lastActive,
          current: true,
        },
      ]
      writeDemoData("login-devices", initialDevices)
      return initialDevices
    }
    return readDemoList<DemoDevice>("login-devices")
  } catch {
    return []
  }
}

export function registerCurrentDemoDevice(customName?: string): DemoDevice[] {
  try {
    const existing = getDemoDevices()
    const detected = detectCurrentDeviceInfo()
    const trimmedName = customName?.trim()
    const newDevice: DemoDevice = {
      id: `device-${Date.now()}`,
      name: trimmedName || detected.name,
      type: detected.type,
      lastActive: detected.lastActive,
      current: true,
    }
    const demoted = existing.map((item) => ({
      ...item,
      current: false,
    }))
    const updated = [newDevice, ...demoted]
    writeDemoData("login-devices", updated)
    return updated
  } catch {
    return getDemoDevices()
  }
}

export function removeDemoDevice(deviceId: string): DemoDevice[] {
  try {
    const updated = getDemoDevices().filter((device) => device.id !== deviceId)
    writeDemoData("login-devices", updated)
    return updated
  } catch {
    return []
  }
}

export function saveDemoInquiry(inquiry: DemoInquiry) {
  const updated = [inquiry, ...readDemoList<DemoInquiry>("inquiries")]
  writeDemoData("inquiries", updated)
  return updated
}
