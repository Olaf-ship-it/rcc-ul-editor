/**
 * Backcasting-Modul: Session- und Berechtigungsprüfung (getrennt von der Haupt-App).
 * Läuft eigenständig unter /backcasting/ und nutzt nur die gemeinsame Auth-Cookie-Session.
 */
(function () {
  const LOGIN_URL = "/?module=backcasting&return=" + encodeURIComponent(window.location.pathname);

  function showBootError(message) {
    const meta = document.getElementById("planMeta");
    if (meta) meta.textContent = message;
  }

  async function bootBackcastingShell() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!res.ok) {
        window.location.replace(LOGIN_URL);
        return;
      }
      const me = await res.json();
      if (!me.modules || !me.modules.backcasting) {
        window.location.replace("/backcasting/forbidden.html");
        return;
      }
      const units = Array.isArray(me.units) ? me.units : [];
      const roles = Array.isArray(me.roles) ? me.roles : [];
      const isSuperAdmin = roles.includes("super_admin") || me.role === "super_admin";
      const isAdmin =
        isSuperAdmin ||
        roles.includes("admin") ||
        me.role === "admin";
      document.body.dataset.rcUserEmail = me.email || "";
      document.body.dataset.rcUserName = me.name || "";
      document.body.dataset.rcUserUnit = me.unit || units[0] || "";
      document.body.dataset.rcUserUnits = units.join("|");
      document.body.dataset.rcIsSuperAdmin = isSuperAdmin ? "1" : "";
      document.body.dataset.rcIsAdmin = isAdmin ? "1" : "";
      const userLine = document.getElementById("bcShellUser");
      if (userLine) {
        userLine.textContent = me.name ? me.name + (me.email ? " (" + me.email + ")" : "") : me.email || "";
      }
      const logoutBtn = document.getElementById("bcLogoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
          try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
          } catch (_e) { /* ignore */ }
          window.location.href = "/?module=backcasting";
        });
      }
      const adminLink = document.getElementById("launcherAdmin");
      if (adminLink) adminLink.style.display = isAdmin ? "" : "none";
      const fsLink = document.getElementById("bcLauncherFortschritt");
      if (fsLink) fsLink.style.display = me.modules?.fortschritt || isAdmin ? "" : "none";
      document.dispatchEvent(
        new CustomEvent("rc-backcasting-ready", {
          detail: { ...me, roles, units, isSuperAdmin, isAdmin },
        })
      );
    } catch (_error) {
      showBootError("Session konnte nicht geladen werden.");
      window.setTimeout(function () {
        window.location.replace(LOGIN_URL);
      }, 1200);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootBackcastingShell);
  } else {
    bootBackcastingShell();
  }
})();
