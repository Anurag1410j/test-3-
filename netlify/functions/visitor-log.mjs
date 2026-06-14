// Netlify Serverless Function — Visitor IP Logger
// Sends visitor details to Discord with accurate geolocation

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1515741397175631985/IrW2dXA3FCHaobB_FkPabcQz7prHko-yzQdAkI-GOCfTj-BicGjpPVgwN-l5-6EPa9p-";

export default async (request) => {
  try {
    // ── Get the real visitor IP ──────────────────────────────────
    const ip =
      request.headers.get("x-nf-client-connection-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // ── Parse client-side metadata ──────────────────────────────
    let meta = {};
    try {
      meta = await request.json();
    } catch (e) {}

    const userAgent = request.headers.get("user-agent") || "unknown";
    const timestamp = new Date().toISOString();

    // ── Geolocation lookup via ipwho.is (free, HTTPS) ───────────
    let country = "—", countryCode = "", state = "—", city = "—";
    let zip = "—", lat = "—", lon = "—", tz = "—";
    let isp = "—", org = "—", asInfo = "—";

    try {
      const res = await fetch("https://ipwho.is/" + ip);
      const d = await res.json();

      if (d.success !== false) {
        country     = d.country || "—";
        countryCode = d.country_code || "";
        state       = d.region || "—";
        city        = d.city || "—";
        zip         = d.postal || "—";
        lat         = d.latitude ?? "—";
        lon         = d.longitude ?? "—";
        tz          = d.timezone ? d.timezone.id + " (" + (d.timezone.abbr || "") + " " + (d.timezone.utc || "") + ")" : "—";
        isp         = (d.connection && d.connection.isp) || "—";
        org         = (d.connection && d.connection.org) || "—";
        asInfo      = d.connection ? ("AS" + (d.connection.asn || "?") + " " + ((d.connection.org) || "")).trim() : "—";
      }
    } catch (e) {}

    // Fallback to ipapi.co if ipwho.is failed
    if (country === "—") {
      try {
        const res2 = await fetch("https://ipapi.co/" + ip + "/json/");
        const d2 = await res2.json();

        if (!d2.error) {
          country     = d2.country_name || "—";
          countryCode = d2.country_code || "";
          state       = d2.region || "—";
          city        = d2.city || "—";
          zip         = d2.postal || "—";
          lat         = d2.latitude ?? "—";
          lon         = d2.longitude ?? "—";
          tz          = d2.timezone || "—";
          isp         = d2.org || "—";
          org         = d2.org || "—";
          asInfo      = ((d2.asn || "") + " " + (d2.org || "")).trim() || "—";
        }
      } catch (e) {}
    }

    // ── Geolocation from IP ─────────────────────────────────────
    const finalLat = lat;
    const finalLon = lon;

    // ── Build country flag emoji ────────────────────────────────
    let flag = "🌍";
    if (countryCode && countryCode.length === 2) {
      try {
        flag = String.fromCodePoint(
          0x1F1E6 + countryCode.toUpperCase().charCodeAt(0) - 65,
          0x1F1E6 + countryCode.toUpperCase().charCodeAt(1) - 65
        );
      } catch (e) { flag = "🌍"; }
    }

    // ── Location string (City, State ZIP) ───────────────────────
    let locationStr = city;
    if (state !== "—") locationStr += ", " + state;
    if (zip !== "—") locationStr += " " + zip;

    // ── Discord embed ───────────────────────────────────────────
    const embed = {
      title: "🌐 New Portfolio Visitor",
      color: 0x28c840,
      fields: [
        { name: "🔗 IP Address",      value: "`" + ip + "`",                inline: false },
        { name: flag + " Country",    value: country,                       inline: false },
        { name: "🏙️ Location",        value: locationStr,                   inline: false },
        { name: "📍 Coordinates",     value: finalLat + ", " + finalLon,    inline: false },
        { name: "🕐 Timezone",        value: tz,                            inline: false },
        { name: "📄 Page",            value: meta.page || "/",              inline: false },
        { name: "📡 ISP",             value: isp,                           inline: false },
        { name: "🏢 Organization",    value: org,                           inline: false },
        { name: "🔢 AS Number",       value: asInfo,                        inline: false },
        { name: "🖥️ User Agent",      value: userAgent,                     inline: false },
        { name: "📐 Screen",          value: meta.screenWidth ? meta.screenWidth + "×" + meta.screenHeight : "—", inline: false },
        { name: "🕐 Timestamp",       value: "<t:" + Math.floor(Date.now() / 1000) + ":F>", inline: false },
      ]
    };

    // ── Send to Discord ─────────────────────────────────────────
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Portfolio Tracker",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/2920/2920349.png",
        embeds: [embed],
      }),
    });

    return new Response(JSON.stringify({ ip: ip, country: country, state: state, city: city }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
