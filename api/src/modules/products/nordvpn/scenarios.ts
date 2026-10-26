import type { Scenario } from "../types";

const killSwitch = "https://support.nordvpn.com/hc/en-us/articles/19509682644369-NordVPN-Kill-Switch-how-does-it-work";
const splitTunnel = "https://support.nordvpn.com/hc/en-us/articles/19618692366865-What-is-Split-Tunneling-and-how-to-use-it-with-NordVPN";
const protocols = "https://support.nordvpn.com/hc/en-us/articles/19482810153745-Which-NordVPN-protocol-should-I-choose";
const login = "https://support.nordvpn.com/hc/en-us/articles/35254513258129-I-can-t-log-in-to-NordVPN";
const mfa = "https://support.nordvpn.com/hc/en-us/articles/19442299167889-What-is-MFA-and-how-to-enable-it";
const websites = "https://support.nordvpn.com/hc/en-us/articles/20095679510801-I-can-t-access-websites-or-apps-are-not-working-with-NordVPN";
const sessionLimit = "https://support.nordvpn.com/hc/en-us/articles/47181405478417";
const refund = "https://support.nordvpn.com/hc/en-us/articles/19476991311121-What-is-your-refund-policy";

export const killSwitchSplitTunnel: Scenario = {
  key: "kill-switch-split-tunnel",
  title: "Kill Switch and split tunneling",
  summary:
    "When Kill Switch is on, internet access is blocked unless the traffic goes through the VPN. Split tunneling, and the Linux allowlist, send some traffic outside the tunnel. Those two settings together often leave the app showing Connected while ordinary browsing fails.",
  sourceUrls: [killSwitch, splitTunnel, protocols],
  sections: [
    {
      heading: "Kill Switch by OS",
      bullets: [
        "Windows: Internet Kill Switch cuts off internet when the VPN drops. App Kill Switch closes chosen apps and is off by default.",
        "macOS App Store and iOS: the matching control is VPN bypass prevention, under Settings and VPN connection. It forces covered traffic through the tunnel, including across sleep and wake.",
        "macOS direct download: App Kill Switch ends app connections if the VPN drops.",
        "Android 8 and later: Kill Switch blocks internet when there is no VPN connection. It is not available on Amazon Fire TV Stick. Android 7 and later can also use the system Always-on VPN toggle.",
        "Linux: nordvpn set killswitch on. Check it with nordvpn settings. The client blocks system-wide internet if the VPN drops or is disconnected.",
      ],
    },
    {
      heading: "Split tunneling rules",
      bullets: [
        "Windows and Android can exclude chosen apps so those apps use the normal connection.",
        "On Windows, the picker lists apps that are currently open. Browse apps can find others.",
        "Linux uses an allowlist of ports, port ranges, or subnets, not a per-app list. Matching traffic bypasses the tunnel and is not blocked by Kill Switch. A rule applies to inbound and outbound traffic.",
        "An excluded app can still use NordVPN DNS. Some apps then fail because DNS and the destination use different addresses.",
      ],
    },
    {
      heading: "Protocols",
      bullets: [
        "NordLynx is the default in most apps and is the usual choice for speed.",
        "OpenVPN, on TCP or UDP, is the stable fallback when a network blocks the default.",
        "NordWhisper is for restrictive networks. It does not work with Meshnet, a dedicated IP, or Onion over VPN.",
      ],
    },
  ],
  replySteps: [
    "Tell me your operating system, and whether Internet Kill Switch, App Kill Switch, or VPN bypass prevention is on.",
    "Tell me which apps, ports, or subnets are set to bypass the VPN.",
    "Turn split tunneling off. On Linux, clear the allowlist. Disconnect, connect once, and try a normal website.",
    "If browsing works only after that, keep those exclusions off while Kill Switch stays on.",
    "If there is still no internet with split tunneling off, switch to OpenVPN UDP and try once. If that fails, try OpenVPN TCP.",
  ],
};

export const login429Mfa: Scenario = {
  key: "login-429-mfa",
  title: "Login, Error 429, and MFA",
  summary:
    "Error 429 means Nord Account received too many sign-in attempts. An authenticator code also fails when the device clock is wrong, and a login loop can continue if the browser blocks cookies or pop-ups.",
  sourceUrls: [login, mfa],
  sections: [
    {
      heading: "Error 429 and login",
      bullets: [
        "Close every Nord Account tab and sign in from the NordVPN app.",
        "Check the email and password. Google or Apple sign-in is an alternative when the account was created that way.",
        "Allow pop-ups and cookies for the Nord Account site, and turn on automatic date and time.",
        "Pause ad blockers and other security software for one attempt.",
        "Wait at least 30 minutes after a 429 before trying again. More attempts keep the limit in place.",
        "Reset the Nord Account password, then fully quit and reopen the app. Reset app preferences or reinstall only after that wait.",
      ],
    },
    {
      heading: "MFA",
      bullets: [
        "Nord Account MFA is an authenticator code that changes about every 30 seconds, or a FIDO2 security key.",
        "If the code fails, check the phone clock, then try one saved backup code.",
        "A lost authenticator and lost backup codes need account recovery. Do not invent a bypass.",
      ],
    },
  ],
  replySteps: [
    "If you see Error 429, wait 30 minutes, close every Nord Account tab, and try one sign-in from the NordVPN app.",
    "Turn on automatic date and time, and allow cookies and pop-ups for the Nord Account site.",
    "If you use an authenticator app, enter a new code. Use one backup code only if the app code keeps failing.",
    "Check that the email and password belong to this Nord Account. Google or Apple sign-in works only if the account was created that way.",
    "If one attempt after the wait still fails, reset the Nord Account password, quit the app completely, and open it again.",
  ],
};

