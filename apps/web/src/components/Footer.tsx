export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        marginTop: "var(--space-6)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "var(--space-4)",
          textAlign: "center",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-xs)",
        }}
      >
        TheFood · скидки на свободные столики в ресторанах
      </div>
    </footer>
  );
}
