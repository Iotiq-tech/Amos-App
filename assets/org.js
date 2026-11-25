(function () {
  "use strict";
  if (!window.DroneAuth || !DroneAuth.requireLogin()) return;
  if (!DroneAuth.can("orgchart", "view")) {
    location.href = "00_Dashboard.html";
    return;
  }

  var ROLES = [
    ["CEO", "Company lead", "Full dashboard and project packs"],
    ["CTO", "Assigns projects to the five teams", "Full dashboard, assign work, project packs"],
    ["Usha — HR", "HR & Operation", "HR supervision and weekly people report (read-only on assignments)"],
    ["Vijay Baskar — Operations", "HR & Operation", "Assign operations work for that team"],
    ["Benny — Head", "Production / General Store", "Assign store and production work"],
    ["Afsal — Incharge", "General Store", "Assign general store work"],
    ["Jinu — Testing Incharge", "Production", "Assign technicians and tester pilot"],
    ["Gowtham — R&D Lead", "R&D-UAV", "Assign UAV team; take project ownership"],
    ["Siddharth — UAV Lead", "R&D-UAV & electronics", "Assign UAV / electronics tasks"],
    ["Alfi — CAD Design Engineer", "DESIGN", "Assign design team work"],
    ["Saravana — R&D Lead", "R&D-IOT", "Assign IOT / embedded work"],
    ["Team members", "Technicians, CAD, designers, pilots, hardware", "My work — submit when the task is done"]
  ];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function cloudUrl() {
    return ((window.DRONE_DOC_CONFIG && window.DRONE_DOC_CONFIG.webAppUrl) || "").trim();
  }

  function gasRequest(action, payload) {
    var url = cloudUrl();
    if (!url) return Promise.reject(new Error("Cloud not configured."));
    return new Promise(function (resolve, reject) {
      var cb = "orgCb_" + Date.now();
      var script = document.createElement("script");
      window[cb] = function (data) {
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
      document.head.appendChild(script);
    });
  }

  document.getElementById("roleBody").innerHTML = ROLES.map(function (row) {
    return "<tr><td>" + esc(row[0]) + "</td><td>" + esc(row[1]) + "</td><td>" + esc(row[2]) + "</td></tr>";
  }).join("");

  var orgKey = "droneDoc.boot." + ((DroneAuth.user() || {}).userId || "anon") + ".orgchart";
  var orgCached = null;
  try {
    var orgPack = JSON.parse(sessionStorage.getItem(orgKey) || "null");
    if (orgPack && orgPack.data && Date.now() - orgPack.at < 90000) orgCached = orgPack.data;
  } catch (e) { orgCached = null; }

  function paintPeople_(data) {
    var users = (data.users || []).filter(function (u) {
      return String(u.Active || "Yes").toLowerCase() !== "no";
    });
    document.getElementById("peopleBody").innerHTML = users.map(function (u) {
      return "<tr><td>" + esc(u.DisplayName) + "</td><td>" + esc(u.Role) + "</td><td>" + esc(u.Department || "—") +
        "</td><td>" + esc(u.ReportsTo || "—") + "</td><td>" + esc(u.OrgLevel || "—") + "</td></tr>";
    }).join("") || '<tr><td colspan="5">No users in cloud sheet yet.</td></tr>';
  }

  if (orgCached) {
    paintPeople_(orgCached);
  } else {
  gasRequest("bootstrap", { scope: "orgchart" }).then(function (data) {
    try { sessionStorage.setItem(orgKey, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* ignore */ }
    paintPeople_(data);
  }).catch(function () {
    document.getElementById("peopleBody").innerHTML = '<tr><td colspan="5">Connect cloud to list users.</td></tr>';
  });
  }

  DroneAuth.decorateChrome();
}());