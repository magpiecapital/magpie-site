/**
 * Wind-down notice — shown on every page while Magpie closes.
 * Static, no network dependency (the bot's site-status endpoint is offline).
 */
export function WindDownBanner() {
  return (
    <div
      role="status"
      style={{
        background: "#1b1613",
        color: "#f3ebdd",
        borderBottom: "1px solid #3a2f28",
        padding: "12px 16px",
        fontSize: 14,
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      <strong>Magpie is winding down.</strong> New loans and new deposits are closed. If you
      have SOL deposited in a lending pool, withdraw it from the{" "}
      <a href="/earn" style={{ color: "#f6c442", textDecoration: "underline" }}>
        Earn page
      </a>
      . Every pool stays fully withdrawable until every depositor has been paid out.
    </div>
  );
}
