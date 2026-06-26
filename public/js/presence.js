/**
 * Online-Presence: Heartbeat für alle angemeldeten User,
 * Avatar-Anzeige nur für Admin / Super Admin.
 */
(function () {
  const HEARTBEAT_MS = 30000;
  const POLL_MS = 15000;
  const MAX_AVATARS = 5;

  const CONTEXT_LABELS = {
    phase1: "Phase 1 · Status",
    backcasting: "Phase 2 · Backcasting",
    fortschritt: "Phase 3 · Fortschritt",
    admin: "Administration",
  };

  const ROLE_LABELS = {
    super_admin: "Super Admin",
    admin: "Admin",
    geschaeftsfuehrung: "Geschäftsführung",
    regionalleiter: "Regionalleiter",
    unit_lead: "Unit Leiter",
    stellv_unit_lead: "Stellv. Unit Leiter",
    cc_leiter: "CC Leiter",
    mitarbeiter: "Mitarbeiter",
    backcasting: "Backcasting",
    fortschritt: "Fortschritt",
  };

  let heartbeatTimer = null;
  let pollTimer = null;
  let visibilityBound = false;
  let docClickBound = false;
  let currentUserEmail = "";
  let isAdminViewer = false;
  let getContext = () => "phase1";
  let getUnit = () => "";

  function roleLabel(role) {
    return ROLE_LABELS[role] || String(role || "–").replace(/_/g, " ");
  }

  function contextLabel(context) {
    return CONTEXT_LABELS[context] || context || "–";
  }

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initials(name, email) {
    const parts = String(name || "")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const single = parts[0] || String(email || "?").split("@")[0] || "?";
    return single.slice(0, 2).toUpperCase();
  }

  function avatarColor(email) {
    let hash = 0;
    const text = String(email || "user");
    for (let i = 0; i < text.length; i += 1) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 52% 42%)`;
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      void sendHeartbeat();
      if (isAdminViewer) void fetchAndRenderPresence();
    }
  }

  function closePresencePopover() {
    const mount = document.getElementById("headerPresence");
    mount?.classList.remove("header-presence--open");
  }

  function bindDocClickOnce() {
    if (docClickBound) return;
    docClickBound = true;
    document.addEventListener("click", (event) => {
      const mount = document.getElementById("headerPresence");
      if (!mount || mount.hidden) return;
      if (!mount.contains(event.target)) closePresencePopover();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePresencePopover();
    });
  }

  function stopPresence() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (visibilityBound) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visibilityBound = false;
    }
    closePresencePopover();
    const mount = document.getElementById("headerPresence");
    if (mount) {
      mount.hidden = true;
      mount.innerHTML = "";
    }
  }

  async function sendHeartbeat() {
    try {
      await fetch("/api/presence/heartbeat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: getContext(),
          unit: getUnit(),
        }),
      });
    } catch (_error) {
      /* ignore network errors */
    }
  }

  function renderUserRow(user) {
    const isSelf = String(user.email || "").toLowerCase() === String(currentUserEmail || "").toLowerCase();
    const unitLine = user.unit ? `<span class="header-presence__meta-unit">${escHtml(user.unit)}</span>` : "";
    return `<li class="header-presence__list-item${isSelf ? " header-presence__list-item--self" : ""}">
      <span class="header-presence__avatar header-presence__avatar--list" style="background:${avatarColor(user.email)}" aria-hidden="true">${escHtml(initials(user.name, user.email))}</span>
      <span class="header-presence__list-text">
        <span class="header-presence__list-name">${escHtml(user.name)}${isSelf ? " <em>(Sie)</em>" : ""}</span>
        <span class="header-presence__list-meta">${escHtml(roleLabel(user.role))} · ${escHtml(contextLabel(user.context))}${unitLine ? " · " + unitLine : ""}</span>
      </span>
    </li>`;
  }

  function renderPresence(users) {
    const mount = document.getElementById("headerPresence");
    if (!mount || !isAdminViewer) return;

    if (!users.length) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    mount.hidden = false;
    const visible = users.slice(0, MAX_AVATARS);
    const overflow = Math.max(0, users.length - visible.length);

    const avatars = visible
      .map((user) => {
        const isSelf = String(user.email || "").toLowerCase() === String(currentUserEmail || "").toLowerCase();
        const title = `${user.name} · ${roleLabel(user.role)} · ${contextLabel(user.context)}${user.unit ? " · " + user.unit : ""}`;
        return `<span class="header-presence__avatar${isSelf ? " header-presence__avatar--self" : ""}" style="background:${avatarColor(user.email)}" title="${escHtml(title)}">${escHtml(initials(user.name, user.email))}</span>`;
      })
      .join("");

    const overflowBadge = overflow
      ? `<button type="button" class="header-presence__overflow" aria-expanded="false" title="${overflow} weitere Benutzer online">+${overflow}</button>`
      : "";

    const list = users.map(renderUserRow).join("");

    mount.innerHTML = `<button type="button" class="header-presence__trigger" aria-label="${users.length} Benutzer online" title="Aktive Benutzer anzeigen">
      <span class="header-presence__stack">${avatars}${overflowBadge}</span>
      <span class="header-presence__count">${users.length}</span>
    </button>
    <div class="header-presence__popover" role="dialog" aria-label="Aktive Benutzer">
      <div class="header-presence__popover-head"><strong>Online</strong><span>${users.length}</span></div>
      <ul class="header-presence__list">${list}</ul>
    </div>`;

    mount.querySelector(".header-presence__trigger")?.addEventListener("click", (event) => {
      event.stopPropagation();
      mount.classList.toggle("header-presence--open");
    });
  }

  async function fetchAndRenderPresence() {
    if (!isAdminViewer) return;
    try {
      const res = await fetch("/api/admin/presence", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      renderPresence(Array.isArray(data.users) ? data.users : []);
    } catch (_error) {
      /* ignore */
    }
  }

  function initPresence(options = {}) {
    stopPresence();

    currentUserEmail = String(options.email || "").trim().toLowerCase();
    isAdminViewer = Boolean(options.isAdmin);
    if (typeof options.getContext === "function") getContext = options.getContext;
    if (typeof options.getUnit === "function") getUnit = options.getUnit;

    const mount = document.getElementById("headerPresence");
    if (!mount) return;

    mount.hidden = !isAdminViewer;
    if (!isAdminViewer) {
      mount.innerHTML = "";
    }

    bindDocClickOnce();
    if (!visibilityBound) {
      document.addEventListener("visibilitychange", onVisibilityChange);
      visibilityBound = true;
    }

    void sendHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void sendHeartbeat();
    }, HEARTBEAT_MS);

    if (isAdminViewer) {
      void fetchAndRenderPresence();
      pollTimer = setInterval(() => {
        if (document.visibilityState === "hidden") return;
        void fetchAndRenderPresence();
      }, POLL_MS);
    }
  }

  window.rcPresence = {
    init: initPresence,
    stop: stopPresence,
    refresh: sendHeartbeat,
    refreshList: fetchAndRenderPresence,
  };
})();
