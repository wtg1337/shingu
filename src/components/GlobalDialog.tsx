import React, { useEffect, useState } from "react"
import {
  DialogState,
  closeActiveDialog,
  subscribeDialog,
} from "../services/dialogService"
import { Check, Bell, CircleHelp } from "./Icons"

export default function GlobalDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  useEffect(() => {
    return subscribeDialog((state) => {
      setDialog(state)
    })
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

  // 알림창이 닫힌 상태면 DOM에서 완전히 언마운트 (Backdrop 잔존/클릭 먹통 버그 차단)
  if (!dialog) return null

  const isDanger =
    dialog.variant === "danger" ||
    (dialog.type === "confirm" &&
      (dialog.confirmText?.includes("삭제") ||
        dialog.confirmText?.includes("나가기") ||
        dialog.confirmText?.includes("폐기") ||
        dialog.confirmText?.includes("취소") ||
        dialog.title?.includes("삭제") ||
        dialog.title?.includes("취소")))

  const isSuccess =
    dialog.variant === "success" ||
    dialog.title?.includes("완료") ||
    dialog.title?.includes("성공") ||
    dialog.message?.includes("완료되었습니다") ||
    dialog.message?.includes("사용 가능한")

  return (
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
  )
}
