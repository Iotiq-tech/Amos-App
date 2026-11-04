/* Session, role gates, loading overlay. Loaded before master.js on every page. */
(function (global) {
  "use strict";

  var KEY = "droneDoc.session";
  var FORM = {
    dashboard: "dashboard",
    enquiry: "enquiry",
    requisition: "requisition",
    pass: "pass",
    store: "store",
    print3d: "print3d",
    purchase: "purchase",
    workassign: "workassign",
    workreport: "workreport",
    projectpack: "projectpack"
  };
  var PAGE_FORM_ = {
    "00_Dashboard.html": "dashboard",
    "01_Enquiry_Sheet.html": "enquiry",
    "02_Store_Requisition.html": "requisition",
    "03_Outside_Test_Pass.html": "pass",
    "04_Store_Stock_Entry.html": "store",
    "05_3D_Print_Job.html": "print3d",
    "06_Purchase_Order.html": "purchase",
    "07_Work_Assign.html": "workassign",
    "08_My_Work.html": "workreport",
    "09_Project_Pack.html": "projectpack"
  };
  var FORM_FILE_ = {
    dashboard: "00_Dashboard.html",
    enquiry: "01_Enquiry_Sheet.html",
    requisition: "02_Store_Requisition.html",
    pass: "03_Outside_Test_Pass.html",
    store: "04_Store_Stock_Entry.html",
    print3d: "05_3D_Print_Job.html",
    purchase: "06_Purchase_Order.html",
    workassign: "07_Work_Assign.html",
    workreport: "08_My_Work.html",
    projectpack: "09_Project_Pack.html"
  };

  function readSession() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeSession(session) {
    localStorage.setItem(KEY, JSON.stringify(session || {}));
  }

  function clearSession() {
    try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
  }

  function token() {
    var s = readSession();
    return s && s.token ? String(s.token) : "";
  }

  function user() {
    return readSession();
  }

  function roleOf() {
    var s = readSession();
    return s && s.role ? String(s.role) : "";
  }

  function isManagement() {
    return roleOf() === "Management";
  }

  function isStore() {
    var r = roleOf();
    return r === "Store Manager" || r === "Store Keeper";
  }

  function isCoordinator() {
    return roleOf() === "Project Coordinator";
  }

  function can(form, mode) {
    var s = readSession();
    if (!s || !s.access) return false;
    var row = s.access[form];
    if (!row) return false;
    if (mode === "edit") return !!row.edit;
    return !!row.view || !!row.edit;
  }

  function ownsProject(ownerUserId, ownerEmail, coordinatorName) {
    var s = readSession();
    if (!s) return false;
    if (isManagement()) return true;
    if (ownerUserId && s.userId && String(ownerUserId) === String(s.userId)) return true;
    if (ownerEmail && s.email && String(ownerEmail).toLowerCase() === String(s.email).toLowerCase()) return true;
    if (isCoordinator() && coordinatorName && s.displayName && String(coordinatorName) === String(s.displayName)) return true;
    return false;
  }

  function canEditProject(enquiry) {
    if (!enquiry) return can("enquiry", "edit") && (isManagement() || isCoordinator());
    if (isManagement()) return true;
    return ownsProject(enquiry.OwnerUserId, enquiry.OwnerEmail, enquiry.Coordinator) && can("enquiry", "edit");
  }

  function pageName() {
    return document.body && document.body.dataset ? document.body.dataset.doc : "";
  }

  function loginHref() {
    return "00_Login.html";
  }

  function homeHref_() {
    var order = ["dashboard", "workreport", "enquiry", "requisition", "pass", "store", "print3d", "purchase", "workassign", "projectpack"];
    for (var i = 0; i < order.length; i++) {
      if (can(order[i], "view") && FORM_FILE_[order[i]]) return FORM_FILE_[order[i]];
    }
    return loginHref();
  }

  function requireLogin() {
    if (pageName() === "login") return true;
    if (!token()) {
      location.href = loginHref() + "?next=" + encodeURIComponent(location.pathname.split("/").pop() || "00_Dashboard.html");
      return false;
    }
    var kind = pageName();
    if (kind && kind !== "login" && !can(kind, "view")) {
      location.href = homeHref_();
      return false;
    }
    return true;
  }

  var loadPctTimer = null;
  var loadPct = 0;

  function loadingMarkup_() {
    return (
      '<div class="drone-stage drone-theme" data-drone-ui="10" aria-hidden="false">' +
        '<div class="drone-stage-bg" aria-hidden="true">' +
          '<div class="drone-stars"></div>' +
          '<div class="drone-haze"></div>' +
          '<div class="drone-sun"></div>' +
          '<div class="drone-hills h1"></div>' +
          '<div class="drone-hills h2"></div>' +
          '<div class="drone-ground"></div>' +
          '<div class="drone-pilot" title="Pilot with transmitter">' +
            '<svg class="pilot-svg" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">' +
              '<ellipse cx="60" cy="152" rx="28" ry="6" fill="rgba(0,0,0,0.35)"/>' +
              '<circle cx="60" cy="28" r="14" fill="#d7c4a8"/>' +
              '<path d="M46 42 Q60 48 74 42 L78 88 Q60 96 42 88 Z" fill="#1f3d5c"/>' +
              '<path d="M42 56 L22 78 L28 82 L48 64" fill="#2a5070"/>' +
              '<path d="M78 56 L98 74 L92 80 L72 64" fill="#2a5070"/>' +
              '<path d="M48 88 L44 148 L54 148 L58 96 Z" fill="#243447"/>' +
              '<path d="M72 88 L76 148 L66 148 L62 96 Z" fill="#243447"/>' +
              '<g class="tx-unit" transform="translate(86 68)">' +
                '<rect x="0" y="0" width="26" height="18" rx="3" fill="#0b1f33" stroke="#f0b429" stroke-width="1.5"/>' +
                '<rect x="4" y="4" width="18" height="6" rx="1" fill="#1a3a55"/>' +
                '<circle cx="8" cy="14" r="2" fill="#f0b429"/>' +
                '<circle cx="18" cy="14" r="2" fill="#8fa3b8"/>' +
                '<path d="M4 -2 L4 -10 M22 -2 L22 -10" stroke="#c5d4e0" stroke-width="1.5" stroke-linecap="round"/>' +
                '<path d="M-2 -10 H10 M16 -10 H28" stroke="#c5d4e0" stroke-width="1.5" stroke-linecap="round"/>' +
                '<circle class="tx-signal" cx="13" cy="-16" r="3" fill="none" stroke="#f0b429" stroke-width="1.2"/>' +
              "</g>" +
              '<path d="M78 70 L90 76" stroke="#d7c4a8" stroke-width="4" stroke-linecap="round"/>' +
            "</svg>" +
            '<div class="pilot-label">PILOT</div>' +
          "</div>" +
          '<div class="drone-path">' +
            '<div class="drone-craft quad">' +
              '<div class="drone-shadow"></div>' +
              '<div class="drone-3d">' +
                '<div class="quad-rig">' +
                  motorArm_(0, false) +
                  motorArm_(1, true) +
                  motorArm_(2, false) +
                  motorArm_(3, true) +
                  '<div class="quad-skids"><span></span><span></span><i></i><i></i></div>' +
                  '<div class="quad-body">' +
                    '<div class="body-face body-bottom"></div>' +
                    '<div class="body-face body-front"></div>' +
                    '<div class="body-face body-back"></div>' +
                    '<div class="body-face body-left"></div>' +
                    '<div class="body-face body-right"></div>' +
                    '<div class="body-face body-top"><img class="body-logo" src="assets/company-logo.jpg" alt="AMOS" onerror="this.onerror=null;this.src=\'assets/Amos.jpg\'"><b class="led g"></b><b class="led r"></b></div>' +
                  "</div>" +
                "</div>" +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div class="link-beam" aria-hidden="true"></div>' +
        "</div>" +
        '<div class="drone-hud">' +
          '<div class="drone-hud-mark tl"></div><div class="drone-hud-mark tr"></div>' +
          '<div class="drone-hud-mark bl"></div><div class="drone-hud-mark br"></div>' +
          '<div class="drone-brand">AMOS</div>' +
          '<div class="cloud-loading-title">Establishing flight link</div>' +
          '<div class="cloud-loading-text" id="cloudLoadingText">Please wait…</div>' +
          '<div class="drone-status-bar">' +
            '<div class="drone-status-track"><div class="drone-status-fill" id="cloudLoadingFill"></div></div>' +
            '<div class="drone-status-meta"><span id="cloudLoadingPct">0%</span><span>LINKING</span></div>' +
          "</div>" +
          '<div class="drone-telemetry"><span>QUAD X4</span><span>TX ACTIVE</span><span>SECURE</span></div>' +
        "</div>" +
      "</div>"
    );
  }

  function motorArm_(index, reverse) {
    return (
      '<div class="quad-arm" style="--i:' + index + '">' +
        '<div class="arm-beam"><span class="arm-top"></span><span class="arm-side"></span><span class="arm-edge"></span></div>' +
        '<div class="motor">' +
          '<div class="prop-wash"></div>' +
          '<div class="prop-blur"></div>' +
          '<div class="prop-rotor prop-spin' + (reverse ? " rev" : "") + '">' +
            '<div class="blade"><i></i><em></em></div>' +
            '<div class="blade b2"><i></i><em></em></div>' +
          "</div>" +
          '<div class="motor-can"></div>' +
          '<div class="motor-hub"></div>' +
        "</div>" +
      "</div>"
    );
  }

  function setLoadPct_(n) {
    loadPct = Math.max(0, Math.min(100, Math.round(n)));
    var fill = document.getElementById("cloudLoadingFill");
    var label = document.getElementById("cloudLoadingPct");
    if (fill) fill.style.width = loadPct + "%";
    if (label) label.textContent = loadPct + "%";
  }

  function startLoadPct_() {
    stopLoadPct_();
    setLoadPct_(0);
    var started = Date.now();
    loadPctTimer = setInterval(function () {
      var t = (Date.now() - started) / 1000;
      // Ease toward 92% while waiting; never finish until hideLoading.
      var target = 92 * (1 - Math.exp(-t / 2.2));
      if (target > loadPct) setLoadPct_(target);
    }, 80);
  }

  function stopLoadPct_() {
    if (loadPctTimer) {
      clearInterval(loadPctTimer);
      loadPctTimer = null;
    }
  }

  function ensureOverlay() {
    var el = document.getElementById("cloudLoading");
    if (!el) {
      el = document.createElement("div");
      el.id = "cloudLoading";
      el.className = "cloud-loading noprint";
      el.hidden = true;
      document.body.appendChild(el);
    }
    if (!el.querySelector('.drone-stage[data-drone-ui="10"]')) {
      el.className = "cloud-loading noprint";
      el.innerHTML = loadingMarkup_();
    }
    return el;
  }

  function showLoading(message) {
    var el = ensureOverlay();
    var text = document.getElementById("cloudLoadingText");
    if (text) text.textContent = message || "Please wait…";
    el.hidden = false;
    startLoadPct_();
  }

  function hideLoading() {
    stopLoadPct_();
    setLoadPct_(100);
    var el = document.getElementById("cloudLoading");
    if (!el) return;
    setTimeout(function () {
      el.hidden = true;
      setLoadPct_(0);
    }, 280);
  }

  function ensureWebAppInput_() {
    var box = document.getElementById("webAppUrl");
    if (!box) {
      box = document.createElement("input");
      box.type = "hidden";
      box.id = "webAppUrl";
      document.body.appendChild(box);
    }
    var cfg = global.DRONE_DOC_CONFIG || {};
    var configured = (cfg.webAppUrl || "").trim();
    var stored = "";
    try {
      if (configured) localStorage.setItem("droneDoc.webAppUrl", configured);
      stored = localStorage.getItem("droneDoc.webAppUrl") || "";
    } catch (e) { stored = ""; }
    box.value = configured || stored || box.value || "";
    return box;
  }

  function accessRows_(s) {
    var access = (s && s.access) || {};
    var labels = {
      dashboard: "Dashboard",
      enquiry: "Enquiry",
      requisition: "Store requisition",
      pass: "Outside test pass",
      store: "Store stock",
      print3d: "3D print",
      purchase: "Purchase order",
      workassign: "Assign work",
      workreport: "My work",
      projectpack: "Project pack"
    };
    return Object.keys(labels).map(function (key) {
      var row = access[key] || {};
      var rights = [];
      if (row.edit) rights.push("Edit");
      else if (row.view) rights.push("View");
      else rights.push("No access");
      return "<tr><td>" + labels[key] + "</td><td>" + rights.join(", ") + "</td></tr>";
    }).join("");
  }

  function fillSettingsPanel_() {
    var s = readSession() || {};
    var cfg = global.DRONE_DOC_CONFIG || {};
    var box = ensureWebAppInput_();
    var url = (box.value || cfg.webAppUrl || "").trim();
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text == null || text === "" ? "—" : String(text);
    };
    set("setUserName", s.displayName || "Not signed in");
    set("setUserRole", s.role || "—");
    set("setUserEmail", s.email || "—");
    set("setUserId", s.userId || "—");
    set("setTeamMode", cfg.teamMode ? "On (shared cloud forms)" : "Off (local Excel allowed)");
    set("setSheetId", cfg.spreadsheetId || "Managed by Apps Script");
    set("setConnState", url ? "Ready" : "No cloud URL configured");
    set("setCloudUrl", url || "—");
    set("setPage", pageName() || "—");
    var urlBox = document.getElementById("settingsWebAppUrl");
    if (urlBox) urlBox.value = url;
    var accessBody = document.getElementById("settingsAccessBody");
    if (accessBody) accessBody.innerHTML = accessRows_(s);
    var canEditUrl = !cfg.teamMode || isManagement();
    var adminBlock = document.getElementById("settingsAdminBlock");
    if (adminBlock) adminBlock.hidden = !canEditUrl;
    var teamReload = document.getElementById("settingsTeamReconnect");
    if (teamReload) teamReload.hidden = canEditUrl;
  }

  function ensureSettingsModal_() {
    if (document.getElementById("amosSettings")) return;
    var wrap = document.createElement("div");
    wrap.id = "amosSettings";
    wrap.className = "settings-modal noprint";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="settings-backdrop" data-settings-close="1"></div>' +
      '<div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">' +
        '<header class="settings-head">' +
          '<div><p class="settings-kicker">AMOS</p><h2 id="settingsTitle">Settings &amp; details</h2></div>' +
          '<button type="button" class="settings-x" data-settings-close="1" aria-label="Close">×</button>' +
        "</header>" +
        '<div class="settings-body">' +
          '<section class="settings-tile">' +
            "<h3>Signed-in user</h3>" +
            '<dl class="settings-dl">' +
              "<div><dt>Name</dt><dd id=\"setUserName\">—</dd></div>" +
              "<div><dt>Role</dt><dd id=\"setUserRole\">—</dd></div>" +
              "<div><dt>Email</dt><dd id=\"setUserEmail\">—</dd></div>" +
              "<div><dt>User ID</dt><dd id=\"setUserId\">—</dd></div>" +
              "<div><dt>This page</dt><dd id=\"setPage\">—</dd></div>" +
            "</dl>" +
          "</section>" +
          '<section class="settings-tile" id="settingsMailTile">' +
            "<h3>Email test</h3>" +
            '<p class="settings-hint">Mail sends from the Google account that deployed Apps Script. Use a real address on the Users sheet (not example.com).</p>' +
            '<div class="settings-actions">' +
              '<button type="button" class="settings-btn primary" id="btnSettingsTestMail">Send test email to me</button>' +
            "</div>" +
            '<p class="settings-pwd-msg" id="settingsMailMsg" aria-live="polite"></p>' +
          "</section>" +
          '<section class="settings-tile" id="settingsPasswordTile">' +
            "<h3>Change password</h3>" +
            '<label class="settings-label">Current password' +
              '<input id="settingsPwdCurrent" type="password" autocomplete="current-password">' +
            "</label>" +
            '<label class="settings-label">New password' +
              '<input id="settingsPwdNew" type="password" autocomplete="new-password" placeholder="At least 8 characters">' +
            "</label>" +
            '<label class="settings-label">Confirm new password' +
              '<input id="settingsPwdConfirm" type="password" autocomplete="new-password">' +
            "</label>" +
            '<div class="settings-actions">' +
              '<button type="button" class="settings-btn primary" id="btnSettingsChangePwd">Update password</button>' +
            "</div>" +
            '<p class="settings-pwd-msg" id="settingsPwdMsg" aria-live="polite"></p>' +
          "</section>" +
          '<section class="settings-tile">' +
            "<h3>Cloud connection</h3>" +
            '<dl class="settings-dl">' +
              "<div><dt>Status</dt><dd id=\"setConnState\">—</dd></div>" +
              "<div><dt>Team mode</dt><dd id=\"setTeamMode\">—</dd></div>" +
              "<div><dt>Spreadsheet</dt><dd id=\"setSheetId\">—</dd></div>" +
              "<div><dt>Cloud URL</dt><dd id=\"setCloudUrl\" class=\"settings-url\">—</dd></div>" +
            "</dl>" +
            '<div id="settingsAdminBlock" class="settings-admin">' +
              '<label class="settings-label">Edit cloud web app URL' +
                '<input id="settingsWebAppUrl" type="url" placeholder="Apps Script /exec URL">' +
              "</label>" +
              '<div class="settings-actions">' +
                '<button type="button" class="settings-btn" id="btnSettingsSaveUrl">Save URL</button>' +
                '<button type="button" class="settings-btn primary" id="btnSettingsReconnect">Reconnect</button>' +
              "</div>" +
            "</div>" +
            '<div class="settings-actions" id="settingsTeamReconnect" hidden>' +
              '<button type="button" class="settings-btn primary" id="btnSettingsReloadOnly">Reload connection</button>' +
            "</div>" +
          "</section>" +
          '<section class="settings-tile">' +
            "<h3>Form access</h3>" +
            '<table class="settings-table"><thead><tr><th>Form</th><th>Rights</th></tr></thead><tbody id="settingsAccessBody"></tbody></table>' +
          "</section>" +
        "</div>" +
      "</div>";
    document.body.appendChild(wrap);

    wrap.addEventListener("click", function (ev) {
      if (ev.target && ev.target.getAttribute("data-settings-close")) closeSettings_();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeSettings_();
    });

    var saveBtn = document.getElementById("btnSettingsSaveUrl");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var urlBox = document.getElementById("settingsWebAppUrl");
        var main = ensureWebAppInput_();
        var url = (urlBox && urlBox.value || "").trim();
        main.value = url;
        try { localStorage.setItem("droneDoc.webAppUrl", url); } catch (e) { /* ignore */ }
        fillSettingsPanel_();
        var status = document.getElementById("status");
        if (status) {
          status.textContent = url ? "Cloud URL saved in settings." : "Cloud URL cleared.";
          status.classList.remove("bad");
        }
      });
    }
    function reconnectNow_() {
      var urlBox = document.getElementById("settingsWebAppUrl");
      var main = ensureWebAppInput_();
      if (urlBox && urlBox.value) main.value = (urlBox.value || "").trim();
      try { localStorage.setItem("droneDoc.webAppUrl", main.value); } catch (e) { /* ignore */ }
      closeSettings_();
      var cloud = document.getElementById("btnCloud");
      var reload = document.getElementById("btnReload");
      if (cloud) cloud.click();
      else if (reload) reload.click();
      else location.reload();
    }
    var reconnect = document.getElementById("btnSettingsReconnect");
    if (reconnect) reconnect.addEventListener("click", reconnectNow_);
    var reloadOnly = document.getElementById("btnSettingsReloadOnly");
    if (reloadOnly) reloadOnly.addEventListener("click", reconnectNow_);

    var pwdBtn = document.getElementById("btnSettingsChangePwd");
    if (pwdBtn) pwdBtn.addEventListener("click", changePasswordFromSettings_);
    var mailBtn = document.getElementById("btnSettingsTestMail");
    if (mailBtn) mailBtn.addEventListener("click", testMailFromSettings_);
  }

  function testMailFromSettings_() {
    var msg = document.getElementById("settingsMailMsg");
    var btn = document.getElementById("btnSettingsTestMail");
    function setMsg(text, bad) {
      if (!msg) return;
      msg.textContent = text || "";
      msg.classList.toggle("bad", !!bad);
      msg.classList.toggle("ok", !bad && !!text);
    }
    if (!token()) {
      setMsg("Sign in first.", true);
      return;
    }
    setMsg("Sending test email…", false);
    if (btn) btn.disabled = true;
    showLoading("Sending test email…");
    settingsGasRequest_("testMail", {}).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || "Test mail failed.");
      setMsg(data.message || "Test mail sent.", false);
    }).catch(function (err) {
      var text = err.message || String(err);
      if (/unknown action/i.test(text)) {
        text = "Apps Script is still an old version (no testMail yet). In the Google Sheet: Extensions → Apps Script → paste the latest GoogleAppsScript.gs → Deploy → Manage deployments → Edit → New version → Deploy. Then Ctrl+F5 and try again.";
      }
      setMsg(text, true);
    }).then(function () {
      if (btn) btn.disabled = false;
      hideLoading();
    });
  }

  function settingsGasRequest_(action, payload) {
    var box = ensureWebAppInput_();
    var url = (box.value || (global.DRONE_DOC_CONFIG && global.DRONE_DOC_CONFIG.webAppUrl) || "").trim();
    if (!url) return Promise.reject(new Error("Cloud is not configured. Check Connection settings."));
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
        try { delete global[cb]; } catch (e) { global[cb] = undefined; }
        if (script.parentNode) script.remove();
        if (err) reject(err); else resolve(data);
      }
      global[cb] = function (data) { finish(null, data); };
      var body = Object.assign({ action: action, token: token() }, payload || {});
      var params = new URLSearchParams();
      params.set("callback", cb);
      params.set("action", action);
      params.set("payload", JSON.stringify(body));
      script.onerror = function () {
        finish(new Error("Could not reach the cloud service."));
      };
      script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + params.toString();
      document.head.appendChild(script);
    });
  }

  function changePasswordFromSettings_() {
    var msg = document.getElementById("settingsPwdMsg");
    var current = document.getElementById("settingsPwdCurrent");
    var next = document.getElementById("settingsPwdNew");
    var confirm = document.getElementById("settingsPwdConfirm");
    var btn = document.getElementById("btnSettingsChangePwd");
    function setMsg(text, bad) {
      if (!msg) return;
      msg.textContent = text || "";
      msg.classList.toggle("bad", !!bad);
      msg.classList.toggle("ok", !bad && !!text);
    }
    if (!token()) {
      setMsg("Sign in first to change your password.", true);
      return;
    }
    var cur = (current && current.value) || "";
    var neu = (next && next.value) || "";
    var conf = (confirm && confirm.value) || "";
    if (!cur || !neu) {
      setMsg("Enter your current password and a new password.", true);
      return;
    }
    if (neu.length < 8) {
      setMsg("New password must be at least 8 characters.", true);
      return;
    }
    if (neu !== conf) {
      setMsg("New password and confirmation do not match.", true);
      return;
    }
    setMsg("Updating password…", false);
    if (btn) btn.disabled = true;
    showLoading("Updating password…");
    settingsGasRequest_("changePassword", {
      currentPassword: cur,
      newPassword: neu,
      confirmPassword: conf
    }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || "Password update failed.");
      if (current) current.value = "";
      if (next) next.value = "";
      if (confirm) confirm.value = "";
      setMsg(data.message || "Password updated.", false);
      var status = document.getElementById("status");
      if (status) {
        status.textContent = "Password updated.";
        status.classList.remove("bad");
      }
    }).catch(function (err) {
      var text = err.message || String(err);
      if (/unknown action/i.test(text)) {
        text = "Apps Script is still an old version. Paste the latest GoogleAppsScript.gs and deploy a New version, then try again.";
      }
      setMsg(text, true);
    }).then(function () {
      if (btn) btn.disabled = false;
      hideLoading();
    });
  }

  function openSettings_() {
    ensureSettingsModal_();
    fillSettingsPanel_();
    var modal = document.getElementById("amosSettings");
    if (modal) modal.hidden = false;
  }

  function closeSettings_() {
    var modal = document.getElementById("amosSettings");
    if (modal) modal.hidden = true;
  }

  var NAV_TIPS_ = {
    "00_Dashboard.html": {
      title: "Dashboard",
      text: "Live overview of open projects, pending approvals, and recent notifications."
    },
    "01_Enquiry_Sheet.html": {
      title: "Enquiry",
      text: "Start a project: capture client need, create enquiry and project numbers, set owner and priority."
    },
    "02_Store_Requisition.html": {
      title: "Store",
      text: "Request materials against an enquiry. Coordinator decides; lines sync to the store workbook."
    },
    "03_Outside_Test_Pass.html": {
      title: "Test pass",
      text: "Issue a leave pass for outside testing using the linked requisition. Store and coordinator approve."
    },
    "04_Store_Stock_Entry.html": {
      title: "Store stock",
      text: "Receive items into a store location. Stock on hand updates and can link to a project."
    },
    "05_3D_Print_Job.html": {
      title: "3D print",
      text: "Log a print job on a project. Coordinator approval draws filament from the 3D store."
    },
    "06_Purchase_Order.html": {
      title: "Purchase order",
      text: "Issue a vendor PO with editable vendor, terms, company logo, and authorize signature image."
    },
    "07_Work_Assign.html": {
      title: "Assign work",
      text: "Reporting manager assigns project tasks by name, department, and workflow stage. Syncs the Google PPT pack."
    },
    "08_My_Work.html": {
      title: "My work",
      text: "See work assigned to you, submit completion with remarks for manager authorization."
    },
    "09_Project_Pack.html": {
      title: "Project pack",
      text: "Management only: review and download the standard project Slides/PPT documentation pack."
    }
  };

  function tipHtml_(title, text) {
    return '<span class="nav-tip" role="tooltip"><strong>' + title + "</strong><span>" + text + "</span></span>";
  }

  function enhanceNavTips_(nav) {
    if (!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll("a[href]"), function (link) {
      if (link.classList.contains("nav-demo")) return;
      if (link.querySelector(".nav-tip")) return;
      var file = (link.getAttribute("href") || "").split("?")[0];
      var tip = NAV_TIPS_[file];
      if (!tip) return;
      link.insertAdjacentHTML("beforeend", tipHtml_(tip.title, tip.text));
    });
  }

  function ensureDemoModal_() {
    if (document.getElementById("amosDemo")) return;
    var wrap = document.createElement("div");
    wrap.id = "amosDemo";
    wrap.className = "demo-modal noprint";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="demo-backdrop" data-demo-close="1"></div>' +
      '<div class="demo-panel" role="dialog" aria-modal="true" aria-labelledby="demoTitle">' +
        '<header class="demo-head">' +
          "<div>" +
            '<p class="demo-kicker">AMOS</p>' +
            '<h2 id="demoTitle">Form usage demo</h2>' +
            "<p>Hover any top tab for a quick tip. Use this guide to walk the full project flow.</p>" +
          "</div>" +
          '<button type="button" class="settings-x" data-demo-close="1" aria-label="Close">×</button>' +
        "</header>" +
        '<div class="demo-body" id="demoBody"></div>' +
      "</div>";
    document.body.appendChild(wrap);
    fillDemoBody_();
    wrap.addEventListener("click", function (ev) {
      if (ev.target && ev.target.getAttribute("data-demo-close")) closeDemo_();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeDemo_();
    });
  }

  function fillDemoBody_() {
    var body = document.getElementById("demoBody");
    if (!body) return;
    var cards = [
      ["dashboard", "01", "Dashboard", "See open projects, who is waiting, and mail notifications after cloud saves.", "00_Dashboard.html", "Open dashboard"],
      ["enquiry", "02", "Enquiry", "Create the enquiry and project number. This locks the chain for every later form.", "01_Enquiry_Sheet.html", "Open enquiry"],
      ["requisition", "03", "Store requisition", "Pick the enquiry, add material lines, and send for coordinator decision.", "02_Store_Requisition.html", "Open store"],
      ["pass", "04", "Outside test pass", "Link the requisition, list items leaving site, then store + coordinator release.", "03_Outside_Test_Pass.html", "Open test pass"],
      ["store", "05", "Store stock", "Receive goods into a location. Optional project link keeps receipts on the same number.", "04_Store_Stock_Entry.html", "Open stock"],
      ["print3d", "06", "3D print", "Raise a print on a project. After approval, filament is taken from the 3D store.", "05_3D_Print_Job.html", "Open 3D print"],
      ["purchase", "07", "Purchase order", "Send a PO to a vendor. Edit vendor name, terms, and authorize signature image.", "06_Purchase_Order.html", "Open purchase order"],
      ["workassign", "08", "Assign work", "Managers assign project tasks; saving updates the shared Google project PPT pack.", "07_Work_Assign.html", "Open assign work"],
      ["workreport", "09", "My work", "Users submit assigned work with remarks for manager authorization.", "08_My_Work.html", "Open my work"],
      ["projectpack", "10", "Project pack", "Management downloads/reviews the standard project documentation PPT.", "09_Project_Pack.html", "Open project pack"]
    ];
    var html = cards.filter(function (row) { return can(row[0], "view"); }).map(function (row) {
      return '<article class="demo-card"><div class="step">' + row[1] + "</div><h3>" + row[2] + "</h3><p>" + row[3] + '</p><a href="' + row[4] + '">' + row[5] + "</a></article>";
    }).join("");
    html += '<div class="demo-flow"><b>Your role only shows pages marked View or Edit on the FormAccess sheet in the master Excel.</b> Suggested flow: Enquiry → Store requisition → Outside test pass → Store stock / 3D print / Purchase order as needed.</div>';
    body.innerHTML = html || "<p>No forms are enabled for your role. Ask the project owner to update FormAccess.</p>";
  }

  function openDemo_() {
    ensureDemoModal_();
    fillDemoBody_();
    var modal = document.getElementById("amosDemo");
    if (modal) modal.hidden = false;
  }

  function closeDemo_() {
    var modal = document.getElementById("amosDemo");
    if (modal) modal.hidden = true;
  }

  function decorateChrome() {
    var bar = document.querySelector(".toolbar");
    if (!bar || pageName() === "login") return;
    var s = readSession();
    var cfg = global.DRONE_DOC_CONFIG || {};

    ensureWebAppInput_();
    ensureSettingsModal_();

    /* Hide legacy sheet URL controls — details live in Settings */
    bar.querySelectorAll("label.cloud").forEach(function (el) { el.hidden = true; });
    var legacyCloud = document.getElementById("btnCloud");
    if (legacyCloud) legacyCloud.hidden = true;
    var urlInput = document.getElementById("webAppUrl");
    if (urlInput && urlInput.closest && urlInput.closest("label.cloud")) {
      /* keep value; label already hidden */
    } else if (urlInput && urlInput.type !== "hidden" && !urlInput.closest("#amosSettings")) {
      urlInput.type = "hidden";
    }

    var nav = bar.querySelector(".toolbar-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "toolbar-nav";
      nav.setAttribute("aria-label", "Forms");
      bar.insertBefore(nav, bar.firstChild);
    }
    var actions = bar.querySelector(".toolbar-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "toolbar-actions";
      bar.appendChild(actions);
    }

    /* Move existing nav links into tab strip; buttons/status into actions */
    Array.prototype.slice.call(bar.children).forEach(function (child) {
      if (child === nav || child === actions) return;
      if (child.tagName === "A") nav.appendChild(child);
      else actions.appendChild(child);
    });

    function hasLink(href) {
      return !!bar.querySelector('a[href="' + href + '"]');
    }
    function ensureNavLink(href, id, label, form) {
      if (!can(form, "view")) return;
      if (hasLink(href)) return;
      var a = document.createElement("a");
      a.id = id;
      a.href = href;
      a.textContent = label;
      nav.appendChild(a);
    }
    ensureNavLink("00_Dashboard.html", "navDashboard", "Dashboard", "dashboard");
    ensureNavLink("01_Enquiry_Sheet.html", "navEnquiry", "Enquiry", "enquiry");
    ensureNavLink("02_Store_Requisition.html", "navStore", "Store", "requisition");
    ensureNavLink("03_Outside_Test_Pass.html", "navPass", "Test pass", "pass");
    ensureNavLink("04_Store_Stock_Entry.html", "navStoreStock", "Store stock", "store");
    ensureNavLink("05_3D_Print_Job.html", "navPrint3d", "3D print", "print3d");
    ensureNavLink("06_Purchase_Order.html", "navPurchase", "Purchase order", "purchase");
    ensureNavLink("07_Work_Assign.html", "navWorkAssign", "Assign work", "workassign");
    ensureNavLink("08_My_Work.html", "navMyWork", "My work", "workreport");
    ensureNavLink("09_Project_Pack.html", "navProjectPack", "Project pack", "projectpack");

    /* Hide tabs the signed-in role cannot view (FormAccess CanView = 0). */
    Array.prototype.slice.call(nav.querySelectorAll("a[href]")).forEach(function (link) {
      if (link.classList.contains("nav-demo")) return;
      var file = (link.getAttribute("href") || "").split("?")[0];
      var form = PAGE_FORM_[file];
      if (form && !can(form, "view")) link.remove();
    });

    var demo = document.getElementById("navDemo");
    if (!demo) {
      demo = document.createElement("a");
      demo.id = "navDemo";
      demo.href = "#";
      demo.className = "nav-demo";
      demo.textContent = "Demo";
      demo.addEventListener("click", function (ev) {
        ev.preventDefault();
        openDemo_();
      });
      nav.appendChild(demo);
    }
    if (!demo.querySelector(".nav-tip")) {
      demo.insertAdjacentHTML("beforeend", tipHtml_("Demo", "Open the usage guide for every form and the recommended project flow."));
    }
    enhanceNavTips_(nav);
    ensureDemoModal_();

    var chip = document.getElementById("userChip");
    if (!chip) {
      chip = document.createElement("span");
      chip.id = "userChip";
      chip.className = "user-chip";
      actions.appendChild(chip);
    }
    chip.textContent = s ? (s.displayName + " · " + s.role) : "Not signed in";

    var settingsBtn = document.getElementById("btnSettings");
    if (!settingsBtn) {
      settingsBtn = document.createElement("button");
      settingsBtn.type = "button";
      settingsBtn.id = "btnSettings";
      settingsBtn.className = "settings-trigger";
      settingsBtn.textContent = "Settings";
      settingsBtn.title = "Connection, user, and access details";
      settingsBtn.addEventListener("click", openSettings_);
      actions.appendChild(settingsBtn);
    }

    var out = document.getElementById("btnLogout");
    if (!out) {
      out = document.createElement("button");
      out.type = "button";
      out.id = "btnLogout";
      out.textContent = "Log out";
      out.addEventListener("click", function () {
        clearSession();
        location.href = loginHref();
      });
      actions.appendChild(out);
    }

    if (cfg.teamMode) {
      ["btnOpen", "fileFallback"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = true;
      });
    }

    var save = document.getElementById("btnSave");
    if (save) {
      save.classList.add("save-btn");
      var kind = pageName();
      var editable = can(kind, "edit");
      if (kind === "enquiry" || kind === "requisition" || kind === "pass" || kind === "store" || kind === "print3d" || kind === "purchase" || kind === "workassign" || kind === "workreport" || kind === "projectpack") {
        save.disabled = !editable;
        if (!editable) save.title = "Your role can view this form but cannot save changes.";
      }
    }

    document.querySelectorAll("[data-role-edit]").forEach(function (el) {
      var form = el.getAttribute("data-role-edit");
      if (!can(form, "edit")) el.setAttribute("disabled", "disabled");
    });

    document.querySelectorAll(".page .section, .dash-card, .dash .section").forEach(function (el) {
      el.classList.add("tile-glow");
    });
  }

  global.DroneAuth = {
    FORM: FORM,
    readSession: readSession,
    writeSession: writeSession,
    clearSession: clearSession,
    token: token,
    user: user,
    roleOf: roleOf,
    isManagement: isManagement,
    isStore: isStore,
    isCoordinator: isCoordinator,
    can: can,
    ownsProject: ownsProject,
    canEditProject: canEditProject,
    requireLogin: requireLogin,
    showLoading: showLoading,
    hideLoading: hideLoading,
    decorateChrome: decorateChrome,
    openSettings: openSettings_,
    closeSettings: closeSettings_,
    openDemo: openDemo_,
    closeDemo: closeDemo_,
    loginHref: loginHref
  };
}(window));
