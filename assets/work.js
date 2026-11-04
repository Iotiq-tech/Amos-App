/* Work assign / my work / project pack pages */
(function () {
  "use strict";

  if (!window.DroneAuth || !DroneAuth.requireLogin()) return;

  var KIND = document.body.dataset.doc;
  var state = {
    settings: {},
    enquiries: [],
    users: [],
    workAssignments: [],
    projectPacks: [],
    trail: [],
    lists: {}
  };
  var current = null;
  var suppress = false;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function norm(v) { return String(v == null ? "" : v).trim(); }
  function val(id) {
    var el = document.getElementById(id);
    return el ? norm(el.value) : "";
  }
  function setVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value == null ? "" : String(value);
  }
  function setStatus(msg, bad) {
    var el = document.getElementById("status");
    if (!el) return;
    el.textContent = msg || "";
    el.title = msg || "";
    el.classList.toggle("bad", !!bad);
  }
  function cloudUrl() {
    var box = document.getElementById("webAppUrl");
    return ((box && box.value) || (window.DRONE_DOC_CONFIG && window.DRONE_DOC_CONFIG.webAppUrl) || "").trim();
  }
  function today() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function gasRequest(action, payload) {
    var url = cloudUrl();
    if (!url) return Promise.reject(new Error("Cloud is not configured. Open Settings."));
    return new Promise(function (resolve, reject) {
      var cb = "droneWorkCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      var script = document.createElement("script");
      var settled = false;
      var timer = setTimeout(function () {
        finish(new Error("Cloud did not answer. Redeploy Apps Script."));
      }, 45000);
      function finish(err, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.remove();
        if (err) reject(err); else resolve(data);
      }
      window[cb] = function (data) {
        if (data && data.ok === false) finish(new Error(data.error || "Request failed"));
        else finish(null, data);
      };
      var body = Object.assign({ action: action, token: DroneAuth.token() }, payload || {});
      var params = new URLSearchParams();
      params.set("callback", cb);
      params.set("action", action);
      params.set("payload", JSON.stringify(body));
      script.onerror = function () { finish(new Error("Could not reach cloud.")); };
      script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + params.toString();
      document.head.appendChild(script);
    });
  }

  function listValues(name, fallback) {
    var values = state.lists && state.lists[name];
    return values && values.length ? values : (fallback || []);
  }

  function fillSelect(id, options, keep) {
    var el = document.getElementById(id);
    if (!el || el.tagName !== "SELECT") return;
    var want = keep != null ? String(keep) : el.value;
    el.innerHTML = (options || []).map(function (opt) {
      var value = typeof opt === "string" ? opt : opt.value;
      var label = typeof opt === "string" ? opt : opt.label;
      return '<option value="' + esc(value) + '"' + (String(value) === String(want) ? " selected" : "") + ">" + esc(label) + "</option>";
    }).join("");
  }

  function applyLogo() {
    var img = document.getElementById("companyLogo");
    if (!img) return;
    var list = ["assets/company-logo.jpg", "assets/Amos.jpg", "assets/company-logo.svg"];
    if (state.settings && state.settings.LogoFile) list.unshift(state.settings.LogoFile);
    (function next(i) {
      if (i >= list.length) return;
      var probe = new Image();
      probe.onload = function () { img.src = list[i]; };
      probe.onerror = function () { next(i + 1); };
      probe.src = list[i];
    }(0));
  }

  function paintChrome() {
    if (state.settings) {
      var name = document.getElementById("companyName");
      if (name) name.textContent = state.settings.CompanyName || "AMOS";
      var contact = document.getElementById("companyContact");
      if (contact) {
        contact.textContent = [state.settings.Address, state.settings.Phone, state.settings.Email]
          .map(norm).filter(Boolean).join(" · ");
      }
    }
    var tag = document.getElementById("draftTag");
    if (tag) tag.textContent = val("Status") || "";
    var userLine = document.getElementById("userLine");
    var s = DroneAuth.user();
    if (userLine && s) userLine.textContent = s.displayName + " · " + s.role;
  }

  function applyEnquiry(enquiryNo) {
    var enq = (state.enquiries || []).find(function (row) { return row.EnquiryNo === enquiryNo; });
    setVal("ProjectNo", enq ? enq.ProjectNo : "");
    setVal("ProjectTitle", enq ? enq.ProjectTitle : "");
    if (enq && document.getElementById("Department") && !val("Department")) {
      setVal("Department", enq.Department || "Projects");
    }
  }

  function fillCommon() {
    var enqOpts = [{ value: "", label: "Select project / enquiry" }].concat((state.enquiries || []).map(function (row) {
      return { value: row.EnquiryNo, label: row.EnquiryNo + " — " + (row.ProjectTitle || row.ProjectNo) };
    }));
    fillSelect("EnquiryNo", enqOpts, val("EnquiryNo"));
    fillSelect("Department", listValues("Department", ["Projects", "Store", "Flight Test", "Electronics", "Management"]).map(function (v) {
      return { value: v, label: v };
    }), val("Department") || "Projects");
    fillSelect("ProcessStage", listValues("ProcessStage", ["Enquiry", "Store requisition", "Outside test pass", "POC", "Pilot", "Full production", "Testing"]).map(function (v) {
      return { value: v, label: v };
    }), val("ProcessStage") || "Enquiry");
    fillSelect("ManagerDecision", [
      { value: "Pending", label: "Pending" },
      { value: "Approved", label: "Approved (complete)" },
      { value: "Rejected", label: "Rejected (not complete)" }
    ], val("ManagerDecision") || "Pending");
    var users = (state.users || []).filter(function (row) {
      return String(row.Active || "Yes").toLowerCase() !== "no";
    });
    fillSelect("AssignedToUserId", [{ value: "", label: "Select user" }].concat(users.map(function (row) {
      return { value: row.UserId, label: row.DisplayName + " (" + row.Role + ")" };
    })), val("AssignedToUserId"));
    var dl = document.getElementById("peopleAll");
    if (dl) {
      dl.innerHTML = users.map(function (row) {
        return '<option value="' + esc(row.DisplayName) + '"></option>';
      }).join("");
    }
  }

  function blankAssign() {
    suppress = true;
    current = null;
    var s = DroneAuth.user() || {};
    setVal("WorkId", "");
    setVal("EnquiryNo", "");
    setVal("ProjectNo", "");
    setVal("ProjectTitle", "");
    setVal("Department", "Projects");
    setVal("ProcessStage", "Enquiry");
    setVal("DueDate", today());
    setVal("AssignedToUserId", "");
    setVal("AssignedToName", "");
    setVal("AssignedByName", s.displayName || "");
    setVal("TaskTitle", "");
    setVal("TaskDetail", "");
    setVal("Status", "Assigned");
    setVal("ManagerDecision", "Pending");
    setVal("ManagerRemarks", "");
    setVal("AssigneeRemarks", "");
    fillCommon();
    suppress = false;
    paintChrome();
    renderAssignTable();
  }

  function fillRecord(record) {
    if (!record) return;
    suppress = true;
    current = record;
    ["WorkId", "EnquiryNo", "ProjectNo", "ProjectTitle", "Department", "ProcessStage", "DueDate",
      "AssignedToUserId", "AssignedToName", "AssignedByName", "TaskTitle", "TaskDetail", "Status",
      "ManagerDecision", "ManagerRemarks", "AssigneeRemarks"].forEach(function (id) {
      setVal(id, record[id] != null ? record[id] : "");
    });
    fillCommon();
    setVal("EnquiryNo", record.EnquiryNo || "");
    setVal("AssignedToUserId", record.AssignedToUserId || "");
    setVal("ManagerDecision", record.ManagerDecision || "Pending");
    suppress = false;
    paintChrome();
    renderAssignTable();
    renderMyTable();
  }

  function renderAssignTable() {
    var body = document.getElementById("assignBody");
    if (!body) return;
    var projectNo = val("ProjectNo");
    var rows = (state.workAssignments || []).filter(function (row) {
      return !projectNo || row.ProjectNo === projectNo;
    });
    body.innerHTML = rows.map(function (row) {
      return "<tr data-work=\"" + esc(row.WorkId) + "\"><td>" + esc(row.WorkId) + "</td><td>" + esc(row.TaskTitle) +
        "</td><td>" + esc(row.AssignedToName) + "</td><td>" + esc(row.Department) + "</td><td>" + esc(row.ProcessStage) +
        "</td><td>" + esc(row.Status) + "</td><td>" + esc(row.ManagerDecision || "Pending") + "</td></tr>";
    }).join("") || '<tr><td colspan="7">No assignments yet for this project.</td></tr>';
    var existing = document.getElementById("existingDoc");
    if (existing) {
      fillSelect("existingDoc", [{ value: "", label: "New / select" }].concat(rows.map(function (row) {
        return { value: row.WorkId, label: row.WorkId + " — " + row.TaskTitle };
      })), current && current.WorkId);
    }
  }

  function renderMyTable() {
    var body = document.getElementById("myWorkBody");
    if (!body) return;
    var s = DroneAuth.user() || {};
    var rows = (state.workAssignments || []).filter(function (row) {
      return String(row.AssignedToUserId) === String(s.userId) ||
        String(row.AssignedToName || "").toLowerCase() === String(s.displayName || "").toLowerCase();
    });
    body.innerHTML = rows.map(function (row) {
      return "<tr data-work=\"" + esc(row.WorkId) + "\"><td>" + esc(row.WorkId) + "</td><td>" + esc(row.ProjectNo) +
        "</td><td>" + esc(row.TaskTitle) + "</td><td>" + esc(row.ProcessStage) + "</td><td>" + esc(row.Status) +
        "</td><td>" + esc(row.ManagerDecision || "Pending") + "</td></tr>";
    }).join("") || '<tr><td colspan="6">No work assigned to you yet.</td></tr>';
    var existing = document.getElementById("existingDoc");
    if (existing && KIND === "workreport") {
      fillSelect("existingDoc", [{ value: "", label: "Select assignment" }].concat(rows.map(function (row) {
        return { value: row.WorkId, label: row.WorkId + " — " + (row.ProjectTitle || row.ProjectNo) + " — " + row.TaskTitle };
      })), current && current.WorkId);
    }
  }

  function renderPacks() {
    var body = document.getElementById("packBody");
    if (!body) return;
    var packs = state.projectPacks || [];
    body.innerHTML = packs.map(function (row) {
      return "<tr data-project=\"" + esc(row.ProjectNo) + "\"><td>" + esc(row.ProjectNo) + "</td><td>" + esc(row.ProjectTitle) +
        "</td><td>" + esc(row.UpdatedAt) + "</td><td>" + esc(row.UpdatedBy) +
        '</td><td><a href="' + esc(row.SlidesUrl || "#") + '" target="_blank" rel="noopener">Slides</a> · ' +
        '<a href="' + esc(row.PptxUrl || "#") + '" target="_blank" rel="noopener">PPT</a></td></tr>';
    }).join("") || '<tr><td colspan="5">No packs yet. Assign work or click Refresh pack.</td></tr>';
  }

  function collectAssign() {
    return {
      WorkId: val("WorkId"),
      EnquiryNo: val("EnquiryNo"),
      ProjectNo: val("ProjectNo"),
      ProjectTitle: val("ProjectTitle"),
      Department: val("Department"),
      ProcessStage: val("ProcessStage"),
      DueDate: val("DueDate"),
      AssignedToUserId: val("AssignedToUserId"),
      AssignedToName: val("AssignedToName"),
      TaskTitle: val("TaskTitle"),
      TaskDetail: val("TaskDetail"),
      Status: val("Status") || "Assigned",
      ManagerDecision: val("ManagerDecision") || "Pending",
      ManagerRemarks: val("ManagerRemarks"),
      AssigneeRemarks: val("AssigneeRemarks")
    };
  }

  function adopt(data) {
    if (!data) return;
    if (data.session) DroneAuth.writeSession(Object.assign(DroneAuth.readSession() || {}, data.session));
    ["settings", "enquiries", "users", "workAssignments", "projectPacks", "trail", "lists"].forEach(function (key) {
      if (data[key] !== undefined) state[key] = data[key];
    });
  }

  async function load() {
    DroneAuth.showLoading("Loading work…");
    try {
      var scope = KIND === "projectpack" ? "projectpack" : (KIND === "workreport" ? "workreport" : "workassign");
      var data = await gasRequest("bootstrap", { scope: scope });
      if (!data.ok) throw new Error(data.error || "Load failed");
      adopt(data);
      fillCommon();
      applyLogo();
      paintChrome();
      if (KIND === "workassign") {
        blankAssign();
        var params = new URLSearchParams(location.search);
        if (params.get("work")) {
          var found = (state.workAssignments || []).find(function (row) { return row.WorkId === params.get("work"); });
          if (found) fillRecord(found);
        } else if (params.get("enq")) {
          setVal("EnquiryNo", params.get("enq"));
          applyEnquiry(params.get("enq"));
          renderAssignTable();
        }
      } else if (KIND === "workreport") {
        renderMyTable();
        var wp = new URLSearchParams(location.search).get("work");
        var mine = (state.workAssignments || []);
        if (wp) {
          var row = mine.find(function (r) { return r.WorkId === wp; });
          if (row) fillRecord(row);
        } else if (mine[0]) fillRecord(mine[0]);
      } else if (KIND === "projectpack") {
        if (!DroneAuth.isManagement()) {
          setStatus("Only Management can view project packs.", true);
          return;
        }
        renderPacks();
        fillCommon();
      }
      setStatus("Loaded.");
      DroneAuth.decorateChrome();
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      DroneAuth.hideLoading();
    }
  }

  function bind() {
    var enq = document.getElementById("EnquiryNo");
    if (enq) enq.addEventListener("change", function () {
      applyEnquiry(val("EnquiryNo"));
      renderAssignTable();
      if (KIND === "projectpack") {
        var pack = (state.projectPacks || []).find(function (row) { return row.ProjectNo === val("ProjectNo"); });
        setVal("SlidesUrl", pack ? pack.SlidesUrl : "");
        setVal("PptxUrl", pack ? pack.PptxUrl : "");
      }
    });
    var userSel = document.getElementById("AssignedToUserId");
    if (userSel) userSel.addEventListener("change", function () {
      var u = (state.users || []).find(function (row) { return row.UserId === val("AssignedToUserId"); });
      if (u) setVal("AssignedToName", u.DisplayName || "");
    });
    var existing = document.getElementById("existingDoc");
    if (existing) existing.addEventListener("change", function () {
      var id = existing.value;
      if (!id) {
        if (KIND === "workassign") blankAssign();
        return;
      }
      var row = (state.workAssignments || []).find(function (r) { return r.WorkId === id; });
      if (row) fillRecord(row);
    });
    document.querySelectorAll("#assignBody, #myWorkBody").forEach(function (tbl) {
      tbl && tbl.addEventListener("click", function (ev) {
        var tr = ev.target.closest("tr[data-work]");
        if (!tr) return;
        var row = (state.workAssignments || []).find(function (r) { return r.WorkId === tr.getAttribute("data-work"); });
        if (row) fillRecord(row);
      });
    });

    var btnNew = document.getElementById("btnNew");
    if (btnNew) btnNew.addEventListener("click", blankAssign);

    var btnSave = document.getElementById("btnSave");
    if (btnSave) btnSave.addEventListener("click", async function () {
      if (!DroneAuth.can("workassign", "edit")) {
        setStatus("Your role cannot assign work.", true);
        return;
      }
      var record = collectAssign();
      if (!record.EnquiryNo) return setStatus("Choose the project.", true);
      if (!record.TaskTitle) return setStatus("Enter the task title.", true);
      if (!record.AssignedToName && !record.AssignedToUserId) return setStatus("Choose the assignee.", true);
      btnSave.disabled = true;
      DroneAuth.showLoading("Saving assignment & syncing project pack…");
      try {
        var data = await gasRequest("saveWorkAssignment", {
          record: record,
          previousId: current && current.WorkId || ""
        });
        adopt(data.data || data);
        fillRecord(data.record);
        setStatus(data.message || "Saved.");
        var note = document.getElementById("packNote");
        if (note && data.pack && data.pack.PptxUrl) {
          note.innerHTML = 'Project pack ready: <a href="' + esc(data.pack.SlidesUrl) + '" target="_blank" rel="noopener">Open Slides</a> · <a href="' + esc(data.pack.PptxUrl) + '" target="_blank" rel="noopener">Download PPT</a>';
        }
      } catch (err) {
        setStatus(err.message || String(err), true);
      } finally {
        btnSave.disabled = false;
        DroneAuth.hideLoading();
      }
    });

    var btnAuth = document.getElementById("btnAuthorize");
    if (btnAuth) btnAuth.addEventListener("click", async function () {
      if (!val("WorkId")) return setStatus("Select an assignment first.", true);
      btnAuth.disabled = true;
      DroneAuth.showLoading("Authorizing…");
      try {
        var data = await gasRequest("authorizeWork", {
          record: {
            WorkId: val("WorkId"),
            ManagerDecision: val("ManagerDecision"),
            ManagerRemarks: val("ManagerRemarks")
          },
          previousId: val("WorkId")
        });
        adopt(data.data || data);
        fillRecord(data.record);
        setStatus(data.message || "Authorized.");
      } catch (err) {
        setStatus(err.message || String(err), true);
      } finally {
        btnAuth.disabled = false;
        DroneAuth.hideLoading();
      }
    });

    var btnSubmit = document.getElementById("btnSubmitWork");
    if (btnSubmit) btnSubmit.addEventListener("click", async function () {
      if (!val("WorkId")) return setStatus("Select an assignment.", true);
      if (!val("AssigneeRemarks")) return setStatus("Add your remarks before submit.", true);
      btnSubmit.disabled = true;
      DroneAuth.showLoading("Submitting…");
      try {
        var data = await gasRequest("submitWorkReport", {
          record: { WorkId: val("WorkId"), AssigneeRemarks: val("AssigneeRemarks") },
          previousId: val("WorkId")
        });
        adopt(data.data || data);
        fillRecord(data.record);
        setStatus(data.message || "Submitted.");
      } catch (err) {
        setStatus(err.message || String(err), true);
      } finally {
        btnSubmit.disabled = false;
        DroneAuth.hideLoading();
      }
    });

    async function syncPack() {
      if (!val("ProjectNo") && KIND !== "projectpack") return setStatus("Choose a project first.", true);
      var projectNo = val("ProjectNo");
      if (KIND === "projectpack" && !projectNo) {
        applyEnquiry(val("EnquiryNo"));
        projectNo = val("ProjectNo");
      }
      if (!projectNo) return setStatus("Choose a project.", true);
      DroneAuth.showLoading("Syncing Google Slides / PPT…");
      try {
        var data = await gasRequest("syncProjectPack", { record: { ProjectNo: projectNo }, projectNo: projectNo });
        adopt(data.data || data);
        if (data.pack) {
          setVal("SlidesUrl", data.pack.SlidesUrl || "");
          setVal("PptxUrl", data.pack.PptxUrl || "");
        }
        renderPacks();
        setStatus(data.message || "Pack synced.");
      } catch (err) {
        setStatus(err.message || String(err), true);
      } finally {
        DroneAuth.hideLoading();
      }
    }
    var btnSync = document.getElementById("btnSyncPack");
    if (btnSync) btnSync.addEventListener("click", syncPack);

    var btnOpen = document.getElementById("btnOpenPack");
    if (btnOpen) btnOpen.addEventListener("click", function () {
      var url = val("SlidesUrl");
      if (!url) return setStatus("Select a project with a pack, or refresh first.", true);
      window.open(url, "_blank", "noopener");
    });
    var btnDl = document.getElementById("btnDownloadPpt");
    if (btnDl) btnDl.addEventListener("click", function () {
      var url = val("PptxUrl");
      if (!url) return setStatus("Select a project with a pack, or refresh first.", true);
      window.open(url, "_blank", "noopener");
    });

    var packBody = document.getElementById("packBody");
    if (packBody) packBody.addEventListener("click", function (ev) {
      var tr = ev.target.closest("tr[data-project]");
      if (!tr) return;
      var projectNo = tr.getAttribute("data-project");
      var pack = (state.projectPacks || []).find(function (row) { return row.ProjectNo === projectNo; });
      if (!pack) return;
      setVal("ProjectNo", pack.ProjectNo);
      setVal("ProjectTitle", pack.ProjectTitle);
      setVal("EnquiryNo", pack.EnquiryNo || "");
      setVal("SlidesUrl", pack.SlidesUrl || "");
      setVal("PptxUrl", pack.PptxUrl || "");
    });

    var reload = document.getElementById("btnReload");
    if (reload) reload.addEventListener("click", load);
  }

  var cfg = window.DRONE_DOC_CONFIG || {};
  var box = document.getElementById("webAppUrl");
  if (!box) {
    box = document.createElement("input");
    box.type = "hidden";
    box.id = "webAppUrl";
    document.body.appendChild(box);
  }
  try {
    if (cfg.webAppUrl) localStorage.setItem("droneDoc.webAppUrl", cfg.webAppUrl);
    box.value = (cfg.webAppUrl || localStorage.getItem("droneDoc.webAppUrl") || "").trim();
  } catch (e) { box.value = cfg.webAppUrl || ""; }

  bind();
  DroneAuth.decorateChrome();
  load();
}());