export const websiteWillNotLoad: Scenario = {
  key: "website-will-not-load",
  title: "Website will not load",
  summary:
    "A site or app that fails only on the VPN is checked by pausing the connection, then by turning off Custom DNS and Real-time protection before changing server or protocol. Streaming services use a different set of articles.",
  sourceUrls: [websites, protocols],
  sections: [
    {
      heading: "Pause the VPN",
      bullets: [
        "Pause or disconnect and open the same site. If it loads only while disconnected, the VPN path, DNS, or a protection feature is involved.",
        "If it also fails while disconnected, it may be the local network or the site itself. Continue with the steps below anyway.",
      ],
    },
    {
      heading: "Custom DNS",
      bullets: [
        "Turn off Custom DNS in the NordVPN app and on the router.",
        "With NordVPN DNS off, some sites fail even though the tunnel is up. A DNS leak test should name NordVPN when the VPN DNS is in use.",
      ],
    },
    {
      heading: "Real-time protection",
      bullets: [
        "Windows and macOS: open the shield, then Advanced settings, and turn features off one at a time.",
        "iOS and Android: open the shield and choose Turn off protection.",
        "Browser extension: turn off Scam and phishing protection.",
        "Linux: Settings, Real-time protection, or nordvpn set protection off.",
      ],
    },
  ],
  replySteps: [
    "Pause the VPN and tell me whether the site loads while it is paused.",
    "Turn off Custom DNS in the NordVPN app and on your router, reconnect, and test the site again.",
    "Turn off Real-time protection, reload the site, then turn protection back on if the site still failed.",
    "Connect to a different country. If it still fails, try NordLynx, then OpenVPN UDP, then OpenVPN TCP.",
    "Send the website address, your operating system, and your NordVPN app version.",
  ],
};

export const sessionLimitReached: Scenario = {
  key: "session-limit",
  title: "Session limit reached",
  summary:
    "Session Limit Reached means too many connections were started, or the account is already connected on the maximum number of devices. The public warning asks for a 10-minute wait, and it names 10 connected devices as the point where one must be disconnected first.",
  sourceUrls: [sessionLimit],
  sections: [
    {
      heading: "What the warning means",
      bullets: [
        "Quick Connect or a chosen country does not connect. The app can show Not connected.",
        "The warning says too many connections were initiated, or the device limit was reached.",
        "It asks for a 10-minute wait. If 10 devices are connected, one of them has to disconnect before that wait.",
        "Pressing Quick Connect again during the wait can extend it.",
      ],
    },
    {
      heading: "What to check",
      bullets: [
        "Count phones, computers, tablets, and routers that are signed in or connected.",
        "Disconnect or sign out on a device that is not in use, then wait the full 10 minutes.",
        "Try one Quick Connect after the wait. Update, restart, or sign out and back in only if that single attempt fails.",
        "Reinstall only after the wait and the device count.",
      ],
    },
  ],
  replySteps: [
    "This wait is expected after too many connection attempts, or when the device limit is reached.",
    "Count every phone, computer, tablet, and router signed in to NordVPN. The warning refers to a limit of 10 connected devices.",
    "If you are at that limit, disconnect or sign out on a device you are not using.",
    "Wait 10 minutes without pressing Quick Connect, then connect once.",
    "If that single attempt still fails, reply with your device type, app version, how many devices are connected, and how many times you tried.",
  ],
};

export const refundBoundary: Scenario = {
  key: "refund-boundary",
  title: "Refund boundary",
  summary:
    "The 30-day money-back guarantee applies to the first purchase only. A renewal, a purchase older than 30 days, or a second request for the same initial payment is outside that guarantee unless a local law says otherwise.",
  sourceUrls: [refund],
  sections: [
    {
      heading: "Refund policy",
      bullets: [
        "A new subscription can be refunded within 30 days of the first purchase.",
        "A renewal is not covered once the first period has ended.",
        "The initial payment can be refunded once. A missing Refund button means the payment is outside the guarantee: older than 30 days, already refunded, or a renewal.",
        "Apple App Store purchases are refunded by Apple. Amazon store purchases go to Amazon. A retailer or reseller purchase goes back to that seller.",
        "An eligible Google Play payment can be requested through NordVPN support, or through Google Play within about 48 hours.",
        "After a valid request, the status moves to Refund processing, then Refunded. A bank can take up to 10 business days.",
      ],
    },
  ],
  replySteps: [
    "The 30-day money-back guarantee covers the first purchase only, and only within 30 days of that purchase.",
    "A renewal is outside that guarantee. I can help cancel auto-renewal so the plan does not renew again.",
    "Purchases from Apple, Amazon, or another retailer need to be refunded by that store.",
    "If the first purchase is still inside 30 days and was bought on the NordVPN website, say so and I will send the verification link. Eligible payments show a Refund button after you verify the account.",
    "I cannot apply the 30-day guarantee to a renewal.",
  ],
};

export const scenarios: Scenario[] = [
  killSwitchSplitTunnel,
  login429Mfa,
  websiteWillNotLoad,
  sessionLimitReached,
  refundBoundary,
];
