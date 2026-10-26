import { labelOf } from "../format";
import type { Status, Suggestion } from "../types";

const statuses: Status[] = ["open", "pending", "resolved"];

export function ReplyBox({
  body,
  draftState,
  sending,
  suggestion,
  submitAs,
  onChange,
  onSend,
  onUseSuggestion,
  onSubmitAs,
}: {
  body: string;
  draftState: "idle" | "saving" | "saved" | "error";
  sending: boolean;
  suggestion: Suggestion | null;
  submitAs: Status;
  onChange: (body: string) => void;
  onSend: () => void;
  onUseSuggestion: () => void;
  onSubmitAs: (status: Status) => void;
}) {
  const draftLabel =
    draftState === "saving" ? "Saving draft…" : draftState === "saved" ? "Draft saved" : draftState === "error" ? "Draft not saved" : "Draft";

  return (
    <div className="composer">
      {suggestion ? (
        <section className="assist" aria-label="Auto assist">
          <header>
            <h3>Auto assist</h3>
            <span>{suggestion.approach?.name ?? "Case guide"}</span>
          </header>
          {suggestion.approach ? (
            <p className="approach-note">
              {suggestion.approach.framing} {suggestion.approach.basis}
            </p>
          ) : null}
          <pre>{suggestion.draft}</pre>
          <div className="assist-action">
            <span>Action: Change status to Solved once the fix is confirmed</span>
            <button type="button" onClick={onUseSuggestion}>
              Apply macro
            </button>
          </div>
        </section>
      ) : null}
      <label className="sr" htmlFor="reply-body">
        Reply
      </label>
      <textarea
        id="reply-body"
        value={body}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={5000}
        placeholder="Or say it in your own words. They will try it on the device above."
      />
      <div className="composer-bar">
        <span role="status">{draftLabel}</span>
        <div className="submit-group">
          <label>
            Submit as
            <select value={submitAs} onChange={(event) => onSubmitAs(event.target.value as Status)}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {labelOf(status)}
                </option>
              ))}
            </select>
          </label>
          <button id="send-reply" type="button" onClick={onSend} disabled={sending || body.trim().length === 0}>
            {sending ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
