export type DeviceFacts = Record<string, boolean | string | undefined>;

export type DeviceControl = {
  id: string;
  label: string;
  read: (facts: DeviceFacts) => string;
  phrase: string | null;
  ask: string;
  risky?: boolean;
};

export type DeviceScreen = {
  title: string;
  blurb: string;
  diagnosis: string;
  controls: DeviceControl[];
};

type ScreenTemplate = Omit<DeviceScreen, "diagnosis">;

function onOff(value: boolean | string | undefined, onLabel = "On", offLabel = "Off") {
  return value === true ? onLabel : offLabel;
}

const screens: Record<string, ScreenTemplate> = {
  "kill-switch-split-tunnel": {
    title: "NordVPN on Windows",
    blurb: "This is their app. Change one setting, then wait while they try it.",
    controls: [
      {
        id: "split",
        label: "Split tunneling",
        read: (facts) => (facts.splitTunnel === true ? "On · Chrome excluded" : "Off · nothing excluded"),
        phrase: "Turn split tunneling off. Take Chrome out of the exclusion list.",
        ask: "Take Chrome off the list",
      },
      {
        id: "kill",
        label: "Internet Kill Switch",
        read: (facts) => onOff(facts.killSwitch),
        phrase: "Turn the Internet Kill Switch off.",
        ask: "Turn Kill Switch off",
        risky: true,
      },
      {
        id: "reconnect",
        label: "VPN session",
        read: (facts) => (facts.reconnected === true ? "Disconnected and connected once" : "Still the old session"),
        phrase: "Disconnect and connect once.",
        ask: "Reconnect once",
      },
      {
        id: "protocol",
        label: "Protocol",
        read: (facts) => String(facts.protocol ?? "NordLynx"),
        phrase: "Switch to OpenVPN.",
        ask: "Switch to OpenVPN",
        risky: true,
      },
    ],
  },
  "login-429-mfa": {
    title: "Nord Account on Android",
    blurb: "Their sign-in screen. The authenticator is useless while Error 429 is up.",
    controls: [
      {
        id: "wait",
        label: "Sign-in limit",
        read: (facts) => (facts.error429 === true ? "Error 429 · too many attempts" : "429 has cleared"),
        phrase: "Wait 30 minutes before the next sign-in.",
        ask: "Wait 30 minutes",
      },
      {
        id: "clock",
        label: "Date and time",
        read: (facts) => (facts.clockOk === true ? "Automatic" : "Set manually"),
        phrase: "Turn on automatic date and time.",
        ask: "Set clock to automatic",
      },
      {
        id: "code",
        label: "Authenticator",
        read: (facts) => (facts.signedIn === true ? "Signed in" : "Waiting for a fresh code"),
        phrase: "Enter a new authenticator code.",
        ask: "Enter a new code",
      },
      {
        id: "retry",
        label: "Try again now",
        read: () => "Another attempt restarts the limit",
        phrase: "Keep trying right now.",
        ask: "Try again now",
        risky: true,
      },
      {
        id: "mfa",
        label: "MFA",
        read: () => "Authenticator stays on",
        phrase: "Turn off MFA.",
        ask: "Turn MFA off",
        risky: true,
      },
    ],
  },
  "website-will-not-load": {
    title: "NordVPN on Mac",
    blurb: "Their connection screen. The bank site fails only while the VPN is up.",
    controls: [
      {
        id: "pause",
        label: "VPN",
        read: (facts) => (facts.pausedTested === true ? "Connected · pause already tried" : "Connected"),
        phrase: "Pause the VPN and tell me if the site loads while it is paused.",
        ask: "Pause the VPN",
      },
      {
        id: "dns",
        label: "Custom DNS",
        read: (facts) => onOff(facts.customDns),
        phrase: "Turn off Custom DNS.",
        ask: "Turn Custom DNS off",
      },
      {
        id: "protection",
        label: "Real-time protection",
        read: (facts) => (facts.protection === false ? "Off" : "On"),
        phrase: "Turn off Real-time protection.",
        ask: "Turn protection off",
      },
      {
        id: "restore",
        label: "Protection again",
        read: (facts) => (facts.siteLoads === true ? "Site loads on the VPN" : "Site still fails on the VPN"),
        phrase: "Turn protection back on.",
        ask: "Turn protection on",
        risky: true,
      },
      {
        id: "country",
        label: "Server",
        read: () => "Current country",
        phrase: "Try a different country.",
        ask: "Change country",
        risky: true,
      },
    ],
  },
  "session-limit": {
    title: "NordVPN on iPhone",
    blurb: "Quick Connect is refusing. Extra taps extend the wait.",
    controls: [
      {
        id: "devices",
        label: "Devices signed in",
        read: (facts) => `${facts.deviceCount ?? "3"} of 10`,
        phrase: null,
        ask: "",
      },
      {
        id: "wait",
        label: "Cooldown",
        read: (facts) => (facts.waited === true ? "10 minutes passed" : "Wait has not finished"),
        phrase: "Wait 10 minutes without Quick Connect.",
        ask: "Wait 10 minutes",
      },
      {
        id: "connect",
        label: "Quick Connect",
        read: (facts) => (facts.connected === true ? "Connected" : "Not connected"),
        phrase: "Then connect once.",
        ask: "Connect once",
      },
      {
        id: "signout",
        label: "Other devices",
        read: (facts) => (facts.disconnected === true ? "Laptop signed out" : "Laptop and router still signed in"),
        phrase: "Sign out of an unused device.",
        ask: "Sign out a device",
      },
      {
        id: "spam",
        label: "Tap again",
        read: () => "More taps reset the timer",
        phrase: "Keep tapping Quick Connect again and again.",
        ask: "Tap Quick Connect again",
        risky: true,
      },
    ],
  },
  "refund-boundary": {
    title: "Nord Account billing",
    blurb: "There is no Refund button on this renewal. Saying you will refund it does not create one.",
    controls: [
      {
        id: "first",
        label: "First purchase",
        read: () => "1 Sep 2025 · nordvpn.com",
        phrase: null,
        ask: "",
      },
      {
        id: "renewal",
        label: "Latest charge",
        read: () => "Renewal · 11 Oct 2026",
        phrase: null,
        ask: "",
      },
      {
        id: "button",
        label: "Refund button",
        read: () => "Not on this payment",
        phrase: null,
        ask: "",
      },
      {
        id: "explain",
        label: "Guarantee",
        read: (facts) => (facts.explained === true ? "Told them it is first purchase only" : "Not explained yet"),
        phrase: "The 30-day guarantee is first purchase only. A renewal is outside that window.",
        ask: "Explain the guarantee",
      },
      {
        id: "cancel",
        label: "Auto-renewal",
        read: (facts) => (facts.cancelOffered === true ? "Cancellation offered" : "Still set to renew"),
        phrase: "I can cancel auto-renewal.",
        ask: "Cancel auto-renewal",
      },
      {
        id: "promise",
        label: "Send a refund",
        read: (facts) => (facts.falsePromise === true ? "A refund was promised" : "No refund sent"),
        phrase: "I will refund this renewal.",
        ask: "Promise a refund",
        risky: true,
      },
    ],
  },
};

