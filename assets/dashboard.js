(function () {
  "use strict";

  if (!DroneAuth.requireLogin()) return;

  var state = null;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function setStatus(msg, bad) {
    var el = document.getElementById("status");
    el.textContent = msg || "";
    el.classList.toggle("bad", !!bad);
  }

  function cloudUrl() {
    var box = document.getElementById("webAppUrl");
    return ((box && box.value) || (window.DRONE_DOC_CONFIG && window.DRONE_DOC_CONFIG.webAppUrl) || "").trim();
  }

  function gasRequest(action, payload) {
    var url = cloudUrl();
    if (!url) return Promise.reject(new Error("Cloud is not configured. Open Settings."));
    return new Promise(function (resolve, reject) {
      var cb = "droneDocCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      var script = document.createElement("script");
      var settled = false;
      var timer = setTimeout(function () {
        finish(new Error("Cloud did not answer. Publish a new Apps Script version."));
      }, 25000);
      function finish(err, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.remove();
        if (err) reject(err); else resolve(data);
      }
      window[cb] = function (data) { finish(null, data); };
      var body = Object.assign({ action: action, token: DroneAuth.token() }, payload || {});
      var params = new URLSearchParams();
      params.set("callback", cb);
      params.set("action", action);
      params.set("payload", JSON.stringify(body));
      script.onerror = function () {
        finish(new Error("Could not reach the cloud service. Check Settings."));
      };
      script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + params.toString();
      document.head.appendChild(script);
    });
  }

  var PROCESS_STAGES = [
    "Enquiry",
    "Store requisition",
    "Outside test pass",
    "POC",
    "Pilot",
    "Full production",
    "Testing"
  ];

  function stageIndex_(name) {
    var want = String(name || "").trim().toLowerCase();
    if (!want) return 0;
    for (var i = 0; i < PROCESS_STAGES.length; i++) {
      if (PROCESS_STAGES[i].toLowerCase() === want) return i;
    }
    for (var j = 0; j < PROCESS_STAGES.length; j++) {
      if (want.indexOf(PROCESS_STAGES[j].toLowerCase()) >= 0 || PROCESS_STAGES[j].toLowerCase().indexOf(want) >= 0) return j;
    }
    return 0;
  }

  function trailScore_(projectNo) {
    var trail = (state && state.trail) || [];
    var rows = trail.filter(function (row) { return String(row.ProjectNo) === String(projectNo); });
    if (!rows.length) return null;
    var total = PROCESS_STAGES.length;
    var score = 0;
    PROCESS_STAGES.forEach(function (stage) {
      var row = rows.find(function (item) { return String(item.Stage || "").toLowerCase() === stage.toLowerCase(); });
      if (!row) return;
      var st = String(row.Status || "").toLowerCase();
      if (/complete|completed|done|closed|approved|issued|finished/.test(st)) score += 1;
      else if (/progress|active|started|submitted|pending/.test(st) && st.indexOf("not started") < 0) score += 0.55;
    });
    return Math.max(0, Math.min(100, Math.round((score / total) * 100)));
  }

  function projectProgress_(row) {
    var status = String(row.Status || "");
    if (/^closed$/i.test(status)) return 100;
    var fromTrail = trailScore_(row.ProjectNo);
    if (fromTrail != null) {
      if (/^rejected$/i.test(status)) return Math.min(fromTrail, 95);
      return fromTrail;
    }
    var idx = stageIndex_(row.CurrentStage);
    var pct = Math.round(((idx + 1) / PROCESS_STAGES.length) * 100);
    if (/^rejected$/i.test(status)) pct = Math.min(pct, 90);
    if (/hold/i.test(status)) pct = Math.min(pct, Math.max(8, pct - 5));
    return Math.max(5, Math.min(99, pct));
  }

  function progressTone_(pct, status) {
    if (/^rejected$/i.test(String(status || ""))) return "bad";
    if (/hold/i.test(String(status || ""))) return "hold";
    if (pct >= 100) return "done";
    if (pct >= 70) return "high";
    if (pct >= 35) return "mid";
    return "low";
  }

  function progressCell_(row) {
    var pct = projectProgress_(row);
    var tone = progressTone_(pct, row.Status);
    var label = pct + "% · " + (row.CurrentStage || row.Status || "Started");
    return (
      '<div class="proj-progress" title="' + esc(label) + '">' +
        '<div class="proj-progress-meta"><span>' + pct + "%</span><span>" + esc(row.CurrentStage || "—") + "</span></div>" +
        '<div class="proj-progress-track" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Project completion">' +
          '<div class="proj-progress-fill ' + tone + '" style="width:' + pct + '%"></div>' +
        "</div>" +
      "</div>"
    );
  }

  function render() {
    var s = DroneAuth.user();
    document.getElementById("userLine").textContent = s.displayName + " · " + s.role;
    if (state.settings && state.settings.CompanyName) {
      document.getElementById("companyName").textContent = state.settings.CompanyName;
    }

    var enquiries = state.enquiries || [];
    var reqs = state.requisitions || [];
    var passes = state.passes || state.gatePasses || [];
    var prints = state.printJobs || [];
    var pos = state.purchaseOrders || [];
    var works = state.workAssignments || [];
    var notes = state.notifications || [];

    var open = enquiries.filter(function (r) { return ["Closed", "Rejected"].indexOf(r.Status) < 0; }).length;
    var workPending = works.filter(function (r) { return r.Status === "Submitted" || r.ManagerDecision === "Pending"; }).length;
    var workDone = works.filter(function (r) { return r.ManagerDecision === "Approved" || r.Status === "Approved"; }).length;
    var pendingReq = reqs.filter(function (r) { return r.CoordinatorDecision === "Pending" || r.Status === "Submitted" || r.Status === "Draft"; }).length;
    var pendingPass = passes.filter(function (r) { return r.StoreDecision === "Pending" || r.CoordinatorDecision === "Pending"; }).length;
    var pendingPrint = prints.filter(function (r) { return r.ApprovalDecision === "Pending" || r.Status === "Pending approval"; }).length;
    var pendingPo = pos.filter(function (r) { return r.AuthorizeDecision === "Pending" || r.Status === "Draft" || r.Status === "Submitted"; }).length;
    var avgProgress = 0;
    if (enquiries.length) {
      avgProgress = Math.round(enquiries.reduce(function (sum, row) {
        return sum + projectProgress_(row);
      }, 0) / enquiries.length);
    }

    document.getElementById("kpi").innerHTML = [
      ["Projects open", open],
      ["Avg completion", avgProgress + "%"],
      ["Store requisitions waiting", pendingReq],
      ["Test passes waiting", pendingPass],
      ["3D prints waiting", pendingPrint],
      ["POs waiting", pendingPo],
      ["Work awaiting auth", workPending],
      ["Work approved", workDone],
      ["Notifications", notes.length]
    ].map(function (row) {
      return '<div class="dash-card tile-glow"><div class="n">' + esc(row[1]) + '</div><div class="l">' + esc(row[0]) + "</div></div>";
    }).join("");

    renderDept_(works);
    renderProcess_(works, enquiries);
    renderPeople_(works);

    var visible = enquiries;
    if (!DroneAuth.isManagement() && !DroneAuth.isStore() && !DroneAuth.isCoordinator()) {
      visible = enquiries.filter(function (row) {
        return DroneAuth.ownsProject(row.OwnerUserId, row.OwnerEmail, row.Coordinator) ||
          (s.displayName && row.AssignedTo === s.displayName);
      });
    }

    document.getElementById("projectBody").innerHTML = visible.map(function (row) {
      return "<tr><td>" + esc(row.ProjectNo) + "</td><td>" + esc(row.EnquiryNo) + "</td><td>" + esc(row.ProjectTitle) +
        "</td><td>" + esc(row.AssignedTo || row.Coordinator || row.OwnerUserId) + "</td><td>" + esc(row.CurrentStage) +
        "</td><td class=\"progress-cell\">" + progressCell_(row) + "</td><td>" + esc(row.Status) +
        '</td><td><a href="01_Enquiry_Sheet.html?enq=' + encodeURIComponent(row.EnquiryNo) + '">Enquiry</a> · ' +
        '<a href="02_Store_Requisition.html?enq=' + encodeURIComponent(row.EnquiryNo) + '">Store</a> · ' +
        '<a href="03_Outside_Test_Pass.html?enq=' + encodeURIComponent(row.EnquiryNo) + '">Pass</a> · ' +
        '<a href="06_Purchase_Order.html?enq=' + encodeURIComponent(row.EnquiryNo) + '">PO</a> · ' +
        '<a href="07_Work_Assign.html?enq=' + encodeURIComponent(row.EnquiryNo) + '">Work</a>' +
        (DroneAuth.isManagement() ? (' · <a href="09_Project_Pack.html">Pack</a>') : "") +
        "</td></tr>";
    }).join("") || '<tr><td colspan="8">No projects for your role yet.</td></tr>';

    var pending = [];
    reqs.forEach(function (row) {
      if (row.CoordinatorDecision === "Pending" || row.Status === "Submitted") {
        pending.push(["Store requisition", row.RequisitionID, row.ProjectNo, "Project coordinator", row.Status]);
      }
    });
    passes.forEach(function (row) {
      if (row.StoreDecision === "Pending") pending.push(["Outside test pass", row.PassID, row.ProjectNo, "Store manager", row.Status]);
      else if (row.CoordinatorDecision === "Pending") pending.push(["Outside test pass", row.PassID, row.ProjectNo, "Project coordinator", row.Status]);
    });
    prints.forEach(function (row) {
      if (row.ApprovalDecision === "Pending" || row.Status === "Pending approval") {
        pending.push(["3D print", row.PrintId, row.ProjectNo, "Project coordinator", row.Status]);
      }
    });
    pos.forEach(function (row) {
      if (row.AuthorizeDecision === "Pending" || row.Status === "Draft" || row.Status === "Submitted") {
        pending.push(["Purchase order", row.PoNo, row.ProjectNo, "Authorizer", row.Status]);
      }
    });
    works.forEach(function (row) {
      if (row.Status === "Submitted" || (row.ManagerDecision === "Pending" && row.CompletedAt)) {
        pending.push(["Work authorization", row.WorkId, row.ProjectNo, row.AssignedByName || "Reporting manager", row.Status]);
      }
    });
    document.getElementById("pendingBody").innerHTML = pending.map(function (row) {
      return "<tr><td>" + esc(row[0]) + "</td><td>" + esc(row[1]) + "</td><td>" + esc(row[2]) + "</td><td>" + esc(row[3]) + "</td><td>" + esc(row[4]) + "</td></tr>";
    }).join("") || '<tr><td colspan="5">Nothing waiting.</td></tr>';

    var recent = notes.slice().reverse().slice(0, 20);
    document.getElementById("notifyBody").innerHTML = recent.map(function (row) {
      return "<tr><td>" + esc(row.CreatedAt) + "</td><td>" + esc(row.Event) + "</td><td>" + esc(row.ToName) + "</td><td>" + esc(row.Subject) + "</td><td>" + esc(row.MailStatus) + "</td></tr>";
    }).join("") || '<tr><td colspan="5">No notifications yet. They appear when forms are saved to the cloud.</td></tr>';
  }

  function bump_(map, key, field) {
    if (!map[key]) map[key] = { assigned: 0, submitted: 0, approved: 0, rejected: 0, pending: 0, projects: {} };
    map[key][field] += 1;
  }

  function renderDept_(works) {
    var body = document.getElementById("deptBody");
    if (!body) return;
    var map = {};
    (works || []).forEach(function (row) {
      var d = row.Department || "General";
      bump_(map, d, "assigned");
      if (row.Status === "Submitted") bump_(map, d, "submitted");
      if (row.ManagerDecision === "Approved" || row.Status === "Approved") bump_(map, d, "approved");
      if (row.ManagerDecision === "Rejected" || row.Status === "Rejected") bump_(map, d, "rejected");
    });
    body.innerHTML = Object.keys(map).map(function (d) {
      var row = map[d];
      var pct = row.assigned ? Math.round((row.approved / row.assigned) * 100) : 0;
      return "<tr><td>" + esc(d) + "</td><td>" + row.assigned + "</td><td>" + row.submitted +
        "</td><td>" + row.approved + "</td><td>" + row.rejected + "</td><td>" + pct + "%</td></tr>";
    }).join("") || '<tr><td colspan="6">No work assignments yet. Managers use Assign work.</td></tr>';
  }

  function renderProcess_(works, enquiries) {
    var body = document.getElementById("processBody");
    if (!body) return;
    var stages = PROCESS_STAGES.slice();
    var map = {};
    stages.forEach(function (s) { map[s] = { assigned: 0, submitted: 0, approved: 0, projects: {} }; });
    (works || []).forEach(function (row) {
      var s = row.ProcessStage || "Enquiry";
      if (!map[s]) map[s] = { assigned: 0, submitted: 0, approved: 0, projects: {} };
      map[s].assigned += 1;
      if (row.Status === "Submitted" || row.Status === "Assigned") map[s].submitted += 1;
      if (row.ManagerDecision === "Approved" || row.Status === "Approved") map[s].approved += 1;
      if (row.ProjectNo) map[s].projects[row.ProjectNo] = true;
    });
    (enquiries || []).forEach(function (row) {
      var s = row.CurrentStage || "Enquiry";
      if (!map[s]) map[s] = { assigned: 0, submitted: 0, approved: 0, projects: {} };
      if (row.ProjectNo) map[s].projects[row.ProjectNo] = true;
    });
    body.innerHTML = Object.keys(map).map(function (s) {
      var row = map[s];
      return "<tr><td>" + esc(s) + "</td><td>" + row.assigned + "</td><td>" + row.submitted +
        "</td><td>" + row.approved + "</td><td>" + Object.keys(row.projects).length + "</td></tr>";
    }).join("");
  }

  function renderPeople_(works) {
    var body = document.getElementById("peopleBody");
    if (!body) return;
    var map = {};
    (works || []).forEach(function (row) {
      var p = row.AssignedToName || "Unassigned";
      bump_(map, p, "assigned");
      if (row.Status === "Submitted" || row.CompletedAt) bump_(map, p, "submitted");
      if (row.ManagerDecision === "Approved" || row.Status === "Approved") bump_(map, p, "approved");
      if (row.Status === "Submitted" && (row.ManagerDecision === "Pending" || !row.ManagerDecision)) bump_(map, p, "pending");
    });
    body.innerHTML = Object.keys(map).map(function (p) {
      var row = map[p];
      return "<tr><td>" + esc(p) + "</td><td>" + row.assigned + "</td><td>" + row.submitted +
        "</td><td>" + row.approved + "</td><td>" + row.pending + "</td></tr>";
    }).join("") || '<tr><td colspan="5">No person assignments yet.</td></tr>';
  }

  function bindDashViews_() {
    document.querySelectorAll(".dash-view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-view");
        document.querySelectorAll(".dash-view-btn").forEach(function (b) { b.classList.toggle("on", b === btn); });
        document.querySelectorAll(".dash-panel").forEach(function (panel) {
          var match = panel.getAttribute("data-panel") === view;
          panel.hidden = !match;
        });
      });
    });
  }

  function readDashCache_() {
    try {
      var raw = sessionStorage.getItem("droneDoc.boot.dashboard");
      if (!raw) return null;
      var pack = JSON.parse(raw);
      if (!pack || !pack.at || !pack.data || !pack.data.ok) return null;
      if (Date.now() - pack.at > 90000) return null;
      return pack.data;
    } catch (e) {
      return null;
    }
  }

  function writeDashCache_(data) {
    try {
      sessionStorage.setItem("droneDoc.boot.dashboard", JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) { /* ignore */ }
  }

  function applyDash_(data, statusText) {
    if (data.session) DroneAuth.writeSession(Object.assign(DroneAuth.readSession() || {}, data.session));
    state = data;
    render();
    DroneAuth.decorateChrome();
    setStatus(statusText || "Dashboard loaded.");
    writeDashCache_(data);
  }

  async function load(force) {
    var cached = force ? null : readDashCache_();
    if (cached) {
      applyDash_(cached, "Dashboard · cached");
      gasRequest("bootstrap", { scope: "dashboard" }).then(function (data) {
        if (data && data.ok) applyDash_(data);
      }).catch(function () { /* keep cache */ });
      return;
    }
    DroneAuth.showLoading("Loading dashboard…");
    try {
      var data = await gasRequest("bootstrap", { scope: "dashboard" });
      if (!data.ok) throw new Error(data.error || "Load failed.");
      applyDash_(data);
    } catch (err) {
      setStatus(err.message || String(err), true);
      if (/session|login|token/i.test(String(err.message || ""))) {
        DroneAuth.clearSession();
        location.href = DroneAuth.loginHref();
      }
    } finally {
      DroneAuth.hideLoading();
    }
  }

  var cfg = window.DRONE_DOC_CONFIG || {};
  var box = document.getElementById("webAppUrl");
  if (!box) {
    box = document.createElement("input");
    box.type = "hidden";
    box.id = "webAppUrl";
    document.body.appendChild(box);
  }
  var configured = (cfg.webAppUrl || "").trim();
  try {
    if (configured) localStorage.setItem("droneDoc.webAppUrl", configured);
    box.value = configured || localStorage.getItem("droneDoc.webAppUrl") || "";
  } catch (e) { box.value = configured; }
  var cloudBtn = document.getElementById("btnCloud");
  if (cloudBtn) {
    cloudBtn.hidden = true;
    cloudBtn.addEventListener("click", function () { load(true); });
  }
  document.getElementById("btnReload").addEventListener("click", function () { load(true); });
  bindDashViews_();
  DroneAuth.decorateChrome();
  load(false);
}());
