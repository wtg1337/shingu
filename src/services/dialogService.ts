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

type DialogListener = (state: DialogState | null) => void

let activeDialogState: DialogState | null = null
const listeners = new Set<DialogListener>()

export function subscribeDialog(listener: DialogListener): () => void {
  listeners.add(listener)
  listener(activeDialogState)
  return () => {
    listeners.delete(listener)
  }
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(activeDialogState)
  }
}

/**
 * 앱 내부 커스텀 알림(Alert) 모달 호출 함수 (Promise 기반)
 */
export function showAppAlert(
  messageOrOptions: string | Omit<DialogOptions, "cancelText">
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
  messageOrOptions: string | DialogOptions
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

// 브라우저 기본 alert 전역 가드 (기본 alert 창이 뜨지 않도록 앱 커스텀 모달로 연결)
if (typeof window !== "undefined") {
  window.alert = (message?: any) => {
    void showAppAlert(String(message ?? ""))
  }
}