export function screenFor(scenarioKey: string, facts: DeviceFacts): DeviceScreen {
  const screen = screens[scenarioKey] ?? {
    title: "Customer device",
    blurb: "Ask for one change at a time.",
    controls: [],
  };
  const tuned = screen.controls.map((control) => tune(scenarioKey, control, facts));
  const extras = accountControls(scenarioKey).filter((control) => {
    if (tuned.some((existing) => existing.id === control.id)) return false;
    if (scenarioKey === "refund-boundary" && control.id === "auto-renew") return false;
    return true;
  });
  return {
    ...screen,
    diagnosis: diagnosis(scenarioKey, facts),
    controls: [...tuned, ...extras],
  };
}

function accountControls(scenarioKey: string): DeviceControl[] {
  const billing = scenarioKey === "refund-boundary";
  return [
    {
      id: "account",
      label: "Account",
      read: (facts) => (facts.planCancelled === true || facts.accountActive === false ? "Not active" : "Active"),
      phrase: "Activate the account.",
      ask: "Activate account",
    },
    {
      id: "cancel-plan",
      label: "Plan",
      read: (facts) => (facts.planCancelled === true ? "Cancelled" : "Active"),
      phrase: "Cancel the plan.",
      ask: "Cancel plan",
      risky: !billing,
    },
    {
      id: "auto-renew",
      label: "Auto-renewal",
      read: (facts) => (facts.autoRenew === false ? "Will not renew" : "Will renew"),
      phrase: "Cancel auto-renewal.",
      ask: "Cancel auto-renewal",
      risky: !billing,
    },
  ];
}

