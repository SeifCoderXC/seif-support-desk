export type Facts = Record<string, boolean | string>;

export type Simulation = {
  resolved: boolean;
  outcome: string | null;
  situation: string;
  facts: Facts;
};

export type CustomerTurn = {
  simulation: Simulation;
  replies: string[];
  /** False when the message did not name a step this case understands. */
  matched: boolean;
};

const openings: Record<string, { situation: string; facts: Facts }> = {
  "kill-switch-split-tunnel": {
    situation: "VPN shows connected. No internet. Internet Kill Switch is on, and Chrome is excluded.",
    facts: { killSwitch: true, splitTunnel: true, reconnected: false, protocol: "NordLynx" },
  },
  "login-429-mfa": {
    situation: "Nord Account shows Error 429. An authenticator app is on. They have been retrying.",
    facts: { error429: true, waited: false, clockOk: false, signedIn: false },
  },
  "website-will-not-load": {
    situation: "The bank site loads only while the VPN is paused. Custom DNS and Real-time protection are still on.",
    facts: { pausedTested: true, customDns: true, protection: true, siteLoads: false },
  },
  "session-limit": {
    situation: "Three devices are signed in. Quick Connect was tapped several times. The app is asking for a 10-minute wait.",
    facts: { deviceCount: "3", waited: false, connected: false },
  },
  "refund-boundary": {
    situation: "First purchase was 1 Sep 2025. The plan renewed on 11 Oct 2026. There is no Refund button.",
    facts: { explained: false, cancelOffered: false, falsePromise: false },
  },
};

const accountDefaults: Facts = { accountActive: true, autoRenew: true, planCancelled: false };

export function initialSimulation(scenarioKey: string): Simulation {
  const opening = openings[scenarioKey];
  return {
    resolved: false,
    outcome: null,
    situation: opening?.situation ?? "Customer is online.",
    facts: { ...accountDefaults, ...(opening?.facts ?? {}) },
  };
}

export function readSimulation(scenarioKey: string, raw: unknown): Simulation {
  const initial = initialSimulation(scenarioKey);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return initial;
  const record = raw as Partial<Simulation>;
  const facts = record.facts && typeof record.facts === "object" && !Array.isArray(record.facts) ? record.facts : {};
  return {
    resolved: record.resolved === true,
    outcome: typeof record.outcome === "string" ? record.outcome : null,
    situation: typeof record.situation === "string" ? record.situation : initial.situation,
    facts: { ...accountDefaults, ...initial.facts, ...facts },
  };
}

export function customerResponds(scenarioKey: string, current: Simulation, agentMessage: string): CustomerTurn {
  const text = agentMessage.toLowerCase();
  const facts: Facts = { ...accountDefaults, ...current.facts };
  const accountNote = scenarioKey === "refund-boundary" ? null : applyAccount(facts, text);
  const handler = handlers[scenarioKey];
  if (!handler) {
    return {
      simulation: { ...current, facts },
      replies: ["I'm here. Tell me the next thing to try and I'll do it on the app."],
      matched: false,
    };
  }
  const turn = handler(facts, text);
  if (accountNote && turn.matched) return withNote(turn, accountNote);
  if (accountNote && !turn.matched) {
    const held = holdState(scenarioKey, facts);
    return reply(
      facts,
      held.resolved,
      held.outcome,
      [accountNote, symptomLine(scenarioKey, facts)],
      held.situation,
      true
    );
  }
  if (!turn.matched && (bareFixClaim(text) || current.resolved)) return inspect(scenarioKey, facts);
  return turn;
}

function bareFixClaim(text: string): boolean {
  return /\b(i (?:have |'ve )?(?:fixed|solved)|it(?:'s| is) (?:all )?fixed|should be (?:fixed|working now)|that fixes it|i resolved it|it is working now|all good now)\b/.test(
    text
  );
}

