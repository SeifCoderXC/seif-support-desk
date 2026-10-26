export type DraftFrame = {
  text: string;
  deleting: boolean;
};

export type TypingStop = { cancelled: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scraps = ["ok so", "wait", "hmm", "let me try", "one second", "hold on"];

export async function hesitateUntil(done: Promise<unknown>, onFrame: (frame: DraftFrame) => void, stop: TypingStop) {
  let settled = false;
  void done.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  const started = Date.now();
  let index = 0;
  while (!stop.cancelled && (!settled || Date.now() - started < 2400)) {
    const scrap = scraps[index % scraps.length];
    index += 1;
    let text = "";
    for (const character of scrap) {
      if (stop.cancelled) return;
      text += character;
      onFrame({ text, deleting: false });
      await sleep(42 + (character.charCodeAt(0) % 28));
    }
    await sleep(320);
    while (text.length > 0 && !stop.cancelled) {
      text = text.slice(0, -1);
      onFrame({ text, deleting: true });
      await sleep(20);
    }
    if (!stop.cancelled) onFrame({ text: "", deleting: false });
    await sleep(180);
  }
}

export async function typeLines(
  lines: string[],
  onFrame: (frame: DraftFrame) => void,
  onLine: (line: string) => void,
  stop: TypingStop
) {
  for (const line of lines) {
    if (stop.cancelled) return;
    const slipAt = Math.max(6, Math.min(line.length - 1, Math.floor(line.length * 0.34)));
    const slip = line.length > 28 ? " wait" : " no";
    let text = "";
    for (let index = 0; index < line.length; index += 1) {
      if (stop.cancelled) return;
      text += line[index];
      onFrame({ text, deleting: false });
      await sleep(18 + (line.charCodeAt(index) % 22));
      if (index === slipAt) {
        for (const character of slip) {
          if (stop.cancelled) return;
          text += character;
          onFrame({ text, deleting: false });
          await sleep(34);
        }
        await sleep(260);
        for (let removed = 0; removed < slip.length && !stop.cancelled; removed += 1) {
          text = text.slice(0, -1);
          onFrame({ text, deleting: true });
          await sleep(16);
        }
      }
    }
    if (stop.cancelled) return;
    await sleep(420);
    onLine(line);
    onFrame({ text: "", deleting: false });
    await sleep(360);
  }
}
