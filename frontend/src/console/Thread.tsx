import { useEffect, useRef } from "react";
import { formatStamp, labelOf } from "../format";
import type { Message, Ticket } from "../types";
import type { DraftFrame } from "./typingPlay";

export function Thread({
  ticket,
  messages,
  liveDraft,
  onBack,
  onProperties,
  onCustomer,
  onNext,
}: {
  ticket: Ticket;
  messages: Message[];
  liveDraft: DraftFrame | null;
  onBack: () => void;
  onProperties: () => void;
  onCustomer: () => void;
  onNext: () => void;
}) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, liveDraft]);

  return (
    <section className="thread" aria-label="Message thread">
      <header className="thread-head">
        <div className="mobile-jumps">
          <button type="button" className="back" onClick={onBack}>
            Tickets
          </button>
          <button type="button" className="back" onClick={onProperties}>
            Properties
          </button>
          <button type="button" className="back" onClick={onCustomer}>
            Customer
          </button>
        </div>
        <div className="crumb">
          <strong>{ticket.subject}</strong>
          <span className="tag">{ticket.customer.name}</span>
          {liveDraft ? (
            <span className="writing-badge" title={`${ticket.customer.name} is writing`}>
              <PenIcon />
              Writing
            </span>
          ) : null}
          <span className="tag">{ticket.channelLabel}</span>
          <span className={`tag tag-${ticket.status}`}>{labelOf(ticket.status)}</span>
        </div>
        <button type="button" className="next" onClick={onNext}>
          Next
        </button>
      </header>
      <div className="meta">
        <p className="eyebrow">
          {ticket.productLabel} · via {ticket.channelLabel}
        </p>
        <h2>{ticket.subject}</h2>
        <p className={ticket.simulation.resolved ? "live-pill is-fixed" : "live-pill"}>
          {ticket.simulation.resolved ? ticket.simulation.outcome ?? "Fixed in this chat" : ticket.simulation.situation}
        </p>
      </div>
      <ol className="messages">
        {messages.map((message) => (
          <li key={message.id} className={`bubble bubble-${message.authorType}`}>
            <p>{message.body}</p>
            <span>
              {message.authorName}
              <time dateTime={message.createdAt}>{formatStamp(message.createdAt)}</time>
            </span>
          </li>
        ))}
        {ticket.simulation.resolved ? <li className="system-event">{ticket.simulation.outcome}</li> : null}
        {liveDraft ? (
          <li className={`bubble bubble-customer typing${liveDraft.deleting ? " is-deleting" : ""}`} aria-live="polite">
            <p>
              <PenIcon />
              <span className="draft-text">{liveDraft.text || " "}</span>
              <span className="caret" />
            </p>
            <span>{ticket.customer.name} is writing</span>
          </li>
        ) : null}
        <li ref={endRef} />
      </ol>
    </section>
  );
}

function PenIcon() {
  return (
    <svg className="write-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M4 20.2 8.4 19 19.2 8.2 15.8 4.8 5 15.6 4 20.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m13.6 7 3.4 3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