export function reasonFor(scenarioKey: string, id: string, facts: DeviceFacts): string {
  if (id === "account") {
    return facts.planCancelled === true || facts.accountActive === false
      ? "The subscription is off. Activating it restores the plan. It does not by itself change the VPN fault."
      : "The account is already active. Activating it again does not touch Kill Switch, DNS, sign-in, or the renewal.";
  }
  if (id === "cancel-plan") {
    return scenarioKey === "refund-boundary"
      ? "This ends the subscription. It does not refund the 11 October renewal."
      : "Cancelling the plan stops billing. The broken setting stays exactly as it is.";
  }
  if (id === "auto-renew" || id === "cancel") {
    return scenarioKey === "refund-boundary"
      ? "Stops the next charge. The current renewal stays outside the 30-day guarantee."
      : "Stops the next charge. The connection the customer has right now does not change.";
  }
  if (scenarioKey === "kill-switch-split-tunnel" && id === "split") {
    return facts.splitTunnel === false
      ? "Chrome is back inside the tunnel."
      : "Chrome is outside the tunnel. Kill Switch blocks anything that bypasses it, which is why the app says Connected and sites fail.";
  }
  if (scenarioKey === "kill-switch-split-tunnel" && id === "kill") {
    return facts.killSwitch === false
      ? "Kill Switch is off, so traffic can leak. Turning it back on is safe only after Chrome is no longer excluded."
      : "Leave this on. Turning it off makes sites load by dropping the protection, which is not the repair.";
  }
  if (scenarioKey === "kill-switch-split-tunnel" && id === "reconnect") {
    return facts.splitTunnel === true
      ? "A fresh connection still blocks Chrome while it remains excluded."
      : "One disconnect and connect applies the exclusion change. Do this after Chrome is off the list.";
  }
  if (scenarioKey === "kill-switch-split-tunnel" && id === "protocol") {
    return "OpenVPN does not help while Chrome is excluded. Protocol is a later check.";
  }
  if (scenarioKey === "login-429-mfa" && id === "wait") {
    return facts.error429 === true
      ? "Error 429 is a rate limit. Another code or another tap keeps it in place. The wait is 30 minutes."
      : "The limit has cleared. More sign-in attempts before the clock and one code can bring it back.";
  }
  if (scenarioKey === "login-429-mfa" && id === "clock") {
    return "An authenticator rejects a code when the phone clock is manual, even after the 429 is gone.";
  }
  if (scenarioKey === "login-429-mfa" && id === "code") {
    return facts.error429 === true
      ? "The authenticator screen is not reachable while Error 429 is showing."
      : "One new code, after the wait and automatic time, is the sign-in. Do not turn MFA off.";
  }
  if (scenarioKey === "login-429-mfa" && id === "retry") return "Trying again now resets the 30-minute limit.";
  if (scenarioKey === "login-429-mfa" && id === "mfa") return "They still have the authenticator. They will refuse to disable MFA.";
  if (scenarioKey === "website-will-not-load" && id === "pause") {
    return "They already paused it. The bank site loads only while the VPN is off, so the block is on the VPN path.";
  }
  if (scenarioKey === "website-will-not-load" && id === "dns") {
    return facts.customDns === false
      ? "Custom DNS is already off. The site still depends on Real-time protection."
      : "Custom DNS is on, but the site fails because of the shield, not because of DNS.";
  }
  if (scenarioKey === "website-will-not-load" && id === "protection") {
    return "Real-time protection is what stops this bank site while the VPN is connected.";
  }
  if (scenarioKey === "website-will-not-load" && id === "restore") {
    return "Turning the shield back on brings the block back if the site loaded without it.";
  }
  if (scenarioKey === "website-will-not-load" && id === "country") {
    return "Another country does not bypass Real-time protection.";
  }
  if (scenarioKey === "session-limit" && id === "devices") {
    return "Three devices are signed in. The cap in the warning is 10, so signing one out is not the cause.";
  }
  if (scenarioKey === "session-limit" && id === "wait") {
    return facts.waited === true
      ? "The 10 minutes have passed. The next step is one connection, not more taps."
      : "The warning is from repeated Quick Connect taps. The wait is 10 minutes with no taps.";
  }
  if (scenarioKey === "session-limit" && id === "connect") {
    return facts.waited === true
      ? "One connection now should stick. A second burst of taps starts the wait over."
      : "Connecting before the wait finishes leaves the warning in place.";
  }
  if (scenarioKey === "session-limit" && id === "signout") {
    return "They are under the 10-device cap. Signing out is optional, not the fix.";
  }
  if (scenarioKey === "session-limit" && id === "spam") return "Each extra Quick Connect tap extends the wait.";
  if (scenarioKey === "refund-boundary" && id === "explain") {
    return "The guarantee is the first purchase only, 1 Sep 2025. The 11 Oct 2026 charge is a renewal.";
  }
  if (scenarioKey === "refund-boundary" && id === "promise") {
    return "Promising a refund does not create a Refund button on this renewal.";
  }
  return "This follows the account or app state they have right now.";
}