function applyAccount(facts: Facts, text: string): string | null {
  const activate = /activate (?:the |their )?(?:account|subscription)/.test(text);
  const cancelPlan = /cancel (?:the |their )?(?:plan|subscription)/.test(text);
  const cancelRenew = /cancel auto-renew/.test(text);
  if (!activate && !cancelPlan && !cancelRenew) return null;
  if (activate && !cancelPlan) {
    if (facts.planCancelled === true || facts.accountActive === false) {
      facts.accountActive = true;
      facts.planCancelled = false;
      facts.autoRenew = true;
      return "I activated the account. The subscription is active again and auto-renewal is back on.";
    }
    return "I checked the account. It is already active, so activating it again changes nothing.";
  }
  if (cancelPlan) {
    facts.planCancelled = true;
    facts.accountActive = false;
    facts.autoRenew = false;
    return "I cancelled the plan. The subscription is off and it will not renew.";
  }
  facts.autoRenew = false;
  return "I cancelled auto-renewal. The account stays active until this period ends, and it will not renew.";
}

function withNote(turn: CustomerTurn, note: string): CustomerTurn {
  const replies = [...turn.replies];
  if (replies.length < 2) replies.push(note);
  else replies[1] = `${replies[1]} ${note}`;
  return { ...turn, replies };
}

const handlers: Record<string, (facts: Facts, text: string) => CustomerTurn> = {
  "kill-switch-split-tunnel": respondKillSwitch,
  "login-429-mfa": respondLogin,
  "website-will-not-load": respondWebsite,
  "session-limit": respondSession,
  "refund-boundary": respondRefund,
};

function respondKillSwitch(facts: Facts, text: string): CustomerTurn {
  const asked =
    /operating system|kill switch|split tunnel|which apps|bypass|excluded/.test(text) &&
    !/turn split|split tunneling off|disable split|connect once|reconnect/.test(text);
  const splitOff = /turn split tunneling off|split tunneling off|disable split|turn off split|clear the allowlist|stop excluding|remove the exclusion|exclusion list|out of the exclusion|take chrome out|take chrome off|remove chrome/.test(
    text
  );
  const reconnect = /connect once|disconnect and connect|reconnect/.test(text);
  const killOff = /kill switch off|disable (?:the )?(?:internet )?kill switch|turn (?:the )?(?:internet )?kill switch off/.test(text);
  const killOn = /turn (?:the )?(?:internet )?kill switch back on/.test(text);
  const protocolAsked = /switch to openvpn|try openvpn/.test(text);
  const protocolOnlyIfStillBroken = /if there is still no internet/.test(text);

  if (splitOff) facts.splitTunnel = false;
  if (killOff) facts.killSwitch = false;
  else if (killOn) facts.killSwitch = true;
  if (reconnect) facts.reconnected = true;

  const protectedFix = facts.splitTunnel === false && facts.killSwitch === true && facts.reconnected === true;
  const applyProtocol = protocolAsked && !(protocolOnlyIfStillBroken && protectedFix);
  if (applyProtocol) facts.protocol = "OpenVPN";

  if (!asked && !splitOff && !reconnect && !killOff && !killOn && !applyProtocol) {
    return reply(facts, false, null, [
      "I don't want to press the wrong control. Should I turn off split tunneling, turn off Kill Switch, or switch the protocol?",
    ], "Waiting for a specific setting to change.", false);
  }

  if (asked && !splitOff && !reconnect && !killOff && !killOn && !applyProtocol) {
    return reply(facts, false, null, [
      "Windows 11. Internet Kill Switch is on. Chrome is excluded with split tunneling, and Edge has no internet either.",
    ], "Customer confirmed Kill Switch is on and Chrome is excluded.");
  }

  const did: string[] = [];
  if (splitOff) did.push("turned split tunneling off, so Chrome is no longer excluded");
  if (killOff) did.push("turned Internet Kill Switch off");
  if (killOn && !killOff) did.push("turned Internet Kill Switch back on");
  if (applyProtocol) did.push("switched the protocol to OpenVPN");
  if (reconnect) did.push("disconnected and connected once");

  if (protectedFix) {
    return reply(
      facts,
      true,
      "Internet restored with Kill Switch still on.",
      [
        "Doing that now.",
        `I ${did.join(", ")}. A normal website loads, and Kill Switch is still on. That fixed it.`,
      ],
      "Internet works. Split tunneling is off. Kill Switch stayed on."
    );
  }
  if (facts.killSwitch === false && facts.reconnected === true) {
    return reply(facts, false, null, [
      "Doing that now.",
      `I ${did.join(", ")}. Websites load, but only because Kill Switch is off. I don't want to leave it that way. What should I change so I can turn it back on?`,
    ], "Internet is back only while Kill Switch is off.");
  }
  if (facts.splitTunnel === false && facts.reconnected !== true) {
    return reply(facts, false, null, [
      `I ${did.join(", ")}. I have not connected again yet. Should I disconnect and connect once?`,
    ], "Split tunneling is off. The VPN has not been reconnected.");
  }
  return reply(facts, false, null, [
    "Doing that now.",
    `I ${did.join(", ")}. There is still no internet. Kill Switch is on, and Chrome is still excluded.`,
  ], "Still no internet. The split-tunnel exclusion is still in place.");
}

