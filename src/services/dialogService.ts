export interface DialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "primary" | "danger" | "success" | "neutral" | "warning"
}

export interface DialogState extends DialogOptions {
  id: string
  type: "alert" | "confirm"
  resolve: (value: boolean) => void
}

export interface ToastOptions {
  message: string
  variant?: "success" | "danger" | "info"
  durationMs?: number
  actionLabel?: string
  onAction?: () => void
}

export interface ToastState extends ToastOptions {
  id: string
}

type DialogListener = (state: DialogState | null) => void
type ToastListener = (state: ToastState | null) => void

let activeDialogState: DialogState | null = null
let activeToastState: ToastState | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<DialogListener>()
const toastListeners = new Set<ToastListener>()

export function subscribeDialog(listener: DialogListener): () => void {
  listeners.add(listener)
  listener(activeDialogState)
  return () => {
    listeners.delete(listener)
  }
}

export function subscribeToast(listener: ToastListener): () => void {
  toastListeners.add(listener)
  listener(activeToastState)
  return () => {
    toastListeners.delete(listener)
  }
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(activeDialogState)
  }
}

function notifyToastListeners() {
  for (const listener of toastListeners) {
    listener(activeToastState)
  }
}

/**
 * 부드럽게 떴다 사라지는 커스텀 토스트(Toast) 알림 호출 함수
 */
export function showAppToast(
  messageOrOptions: string | ToastOptions,
): void {
  const options: ToastOptions =
    typeof messageOrOptions === "string"
      ? { message: messageOrOptions }
      : messageOrOptions

  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }

  activeToastState = {
    id: Math.random().toString(36).slice(2),
    message: options.message,
    variant: options.variant || "success",
    durationMs: options.durationMs || 2800,
    actionLabel: options.actionLabel,
    onAction: options.onAction,
  }
  notifyToastListeners()

  toastTimer = setTimeout(() => {
    activeToastState = null
    notifyToastListeners()
  }, activeToastState.durationMs)
}

export function dismissAppToast(): void {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  activeToastState = null
  notifyToastListeners()
}

/**
 * 앱 내부 커스텀 알림(Alert) 모달 호출 함수 (Promise 기반)
 */
export function showAppAlert(
  messageOrOptions: string | Omit<DialogOptions, "cancelText">,
): Promise<void> {
  const options =
    typeof messageOrOptions === "string"
      ? { message: messageOrOptions }
      : messageOrOptions

  return new Promise<void>((resolve) => {
    if (activeDialogState) {
      activeDialogState.resolve(false)
    }

    const state: DialogState = {
      id: Math.random().toString(36).slice(2),
      type: "alert",
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || "확인",
      variant: options.variant || "primary",
      resolve: () => resolve(),
    }

    activeDialogState = state
    notifyListeners()
  })
}

/**
 * 앱 내부 커스텀 확인(Confirm) 모달 호출 함수 (Promise 기반)
 * 확인 클릭 시 true, 취소/닫기 시 false 반환
 */
export function showAppConfirm(
  messageOrOptions: string | DialogOptions,
): Promise<boolean> {
  const options =
    typeof messageOrOptions === "string"
      ? { message: messageOrOptions }
      : messageOrOptions

  return new Promise<boolean>((resolve) => {
    if (activeDialogState) {
      activeDialogState.resolve(false)
    }

    const state: DialogState = {
      id: Math.random().toString(36).slice(2),
      type: "confirm",
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || "확인",
      cancelText: options.cancelText || "취소",
      variant: options.variant || "primary",
      resolve: (result: boolean) => resolve(result),
    }

    activeDialogState = state
    notifyListeners()
  })
}

/**
 * 현재 열려 있는 다이얼로그 닫기
 */
export function closeActiveDialog(result: boolean) {
  if (activeDialogState) {
    const resolve = activeDialogState.resolve
    activeDialogState = null
    notifyListeners()
    resolve(result)
  }
}

// 브라우저 기본 alert 전역 가드 (투박한 기본 alert 대신 커스텀 토스트 알림으로 표시)
if (typeof window !== "undefined") {
  window.alert = (message?: any) => {
    showAppToast({ message: String(message ?? ""), variant: "info" })
  }
}
