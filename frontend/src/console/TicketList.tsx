import { formatStamp, labelOf } from "../format";
import type { Status, Ticket } from "../types";

const filters: Array<{ id: "all" | Status; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "resolved", label: "Solved" },
];

export function TicketList({
  tickets,
  activeId,
  filter,
  onFilter,
  onSelect,
}: {
  tickets: Ticket[];
  activeId: string | null;
  filter: "all" | Status;
  onFilter: (filter: "all" | Status) => void;
  onSelect: (id: string) => void;
}) {
  const visible = tickets.filter((ticket) => filter === "all" || ticket.status === filter);

  return (
    <aside className="list">
      <div className="list-head">
        <h2>Tickets</h2>
        <div className="filters" role="tablist" aria-label="Filter by status">
          {filters.map((item) => {
            const count =
              item.id === "all"
                ? tickets.length
                : tickets.filter((ticket) => ticket.status === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={filter === item.id ? "is-selected" : ""}
                onClick={() => onFilter(item.id)}
              >
                {item.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ul>
        {visible.map((ticket) => (
          <li key={ticket.id}>
            <button
              type="button"
              className={ticket.id === activeId ? "ticket is-active" : "ticket"}
              onClick={() => onSelect(ticket.id)}
            >
              <span className={`priority priority-${ticket.priority}`}>{labelOf(ticket.priority)}</span>
              <strong>{ticket.subject}</strong>
              <span className="ticket-meta">
                {ticket.customer.name}
                <span className={`status status-${ticket.status}`}>{labelOf(ticket.status)}</span>
              </span>
              <span className="preview">{ticket.preview}</span>
              <span className="ticket-foot">
                <span>{ticket.assignee?.name ?? "Unassigned"}</span>
                <time dateTime={ticket.lastActivityAt}>{formatStamp(ticket.lastActivityAt)}</time>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="empty">No tickets in this view.</p> : null}
    </aside>
  );
}