function respondLogin(facts: Facts, text: string): CustomerTurn {
  const wait = /wait 30 minutes|wait thirty minutes|wait half an hour/.test(text);
  const clock = /automatic date and time|date and time|check the clock|phone clock/.test(text);
  const code = /new code|authenticator|backup code|verification code|mfa/.test(text);
  const disableMfa = /turn off mfa|disable mfa|turn off the authenticator|disable the authenticator/.test(text);
  const keepRetrying = /keep (?:tapping|trying|signing)|try again right now/.test(text) && !wait;

  if (disableMfa) {
    return reply(facts, false, null, [
      "I don't want to turn MFA off. I still have the authenticator app. Can we get in without disabling it?",
    ], "Customer will not turn MFA off.");
  }
  if (keepRetrying) {
    facts.waited = false;
    facts.error429 = true;
    return reply(facts, false, null, [
      "I tried signing in again just now. It still says Error 429 Too Many Requests.",
    ], "Another sign-in attempt kept Error 429 in place.");
  }
  if (wait) {
    facts.waited = true;
    facts.error429 = false;
  }
  if (clock) facts.clockOk = true;
  const canFinish = facts.waited === true && facts.clockOk === true && code;
  if (canFinish) facts.signedIn = true;

  if (!wait && !clock && !code) {
    return reply(facts, false, null, [
      "I'm on the sign-in page. Tell me whether to wait, change the phone time, or enter an authenticator code.",
    ], "Customer is waiting on the sign-in page.", false);
  }
  if (facts.signedIn === true) {
    return reply(
      facts,
      true,
      "Signed in after the wait, a correct clock, and a new MFA code.",
      [
        "Okay, I'll do it once and then stop.",
        "I waited 30 minutes, turned on automatic date and time, and entered a new authenticator code. I'm signed in.",
      ],
      "Signed in. Error 429 is gone."
    );
  }
  if (facts.error429 === true) {
    return reply(facts, false, null, [
      "I still can't reach the authenticator code. Nord Account only shows Error 429.",
    ], "Error 429 is still blocking sign-in.");
  }
  if (facts.waited === true && facts.clockOk !== true) {
    return reply(facts, false, null, [
      "The 429 is gone after the wait. The authenticator code is rejected, and my phone time is set manually.",
    ], "Past Error 429. The authenticator code fails because the clock is manual.");
  }
  return reply(facts, false, null, [
    "I waited, and the clock is set to automatic. It is asking for the authenticator code now. Should I enter a new one?",
  ], "Waiting at the MFA prompt.");
}

