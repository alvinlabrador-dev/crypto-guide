import { Check, WifiOff } from "lucide-react";
import type { Toast } from "../../types";
import "./ToastStack.css";

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          {toast.tone === "success" ? <Check size={16} /> : <WifiOff size={16} />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
