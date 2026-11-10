"use client";

export default function ConfirmDeleteButton({
  action,
  confirmText,
  label,
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(confirmText)) action();
      }}
      className="text-xs font-medium text-red-500 hover:underline"
    >
      {label ?? "Elimina"}
    </button>
  );
}