function respondWebsite(facts: Facts, text: string): CustomerTurn {
  const pause = /pause the vpn|while it is paused|with the vpn off/.test(text);
  const dnsOff = /turn off custom dns|custom dns off|disable custom dns/.test(text);
  const protectionOff = /turn off real-time protection|real-time protection off|disable real-time protection|turn off threat protection|disable threat protection/.test(text);
  const restoreProtection = /turn protection back on/.test(text);
  const restoreOnlyIfFailed = /if the site still failed/.test(text);
  const protocol = /different country|switch to openvpn|try nordlynx|try openvpn/.test(text);
  const protocolOnlyIfFailed = /if it still fails/.test(text);

  if (pause) facts.pausedTested = true;
  if (dnsOff) facts.customDns = false;
  if (protectionOff) facts.protection = false;
  const loads = facts.protection === false;
  if (restoreProtection && !(restoreOnlyIfFailed && loads)) {
    facts.protection = true;
  }
  facts.siteLoads = facts.protection === false;
  const changedProtocol = protocol && !(protocolOnlyIfFailed && facts.siteLoads === true);

  const didSomething = pause || dnsOff || protectionOff || changedProtocol || restoreProtection;
  if (!didSomething) {
    return reply(facts, false, null, [
      facts.pausedTested === true
        ? "It loads while the VPN is paused and fails when I connect. Real-time protection is still on. What should I turn off?"
        : "Tell me what to change. I can pause the VPN, turn off Custom DNS, or turn off Real-time protection.",
    ], "Bank site still fails on the VPN.", false);
  }

  if (facts.siteLoads === true) {
    return reply(
      facts,
      true,
      "Bank site loads on the VPN with Real-time protection off.",
      [
        "Trying that now.",
        "The bank site loads with the VPN connected after I turned Real-time protection off. I left it off, because turning it back on is what blocks the site. Custom DNS is " +
          (facts.customDns === true ? "still on." : "off as well."),
      ],
      "Fixed. Real-time protection was blocking the site."
    );
  }

  const notes: string[] = [];
  if (facts.pausedTested === true) notes.push("it loads while the VPN is paused and fails again when I connect");
  if (facts.customDns === false) notes.push("Custom DNS is off");
  if (changedProtocol) notes.push("I also tried another server");
  return reply(facts, false, null, [
    "Trying that now.",
    `I checked. ${notes.join(", ").replace(/^./, (letter) => letter.toUpperCase())}. Real-time protection is still on, and the bank site still fails on the VPN.`,
  ], "Still blocked on the VPN. Real-time protection is on.");
}

function respondSession(facts: Facts, text: string): CustomerTurn {
  const atLimit = facts.deviceCount === "10";
  const disconnect = /disconnect|sign out/.test(text);
  const disconnectOnlyAtLimit = /if you are at that limit/.test(text);
  const wait = /wait 10 minutes|wait ten minutes|wait the full 10/.test(text);
  const spam = /keep (?:tapping|pressing)|again and again/.test(text);
  const connectOnce = /connect once|then connect|single quick connect|one quick connect/.test(text);

  if (disconnect && !(disconnectOnlyAtLimit && !atLimit)) facts.disconnected = true;
  if (spam) facts.waited = false;
  else if (wait) facts.waited = true;
  if (connectOnce && facts.waited === true && !spam) facts.connected = true;

  if (!disconnect && !wait && !connectOnce && !spam) {
    return reply(facts, false, null, [
      "Quick Connect still does nothing. I have this phone, my laptop, and the router at home signed in. What should I do, and should I wait?",
    ], "Still blocked by the session warning.", false);
  }
  if (facts.connected === true) {
    return reply(
      facts,
      true,
      "Connected once after a clean 10-minute wait.",
      [
        "All right. I won't tap it again.",
        facts.disconnected === true
          ? "I signed out on the laptop, waited 10 minutes without pressing Quick Connect, then connected once. The phone is connected."
          : "I counted three devices, which is under 10, so I left the laptop and router signed in. I waited 10 minutes without pressing Quick Connect, then connected once. The phone is connected.",
      ],
      "VPN is connected after one clean attempt."
    );
  }
  if (spam) {
    return reply(facts, false, null, [
      "I pressed Quick Connect a few more times. The warning is still there, and it still tells me to wait.",
    ], "More Quick Connect taps extended the wait.");
  }
  if (facts.waited !== true) {
    return reply(facts, false, null, [
      facts.disconnected === true
        ? "I signed out on the laptop and tried to connect. The warning is still there. It says to wait 10 minutes."
        : "I haven't waited the 10 minutes yet. If I connect now, I think the warning will stay.",
    ], "The 10-minute wait has not happened yet.");
  }
  return reply(facts, false, null, [
    "I waited 10 minutes. Do you want me to connect once now, or should I keep waiting?",
  ], "The wait is over. The customer has not connected again.");
}

