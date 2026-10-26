import { reasonFor, screenFor, type DeviceControl, type DeviceFacts } from "./deviceModel";

export function DeviceBoard({
  scenarioKey,
  platform,
  facts,
  resolved,
  busy,
  pendingId,
  onAct,
}: {
  scenarioKey: string;
  platform: string;
  facts: DeviceFacts;
  resolved: boolean;
  busy: boolean;
  pendingId: string | null;
  onAct: (control: DeviceControl) => void;
}) {
  const screen = screenFor(scenarioKey, facts);

  return (
    <section className="device" aria-label="Customer device">
      <header className="device-head">
        <div>
          <p className="device-kicker">{platform}</p>
          <h3>{screen.title}</h3>
        </div>
        <span className={resolved ? "device-state is-settled" : "device-state"}>{resolved ? "Working" : "Live screen"}</span>
      </header>
      <p className="device-diagnosis">{screen.diagnosis}</p>
      <ul>
        {screen.controls.map((control) => (
          <li key={control.id} className={pendingId === control.id ? "is-pending" : ""}>
            <div>
              <strong>{control.label}</strong>
              <span>{control.read(facts)}</span>
              <small>{reasonFor(scenarioKey, control.id, facts)}</small>
            </div>
            {control.phrase ? (
              <button
                type="button"
                disabled={busy}
                className={control.risky ? "is-risky" : ""}
                onClick={() => onAct(control)}
              >
                {control.ask}
              </button>
            ) : (
              <em>Now</em>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
