import { useRef } from "react";

/**
 * DatePickerInput
 *
 * Allows both manual keyboard date entry AND a 1-click visual calendar popup.
 * Clicking anywhere on the input or on the dedicated 📅 calendar icon
 * calls `showPicker()`, displaying the interactive month/day calendar grid.
 */
export function DatePickerInput({
  value,
  onChange,
  className = "",
  title = "Select date",
}) {
  const inputRef = useRef(null);

  const handleOpenPicker = (e) => {
    try {
      if (inputRef.current && typeof inputRef.current.showPicker === "function") {
        inputRef.current.showPicker();
      } else {
        inputRef.current?.focus();
      }
    } catch (_) {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative flex items-center w-full group">
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={onChange}
        onClick={handleOpenPicker}
        title={title}
        className={`w-full bg-card border border-line rounded-lg pl-2.5 pr-8 py-1.5 text-[12px] text-textLight outline-none focus:border-accent cursor-pointer transition-colors ${className}`}
      />
      <button
        type="button"
        onClick={handleOpenPicker}
        title="Open interactive calendar"
        tabIndex={-1}
        className="absolute right-2 text-accent/80 hover:text-accent text-[13px] cursor-pointer p-0.5 transition-transform group-hover:scale-110 active:scale-90 select-none"
      >
        📅
      </button>
    </div>
  );
}