function respondRefund(facts: Facts, text: string): CustomerTurn {
  const explained = /first purchase only|renewal is outside|30-day guarantee|cannot apply the 30-day|does not cover a renewal|doesn't cover a renewal/.test(
    text
  );
  const activate = /activate (?:the |their )?(?:account|subscription)/.test(text);
  const cancelPlan = /cancel (?:the |their )?(?:plan|subscription)/.test(text);
  const cancel = /cancel auto-renew/.test(text) || cancelPlan;
  const conditionalLink = /if the first purchase is still inside 30 days/.test(text);
  const sendsLink = /send the verification link|send you the refund/.test(text);
  const directRefund = /refund this renewal|refund your renewal|i(?: will|'ll) refund|refund has been|issue a refund|process the refund/.test(
    text
  );
  const matched = explained || cancel || directRefund || sendsLink || activate;
  if (explained) facts.explained = true;
  if (cancel) {
    facts.cancelOffered = true;
    facts.autoRenew = false;
    if (cancelPlan) {
      facts.planCancelled = true;
      facts.accountActive = false;
    }
  }
  if (directRefund || (sendsLink && !conditionalLink)) facts.falsePromise = true;
  if (activate && !explained && !cancel && !directRefund && !sendsLink) {
    facts.accountActive = facts.accountActive === false ? true : true;
    return reply(
      facts,
      false,
      null,
      [
        "I checked. The account is already active, so there is nothing to activate. The 11 October renewal still has no Refund button.",
      ],
      "Account is active. The renewal is still outside the guarantee.",
      true
    );
  }

  if (facts.falsePromise === true) {
    return reply(facts, false, null, [
      "I still don't see a Refund button on the 11 October renewal. The first purchase was 1 September 2025. Can you look again before anything is sent?",
    ], "A refund was offered, but this renewal is outside the guarantee.", matched);
  }
  if (facts.explained === true && facts.cancelOffered === true) {
    return reply(
      facts,
      true,
      "Auto-renewal will be cancelled. The renewal was not refunded.",
      [
        "Thank you for checking. Please cancel auto-renewal. I understand the 30-day guarantee does not cover the renewal on 11 October.",
      ],
      "Handled. Refund declined, auto-renewal cancelled.",
      matched
    );
  }
  if (facts.cancelOffered === true && facts.explained !== true) {
    return reply(
      facts,
      false,
      null,
      [
        cancelPlan
          ? "I cancelled the plan, so it will not renew. There is still no Refund button on the 11 October charge. Does the 30-day guarantee cover that payment or not?"
          : "I cancelled auto-renewal, so it will not charge next year. There is still no Refund button on the 11 October renewal. Does the 30-day guarantee cover that charge or not?",
      ],
      "Renewal will not repeat. The current charge is still unexplained.",
      true
    );
  }
  if (facts.explained === true) {
    return reply(facts, false, null, [
      "All right, if this renewal isn't covered, can you cancel auto-renewal so it doesn't charge me next year?",
    ], "Customer understands the refund boundary and wants auto-renewal cancelled.", matched);
  }
  return reply(facts, false, null, [
    "The renewal was two weeks ago and there is no Refund button. Does the 30-day guarantee cover it or not?",
  ], "Customer is waiting to hear whether the renewal can be refunded.", matched);
}

function inspect(scenarioKey: string, facts: Facts): CustomerTurn {
  const held = holdState(scenarioKey, facts);
  return reply(facts, held.resolved, held.outcome, checkedLines(scenarioKey, facts), held.situation, true);
}

function holdState(scenarioKey: string, facts: Facts): { resolved: boolean; outcome: string | null; situation: string } {
  if (scenarioKey === "kill-switch-split-tunnel") {
    if (facts.splitTunnel === false && facts.killSwitch === true && facts.reconnected === true) {
      return { resolved: true, outcome: "Internet restored with Kill Switch still on.", situation: "Internet works. Split tunneling is off. Kill Switch stayed on." };
    }
    if (facts.killSwitch === false && facts.reconnected === true) {
      return { resolved: false, outcome: null, situation: "Internet is back only while Kill Switch is off." };
    }
    return { resolved: false, outcome: null, situation: "Still no internet. Chrome is still outside the tunnel." };
  }
  if (scenarioKey === "login-429-mfa") {
    if (facts.signedIn === true) {
      return { resolved: true, outcome: "Signed in after the wait, a correct clock, and a new MFA code.", situation: "Signed in. Error 429 is gone." };
    }
    return { resolved: false, outcome: null, situation: "Sign-in is still blocked." };
  }
  if (scenarioKey === "website-will-not-load") {
    if (facts.siteLoads === true) {
      return { resolved: true, outcome: "Bank site loads on the VPN with Real-time protection off.", situation: "Fixed. Real-time protection was blocking the site." };
    }
    return { resolved: false, outcome: null, situation: "The bank site still fails on the VPN." };
  }
  if (scenarioKey === "session-limit") {
    if (facts.connected === true) {
      return { resolved: true, outcome: "Connected once after a clean 10-minute wait.", situation: "VPN is connected after one clean attempt." };
    }
    return { resolved: false, outcome: null, situation: "The session warning is still up." };
  }
  if (facts.falsePromise === true) {
    return { resolved: false, outcome: null, situation: "A refund was offered, but this renewal is outside the guarantee." };
  }
  if (facts.explained === true && facts.cancelOffered === true) {
    return { resolved: true, outcome: "Auto-renewal will be cancelled. The renewal was not refunded.", situation: "Handled. Refund declined, auto-renewal cancelled." };
  }
  return { resolved: false, outcome: null, situation: "The renewal is still not settled." };
}