function diagnosis(scenarioKey: string, facts: DeviceFacts): string {
  if (scenarioKey === "kill-switch-split-tunnel") {
    if (facts.splitTunnel !== false && facts.killSwitch !== false) {
      return "Connected with no internet because Chrome is excluded and Kill Switch blocks that bypass. Take Chrome off the list, leave Kill Switch on, then reconnect once.";
    }
    if (facts.splitTunnel === false && facts.reconnected !== true) {
      return "Chrome is no longer excluded. The old session is still up, so reconnect once and leave Kill Switch on.";
    }
    if (facts.killSwitch === false) {
      return "Sites only work because Kill Switch is off. That is a leak, not a fix. Turn Kill Switch back on after Chrome is inside the tunnel.";
    }
    return "The tunnel is in the working shape: Chrome included, Kill Switch on, one fresh connection.";
  }
  if (scenarioKey === "login-429-mfa") {
    if (facts.signedIn === true) return "They are signed in. The path was the 30-minute wait, automatic time, then one new code.";
    if (facts.error429 !== false) return "Error 429 is blocking the authenticator. Wait 30 minutes before any new code. Do not retry now.";
    if (facts.clockOk !== true) return "The 429 has cleared. The code will fail until the phone time is automatic.";
    return "Wait and clock are done. One new authenticator code should sign them in.";
  }
  if (scenarioKey === "website-will-not-load") {
    if (facts.protection === false || facts.siteLoads === true) {
      return "The bank site loads on the VPN because Real-time protection is off. DNS and country were not the block.";
    }
    return "The site loads while the VPN is paused and fails when connected. Real-time protection is still on, so that shield is the block. DNS and a new country will not remove it.";
  }
  if (scenarioKey === "session-limit") {
    if (facts.connected === true) return "The phone connected after one clean wait. More Quick Connect taps would have reset it.";
    if (facts.waited === true) return "The 10 minutes have passed. Connect once. They are at 3 devices, under the cap of 10.";
    return "Quick Connect was tapped too many times. Three devices is under the cap of 10, so the fix is a 10-minute wait with no taps, then one connection.";
  }
  if (facts.falsePromise === true) return "A refund of this renewal was promised, but the billing page still has no Refund button.";
  if (facts.explained === true && facts.cancelOffered === true) {
    return "The renewal stays charged. Auto-renewal can be cancelled so the next year is not billed.";
  }
  return "First purchase 1 Sep 2025. Renewal 11 Oct 2026 with no Refund button. Explain that the guarantee is first purchase only, then cancel auto-renewal. Do not refund this charge.";
}

function tune(scenarioKey: string, control: DeviceControl, facts: DeviceFacts): DeviceControl {
  if (scenarioKey === "kill-switch-split-tunnel" && control.id === "split" && facts.splitTunnel === false) {
    return { ...control, phrase: null };
  }
  if (scenarioKey === "kill-switch-split-tunnel" && control.id === "kill" && facts.killSwitch === false) {
    return { ...control, phrase: "Turn the Internet Kill Switch back on.", ask: "Turn Kill Switch on", risky: false };
  }
  if (scenarioKey === "kill-switch-split-tunnel" && control.id === "protocol" && facts.protocol === "OpenVPN") {
    return { ...control, phrase: null };
  }
  if (scenarioKey === "login-429-mfa" && control.id === "clock" && facts.clockOk === true) {
    return { ...control, phrase: null };
  }
  if (scenarioKey === "website-will-not-load" && control.id === "dns" && facts.customDns === false) {
    return { ...control, phrase: null };
  }
  if (scenarioKey === "website-will-not-load" && control.id === "protection" && facts.protection === false) {
    return { ...control, phrase: null };
  }
  if (scenarioKey === "website-will-not-load" && control.id === "restore" && facts.protection !== false) {
    return { ...control, phrase: null };
  }
  return control;
}
