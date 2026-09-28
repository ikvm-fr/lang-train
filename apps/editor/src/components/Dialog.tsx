import { useEffect, useRef, type ReactNode } from 'react'

export function Dialog(props: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="dialog" onCancel={props.onClose}>
      <h2>{props.title}</h2>
      <div className="dialog-body">{props.children}</div>
      <div className="dialog-footer">{props.footer}</div>
    </dialog>
  )
}
