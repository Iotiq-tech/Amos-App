(function () {
  "use strict";
  if (!window.DroneAuth || !DroneAuth.requireLogin()) return;
  if (!DroneAuth.can("hrview", "view") && !DroneAuth.isExecutive()) {
    location.href = "00_Dashboard.html";
    return;
  }

  var state = { workAssignments: [], users: [] };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function parseStamp(s) {
    if (!s) return NaN;
    var t = Date.parse(String(s).replace(" ", "T"));
    return isNaN(t) ? NaN : t;
  }

  function weekAgo() {
    return Date.now() - 7 * 24 * 3600 * 1000;
  }

  function inWeek(row) {
    var t = parseStamp(row.CompletedAt) || parseStamp(row.UpdatedAt);
    return !isNaN(t) && t >= weekAgo();
  }

  function setStatus(msg, bad) {
    var el = document.getElementById("status");
    if (el) { el.textContent = msg || ""; el.classList.toggle("bad", !!bad); }
  }

  function cloudUrl() {
    var box = document.getElementById("webAppUrl");
    return ((box && box.value) || (window.DRONE_DOC_CONFIG && window.DRONE_DOC_CONFIG.webAppUrl) || "").trim();
  }

  function gasRequest(action, payload) {
    var url = cloudUrl();
    if (!url) return Promise.reject(new Error("Cloud not configured."));
    return new Promise(function (resolve, reject) {
      var cb = "hrCb_" + Date.now();
      var script = document.createElement("script");
      var timer = setTimeout(function () { reject(new Error("Cloud timeout")); }, 45000);
      window[cb] = function (data) {
        clearTimeout(timer);
        script.remove();
        delete window[cb];
        if (data && data.ok === false) reject(new Error(data.error || "Failed"));
        else resolve(data);
      };
      var body = Object.assign({ action: action, token: DroneAuth.token() }, payload || {});
      var params = new URLSearchParams();
      params.set("callback", cb);
      params.set("action", action);
      params.set("payload", JSON.stringify(body));
      script.src = url + "?" + params.toString();
      script.onerror = function () { reject(new Error("Cloud unreachable")); };
      document.head.appendChild(script);
    });
  }

  function render() {
    var works = state.workAssignments || [];
    var assigned = works.length;
    var submitted = works.filter(function (r) { return r.Status === "Submitted" || r.CompletedAt; }).length;
    var approved = works.filter(function (r) { return r.ManagerDecision === "Approved" || r.Status === "Approved"; }).length;
    var pending = works.filter(function (r) { return r.Status === "Submitted" && (r.ManagerDecision === "Pending" || !r.ManagerDecision); }).length;
    document.getElementById("hrKpi").innerHTML = [
      ["Total assignments", assigned],
      ["Submitted / done", submitted],
      ["Manager approved", approved],
      ["Awaiting authorization", pending]
    ].map(function (row) {
      return '<div class="dash-card tile-glow"><div class="n">' + esc(row[1]) + '</div><div class="l">' + esc(row[0]) + "</div></div>";
    }).join("");

    var weekWorks = works.filter(inWeek);
    var byPerson = {};
    weekWorks.forEach(function (row) {
      var p = row.AssignedToName || "—";
      if (!byPerson[p]) byPerson[p] = { dept: row.Department || "—", assigned: 0, submitted: 0, approved: 0, pending: 0 };
      byPerson[p].assigned += 1;
      if (row.Status === "Submitted" || row.CompletedAt) byPerson[p].submitted += 1;
      if (row.ManagerDecision === "Approved") byPerson[p].approved += 1;
      if (row.Status === "Submitted" && row.ManagerDecision === "Pending") byPerson[p].pending += 1;
    });
    document.getElementById("weeklyBody").innerHTML = Object.keys(byPerson).map(function (p) {
      var r = byPerson[p];
      return "<tr><td>" + esc(p) + "</td><td>" + esc(r.dept) + "</td><td>" + r.assigned + "</td><td>" + r.submitted +
        "</td><td>" + r.approved + "</td><td>" + r.pending + "</td></tr>";
    }).join("") || '<tr><td colspan="6">No assignment activity in the last 7 days.</td></tr>';

    document.getElementById("allWorkBody").innerHTML = works.map(function (row) {
      return "<tr><td>" + esc(row.WorkId) + "</td><td>" + esc(row.ProjectNo) + "</td><td>" + esc(row.TaskTitle) +
        "</td><td>" + esc(row.AssignedToName) + "</td><td>" + esc(row.Department) + "</td><td>" + esc(row.RequestingDepartment || "—") +
        "</td><td>" + esc(row.CrossDeptRequest || "No") + "</td><td>" + esc(row.Status) + "</td><td>" + esc(row.ManagerDecision || "Pending") +
        "</td><td>" + esc(row.UpdatedAt) + "</td></tr>";
    }).join("") || '<tr><td colspan="10">No assignments yet.</td></tr>';

    var s = DroneAuth.user();
    var line = document.getElementById("userLine");
    if (line && s) line.textContent = s.displayName + " · " + s.role;
  }

  function hrCacheKey_() {
    var s = DroneAuth.user() || {};
    return "droneDoc.boot." + (s.userId || "anon") + ".hrview";
  }

  function applyHr_(data, statusText) {
    state.workAssignments = data.workAssignments || [];
    state.users = data.users || [];
    render();
    setStatus(statusText || "HR supervision loaded.");
    DroneAuth.decorateChrome();
    try {
      sessionStorage.setItem(hrCacheKey_(), JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) { /* ignore */ }
  }

  async function load(force) {
    if (!force) {
      try {
        var pack = JSON.parse(sessionStorage.getItem(hrCacheKey_()) || "null");
        if (pack && pack.data && pack.data.ok && Date.now() - pack.at < 90000) {
          applyHr_(pack.data, "HR supervision · cached. Reload for the latest.");
          return;
        }
      } catch (e) { /* ignore */ }
    }
    DroneAuth.showLoading("Loading HR view…");
    try {
      var data = await gasRequest("bootstrap", { scope: "hrview" });
      applyHr_(data);
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      DroneAuth.hideLoading();
    }
  }

  var cfg = window.DRONE_DOC_CONFIG || {};
  var box = document.getElementById("webAppUrl");
  if (box) box.value = (cfg.webAppUrl || "").trim();
  document.getElementById("btnReload").addEventListener("click", function () { load(true); });
  document.getElementById("btnPrintWeek").addEventListener("click", function () { window.print(); });
  DroneAuth.decorateChrome();
  load();
}());