import { labelOf } from "../format";
import type { Agent, Priority, ScenarioView, Status, Ticket } from "../types";

const statuses: Status[] = ["open", "pending", "resolved"];
const priorities: Priority[] = ["low", "normal", "high", "urgent"];

export function Properties({
  ticket,
  scenario,
  agents,
  agent,
  onStatus,
  onPriority,
  onAssignee,
}: {
  ticket: Ticket;
  scenario: ScenarioView | null;
  agents: Agent[];
  agent: Agent;
  onStatus: (status: Status) => void;
  onPriority: (priority: Priority) => void;
  onAssignee: (assigneeId: string | null) => void;
}) {
  return (
    <aside className="properties" aria-label="Ticket properties">
      <h2>Ticket properties</h2>
      <label>
        Requester
        <input value={ticket.customer.name} readOnly />
      </label>
      <label>
        Assignee
        <span className="assignee-row">
          <select value={ticket.assignee?.id ?? ""} onChange={(event) => onAssignee(event.target.value || null)}>
            <option value="">Unassigned</option>
            {agents.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          {ticket.assignee?.id === agent.id ? (
            <span className="take is-you">you</span>
          ) : (
            <button type="button" className="take" onClick={() => onAssignee(agent.id)}>
              take it
            </button>
          )}
        </span>
      </label>
      <label>
        Priority
        <select value={ticket.priority} onChange={(event) => onPriority(event.target.value as Priority)}>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {labelOf(priority)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={ticket.status} onChange={(event) => onStatus(event.target.value as Status)}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {labelOf(status)}
            </option>
          ))}
        </select>
      </label>
      <h2>Account</h2>
      <label>
        Product
        <input value={ticket.productLabel} readOnly />
      </label>
      <label>
        Form
        <input value={scenario?.title ?? ticket.subject} readOnly />
      </label>
      <label>
        Channel
        <input value={ticket.channelLabel} readOnly />
      </label>
      <label>
        Platform
        <input value={ticket.customer.platform} readOnly />
      </label>
      <label>
        Plan
        <input value={ticket.customer.plan} readOnly />
      </label>
      <label>
        App
        <input value={ticket.customer.appVersion} readOnly />
      </label>
      <label>
        Country
        <input value={ticket.customer.country} readOnly />
      </label>
    </aside>
  );
}
