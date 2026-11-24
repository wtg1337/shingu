import React, { useEffect, useState } from "react"
import {
  DialogState,
  ToastState,
  closeActiveDialog,
  dismissAppToast,
  subscribeDialog,
  subscribeToast,
} from "../services/dialogService"
import { Check, Bell, CircleHelp, X } from "./Icons"

export default function GlobalDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    const unsubDialog = subscribeDialog((state) => {
      setDialog(state)
    })
    const unsubToast = subscribeToast((state) => {
      setToast(state)
    })
    return () => {
      unsubDialog()
      unsubToast()
    }
  }, [])

  // 키보드 단축키 지원 (ESC: 닫기/취소, Enter: 확인)
  useEffect(() => {
    if (!dialog) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeActiveDialog(dialog.type === "alert")
      } else if (event.key === "Enter") {
        event.preventDefault()
        closeActiveDialog(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [dialog])

  if (!dialog && !toast) return null

  const isDanger =
    dialog?.variant === "danger" ||
    (dialog?.type === "confirm" &&
      (dialog?.confirmText?.includes("삭제") ||
        dialog?.confirmText?.includes("나가기") ||
        dialog?.confirmText?.includes("폐기") ||
        dialog?.confirmText?.includes("취소") ||
        dialog?.title?.includes("삭제") ||
        dialog?.title?.includes("취소")))

  const isSuccess =
    dialog?.variant === "success" ||
    dialog?.title?.includes("완료") ||
    dialog?.title?.includes("성공") ||
    dialog?.message?.includes("완료되었습니다") ||
    dialog?.message?.includes("사용 가능한")

  return (
    <>
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "18px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100000,
            width: "min(92vw, 390px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "12px 15px",
            borderRadius: "16px",
            background:
              toast.variant === "danger"
                ? "#d63031"
                : toast.variant === "info"
                  ? "#173653"
                  : "#1f4733",
            color: "#ffffff",
            boxShadow: "0 12px 28px rgba(23, 54, 83, 0.25)",
            fontSize: "12.5px",
            fontWeight: 700,
            lineHeight: 1.4,
            animation: "reset-slide-down 0.22s ease-out forwards",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {toast.variant === "danger" ? <CircleHelp /> : <Check />}
            </span>
            <span>{toast.message}</span>
          </span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                const fn = toast.onAction
                dismissAppToast()
                fn?.()
              }}
              style={{
                border: 0,
                borderRadius: "10px",
                padding: "6px 10px",
                background: "#96c449",
                color: "#173653",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={dismissAppToast}
            style={{
              border: 0,
              background: "transparent",
              color: "rgba(255,255,255,0.75)",
              padding: "2px",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X />
          </button>
        </div>
      )}

      {dialog && (
        <div
          className="global-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialog.title ? "global-dialog-title" : undefined}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeActiveDialog(dialog.type === "alert")
            }
          }}
        >
          <section
            className="app-dialog global-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={`dialog-icon ${
                isSuccess
                  ? "dialog-icon--success"
                  : isDanger
                    ? "dialog-icon--danger"
                    : "neutral"
              }`}
              aria-hidden="true"
            >
              {isSuccess ? (
                <Check />
              ) : isDanger ? (
                <CircleHelp />
              ) : (
                <Bell />
              )}
            </span>

            {dialog.title && (
              <h2 id="global-dialog-title" className="global-dialog-title">
                {dialog.title}
              </h2>
            )}

            <p className="global-dialog-message">{dialog.message}</p>

            {dialog.type === "alert" ? (
              <div className="global-dialog-single-action">
                <button
                  type="button"
                  className="button button--primary global-dialog-btn"
                  onClick={() => closeActiveDialog(true)}
                  autoFocus
                >
                  {dialog.confirmText || "확인"}
                </button>
              </div>
            ) : (
              <div className="dialog-actions global-dialog-actions">
                <button
                  type="button"
                  className="button button--soft global-dialog-btn"
                  onClick={() => closeActiveDialog(false)}
                >
                  {dialog.cancelText || "취소"}
                </button>
                <button
                  type="button"
                  className={`button ${
                    isDanger ? "global-dialog-btn--danger" : "button--primary"
                  } global-dialog-btn`}
                  onClick={() => closeActiveDialog(true)}
                  autoFocus
                >
                  {dialog.confirmText || "확인"}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
