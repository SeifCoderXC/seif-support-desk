import { useEffect, useRef, useState } from "react";
import { ApiError, api, messageFrom } from "../api";
import type { Agent, Message, Priority, Status, Suggestion, Ticket, TicketDetail } from "../types";
import { DeviceBoard } from "./DeviceBoard";
import type { DeviceControl } from "./deviceModel";
import { Properties } from "./Properties";
import { ReplyBox } from "./ReplyBox";
import { Sidebar } from "./Sidebar";
import { Thread } from "./Thread";
import { TicketList } from "./TicketList";
import { hesitateUntil, typeLines, type DraftFrame } from "./typingPlay";

type Pane = "queue" | "ticket" | "properties" | "customer";

export function ConsolePage({
  token,
  agent,
  onSignOut,
  onUnauthorized,
}: {
  token: string;
  agent: Agent;
  onSignOut: () => void;
  onUnauthorized: () => void;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [body, setBody] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [liveDraft, setLiveDraft] = useState<DraftFrame | null>(null);
  const [provisional, setProvisional] = useState<Message[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>("ticket");
  const [inspector, setInspector] = useState<"customer" | "guide">("customer");
  const [submitAs, setSubmitAs] = useState<Status>("open");
  const savedBody = useRef("");
  const saveSeq = useRef(0);
  const sendingRef = useRef(false);
  const enactStop = useRef({ cancelled: false });
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  function fail(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return;
    }
    setError(messageFrom(cause));
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.tickets(token), api.agents(token)])
      .then(([ticketResult, agentResult]) => {
        if (cancelled) return;
        setTickets(ticketResult.tickets);
        setAgents(agentResult.agents);
        setActiveId((current) => current ?? ticketResult.tickets[0]?.id ?? null);
      })
      .catch((cause) => {
        if (!cancelled) fail(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    saveSeq.current += 1;
    enactStop.current.cancelled = true;
    setLiveDraft(null);
    setProvisional([]);
    setPendingAction(null);
    setDraftReady(false);
    setError(null);
    Promise.all([api.ticket(token, activeId), api.draft(token, activeId), api.suggestion(token, activeId)])
      .then(([nextDetail, draft, nextSuggestion]) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setBody(draft.body);
        savedBody.current = draft.body;
        setSuggestion(nextSuggestion);
        setDraftState(draft.body ? "saved" : "idle");
        setDraftReady(true);
        setSubmitAs(nextDetail.ticket.status);
      })
      .catch((cause) => {
        if (!cancelled) fail(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, token]);

  useEffect(() => {
    if (!activeId || !draftReady || body === savedBody.current) return;
    setDraftState("saving");
    const ticketId = activeId;
    const next = body;
    const seq = ++saveSeq.current;
    const timer = setTimeout(() => {
      api
        .saveDraft(token, ticketId, next)
        .then(() => {
          if (saveSeq.current !== seq) return;
          savedBody.current = next;
          setDraftState("saved");
        })
        .catch((cause) => {
          if (saveSeq.current !== seq) return;
          setDraftState("error");
          fail(cause);
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [activeId, body, draftReady, token]);

  async function refresh(id: string, keepComposer = false) {
    const [nextDetail, draft, nextSuggestion, ticketResult] = await Promise.all([
      api.ticket(token, id),
      api.draft(token, id),
      api.suggestion(token, id),
      api.tickets(token),
    ]);
    setDetail(nextDetail);
    setTickets(ticketResult.tickets);
    setSuggestion(nextSuggestion);
    if (!keepComposer) {
      setBody(draft.body);
      savedBody.current = draft.body;
      setDraftState(draft.body ? "saved" : "idle");
    }
    setDraftReady(true);
    setSubmitAs(nextDetail.ticket.status);
    setProvisional([]);
    setLiveDraft(null);
  }

  async function mutate(action: () => Promise<void>) {
    if (!activeId) return;
    setError(null);
    try {
      if (body !== savedBody.current) {
        await api.saveDraft(token, activeId, body);
        savedBody.current = body;
      }
      await action();
      await refresh(activeId);
    } catch (cause) {
      fail(cause);
    }
  }

  async function sendText(text: string, clearDraft: boolean, actionId: string | null) {
    if (!activeId || !detail || sendingRef.current || text.trim().length === 0) return;
    const ticketId = activeId;
    const customerName = detail.ticket.customer.name;
    const chosen = submitAs;
    sendingRef.current = true;
    enactStop.current = { cancelled: false };
    const stop = enactStop.current;
    setSending(true);
    setError(null);
    setPendingAction(actionId);
    setProvisional([]);
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      authorType: "agent",
      authorName: agent.name,
      body: text,
      createdAt: new Date().toISOString(),
    };
    setDetail({ ...detail, messages: [...detail.messages, optimistic] });
    if (clearDraft) {
      savedBody.current = "";
      setBody("");
    }
    setLiveDraft({ text: "", deleting: false });
    const posted = api
      .send(token, ticketId, text)
      .then(async (result) => {
        if (clearDraft) await api.saveDraft(token, ticketId, "");
        if (!result.ticket.simulation.resolved && chosen !== result.ticket.status) {
          await api.updateTicket(token, ticketId, { status: chosen });
        }
        return result;
      });
    const frame = (next: DraftFrame) => {
      if (stop.cancelled || activeRef.current !== ticketId) return;
      setLiveDraft(next);
    };
    try {
      await hesitateUntil(posted, frame, stop);
      const result = await posted;
      if (stop.cancelled || activeRef.current !== ticketId) return;
      await typeLines(
        result.customerReplies.map((message) => message.body),
        frame,
        (line) => {
          if (stop.cancelled || activeRef.current !== ticketId) return;
          setProvisional((current) => [
            ...current,
            {
              id: `live-${current.length}-${line.length}`,
              authorType: "customer",
              authorName: customerName,
              body: line,
              createdAt: new Date().toISOString(),
            },
          ]);
        },
        stop
      );
      if (stop.cancelled || activeRef.current !== ticketId) return;
      await refresh(ticketId, !clearDraft);
    } catch (cause) {
      if (clearDraft) {
        setBody(text);
        savedBody.current = "";
      }
      setDetail((current) =>
        current && current.ticket.id === ticketId
          ? { ...current, messages: current.messages.filter((message) => !message.id.startsWith("local-")) }
          : current
      );
      fail(cause);
    } finally {
      if (activeRef.current === ticketId) {
        setLiveDraft(null);
        setPendingAction(null);
      }
      sendingRef.current = false;
      setSending(false);
    }
  }

  function send() {
    void sendText(body.trim(), true, null);
  }

  function actOnDevice(control: DeviceControl) {
    if (!control.phrase) return;
    void sendText(control.phrase, false, control.id);
  }

  function openTicket(id: string) {
    setActiveId(id);
    setPane("ticket");
  }

  function openNext() {
    const visible = tickets.filter((ticket) => filter === "all" || ticket.status === filter);
    if (visible.length === 0) return;
    const index = visible.findIndex((ticket) => ticket.id === activeId);
    const next = visible[(index + 1) % visible.length];
    if (next) setActiveId(next.id);
  }

  const open = detail && activeId === detail.ticket.id ? detail : null;
  const showQueue = pane === "queue";
  const initials = agent.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className={`desk pane-${pane}`}>
      <nav className="rail" aria-label="Workspace">
        <span className="rail-mark" title="Seif. Local demo, not a NordVPN product.">
          S
        </span>
        <button type="button" className={pane === "queue" ? "is-active" : ""} aria-label="Tickets" onClick={() => setPane("queue")}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M5 6.5h14v12H5z M8 6.5V5h8v1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className={pane === "customer" && inspector === "customer" ? "is-active" : ""}
          aria-label="Customer"
          onClick={() => {
            setInspector("customer");
            setPane("customer");
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M12 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 12ZM5.5 19c1.3-2.5 3.6-3.8 6.5-3.8s5.2 1.3 6.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className={pane === "customer" && inspector === "guide" ? "is-active" : ""}
          aria-label="Guide"
          onClick={() => {
            setInspector("guide");
            setPane("customer");
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M5 5.5h6.2A2.3 2.3 0 0 1 13.5 8V19H7a2 2 0 0 1-2-2V5.5ZM19 5.5h-6.2A2.3 2.3 0 0 0 10.5 8V19H17a2 2 0 0 0 2-2V5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="rail-bottom" aria-label={`Sign out ${agent.name}`} onClick={onSignOut}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M10 7V5H5v14h5v-2 M10 12h9 M16 9l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="rail-agent" title={agent.name}>
          {initials}
        </span>
      </nav>
      <div className="side">
        {showQueue ? (
          <TicketList tickets={tickets} activeId={activeId} filter={filter} onFilter={setFilter} onSelect={openTicket} />
        ) : open ? (
          <Properties
            ticket={open.ticket}
            scenario={open.scenario}
            agents={agents}
            agent={agent}
            onStatus={(status) => mutate(() => api.updateTicket(token, open.ticket.id, { status }).then(() => undefined))}
            onPriority={(priority: Priority) =>
              mutate(() => api.updateTicket(token, open.ticket.id, { priority }).then(() => undefined))
            }
            onAssignee={(assigneeId) => mutate(() => api.updateTicket(token, open.ticket.id, { assigneeId }).then(() => undefined))}
          />
        ) : (
          <p className="empty">Select a ticket.</p>
        )}
      </div>
      {open ? (
        <div className="center">
          {error ? <p className="banner">{error}</p> : null}
          <Thread
            ticket={open.ticket}
            messages={[...open.messages, ...provisional]}
            liveDraft={liveDraft}
            onBack={() => setPane("queue")}
            onProperties={() => setPane("properties")}
            onCustomer={() => setPane("customer")}
            onNext={openNext}
          />
          <DeviceBoard
            scenarioKey={open.ticket.scenarioKey}
            platform={open.ticket.customer.platform}
            facts={open.ticket.simulation.facts ?? {}}
            resolved={open.ticket.simulation.resolved}
            busy={sending}
            pendingId={pendingAction}
            onAct={actOnDevice}
          />
          <ReplyBox
            body={body}
            draftState={draftState}
            sending={sending}
            suggestion={suggestion}
            submitAs={submitAs}
            onChange={setBody}
            onSend={send}
            onSubmitAs={setSubmitAs}
            onUseSuggestion={() => {
              if (suggestion) setBody(suggestion.draft);
            }}
          />
        </div>
      ) : (
        <div className="center empty-desk">
          {error ? <p className="banner">{error}</p> : null}
          <p>Select a ticket to read the thread.</p>
        </div>
      )}
      {open ? (
        <Sidebar
          ticket={open.ticket}
          scenario={open.scenario}
          approach={suggestion?.approach ?? null}
          tab={inspector}
          onTab={setInspector}
        />
      ) : (
        <aside className="inspector inspector-empty" />
      )}
    </div>
  );
}
