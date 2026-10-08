/** iOS-style on/off toggle. */
export function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        position: "relative",
        width: 44,
        height: 26,
        flexShrink: 0,
        borderRadius: 13,
        border: "none",
        padding: 0,
        background: checked ? "var(--color-accent)" : "var(--color-border)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 150ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#ffffff",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 150ms ease",
        }}
      />
    </button>
  );
}
