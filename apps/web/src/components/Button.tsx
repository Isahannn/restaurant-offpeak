import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-2)",
  height: "44px",
  padding: "0 var(--space-4)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--font-size-md)",
  fontWeight: 600,
  border: "1px solid transparent",
  cursor: "pointer",
  transition: "opacity 120ms ease",
};

const variantStyle: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-accent)",
    color: "var(--color-accent-contrast)",
  },
  secondary: {
    background: "var(--color-surface-muted)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
  },
};

export function Button({ variant = "primary", style, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...variantStyle[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    />
  );
}
