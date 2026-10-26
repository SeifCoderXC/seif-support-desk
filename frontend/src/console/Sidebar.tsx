import type { ScenarioView, ServiceApproach, Ticket } from "../types";

export function Sidebar({
  ticket,
  scenario,
  approach,
  tab,
  onTab,
}: {
  ticket: Ticket;
  scenario: ScenarioView | null;
  approach: ServiceApproach | null;
  tab: "customer" | "guide";
  onTab: (tab: "customer" | "guide") => void;
}) {
  const facts = [
    ["Plan", ticket.customer.plan],
    ["Platform", ticket.customer.platform],
    ["App", ticket.customer.appVersion],
    ["Country", ticket.customer.country],
  ];

  return (
    <aside className="inspector" aria-label="Customer and quick reference">
      <div className="utility" role="tablist" aria-label="Inspector">
        <button type="button" role="tab" aria-selected={tab === "customer"} className={tab === "customer" ? "is-active" : ""} onClick={() => onTab("customer")}>
          <span className="sr">Customer</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 12ZM5.5 19c1.3-2.5 3.6-3.8 6.5-3.8s5.2 1.3 6.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" role="tab" aria-selected={tab === "guide"} className={tab === "guide" ? "is-active" : ""} onClick={() => onTab("guide")}>
          <span className="sr">Guide</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M5 5.5h6.2A2.3 2.3 0 0 1 13.5 8V19H7a2 2 0 0 1-2-2V5.5ZM19 5.5h-6.2A2.3 2.3 0 0 0 10.5 8V19H17a2 2 0 0 0 2-2V5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="context">
        {tab === "customer" ? (
          <section>
            <h2>Live customer</h2>
            <p className={ticket.simulation.resolved ? "live-pill is-fixed" : "live-pill"}>
              {ticket.simulation.resolved ? ticket.simulation.outcome ?? "Fixed in this chat" : ticket.simulation.situation}
            </p>
            <p className="customer-name">{ticket.customer.name}</p>
            <p className="customer-email">{ticket.customer.email}</p>
            <dl>
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <h3>Case notes</h3>
            <p className="notes">{ticket.customer.notes}</p>
          </section>
        ) : (
          <section>
            <h2>Quick reference</h2>
            {approach ? (
              <div className="approach">
                <h3>{approach.name}</h3>
                <p className="notes">{approach.framing}</p>
                <p className="notes">{approach.basis}</p>
                <ul>
                  {approach.moves.map((move) => (
                    <li key={move.label}>
                      <strong>{move.label}.</strong> {move.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {scenario ? (
              <>
                <h3>{scenario.title}</h3>
                <p className="notes">{scenario.summary}</p>
                {scenario.sections.map((section) => (
                  <div key={section.heading} className="knowledge">
                    <h3>{section.heading}</h3>
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <h3>Public Help Center</h3>
                <ul className="sources">
                  {scenario.sourceUrls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url.replace("https://support.nordvpn.com/hc/en-us/articles/", "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="notes">No quick reference is registered for this ticket.</p>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