function checkedLines(scenarioKey: string, facts: Facts): string[] {
  if (scenarioKey === "kill-switch-split-tunnel") {
    if (facts.splitTunnel === false && facts.killSwitch === true && facts.reconnected === true) {
      return ["I checked the app again. A normal website loads, Chrome is no longer excluded, and Internet Kill Switch is still on. That is why it works."];
    }
    if (facts.killSwitch === false && facts.reconnected === true) {
      return ["I checked. Websites load only because Internet Kill Switch is off, and Chrome is still excluded. I do not want to leave Kill Switch off."];
    }
    if (facts.killSwitch === false) {
      return ["I checked. Internet Kill Switch is off, but that session has not been reconnected, and Chrome is still excluded. There is still no internet."];
    }
    if (facts.splitTunnel === false) {
      return ["I checked. Split tunneling is off, but the old VPN session is still up, so there is still no internet. I have not connected again yet."];
    }
    return ["I checked the Windows app. Chrome is still excluded, Internet Kill Switch is still on, and a normal website still does not load. Saying it is fixed did not change those settings."];
  }
  if (scenarioKey === "login-429-mfa") {
    if (facts.signedIn === true) {
      return ["I checked. I am signed in. The 429 is gone, the phone time is automatic, and the new authenticator code worked."];
    }
    if (facts.error429 === true) {
      return ["I checked Nord Account. It still shows Error 429, so the authenticator screen never opened. A message that it is fixed does not clear that limit."];
    }
    if (facts.clockOk !== true) {
      return ["I checked. The 429 is gone, but the authenticator code is still rejected because the phone time is set manually."];
    }
    return ["I checked. The clock is automatic and the 429 is gone. It is asking for a new authenticator code, and I have not entered one."];
  }
  if (scenarioKey === "website-will-not-load") {
    if (facts.siteLoads === true) {
      return ["I checked the bank site with the VPN connected. It loads because Real-time protection is off. That is the setting that was blocking it."];
    }
    return ["I checked in the browser. The bank site still fails while the VPN is connected, and Real-time protection is still on. Saying it is fixed did not turn that shield off."];
  }
  if (scenarioKey === "session-limit") {
    if (facts.connected === true) {
      return ["I checked the iPhone. It is connected. I had waited 10 minutes without Quick Connect, then connected once."];
    }
    if (facts.waited === true) {
      return ["I checked. The 10 minutes have passed and the phone is not connected yet. I have not pressed Quick Connect again."];
    }
    return ["I checked the iPhone. The session warning is still there and it is not connected. Three devices are signed in, which is under 10, so the limit is the repeated Quick Connect taps."];
  }
  if (facts.explained === true && facts.cancelOffered === true && facts.falsePromise !== true) {
    return ["I checked billing. Auto-renewal is cancelled and the 11 October renewal was not refunded, because the 30-day guarantee is first purchase only."];
  }
  return ["I checked billing. The account is active. The first purchase was 1 September 2025, and the 11 October 2026 renewal has no Refund button. That charge is outside the 30-day guarantee."];
}

function symptomLine(scenarioKey: string, facts: Facts): string {
  return checkedLines(scenarioKey, facts)[0];
}

function reply(
  facts: Facts,
  resolved: boolean,
  outcome: string | null,
  replies: string[],
  situation: string,
  matched = true
): CustomerTurn {
  return {
    simulation: {
      resolved,
      outcome,
      situation,
      facts,
    },
    replies,
    matched,
  };
}
