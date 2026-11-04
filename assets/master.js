/* Links the three A4 forms to Drone_Project_Master.xlsx.
   Keep the save rules in step with GoogleAppsScript.gs. */
(function () {
  "use strict";

  const KIND = document.body.dataset.doc;
  const FILE = {
    enquiry: ["Enquiry_Sheet", "01_Enquiry_Sheet.html", "Enquiry"],
    requisition: ["Store_Requisition", "02_Store_Requisition.html", "Store requisition"],
    pass: ["Outside_Test_Pass", "03_Outside_Test_Pass.html", "Outside test pass"],
    store: ["Store_Stock_Entry", "04_Store_Stock_Entry.html", "Store stock"],
    print3d: ["3D_Print", "05_3D_Print_Job.html", "3D print"],
    purchase: ["Purchase_Order", "06_Purchase_Order.html", "Purchase order"]
  };
  const STAGES = [
    ["Enquiry", 1],
    ["Store requisition", 2],
    ["Outside test pass", 3],
    ["POC", 4],
    ["Pilot", 5],
    ["Full production", 6],
    ["Testing", 7]
  ];
  const PROCESS_TO_TRAIL = {
    "Outside test": "Outside test pass",
    POC: "POC",
    Pilot: "Pilot",
    "Full production": "Full production",
    Testing: "Testing"
  };
  const NUMERIC = new Set([
    "LastNumber", "Pad", "Year", "LineNo", "QtyRequested", "QtyApproved", "QtyCarried",
    "Quantity", "EstimatedBudget", "StageOrder", "Amount", "Revision", "Qty", "Rate",
    "TaxPercent", "Subtotal", "TaxAmount", "GrandTotal"
  ]);
  const DEFAULT_LISTS = {
    Source: ["Client", "Management"],
    ProductFamily: ["Drone", "Electronics", "Drone + Electronics"],
    Priority: ["High", "Medium", "Low"],
    DocStatus: ["Draft", "Submitted", "Approved", "Issued", "Closed", "Rejected", "On hold"],
    Decision: ["Pending", "Approved", "Rejected", "On hold"],
    ProcessStage: ["Outside test", "POC", "Pilot", "Full production", "Testing"],
    UOM: ["Nos", "Set", "Mtr", "Kg", "Lot"],
    Department: ["Projects", "Store", "Flight Test", "Electronics", "Management", "External"],
    Currency: ["INR", "USD", "EUR"],
    PoStatus: ["Draft", "Submitted", "Approved", "Issued", "Closed", "Rejected", "On hold"]
  };
  const DEFAULT_PO_TERMS =
    "1. Goods and services must match the item description and specifications on this purchase order.\n" +
    "2. Delivery must meet the stated delivery date unless AMOS agrees a change in writing.\n" +
    "3. Vendor invoices must quote this PO number; payment follows the payment terms stated above.\n" +
    "4. Title and risk pass on accepted delivery at the delivery place named on this PO.\n" +
    "5. AMOS may reject non-conforming goods at the vendor's cost and cancel undelivered balances for breach.";

  const state = {
    settings: {},
    series: [],
    people: [],
    drones: [],
    electronics: [],
    budgets: [],
    materials: [],
    locations: [],
    stages: [],
    lists: Object.assign({}, DEFAULT_LISTS),
    enquiries: [],
    requisitions: [],
    requisitionLines: [],
    passes: [],
    passLines: [],
    trail: [],
    documents: [],
    storeLocations: [],
    storeStock: [],
    storeReceipts: [],
    printJobs: [],
    purchaseOrders: [],
    purchaseOrderLines: [],
    notifications: [],
    users: [],
    formAccess: []
  };

  let workbook = null;
  let fileHandle = null;
  let mode = "none";
  let dirty = false;
  let suppress = false;
  let previousId = "";
  let previousEnquiryNo = "";
  let describeExisting = function () { return []; };

  const page = {};

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function norm(value) {
    return String(value == null ? "" : value).trim();
  }

  function tokens(value) {
    return norm(value).split(";").map(function (part) { return part.trim(); }).filter(Boolean);
  }

  function joinTokens(list) {
    const out = [];
    list.forEach(function (item) {
      if (item && out.indexOf(item) < 0) out.push(item);
    });
    return out.join("; ");
  }

  function today() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function nowStamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, "0"); };
    return today() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function seqOf(id) {
    const match = String(id || "").match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function seriesBy(key) {
    const row = state.series.find(function (item) { return item.SeriesKey === key; });
    if (!row) throw new Error("Number series " + key + " is missing from the workbook.");
    return row;
  }

  function formatId(series, n) {
    const pad = Number(series.Pad) || 3;
    return String(series.Prefix) + String(series.Year) + "-" + String(n).padStart(pad, "0");
  }

  function allocate(key, used) {
    const series = seriesBy(key);
    let n = Number(series.LastNumber) + 1;
    let id = formatId(series, n);
    const taken = new Set((used || []).map(String));
    while (taken.has(id)) {
      n += 1;
      id = formatId(series, n);
    }
    return id;
  }

  function commitSeries(key, id) {
    const series = seriesBy(key);
    const n = seqOf(id);
    if (n > Number(series.LastNumber)) series.LastNumber = n;
  }

  function peek(key) {
    if (!state.series.length) return "";
    try { return allocate(key, []); } catch (err) { return ""; }
  }

  function fileNameFor(kind, docId, projectNo) {
    return docId + "_" + projectNo + "_" + FILE[kind][0];
  }

  function openLink(kind, enquiryNo, ids) {
    const params = new URLSearchParams();
    params.set("enq", enquiryNo);
    if (ids.req) params.set("req", ids.req);
    if (ids.pass) params.set("pass", ids.pass);
    return FILE[kind][1] + "?" + params.toString();
  }

  function numOrBlank(value) {
    if (value === "" || value == null) return "";
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
  }

  function plain(value) {
    if (value == null) return "";
    if (value instanceof Date) {
      const p = function (n) { return String(n).padStart(2, "0"); };
      return value.getFullYear() + "-" + p(value.getMonth() + 1) + "-" + p(value.getDate());
    }
    if (typeof value === "object") {
      if (Array.isArray(value.richText)) return value.richText.map(function (part) { return part.text || ""; }).join("").trim();
      if (value.text && !value.formula) return String(value.text).trim();
      if (Object.prototype.hasOwnProperty.call(value, "result")) return plain(value.result);
      return "";
    }
    return typeof value === "string" ? value.trim() : value;
  }

  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? norm(el.value) : "";
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = value == null ? "" : String(value);
    if (el.tagName === "SELECT" && v && ![].some.call(el.options, function (opt) { return opt.value === v; })) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    }
    el.value = v;
  }

  function toLocalInput(value) {
    const s = norm(value);
    if (!s) return "";
    if (s.indexOf("T") >= 0) return s.slice(0, 16);
    if (s.length >= 16 && s.charAt(10) === " ") return s.slice(0, 10) + "T" + s.slice(11, 16);
    return s;
  }

  function fromLocalInput(value) {
    return norm(value).replace("T", " ").slice(0, 16);
  }

  function setDate(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const s = value == null ? "" : String(value);
    if (el.type === "date") el.value = s.slice(0, 10);
    else if (el.type === "datetime-local") el.value = toLocalInput(s);
    else el.value = s;
  }

  function setStatus(message, bad) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("bad", !!bad);
  }

  function showBanner(message) {
    const el = document.getElementById("banner");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function fillSelect(id, options, keep) {
    const el = document.getElementById(id);
    if (!el || el.tagName !== "SELECT") return;
    const current = keep !== undefined ? keep : el.value;
    const opts = options.slice();
    if (current && !opts.some(function (opt) { return opt.value === current; })) {
      opts.push({ value: current, label: current });
    }
    el.innerHTML = opts.map(function (opt) {
      return '<option value="' + esc(opt.value) + '">' + esc(opt.label) + "</option>";
    }).join("");
    el.value = current && [].some.call(el.options, function (opt) { return opt.value === current; })
      ? current
      : (opts[0] ? opts[0].value : "");
  }

  function fillDataList(id, values) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = values.filter(Boolean).map(function (value) {
      return '<option value="' + esc(value) + '"></option>';
    }).join("");
  }

  function listValues(name, fallback) {
    const values = state.lists && state.lists[name];
    return values && values.length ? values : (fallback || []);
  }

  function people(role) {
    const rows = state.people.filter(function (person) {
      return norm(person.Active || "Yes").toLowerCase() !== "no";
    }).filter(function (person) {
      return !role || person.Role === role;
    }).map(function (person) { return person.PersonName; }).filter(Boolean);
    if (role && !rows.length) return people("");
    return rows;
  }

  function headerList(ws) {
    const headers = [];
    const row = ws.getRow(1);
    const max = Math.max(ws.columnCount || 0, 1);
    for (let c = 1; c <= max; c++) {
      const header = norm(plain(row.getCell(c).value));
      if (!header) break;
      headers.push(header);
    }
    return headers;
  }

  function readObjects(ws) {
    if (!ws) return [];
    const headers = headerList(ws);
    const out = [];
    for (let r = 2; r <= (ws.rowCount || 1); r++) {
      const obj = {};
      let any = false;
      headers.forEach(function (header, index) {
        const value = plain(ws.getRow(r).getCell(index + 1).value);
        obj[header] = value;
        if (value !== "" && value != null) any = true;
      });
      if (any) out.push(obj);
    }
    return out;
  }

  function readColumns(ws) {
    const cols = {};
    if (!ws) return cols;
    const headers = headerList(ws);
    headers.forEach(function (header) { cols[header] = []; });
    for (let r = 2; r <= (ws.rowCount || 1); r++) {
      headers.forEach(function (header, index) {
        const value = norm(plain(ws.getRow(r).getCell(index + 1).value));
        if (value) cols[header].push(value);
      });
    }
    return cols;
  }

  function readSettings(ws) {
    const out = {};
    if (!ws) return out;
    for (let r = 2; r <= (ws.rowCount || 1); r++) {
      const key = norm(plain(ws.getRow(r).getCell(1).value));
      if (key) out[key] = plain(ws.getRow(r).getCell(2).value);
    }
    return out;
  }

  function adoptState(data) {
    Object.keys(state).forEach(function (key) {
      if (data[key] !== undefined) state[key] = data[key];
    });
    state.lists = Object.assign({}, DEFAULT_LISTS, data.lists || {});
    state.passes = data.passes || data.gatePasses || state.passes;
    state.passLines = data.passLines || data.gatePassLines || state.passLines;
  }

  function readWorkbook() {
    const need = ["Settings", "NumberSeries", "People", "Enquiries", "Requisitions", "RequisitionLines", "GatePasses", "GatePassLines", "ProjectTrail", "Documents"];
    need.forEach(function (name) {
      if (!workbook.getWorksheet(name)) throw new Error(name + " is missing. Open Drone_Project_Master.xlsx.");
    });
    adoptState({
      settings: readSettings(workbook.getWorksheet("Settings")),
      series: readObjects(workbook.getWorksheet("NumberSeries")),
      people: readObjects(workbook.getWorksheet("People")),
      drones: readObjects(workbook.getWorksheet("DroneTypes")),
      electronics: readObjects(workbook.getWorksheet("Electronics")),
      budgets: readObjects(workbook.getWorksheet("Budgets")),
      materials: readObjects(workbook.getWorksheet("Materials")),
      locations: readObjects(workbook.getWorksheet("Locations")),
      stages: readObjects(workbook.getWorksheet("Stages")),
      lists: readColumns(workbook.getWorksheet("Lists")),
      enquiries: readObjects(workbook.getWorksheet("Enquiries")),
      requisitions: readObjects(workbook.getWorksheet("Requisitions")),
      requisitionLines: readObjects(workbook.getWorksheet("RequisitionLines")),
      passes: readObjects(workbook.getWorksheet("GatePasses")),
      passLines: readObjects(workbook.getWorksheet("GatePassLines")),
      trail: readObjects(workbook.getWorksheet("ProjectTrail")),
      documents: readObjects(workbook.getWorksheet("Documents")),
      storeLocations: workbook.getWorksheet("StoreLocations") ? readObjects(workbook.getWorksheet("StoreLocations")) : [],
      storeStock: workbook.getWorksheet("StoreStock") ? readObjects(workbook.getWorksheet("StoreStock")) : [],
      storeReceipts: workbook.getWorksheet("StoreReceipts") ? readObjects(workbook.getWorksheet("StoreReceipts")) : [],
      printJobs: workbook.getWorksheet("PrintJobs") ? readObjects(workbook.getWorksheet("PrintJobs")) : [],
      purchaseOrders: workbook.getWorksheet("PurchaseOrders") ? readObjects(workbook.getWorksheet("PurchaseOrders")) : [],
      purchaseOrderLines: workbook.getWorksheet("PurchaseOrderLines") ? readObjects(workbook.getWorksheet("PurchaseOrderLines")) : [],
      notifications: workbook.getWorksheet("Notifications") ? readObjects(workbook.getWorksheet("Notifications")) : [],
      users: workbook.getWorksheet("Users") ? readObjects(workbook.getWorksheet("Users")) : [],
      formAccess: workbook.getWorksheet("FormAccess") ? readObjects(workbook.getWorksheet("FormAccess")) : []
    });
  }

  function numericValue(key, value) {
    if (value == null || value === "") return null;
    if (!NUMERIC.has(key)) return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }

  function flushSheet(name, records) {
    const ws = workbook.getWorksheet(name);
    if (!ws) throw new Error("Missing sheet " + name);
    const headers = headerList(ws);
    const asText = new Set(["EnquiryNo", "ProjectNo", "EnquiryDate", "RequiredBy", "ContactPhone", "RequisitionID", "ReqDate", "CoordinatorDate", "StoreDate", "PassID", "PassDate", "ValidFrom", "ValidUntil", "ReturnDue", "UpdatedAt", "FileName", "LinkKey", "OpenLink", "ItemCode", "BudgetCode", "DocID", "EnquiryNo"]);
    const last = Math.max(ws.rowCount || 1, records.length + 1);
    for (let r = 2; r <= last; r++) {
      const row = ws.getRow(r);
      const rec = records[r - 2];
      headers.forEach(function (header, index) {
        const cell = row.getCell(index + 1);
        if (!rec) {
          cell.value = null;
          return;
        }
        const value = numericValue(header, rec[header] == null ? "" : rec[header]);
        if (value == null || value === "") {
          cell.value = null;
          return;
        }
        if (asText.has(header)) {
          cell.value = String(value);
          cell.numFmt = "@";
        } else cell.value = value;
      });
    }
  }

  function writeSeriesLast() {
    const ws = workbook.getWorksheet("NumberSeries");
    const headers = headerList(ws);
    const keyCol = headers.indexOf("SeriesKey") + 1;
    const lastCol = headers.indexOf("LastNumber") + 1;
    state.series.forEach(function (series) {
      for (let r = 2; r <= ws.rowCount; r++) {
        if (norm(plain(ws.getRow(r).getCell(keyCol).value)) === series.SeriesKey) {
          ws.getRow(r).getCell(lastCol).value = Number(series.LastNumber) || 0;
        }
      }
    });
  }

  function writeSetting(key, value) {
    const ws = workbook.getWorksheet("Settings");
    if (!ws) return;
    for (let r = 2; r <= ws.rowCount; r++) {
      if (norm(plain(ws.getRow(r).getCell(1).value)) === key) {
        ws.getRow(r).getCell(2).value = value;
        state.settings[key] = value;
      }
    }
  }

  async function loadBuffer(buffer) {
    if (typeof ExcelJS === "undefined") {
      throw new Error("The Excel library did not load. Keep assets/exceljs.min.js beside the forms, or use the Google web app.");
    }
    const next = new ExcelJS.Workbook();
    await next.xlsx.load(buffer);
    workbook = next;
    readWorkbook();
  }

  function findEnquiry(enquiryNo) {
    return state.enquiries.find(function (row) { return row.EnquiryNo === enquiryNo; });
  }

  function resolveId(requested, previous, key, rows, idField) {
    const others = rows.filter(function (row) { return String(row[idField]) !== String(previous || ""); });
    const taken = new Set(others.map(function (row) { return String(row[idField]); }));
    let id = norm(requested);
    let renumbered = false;
    if (!id || taken.has(id)) {
      const before = id;
      id = allocate(key, rows.map(function (row) { return row[idField]; }));
      renumbered = !!before && before !== id;
    }
    return { id: id, renumbered: renumbered };
  }

  function upsert(list, idField, record, previous) {
    const keys = [previous, record[idField]].filter(Boolean).map(String);
    const index = list.findIndex(function (row) { return keys.indexOf(String(row[idField])) >= 0; });
    if (index < 0) list.push(record);
    else list[index] = record;
  }

  function replaceLines(list, parentField, ids, lines) {
    const drop = new Set(ids.filter(Boolean).map(String));
    return list.filter(function (line) { return !drop.has(String(line[parentField])); }).concat(lines);
  }

  function ensureTrail(projectNo, enquiryNo) {
    STAGES.forEach(function (item) {
      const stage = item[0];
      const order = item[1];
      const found = state.trail.some(function (row) { return row.ProjectNo === projectNo && row.Stage === stage; });
      if (!found) {
        state.trail.push({
          ProjectNo: projectNo,
          EnquiryNo: enquiryNo,
          Stage: stage,
          StageOrder: order,
          Status: "Not started",
          Owner: "",
          PlannedDate: "",
          RequisitionID: "",
          PassID: "",
          Notes: order > 3 ? "Reserved under this project number." : "",
          UpdatedAt: ""
        });
      }
    });
  }

  function trailRow(projectNo, stage) {
    return state.trail.find(function (row) { return row.ProjectNo === projectNo && row.Stage === stage; });
  }

  function touchOwned(projectNo, enquiryNo, stage, status, owner, extra) {
    ensureTrail(projectNo, enquiryNo);
    const row = trailRow(projectNo, stage);
    row.Status = status || row.Status || "Draft";
    if (owner) row.Owner = owner;
    Object.assign(row, extra || {});
    row.ProjectNo = projectNo;
    row.EnquiryNo = enquiryNo;
    row.UpdatedAt = nowStamp();
  }

  function noteLater(projectNo, enquiryNo, stage, extra, statusIfOpen) {
    if (!stage) return;
    ensureTrail(projectNo, enquiryNo);
    const row = trailRow(projectNo, stage);
    if (extra.RequisitionID) row.RequisitionID = extra.RequisitionID;
    if (extra.PassID) row.PassID = extra.PassID;
    if (extra.Owner && !row.Owner) row.Owner = extra.Owner;
    const locked = ["Approved", "Complete", "Closed"].indexOf(row.Status) >= 0;
    if (!locked && statusIfOpen && (!row.Status || row.Status === "Not started" || row.Status === "Draft")) {
      row.Status = statusIfOpen;
    }
    row.UpdatedAt = nowStamp();
  }

  function forwardStage(current, next) {
    const order = STAGES.map(function (item) { return item[0]; });
    const a = order.indexOf(current);
    const b = order.indexOf(next);
    if (b < 0) return current || "Enquiry";
    if (a < 0) return next;
    return b >= a ? next : current;
  }

  function cascadeIdentity(oldEnq, newEnq, oldPrj, newPrj) {
    state.requisitions.forEach(function (row) {
      if (row.EnquiryNo === oldEnq) {
        row.EnquiryNo = newEnq;
        row.ProjectNo = newPrj;
        row.FileName = fileNameFor("requisition", row.RequisitionID, newPrj);
      }
    });
    state.passes.forEach(function (row) {
      if (row.EnquiryNo === oldEnq) {
        row.EnquiryNo = newEnq;
        row.ProjectNo = newPrj;
        row.FileName = fileNameFor("pass", row.PassID, newPrj);
      }
    });
    state.trail.forEach(function (row) {
      if (row.ProjectNo === oldPrj || row.EnquiryNo === oldEnq) {
        row.ProjectNo = newPrj;
        row.EnquiryNo = newEnq;
      }
    });
    state.documents.forEach(function (row) {
      if (row.EnquiryNo !== oldEnq && row.ProjectNo !== oldPrj) return;
      row.EnquiryNo = newEnq;
      row.ProjectNo = newPrj;
      if (row.DocType === "Enquiry") {
        row.DocID = newEnq;
        row.LinkKey = "Enquiry|" + newEnq;
        row.FileName = fileNameFor("enquiry", newEnq, newPrj);
        row.OpenLink = openLink("enquiry", newEnq, {});
      } else if (row.DocType === "Store requisition") {
        row.LinkKey = "Store requisition|" + row.DocID;
        row.FileName = fileNameFor("requisition", row.DocID, newPrj);
        row.OpenLink = openLink("requisition", newEnq, { req: row.DocID });
      } else if (row.DocType === "Outside test pass") {
        const pass = state.passes.find(function (item) { return item.PassID === row.DocID; });
        row.LinkKey = "Outside test pass|" + row.DocID;
        row.FileName = fileNameFor("pass", row.DocID, newPrj);
        row.OpenLink = openLink("pass", newEnq, { req: pass ? pass.RequisitionID : "", pass: row.DocID });
      }
    });
  }

  function upsertDoc(doc, previous) {
    const index = state.documents.findIndex(function (row) {
      return row.DocType === doc.DocType && (String(row.DocID) === String(previous) || String(row.DocID) === String(doc.DocID));
    });
    if (index < 0) state.documents.push(doc);
    else state.documents[index] = doc;
  }

  function setLink(enquiryNo, field, oldEnquiryNo, oldId, newId) {
    if (oldEnquiryNo && oldEnquiryNo !== enquiryNo) {
      const old = findEnquiry(oldEnquiryNo);
      if (old) old[field] = joinTokens(tokens(old[field]).filter(function (id) { return id !== oldId && id !== newId; }));
    }
    const enquiry = findEnquiry(enquiryNo);
    if (!enquiry) return;
    const list = tokens(enquiry[field]).filter(function (id) { return id !== oldId; });
    if (newId) list.push(newId);
    enquiry[field] = joinTokens(list);
  }

  function copyFields(prev, input, fields) {
    const record = Object.assign({}, prev || {});
    fields.forEach(function (field) {
      if (input[field] !== undefined) record[field] = input[field];
    });
    return record;
  }

  function applyEnquiry(input, meta) {
    const prevId = norm(meta.previousId);
    const prev = prevId ? findEnquiry(prevId) : null;
    const enquiryIds = resolveId(input.EnquiryNo, prevId, "ENQ", state.enquiries, "EnquiryNo");
    const projectTakenFrom = state.enquiries.filter(function (row) { return String(row.EnquiryNo) !== String(prevId); }).map(function (row) { return row.ProjectNo; });
    let projectNo = norm(input.ProjectNo);
    let projectRenumbered = false;
    if (!projectNo || projectTakenFrom.map(String).indexOf(projectNo) >= 0) {
      const before = projectNo;
      projectNo = allocate("PRJ", state.enquiries.map(function (row) { return row.ProjectNo; }));
      projectRenumbered = !!before && before !== projectNo;
    }
    const enquiryNo = enquiryIds.id;
    commitSeries("ENQ", enquiryNo);
    commitSeries("PRJ", projectNo);
    if (prev && (prev.EnquiryNo !== enquiryNo || prev.ProjectNo !== projectNo)) {
      cascadeIdentity(prev.EnquiryNo, enquiryNo, prev.ProjectNo, projectNo);
    }
    const fields = ["EnquiryDate", "Source", "RaisedBy", "ClientOrg", "ContactName", "ContactPhone", "ContactEmail", "ProjectTitle", "ProductFamily", "DroneType", "Electronics", "Mission", "Quantity", "Environment", "Endurance", "Payload", "PowerSource", "CommsLink", "Sensors", "GroundEquipment", "TechnicalRequirements", "Constraints", "Acceptance", "BudgetCode", "EstimatedBudget", "Currency", "Priority", "RequiredBy", "Location", "Coordinator", "Status", "Remarks"];
    const record = copyFields(prev, input, fields);
    record.EnquiryNo = enquiryNo;
    record.ProjectNo = projectNo;
    record.Quantity = numOrBlank(record.Quantity);
    record.EstimatedBudget = numOrBlank(record.EstimatedBudget);
    record.Status = record.Status || "Draft";
    record.CurrentStage = forwardStage(prev ? prev.CurrentStage : "", "Enquiry");
    record.LinkedRequisitions = prev ? prev.LinkedRequisitions || "" : "";
    record.LinkedPasses = prev ? prev.LinkedPasses || "" : "";
    record.FileName = fileNameFor("enquiry", enquiryNo, projectNo);
    record.Revision = prev ? Number(prev.Revision || 1) + 1 : 1;
    record.UpdatedAt = nowStamp();
    upsert(state.enquiries, "EnquiryNo", record, prevId);
    touchOwned(projectNo, enquiryNo, "Enquiry", record.Status, record.RaisedBy, {});
    upsertDoc({
      LinkKey: "Enquiry|" + enquiryNo,
      FileName: record.FileName,
      HtmlTemplate: FILE.enquiry[1],
      DocType: "Enquiry",
      DocID: enquiryNo,
      ProjectNo: projectNo,
      EnquiryNo: enquiryNo,
      OpenLink: openLink("enquiry", enquiryNo, {}),
      Status: record.Status,
      UpdatedAt: record.UpdatedAt
    }, prevId);
    return {
      record: record,
      renumbered: enquiryIds.renumbered || projectRenumbered,
      message: saveMessage("Enquiry", enquiryNo, projectNo, record.FileName, enquiryIds.renumbered || projectRenumbered)
    };
  }

  function applyRequisition(input, lines, meta) {
    const prevId = norm(meta.previousId);
    const prev = state.requisitions.find(function (row) { return row.RequisitionID === prevId; });
    const enquiry = findEnquiry(norm(input.EnquiryNo));
    if (!enquiry) throw new Error("Choose an enquiry that is already in the workbook.");
    if (!norm(input.Coordinator)) throw new Error("Enter the project coordinator.");
    if (!lines.length) throw new Error("Add at least one material line.");
    const resolved = resolveId(input.RequisitionID, prevId, "REQ", state.requisitions, "RequisitionID");
    const requisitionId = resolved.id;
    commitSeries("REQ", requisitionId);
    if (prevId && prevId !== requisitionId) {
      state.passes.forEach(function (row) { if (row.RequisitionID === prevId) row.RequisitionID = requisitionId; });
      state.trail.forEach(function (row) { if (row.RequisitionID === prevId) row.RequisitionID = requisitionId; });
    }
    const fields = ["ReqDate", "ProcessStage", "RequestedBy", "Department", "Purpose", "Coordinator", "CoordinatorDecision", "CoordinatorDate", "CoordinatorRemarks", "StoreKeeper", "StoreDate", "StoreRemarks", "Status"];
    const record = copyFields(prev, input, fields);
    record.RequisitionID = requisitionId;
    record.EnquiryNo = enquiry.EnquiryNo;
    record.ProjectNo = enquiry.ProjectNo;
    record.ProcessStage = record.ProcessStage || "Outside test";
    record.CoordinatorDecision = record.CoordinatorDecision || "Pending";
    if (record.CoordinatorDecision === "Approved" && (!record.Status || record.Status === "Draft" || record.Status === "Submitted")) record.Status = "Approved";
    if (record.CoordinatorDecision === "Rejected") record.Status = "Rejected";
    record.Status = record.Status || "Draft";
    record.FileName = fileNameFor("requisition", requisitionId, record.ProjectNo);
    record.Revision = prev ? Number(prev.Revision || 1) + 1 : 1;
    record.UpdatedAt = nowStamp();
    lines.forEach(function (line, index) {
      line.RequisitionID = requisitionId;
      line.LineNo = index + 1;
    });
    upsert(state.requisitions, "RequisitionID", record, prevId);
    state.requisitionLines = replaceLines(state.requisitionLines, "RequisitionID", [prevId, requisitionId], lines);
    setLink(record.EnquiryNo, "LinkedRequisitions", norm(meta.previousEnquiryNo) || (prev && prev.EnquiryNo), prevId, requisitionId);
    const stage = record.CoordinatorDecision === "Approved" ? (PROCESS_TO_TRAIL[record.ProcessStage] || "Store requisition") : "Store requisition";
    enquiry.CurrentStage = forwardStage(enquiry.CurrentStage, stage);
    touchOwned(record.ProjectNo, record.EnquiryNo, "Store requisition", record.Status, record.Coordinator, { RequisitionID: requisitionId });
    if (PROCESS_TO_TRAIL[record.ProcessStage] && PROCESS_TO_TRAIL[record.ProcessStage] !== "Store requisition") {
      noteLater(record.ProjectNo, record.EnquiryNo, PROCESS_TO_TRAIL[record.ProcessStage], { RequisitionID: requisitionId, Owner: record.Coordinator }, record.Status === "Approved" ? "Materials approved" : "");
    }
    upsertDoc({
      LinkKey: "Store requisition|" + requisitionId,
      FileName: record.FileName,
      HtmlTemplate: FILE.requisition[1],
      DocType: "Store requisition",
      DocID: requisitionId,
      ProjectNo: record.ProjectNo,
      EnquiryNo: record.EnquiryNo,
      OpenLink: openLink("requisition", record.EnquiryNo, { req: requisitionId }),
      Status: record.Status,
      UpdatedAt: record.UpdatedAt
    }, prevId);
    return {
      record: record,
      lines: lines,
      renumbered: resolved.renumbered,
      message: saveMessage("Requisition", requisitionId, record.ProjectNo, record.FileName, resolved.renumbered)
    };
  }

  function applyPass(input, lines, meta) {
    const prevId = norm(meta.previousId);
    const prev = state.passes.find(function (row) { return row.PassID === prevId; });
    const enquiry = findEnquiry(norm(input.EnquiryNo));
    if (!enquiry) throw new Error("Choose an enquiry that is already in the workbook.");
    const requisition = state.requisitions.find(function (row) { return row.RequisitionID === norm(input.RequisitionID); });
    if (!requisition || requisition.EnquiryNo !== enquiry.EnquiryNo) throw new Error("Choose a requisition for this enquiry.");
    if (!norm(input.TakenBy) || !norm(input.Destination)) throw new Error("Enter who is taking the material, and the destination.");
    if (!norm(input.Coordinator) || !norm(input.StoreKeeper)) throw new Error("Enter the store keeper and the project coordinator.");
    if (!lines.length) throw new Error("Add the materials being taken out.");
    const resolved = resolveId(input.PassID, prevId, "GTP", state.passes, "PassID");
    const passId = resolved.id;
    commitSeries("GTP", passId);
    if (prevId && prevId !== passId) {
      state.trail.forEach(function (row) { if (row.PassID === prevId) row.PassID = passId; });
    }
    const fields = ["ProcessStage", "PassDate", "ValidFrom", "ValidUntil", "TakenBy", "Team", "Destination", "FlightArea", "Purpose", "Conditions", "StoreKeeper", "StoreDecision", "StoreDate", "Coordinator", "CoordinatorDecision", "CoordinatorDate", "CoordinatorRemarks", "ReturnDue", "Status"];
    const record = copyFields(prev, input, fields);
    record.PassID = passId;
    record.EnquiryNo = enquiry.EnquiryNo;
    record.ProjectNo = enquiry.ProjectNo;
    record.RequisitionID = requisition.RequisitionID;
    record.ProcessStage = record.ProcessStage || "Outside test";
    record.StoreDecision = record.StoreDecision || "Pending";
    record.CoordinatorDecision = record.CoordinatorDecision || "Pending";
    if (record.StoreDecision === "Rejected" || record.CoordinatorDecision === "Rejected") record.Status = "Rejected";
    else if (record.StoreDecision === "Approved" && record.CoordinatorDecision === "Approved" && (!record.Status || record.Status === "Draft" || record.Status === "Submitted")) record.Status = "Approved";
    record.Status = record.Status || "Draft";
    record.FileName = fileNameFor("pass", passId, record.ProjectNo);
    record.Revision = prev ? Number(prev.Revision || 1) + 1 : 1;
    record.UpdatedAt = nowStamp();
    lines.forEach(function (line, index) {
      line.PassID = passId;
      line.LineNo = index + 1;
    });
    upsert(state.passes, "PassID", record, prevId);
    state.passLines = replaceLines(state.passLines, "PassID", [prevId, passId], lines);
    setLink(record.EnquiryNo, "LinkedPasses", norm(meta.previousEnquiryNo) || (prev && prev.EnquiryNo), prevId, passId);
    enquiry.CurrentStage = forwardStage(enquiry.CurrentStage, "Outside test pass");
    touchOwned(record.ProjectNo, record.EnquiryNo, "Outside test pass", record.Status, record.Coordinator, { PassID: passId, RequisitionID: record.RequisitionID });
    const later = PROCESS_TO_TRAIL[record.ProcessStage];
    if (later && later !== "Outside test pass") {
      noteLater(record.ProjectNo, record.EnquiryNo, later, { PassID: passId, RequisitionID: record.RequisitionID, Owner: record.Coordinator }, record.Status === "Approved" ? "In progress" : "");
    }
    upsertDoc({
      LinkKey: "Outside test pass|" + passId,
      FileName: record.FileName,
      HtmlTemplate: FILE.pass[1],
      DocType: "Outside test pass",
      DocID: passId,
      ProjectNo: record.ProjectNo,
      EnquiryNo: record.EnquiryNo,
      OpenLink: openLink("pass", record.EnquiryNo, { req: record.RequisitionID, pass: passId }),
      Status: record.Status,
      UpdatedAt: record.UpdatedAt
    }, prevId);
    return {
      record: record,
      lines: lines,
      renumbered: resolved.renumbered,
      message: saveMessage("Pass", passId, record.ProjectNo, record.FileName, resolved.renumbered)
    };
  }

  function saveMessage(label, id, projectNo, fileName, renumbered) {
    const lead = renumbered ? label + " number was already used, so this was saved as " + id + ". " : label + " " + id + " saved. ";
    return lead + "Project " + projectNo + ". File name " + fileName + ".";
  }

  function validateEnquiry(input) {
    if (!norm(input.ProjectTitle)) return "Enter the project title.";
    if (!norm(input.Source)) return "Choose whether this came from the client or from management.";
    if (!norm(input.RaisedBy)) return "Enter who raised the enquiry.";
    if (!norm(input.ProductFamily)) return "Choose the product family.";
    if (!norm(input.DroneType) && !norm(input.Electronics)) return "Choose a drone type or at least one electronics item.";
    return "";
  }

  async function persistLocal() {
    state.trail.sort(function (a, b) {
      return String(a.ProjectNo).localeCompare(String(b.ProjectNo)) || Number(a.StageOrder) - Number(b.StageOrder);
    });
    flushSheet("Enquiries", state.enquiries);
    flushSheet("Requisitions", state.requisitions);
    flushSheet("RequisitionLines", state.requisitionLines);
    flushSheet("GatePasses", state.passes);
    flushSheet("GatePassLines", state.passLines);
    flushSheet("ProjectTrail", state.trail);
    flushSheet("Documents", state.documents);
    writeSeriesLast();
    const url = val("webAppUrl");
    if (url) writeSetting("WebAppUrl", url);
    const buffer = await workbook.xlsx.writeBuffer();
    if (fileHandle && mode === "file") {
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return;
    }
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Drone_Project_Master.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
  }

  function cloudUrl() {
    return norm(val("webAppUrl") || (window.DRONE_DOC_CONFIG && window.DRONE_DOC_CONFIG.webAppUrl) || "");
  }

  function gasRequest(action, payload) {
    const url = cloudUrl();
    return new Promise(function (resolve, reject) {
      const cb = "droneDocCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const script = document.createElement("script");
      let settled = false;
      const timer = setTimeout(function () {
        finish(new Error("The Google Sheet did not answer. In Apps Script choose Deploy, Manage deployments, edit the web app, and publish a new version of GoogleAppsScript.gs. Access must allow the people who open these forms."));
      }, 25000);
      function finish(err, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.remove();
        if (err) reject(err);
        else resolve(data);
      }
      window[cb] = function (data) { finish(null, data); };
      const body = Object.assign({
        action: action,
        token: window.DroneAuth ? DroneAuth.token() : ""
      }, payload || {});
      const params = new URLSearchParams();
      params.set("callback", cb);
      params.set("action", action);
      params.set("payload", JSON.stringify(body));
      const src = url + (url.indexOf("?") >= 0 ? "&" : "?") + params.toString();
      if (src.length > 28000) {
        finish(new Error("This form is too long to send in one step. Shorten the long text fields and save again."));
        return;
      }
      script.onerror = function () {
        finish(new Error("Google is asking for a sign-in, so this page cannot read the Sheet. In Apps Script choose Deploy, Manage deployments, edit the web app, set Execute as Me and Who has access to Anyone, then publish a new version of GoogleAppsScript.gs. Reload this page after that."));
      };
      script.src = src;
      document.head.appendChild(script);
    });
  }

  function bootScope_() {
    if (KIND === "enquiry" || KIND === "requisition" || KIND === "pass" || KIND === "store" || KIND === "print3d" || KIND === "purchase") return KIND;
    return "full";
  }

  function readBootCache_() {
    try {
      const raw = sessionStorage.getItem("droneDoc.boot." + bootScope_());
      if (!raw) return null;
      const pack = JSON.parse(raw);
      if (!pack || !pack.at || !pack.data || !pack.data.ok) return null;
      if (Date.now() - pack.at > 90000) return null;
      return pack.data;
    } catch (err) {
      return null;
    }
  }

  function writeBootCache_(data) {
    try {
      sessionStorage.setItem("droneDoc.boot." + bootScope_(), JSON.stringify({ at: Date.now(), data: data }));
    } catch (err) { /* quota / private mode */ }
  }

  function applyCloudData_(data, statusText) {
    if (data.session && window.DroneAuth) DroneAuth.writeSession(Object.assign(DroneAuth.readSession() || {}, data.session));
    adoptState(data);
    mode = "cloud";
    workbook = null;
    fileHandle = null;
    afterMasterLoaded();
    showBanner("");
    setStatus(statusText || ("Connected" + (state.settings.CompanyName ? " · " + state.settings.CompanyName : "")));
    if (window.DroneAuth) DroneAuth.decorateChrome();
    writeBootCache_(data);
  }

  async function connectCloud(url, options) {
    options = options || {};
    setVal("webAppUrl", url);
    try { localStorage.setItem("droneDoc.webAppUrl", url); } catch (err) { /* file pages may block storage */ }
    const scope = options.scope || bootScope_();
    const cached = options.force ? null : readBootCache_();
    if (cached) {
      applyCloudData_(cached, "Connected · cached");
      gasRequest("bootstrap", { scope: scope }).then(function (data) {
        if (!data || !data.ok) return;
        applyCloudData_(data, "Connected" + (data.settings && data.settings.CompanyName ? " · " + data.settings.CompanyName : ""));
      }).catch(function () { /* keep cached view */ });
      return;
    }
    if (window.DroneAuth) DroneAuth.showLoading("Connecting to cloud…");
    try {
      const data = await gasRequest("bootstrap", { scope: scope });
      if (!data.ok) throw new Error(data.error || "Cloud connection failed.");
      applyCloudData_(data);
    } finally {
      if (window.DroneAuth) DroneAuth.hideLoading();
    }
  }

  async function cloudSave(action, payload) {
    if (window.DroneAuth) DroneAuth.showLoading("Saving…");
    try {
      const data = await gasRequest(action, payload || {});
      if (!data.ok) throw new Error(data.error || "Save failed.");
      if (data.session && window.DroneAuth) DroneAuth.writeSession(Object.assign(DroneAuth.readSession() || {}, data.session));
      adoptState(data.data || {});
      writeBootCache_(Object.assign({}, state, { ok: true }));
      return data;
    } finally {
      if (window.DroneAuth) DroneAuth.hideLoading();
    }
  }

  function idb() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open("drone-doc-master", 1);
      request.onupgradeneeded = function () { request.result.createObjectStore("handles"); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  async function storeHandle(handle) {
    try {
      const db = await idb();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction("handles", "readwrite");
        tx.objectStore("handles").put(handle, "master");
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    } catch (err) { /* the next Open still works */ }
  }

  async function storedHandle() {
    try {
      const db = await idb();
      return await new Promise(function (resolve, reject) {
        const tx = db.transaction("handles", "readonly");
        const request = tx.objectStore("handles").get("master");
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
    } catch (err) { return null; }
  }

  async function readHandle(handle) {
    const file = await handle.getFile();
    await loadBuffer(await file.arrayBuffer());
    fileHandle = handle;
    mode = "file";
    afterMasterLoaded();
    showBanner("");
    setStatus("Master workbook open. Save writes back to that file.");
  }

  function itemOptions(selected) {
    const opts = ['<option value="">—</option>'];
    state.materials.forEach(function (item) {
      opts.push('<option value="' + esc(item.ItemCode) + '"' + (item.ItemCode === selected ? " selected" : "") + ">" + esc(item.ItemCode) + " — " + esc(item.Description) + "</option>");
    });
    if (selected && !state.materials.some(function (item) { return item.ItemCode === selected; })) {
      opts.push('<option value="' + esc(selected) + '" selected>' + esc(selected) + "</option>");
    }
    return opts.join("");
  }

  function uomOptions(selected) {
    const list = listValues("UOM", ["Nos", "Set"]).slice();
    if (selected && list.indexOf(selected) < 0) list.push(selected);
    return ['<option value=""></option>'].concat(list.map(function (uom) {
      return '<option value="' + esc(uom) + '"' + (uom === selected ? " selected" : "") + ">" + esc(uom) + "</option>";
    })).join("");
  }

  function lineRow(kind, line, index) {
    const qty = kind === "pass"
      ? '<td><input data-line="QtyCarried" type="number" min="0" step="1" value="' + esc(line.QtyCarried) + '"></td>'
      : '<td><input data-line="QtyRequested" type="number" min="0" step="1" value="' + esc(line.QtyRequested) + '"></td><td><input data-line="QtyApproved" type="number" min="0" step="1" value="' + esc(line.QtyApproved) + '"></td>';
    return '<tr><td class="n">' + (index + 1) + '</td><td><select data-line="ItemCode">' + itemOptions(line.ItemCode || "") + '</select></td><td><input data-line="Description" value="' + esc(line.Description) + '"></td><td><input data-line="Spec" value="' + esc(line.Spec) + '"></td><td><select data-line="UOM">' + uomOptions(line.UOM || "") + "</select></td>" + qty + '<td><input data-line="Remarks" value="' + esc(line.Remarks) + '"></td><td class="noprint"><button type="button" class="linkish" data-remove>Remove</button></td></tr>';
  }

  function renderLines(kind, lines) {
    const body = document.getElementById("linesBody");
    if (!body) return;
    const rows = (lines || []).slice();
    while (rows.length < 6) rows.push({});
    body.innerHTML = rows.map(function (line, index) { return lineRow(kind, line, index); }).join("");
    updateQty();
  }

  function collectLines(kind) {
    const fields = kind === "pass"
      ? ["ItemCode", "Description", "Spec", "UOM", "QtyCarried", "Remarks"]
      : ["ItemCode", "Description", "Spec", "UOM", "QtyRequested", "QtyApproved", "Remarks"];
    const parent = kind === "pass" ? "PassID" : "RequisitionID";
    const lines = [];
    document.querySelectorAll("#linesBody tr").forEach(function (tr) {
      const line = {};
      let any = false;
      fields.forEach(function (field) {
        const el = tr.querySelector('[data-line="' + field + '"]');
        line[field] = el ? norm(el.value) : "";
        if (line[field]) any = true;
      });
      if (!any || (!line.ItemCode && !line.Description)) return;
      if (line.QtyRequested !== undefined) line.QtyRequested = numOrBlank(line.QtyRequested);
      if (line.QtyApproved !== undefined) line.QtyApproved = numOrBlank(line.QtyApproved);
      if (line.QtyCarried !== undefined) line.QtyCarried = numOrBlank(line.QtyCarried);
      line[parent] = "";
      line.LineNo = lines.length + 1;
      lines.push(line);
    });
    return lines;
  }

  function refreshLineChoices() {
    document.querySelectorAll('#linesBody [data-line="ItemCode"]').forEach(function (sel) {
      const current = sel.value;
      sel.innerHTML = itemOptions(current);
      sel.value = current;
    });
    document.querySelectorAll('#linesBody [data-line="UOM"]').forEach(function (sel) {
      const current = sel.value;
      sel.innerHTML = uomOptions(current);
      sel.value = current;
    });
  }

  function updateQty() {
    const note = document.getElementById("qtyNote");
    if (!note) return;
    let requested = 0;
    let approved = 0;
    let carried = 0;
    document.querySelectorAll("#linesBody tr").forEach(function (tr) {
      requested += Number(tr.querySelector('[data-line="QtyRequested"]') && tr.querySelector('[data-line="QtyRequested"]').value || 0);
      approved += Number(tr.querySelector('[data-line="QtyApproved"]') && tr.querySelector('[data-line="QtyApproved"]').value || 0);
      carried += Number(tr.querySelector('[data-line="QtyCarried"]') && tr.querySelector('[data-line="QtyCarried"]').value || 0);
    });
    note.textContent = KIND === "pass" ? "Total carried " + carried : "Total requested " + requested + " · approved " + approved;
  }

  function bindLines(kind) {
    const body = document.getElementById("linesBody");
    if (!body) return;
    body.addEventListener("change", function (event) {
      const select = event.target.closest('[data-line="ItemCode"]');
      if (!select) return;
      const item = state.materials.find(function (row) { return row.ItemCode === select.value; });
      if (!item) return;
      const tr = select.closest("tr");
      tr.querySelector('[data-line="Description"]').value = item.Description || "";
      const spec = tr.querySelector('[data-line="Spec"]');
      if (spec) spec.value = item.Spec || "";
      const uom = tr.querySelector('[data-line="UOM"]');
      if (uom) uom.value = item.UOM || "";
      updateQty();
    });
    body.addEventListener("input", function (event) {
      if (event.target.dataset.line === "QtyRequested") {
        const approved = event.target.closest("tr").querySelector('[data-line="QtyApproved"]');
        if (approved && approved.dataset.touched !== "1") approved.value = event.target.value;
      }
      if (event.target.dataset.line === "QtyApproved") event.target.dataset.touched = "1";
      updateQty();
    });
    body.addEventListener("click", function (event) {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      const rows = body.querySelectorAll("tr");
      if (rows.length === 1) {
        button.closest("tr").querySelectorAll("input").forEach(function (input) { input.value = ""; });
        const sel = button.closest("tr").querySelectorAll("select");
        sel.forEach(function (input) { input.value = ""; });
      } else button.closest("tr").remove();
      body.querySelectorAll("tr").forEach(function (tr, index) { tr.firstElementChild.textContent = String(index + 1); });
      updateQty();
    });
    const add = document.getElementById("btnAddLine");
    if (add) add.addEventListener("click", function () {
      body.insertAdjacentHTML("beforeend", lineRow(kind, {}, body.querySelectorAll("tr").length));
    });
  }

  function renderElectronics(selected) {
    const host = document.getElementById("electronicsList");
    if (!host) return;
    const chosen = new Set(tokens(selected));
    const names = state.electronics.map(function (item) { return item.ItemName; }).filter(Boolean);
    chosen.forEach(function (name) { if (names.indexOf(name) < 0) names.push(name); });
    host.innerHTML = names.map(function (name) {
      return '<label><input type="checkbox" value="' + esc(name) + '"' + (chosen.has(name) ? " checked" : "") + "> " + esc(name) + "</label>";
    }).join("");
  }

  function selectedElectronics() {
    return [].map.call(document.querySelectorAll("#electronicsList input:checked"), function (input) { return input.value; }).join("; ");
  }

  function optionsOf(values) {
    return values.map(function (value) { return { value: value, label: value }; });
  }

  function fillCommonLists() {
    fillSelect("Source", optionsOf(listValues("Source")), val("Source"));
    fillSelect("ProductFamily", optionsOf(listValues("ProductFamily")), val("ProductFamily"));
    fillSelect("Priority", optionsOf(listValues("Priority")), val("Priority"));
    fillSelect("Status", optionsOf(listValues("DocStatus")), val("Status") || "Draft");
    fillSelect("Currency", optionsOf(listValues("Currency")), val("Currency") || state.settings.Currency || "INR");
    fillSelect("Department", optionsOf(listValues("Department")), val("Department"));
    fillSelect("ProcessStage", optionsOf(listValues("ProcessStage")), val("ProcessStage") || "Outside test");
    fillSelect("CoordinatorDecision", optionsOf(listValues("Decision")), val("CoordinatorDecision") || "Pending");
    fillSelect("StoreDecision", optionsOf(listValues("Decision")), val("StoreDecision") || "Pending");
    fillSelect("BudgetCode", [{ value: "", label: "—" }].concat(state.budgets.map(function (row) {
      return { value: row.BudgetCode, label: row.BudgetCode + " — " + row.BudgetName };
    })), val("BudgetCode"));
    const enquirySelect = document.getElementById("EnquiryNo");
    if (enquirySelect && enquirySelect.tagName === "SELECT") {
      fillSelect("EnquiryNo", [{ value: "", label: "Select enquiry" }].concat(state.enquiries.map(function (row) {
        return { value: row.EnquiryNo, label: row.EnquiryNo + " — " + row.ProjectTitle };
      })), val("EnquiryNo"));
    }
    fillDataList("peopleAll", people(""));
    fillDataList("peopleCoord", people("Project Coordinator"));
    fillDataList("peopleStore", people("Store Keeper"));
    fillDataList("droneList", state.drones.map(function (row) { return row.TypeName; }));
    fillDataList("locationList", state.locations.map(function (row) { return row.LocationName; }));
    refreshPickers();
  }

  function refreshPickers() {
    const options = [{ value: "", label: "New" }].concat(describeExisting());
    const keep = options.some(function (opt) { return opt.value && opt.value === previousId; }) ? previousId : "";
    fillSelect("existingDoc", options, keep);
  }

  function paintChain() {
    const host = document.getElementById("chain");
    if (!host) return;
    const enquiryNo = val("EnquiryNo");
    const enquiry = findEnquiry(enquiryNo);
    const projectNo = enquiry ? enquiry.ProjectNo : val("ProjectNo");
    const reqs = state.requisitions.filter(function (row) { return row.EnquiryNo === enquiryNo; });
    const passes = state.passes.filter(function (row) { return row.EnquiryNo === enquiryNo; });
    const later = state.trail.filter(function (row) {
      return row.ProjectNo === projectNo && ["POC", "Pilot", "Full production", "Testing"].indexOf(row.Stage) >= 0;
    }).sort(function (a, b) { return Number(a.StageOrder) - Number(b.StageOrder); });
    const laterText = later.length ? later.map(function (row) { return row.Stage + ": " + (row.Status || "Not started"); }).join(" · ") : "POC · Pilot · Full production · Testing";
    const pos = (state.purchaseOrders || []).filter(function (row) { return row.EnquiryNo === enquiryNo; });
    const items = [
      ["Project", projectNo || "—", false],
      ["Enquiry", enquiryNo || "—", KIND === "enquiry"],
      ["Store", reqs.map(function (row) { return row.RequisitionID; }).join(", ") || "—", KIND === "requisition"],
      ["Test pass", passes.map(function (row) { return row.PassID; }).join(", ") || "—", KIND === "pass"],
      ["PO", pos.map(function (row) { return row.PoNo; }).join(", ") || "—", KIND === "purchase"],
      ["Later", laterText, false]
    ];
    host.innerHTML = items.map(function (item) {
      const has = item[1] && item[1] !== "—";
      return '<li class="' + (item[2] ? "on" : has ? "has" : "") + '"><span class="lbl">' + esc(item[0]) + "</span><b>" + esc(item[1]) + "</b></li>";
    }).join("");
  }

  function paintLinks() {
    const body = document.getElementById("linkBody");
    if (!body) return;
    const projectNo = val("ProjectNo");
    const rows = state.documents.filter(function (row) { return row.ProjectNo && row.ProjectNo === projectNo; });
    body.innerHTML = rows.length ? rows.map(function (row) {
      return "<tr><td>" + esc(row.DocType) + "</td><td>" + esc(row.DocID) + "</td><td>" + esc(row.FileName) + "</td></tr>";
    }).join("") : '<tr><td colspan="3">Save to record the file name against this project number.</td></tr>';
  }

  function paintTrail() {
    const body = document.getElementById("trailBody");
    if (!body) return;
    const projectNo = val("ProjectNo");
    const rows = state.trail.filter(function (row) { return row.ProjectNo === projectNo; }).sort(function (a, b) { return Number(a.StageOrder) - Number(b.StageOrder); });
    const source = rows.length ? rows : STAGES.map(function (item) { return { Stage: item[0], Status: "Not started", RequisitionID: "", PassID: "", Notes: "" }; });
    body.innerHTML = source.map(function (row) {
      return "<tr><td>" + esc(row.Stage) + "</td><td>" + esc(row.Status) + "</td><td>" + esc(row.RequisitionID) + "</td><td>" + esc(row.PassID) + "</td><td>" + esc(row.Notes) + "</td></tr>";
    }).join("");
  }

  function stamp(id, decision) {
    const el = document.getElementById(id);
    if (!el) return;
    const value = decision || "Pending";
    el.textContent = value;
    el.className = "stamp " + (value === "Approved" ? "approved" : value === "Pending" ? "pending" : value === "On hold" ? "hold" : "rejected");
  }

  function refreshChrome() {
    const s = state.settings || {};
    text("companyName", s.CompanyName || "AMOS");
    text("companyTagline", s.Tagline || "Drones & Related Electronics");
    text("companyContact", [s.Address, s.Phone, s.Email, s.Website].map(norm).filter(Boolean).join(" · "));
    const status = val("Status");
    const clearTag = ["Approved", "Issued", "Closed", "Complete", "Printing"].indexOf(status) >= 0;
    text("draftTag", status && !clearTag ? status.toUpperCase() : "");
    text("sigRaised", val("RaisedBy") || "—");
    const coord = val("Approver") || val("Coordinator");
    const coordSig = document.getElementById("sigCoord");
    if (coordSig) coordSig.textContent = coord ? coord + " — signature" : "Signature";
    const storeSig = document.getElementById("sigStore");
    if (storeSig) storeSig.textContent = val("StoreKeeper") ? val("StoreKeeper") + " — signature" : "Signature";
    stamp("stampCoord", val("ApprovalDecision") || val("CoordinatorDecision") || "Pending");
    stamp("stampStore", val("StoreDecision") || "Pending");
    stamp("stampAuth", val("AuthorizeDecision") || "Pending");
    const authName = val("AuthorizerName");
    const authTitle = val("AuthorizerTitle");
    text("sigAuthLabel", authName ? (authName + (authTitle ? " — " + authTitle : "")) : "Authorized signatory");
    text("buyerNameLabel", s.CompanyName || "AMOS");
    const fileName = (function () {
      const docId = KIND === "enquiry" ? val("EnquiryNo")
        : KIND === "requisition" ? val("RequisitionID")
        : KIND === "pass" ? val("PassID")
        : KIND === "print3d" ? val("PrintId")
        : KIND === "purchase" ? val("PoNo")
        : KIND === "store" ? val("ReceiptId")
        : "";
      const projectNo = val("ProjectNo");
      if (KIND === "store") return docId || "—";
      return docId && projectNo ? fileNameFor(KIND, docId, projectNo) : "—";
    }());
    text("fileNameLabel", fileName);
    text("revLabel", document.body.dataset.rev || "—");
    text("updatedLabel", document.body.dataset.updated || "—");
    const titles = {
      enquiry: "Technical Enquiry Sheet",
      requisition: "Store Requisition",
      pass: "Outside Test Pass",
      store: "Store Stock Entry",
      print3d: "3D Print Job",
      purchase: "Purchase Order"
    };
    document.title = fileName !== "—" ? fileName : (titles[KIND] || "AMOS form");
    paintChain();
    paintLinks();
    paintTrail();
  }

  function markSaved(record) {
    document.body.dataset.rev = String(record.Revision || "");
    document.body.dataset.updated = record.UpdatedAt || "";
    if (KIND === "enquiry") previousId = record.EnquiryNo || "";
    else if (KIND === "requisition") previousId = record.RequisitionID || "";
    else if (KIND === "pass") previousId = record.PassID || "";
    else if (KIND === "print3d") previousId = record.PrintId || "";
    else if (KIND === "purchase") previousId = record.PoNo || "";
    else if (KIND === "store") previousId = record.ReceiptId || "";
    else previousId = "";
    previousEnquiryNo = record.EnquiryNo || "";
  }

  function applyEnquiryToChild(enquiryNo) {
    const enquiry = findEnquiry(enquiryNo);
    setVal("ProjectNo", enquiry ? enquiry.ProjectNo : "");
    setVal("projectTitle", enquiry ? enquiry.ProjectTitle : "");
    const drone = document.getElementById("droneLine");
    if (drone) {
      const reqId = val("RequisitionID");
      const req = state.requisitions.find(function (row) { return row.RequisitionID === reqId; });
      const bits = [];
      if (enquiry) bits.push([enquiry.DroneType, enquiry.Electronics].filter(Boolean).join(" · "));
      if (req && req.Status && req.Status !== "Approved") bits.push("Requisition status: " + req.Status);
      drone.textContent = bits.filter(Boolean).join("  |  ");
    }
    if (enquiry && !val("Coordinator")) setVal("Coordinator", enquiry.Coordinator || "");
    refreshChrome();
  }

  function fillRequisitionSelect(enquiryNo, keep) {
    const rows = state.requisitions.filter(function (row) { return !enquiryNo || row.EnquiryNo === enquiryNo; });
    fillSelect("RequisitionID", [{ value: "", label: "Select requisition" }].concat(rows.map(function (row) {
      return { value: row.RequisitionID, label: row.RequisitionID + " — " + (row.Status || "Draft") + " — " + (row.ProcessStage || "") };
    })), keep !== undefined ? keep : val("RequisitionID"));
  }

  function remember(record) {
    markSaved(record);
    const picker = document.getElementById("existingDoc");
    if (picker) picker.value = previousId;
  }

  function bootEnquiry() {
    describeExisting = function () {
      return state.enquiries.map(function (row) { return { value: row.EnquiryNo, label: row.EnquiryNo + " — " + row.ProjectTitle }; });
    };
    page.blank = function () {
      suppress = true;
      previousId = "";
      previousEnquiryNo = "";
      ["ProjectTitle", "RaisedBy", "ClientOrg", "ContactName", "ContactPhone", "ContactEmail", "DroneType", "Mission", "Environment", "Endurance", "Payload", "PowerSource", "CommsLink", "Sensors", "GroundEquipment", "TechnicalRequirements", "Constraints", "Acceptance", "Location", "Coordinator", "Remarks"].forEach(function (id) { setVal(id, ""); });
      setVal("Quantity", "");
      setVal("EstimatedBudget", "");
      setVal("EnquiryNo", peek("ENQ"));
      setVal("ProjectNo", peek("PRJ"));
      setDate("EnquiryDate", today());
      setDate("RequiredBy", "");
      fillCommonLists();
      setVal("Source", "Management");
      setVal("Priority", "Medium");
      setVal("Status", "Draft");
      setVal("ProductFamily", "Drone + Electronics");
      setVal("Currency", state.settings.Currency || "INR");
      setVal("BudgetCode", "");
      renderElectronics("");
      document.body.dataset.rev = "1";
      document.body.dataset.updated = "";
      setVal("existingDoc", "");
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.fill = function (record) {
      suppress = true;
      ["EnquiryNo", "ProjectNo", "Source", "RaisedBy", "ClientOrg", "ContactName", "ContactPhone", "ContactEmail", "ProjectTitle", "ProductFamily", "DroneType", "Mission", "Quantity", "Environment", "Endurance", "Payload", "PowerSource", "CommsLink", "Sensors", "GroundEquipment", "TechnicalRequirements", "Constraints", "Acceptance", "BudgetCode", "EstimatedBudget", "Currency", "Priority", "Location", "Coordinator", "Status", "Remarks"].forEach(function (id) { setVal(id, record[id]); });
      setDate("EnquiryDate", record.EnquiryDate);
      setDate("RequiredBy", record.RequiredBy);
      renderElectronics(record.Electronics || "");
      remember(record);
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.collect = function () {
      const input = {};
      ["EnquiryNo", "ProjectNo", "Source", "RaisedBy", "ClientOrg", "ContactName", "ContactPhone", "ContactEmail", "ProjectTitle", "ProductFamily", "DroneType", "Mission", "Quantity", "Environment", "Endurance", "Payload", "PowerSource", "CommsLink", "Sensors", "GroundEquipment", "TechnicalRequirements", "Constraints", "Acceptance", "BudgetCode", "EstimatedBudget", "Currency", "Priority", "Location", "Coordinator", "Status", "Remarks"].forEach(function (id) { input[id] = val(id); });
      input.EnquiryDate = val("EnquiryDate");
      input.RequiredBy = val("RequiredBy");
      input.Electronics = selectedElectronics();
      input.Quantity = numOrBlank(input.Quantity);
      input.EstimatedBudget = numOrBlank(input.EstimatedBudget);
      const error = validateEnquiry(input);
      return error ? { error: error } : { input: input, lines: [] };
    };
    page.loadById = function (id) {
      const record = findEnquiry(id);
      if (record) page.fill(record);
    };
    const budget = document.getElementById("BudgetCode");
    if (budget) budget.addEventListener("change", function () {
      const row = state.budgets.find(function (item) { return item.BudgetCode === budget.value; });
      if (row && !val("EstimatedBudget")) setVal("EstimatedBudget", row.Amount);
      if (row && row.Currency) setVal("Currency", row.Currency);
    });
  }

  function bootRequisition() {
    describeExisting = function () {
      return state.requisitions.map(function (row) { return { value: row.RequisitionID, label: row.RequisitionID + " — " + row.EnquiryNo }; });
    };
    bindLines("requisition");
    page.blank = function (keepEnquiry) {
      suppress = true;
      previousId = "";
      const enquiryNo = keepEnquiry ? val("EnquiryNo") : "";
      setVal("RequisitionID", peek("REQ"));
      setDate("ReqDate", today());
      setVal("Purpose", "");
      setVal("RequestedBy", "");
      setVal("CoordinatorRemarks", "");
      setVal("StoreRemarks", "");
      setDate("CoordinatorDate", "");
      setDate("StoreDate", "");
      setVal("StoreKeeper", "");
      fillCommonLists();
      setVal("EnquiryNo", enquiryNo);
      setVal("ProcessStage", "Outside test");
      setVal("Department", "Electronics");
      setVal("Status", "Draft");
      setVal("CoordinatorDecision", "Pending");
      applyEnquiryToChild(enquiryNo);
      if (!val("Coordinator")) setVal("Coordinator", "");
      renderLines("requisition", []);
      document.body.dataset.rev = "1";
      document.body.dataset.updated = "";
      previousEnquiryNo = enquiryNo;
      setVal("existingDoc", "");
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.fill = function (record, lines) {
      suppress = true;
      fillCommonLists();
      ["RequisitionID", "EnquiryNo", "RequestedBy", "Department", "Purpose", "Coordinator", "CoordinatorDecision", "CoordinatorRemarks", "StoreKeeper", "StoreRemarks", "Status", "ProcessStage"].forEach(function (id) { setVal(id, record[id]); });
      setDate("ReqDate", record.ReqDate);
      setDate("CoordinatorDate", record.CoordinatorDate);
      setDate("StoreDate", record.StoreDate);
      applyEnquiryToChild(record.EnquiryNo);
      renderLines("requisition", lines || state.requisitionLines.filter(function (line) { return line.RequisitionID === record.RequisitionID; }));
      remember(record);
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.collect = function () {
      const input = {};
      ["RequisitionID", "EnquiryNo", "ProcessStage", "RequestedBy", "Department", "Purpose", "Coordinator", "CoordinatorDecision", "CoordinatorRemarks", "StoreKeeper", "StoreRemarks", "Status"].forEach(function (id) { input[id] = val(id); });
      input.ReqDate = val("ReqDate");
      input.CoordinatorDate = val("CoordinatorDate");
      input.StoreDate = val("StoreDate");
      const lines = collectLines("requisition").filter(function (line) { return Number(line.QtyRequested) > 0 || Number(line.QtyApproved) > 0; });
      if (!input.EnquiryNo) return { error: "Choose the enquiry number." };
      if (!lines.length) return { error: "Add at least one material with a quantity." };
      return { input: input, lines: lines };
    };
    page.loadById = function (id) {
      const record = state.requisitions.find(function (row) { return row.RequisitionID === id; });
      if (record) page.fill(record);
    };
    document.getElementById("EnquiryNo").addEventListener("change", function () {
      applyEnquiryToChild(val("EnquiryNo"));
    });
  }

  function bootPass() {
    describeExisting = function () {
      return state.passes.map(function (row) { return { value: row.PassID, label: row.PassID + " — " + row.EnquiryNo }; });
    };
    bindLines("pass");
    page.blank = function (keepEnquiry) {
      suppress = true;
      previousId = "";
      const enquiryNo = keepEnquiry ? val("EnquiryNo") : "";
      setVal("PassID", peek("GTP"));
      setDate("PassDate", today());
      setDate("ReturnDue", "");
      setDate("ValidFrom", "");
      setDate("ValidUntil", "");
      setVal("TakenBy", "");
      setVal("Team", "");
      setVal("Destination", "");
      setVal("FlightArea", "");
      setVal("Purpose", "");
      setVal("Conditions", "Company property. Do not hand the material to a third party. Do not exceed the approved quantities. Stay inside the named test area. Return every item to the store keeper by the return due time.");
      setVal("StoreKeeper", "");
      setVal("CoordinatorRemarks", "");
      setDate("StoreDate", "");
      setDate("CoordinatorDate", "");
      fillCommonLists();
      setVal("EnquiryNo", enquiryNo);
      fillRequisitionSelect(enquiryNo, "");
      setVal("ProcessStage", "Outside test");
      setVal("Status", "Draft");
      setVal("StoreDecision", "Pending");
      setVal("CoordinatorDecision", "Pending");
      applyEnquiryToChild(enquiryNo);
      renderLines("pass", []);
      document.body.dataset.rev = "1";
      document.body.dataset.updated = "";
      previousEnquiryNo = enquiryNo;
      setVal("existingDoc", "");
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.fill = function (record, lines) {
      suppress = true;
      fillCommonLists();
      setVal("EnquiryNo", record.EnquiryNo);
      fillRequisitionSelect(record.EnquiryNo, record.RequisitionID);
      ["PassID", "TakenBy", "Team", "Destination", "FlightArea", "Purpose", "Conditions", "StoreKeeper", "StoreDecision", "Coordinator", "CoordinatorDecision", "CoordinatorRemarks", "Status", "ProcessStage"].forEach(function (id) { setVal(id, record[id]); });
      setDate("PassDate", record.PassDate);
      setDate("ValidFrom", record.ValidFrom);
      setDate("ValidUntil", record.ValidUntil);
      setDate("StoreDate", record.StoreDate);
      setDate("CoordinatorDate", record.CoordinatorDate);
      setDate("ReturnDue", record.ReturnDue);
      applyEnquiryToChild(record.EnquiryNo);
      renderLines("pass", lines || state.passLines.filter(function (line) { return line.PassID === record.PassID; }));
      remember(record);
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.collect = function () {
      const input = {};
      ["PassID", "EnquiryNo", "RequisitionID", "ProcessStage", "TakenBy", "Team", "Destination", "FlightArea", "Purpose", "Conditions", "StoreKeeper", "StoreDecision", "Coordinator", "CoordinatorDecision", "CoordinatorRemarks", "Status"].forEach(function (id) { input[id] = val(id); });
      input.PassDate = val("PassDate");
      input.ValidFrom = fromLocalInput(val("ValidFrom"));
      input.ValidUntil = fromLocalInput(val("ValidUntil"));
      input.StoreDate = val("StoreDate");
      input.CoordinatorDate = val("CoordinatorDate");
      input.ReturnDue = val("ReturnDue");
      const lines = collectLines("pass").filter(function (line) { return Number(line.QtyCarried) > 0; });
      if (!input.EnquiryNo) return { error: "Choose the enquiry number." };
      if (!input.RequisitionID) return { error: "Choose the store requisition." };
      if (!lines.length) return { error: "Enter the quantity carried for at least one item." };
      return { input: input, lines: lines };
    };
    page.loadById = function (id) {
      const record = state.passes.find(function (row) { return row.PassID === id; });
      if (record) page.fill(record);
    };
    document.getElementById("EnquiryNo").addEventListener("change", function () {
      fillRequisitionSelect(val("EnquiryNo"), "");
      applyEnquiryToChild(val("EnquiryNo"));
    });
    document.getElementById("RequisitionID").addEventListener("change", function () {
      applyEnquiryToChild(val("EnquiryNo"));
      const existing = collectLines("pass");
      if (!existing.length) pullLines(false);
    });
    document.getElementById("btnPull").addEventListener("click", function () { pullLines(true); });
  }

  function pullLines(force) {
    const id = val("RequisitionID");
    const lines = state.requisitionLines.filter(function (line) { return line.RequisitionID === id; }).map(function (line) {
      return {
        ItemCode: line.ItemCode,
        Description: line.Description,
        Spec: line.Spec,
        UOM: line.UOM,
        QtyCarried: line.QtyApproved !== "" && line.QtyApproved != null ? line.QtyApproved : line.QtyRequested,
        Remarks: line.Remarks
      };
    });
    if (!lines.length && force) setStatus("That requisition has no material lines.", true);
    if (lines.length) renderLines("pass", lines);
  }

  function bootStore() {
    describeExisting = function () { return []; };
    page.blank = function () {
      suppress = true;
      setVal("ReceiptId", peek("RCPT") || "auto");
      setDate("ReceiptDate", today());
      setVal("Qty", "");
      setVal("Remarks", "");
      setVal("ProjectNo", "");
      setVal("EnquiryNo", "");
      setVal("EnteredBy", (window.DroneAuth && DroneAuth.user() && DroneAuth.user().displayName) || "");
      fillCommonLists();
      fillSelect("LocationCode", (state.storeLocations || []).map(function (row) {
        return { value: row.LocationCode, label: row.LocationCode + " — " + row.LocationName };
      }), "");
      fillSelect("ItemCode", [{ value: "", label: "—" }].concat((state.materials || []).map(function (row) {
        return { value: row.ItemCode, label: row.ItemCode + " — " + row.Description };
      })), "");
      fillSelect("UOM", optionsOf(listValues("UOM", ["Nos", "Set", "Kg"])), "Nos");
      fillDataList("projectList", state.enquiries.map(function (row) { return row.ProjectNo; }));
      fillDataList("enquiryList", state.enquiries.map(function (row) { return row.EnquiryNo; }));
      renderStock();
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.fill = function (record) {
      suppress = true;
      page.blank();
      ["ReceiptId", "ItemCode", "Description", "LocationCode", "UOM", "Qty", "ProjectNo", "EnquiryNo", "EnteredBy", "Remarks"].forEach(function (id) { setVal(id, record[id]); });
      setDate("ReceiptDate", record.ReceiptDate);
      remember({ EnquiryNo: record.EnquiryNo, ReceiptId: record.ReceiptId });
      previousId = record.ReceiptId || "";
      renderStock();
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.collect = function () {
      const input = {};
      ["ReceiptId", "ItemCode", "Description", "LocationCode", "UOM", "Qty", "ProjectNo", "EnquiryNo", "EnteredBy", "Remarks"].forEach(function (id) { input[id] = val(id); });
      input.ReceiptDate = val("ReceiptDate");
      input.Qty = numOrBlank(input.Qty);
      if (!input.ItemCode) return { error: "Choose the item." };
      if (!input.LocationCode) return { error: "Choose the store location." };
      if (!(Number(input.Qty) > 0)) return { error: "Enter a quantity greater than zero." };
      return { input: input, lines: [] };
    };
    page.loadById = function () {};
    const item = document.getElementById("ItemCode");
    if (item) item.addEventListener("change", function () {
      const mat = state.materials.find(function (row) { return row.ItemCode === item.value; });
      if (mat) {
        setVal("Description", mat.Description || "");
        setVal("UOM", mat.UOM || "Nos");
      }
    });
  }

  function renderStock() {
    const body = document.getElementById("stockBody");
    if (!body) return;
    const rows = state.storeStock || [];
    const desc = {};
    (state.materials || []).forEach(function (row) { desc[row.ItemCode] = row.Description; });
    const loc = {};
    (state.storeLocations || []).forEach(function (row) { loc[row.LocationCode] = row.LocationName; });
    body.innerHTML = rows.map(function (row) {
      return "<tr><td>" + esc(row.ItemCode) + "</td><td>" + esc(desc[row.ItemCode] || "") + "</td><td>" + esc((loc[row.LocationCode] || row.LocationCode)) + "</td><td>" + esc(row.QtyOnHand) + "</td><td>" + esc(row.MinQty) + "</td><td>" + esc(row.UOM) + "</td></tr>";
    }).join("") || '<tr><td colspan="6">No stock rows yet.</td></tr>';
  }

  function bootPrint3d() {
    describeExisting = function () {
      return (state.printJobs || []).map(function (row) {
        return { value: row.PrintId, label: row.PrintId + " — " + row.PartName };
      });
    };
    page.blank = function () {
      suppress = true;
      previousId = "";
      setVal("PrintId", peek("PRN"));
      setVal("PartName", "");
      setVal("FilamentG", "");
      setVal("FilamentM", "");
      setVal("PrinterUsed", "");
      setVal("Duration", "");
      setVal("ProjectOwner", (window.DroneAuth && DroneAuth.user() && DroneAuth.user().displayName) || "");
      fillCommonLists();
      fillSelect("PrintType", optionsOf(listValues("PrintType", ["Prototype", "Functional", "Fixture", "Enclosure", "Jig"])), "Functional");
      fillSelect("FilamentType", optionsOf(listValues("FilamentType", ["PLA", "PETG", "TPU", "ABS", "ASA", "PC", "PA-CF", "PET-CF"])), "PETG");
      fillSelect("Status", optionsOf(listValues("PrintStatus", ["Draft", "Submitted", "Pending approval", "Approved", "Printing", "Complete", "Rejected"])), "Pending approval");
      fillSelect("ApprovalDecision", optionsOf(listValues("Decision")), "Pending");
      fillSelect("MaterialCode", [{ value: "", label: "—" }].concat((state.materials || []).filter(function (row) {
        return String(row.Category || "").indexOf("3D") >= 0 || String(row.ItemCode).indexOf("FIL") >= 0;
      }).map(function (row) {
        return { value: row.ItemCode, label: row.ItemCode + " — " + row.Description };
      })), "MAT-FIL-PETG");
      fillSelect("StoreLocation", (state.storeLocations || []).map(function (row) {
        return { value: row.LocationCode, label: row.LocationCode + " — " + row.LocationName };
      }), "STR-3D");
      setVal("EnquiryNo", "");
      setVal("ProjectNo", "");
      setVal("projectTitle", "");
      setDate("ApprovalDate", "");
      setVal("Approver", "");
      setVal("existingDoc", "");
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.fill = function (record) {
      suppress = true;
      fillCommonLists();
      fillSelect("PrintType", optionsOf(listValues("PrintType", ["Prototype", "Functional", "Fixture", "Enclosure", "Jig"])), record.PrintType);
      fillSelect("FilamentType", optionsOf(listValues("FilamentType", ["PLA", "PETG", "TPU", "ABS", "ASA", "PC", "PA-CF", "PET-CF"])), record.FilamentType);
      fillSelect("Status", optionsOf(listValues("PrintStatus", ["Draft", "Submitted", "Pending approval", "Approved", "Printing", "Complete", "Rejected"])), record.Status);
      fillSelect("ApprovalDecision", optionsOf(listValues("Decision")), record.ApprovalDecision || "Pending");
      fillSelect("MaterialCode", [{ value: "", label: "—" }].concat((state.materials || []).map(function (row) {
        return { value: row.ItemCode, label: row.ItemCode + " — " + row.Description };
      })), record.MaterialCode);
      fillSelect("StoreLocation", (state.storeLocations || []).map(function (row) {
        return { value: row.LocationCode, label: row.LocationCode + " — " + row.LocationName };
      }), record.StoreLocation);
      ["PrintId", "EnquiryNo", "ProjectNo", "PartName", "PrinterUsed", "Duration", "ProjectOwner", "Approver", "FilamentG", "FilamentM"].forEach(function (id) { setVal(id, record[id]); });
      setDate("ApprovalDate", record.ApprovalDate);
      applyEnquiryToChild(record.EnquiryNo);
      remember(record);
      previousId = record.PrintId || "";
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.collect = function () {
      const input = {};
      ["PrintId", "EnquiryNo", "ProjectNo", "PartName", "PrintType", "FilamentType", "FilamentG", "FilamentM", "PrinterUsed", "Duration", "ProjectOwner", "Status", "Approver", "ApprovalDecision", "MaterialCode", "StoreLocation"].forEach(function (id) { input[id] = val(id); });
      input.ApprovalDate = val("ApprovalDate");
      input.FilamentG = numOrBlank(input.FilamentG);
      input.FilamentM = numOrBlank(input.FilamentM);
      if (!input.EnquiryNo) return { error: "Choose the enquiry number." };
      if (!input.PartName) return { error: "Enter the part name." };
      return { input: input, lines: [] };
    };
    page.loadById = function (id) {
      const record = (state.printJobs || []).find(function (row) { return row.PrintId === id; });
      if (record) page.fill(record);
    };
    document.getElementById("EnquiryNo").addEventListener("change", function () {
      applyEnquiryToChild(val("EnquiryNo"));
    });
  }

  function money(n) {
    const v = Number(n);
    return (Number.isFinite(v) ? v : 0).toFixed(2);
  }

  function defaultPoTerms() {
    return DEFAULT_PO_TERMS;
  }

  function applyAuthorizeSignature() {
    const img = document.getElementById("authorizeSignature");
    if (!img) return;
    const dataUrl = val("SignatureDataUrl");
    if (dataUrl) {
      img.src = dataUrl;
      return;
    }
    const file = val("SignatureFile") || "assets/authorize-signature.svg";
    img.src = file;
  }

  function poLineRow(line, index) {
    const qty = line.Qty != null && line.Qty !== "" ? line.Qty : "";
    const rate = line.Rate != null && line.Rate !== "" ? line.Rate : "";
    const amount = money(Number(qty || 0) * Number(rate || 0));
    return '<tr><td class="n">' + (index + 1) + '</td>' +
      '<td><input data-po="ItemCode" value="' + esc(line.ItemCode || "") + '" placeholder="Code"></td>' +
      '<td><input data-po="Description" value="' + esc(line.Description || "") + '" placeholder="Description"></td>' +
      '<td><select data-po="UOM">' + uomOptions(line.UOM || "Nos") + "</select></td>" +
      '<td><input data-po="Qty" type="number" min="0" step="0.01" value="' + esc(qty) + '"></td>' +
      '<td><input data-po="Rate" type="number" min="0" step="0.01" value="' + esc(rate) + '"></td>' +
      '<td class="q"><span data-po-amount>' + amount + "</span></td>" +
      '<td class="noprint"><button type="button" class="linkish" data-remove-po>Remove</button></td></tr>';
  }

  function renderPoLines(lines) {
    const body = document.getElementById("poLineBody");
    if (!body) return;
    const rows = (lines || []).slice();
    while (rows.length < 4) rows.push({});
    body.innerHTML = rows.map(function (line, index) { return poLineRow(line, index); }).join("");
    updatePoTotals();
  }

  function collectPoLines() {
    const lines = [];
    document.querySelectorAll("#poLineBody tr").forEach(function (tr) {
      const line = {};
      let any = false;
      ["ItemCode", "Description", "UOM", "Qty", "Rate"].forEach(function (field) {
        const el = tr.querySelector('[data-po="' + field + '"]');
        line[field] = el ? norm(el.value) : "";
        if (line[field]) any = true;
      });
      if (!any || (!line.ItemCode && !line.Description)) return;
      line.Qty = numOrBlank(line.Qty);
      line.Rate = numOrBlank(line.Rate);
      line.Amount = Number(line.Qty || 0) * Number(line.Rate || 0);
      line.PoNo = "";
      line.LineNo = lines.length + 1;
      lines.push(line);
    });
    return lines;
  }

  function updatePoTotals() {
    let subtotal = 0;
    document.querySelectorAll("#poLineBody tr").forEach(function (tr) {
      const qty = Number(tr.querySelector('[data-po="Qty"]') && tr.querySelector('[data-po="Qty"]').value || 0);
      const rate = Number(tr.querySelector('[data-po="Rate"]') && tr.querySelector('[data-po="Rate"]').value || 0);
      const amount = qty * rate;
      const cell = tr.querySelector("[data-po-amount]");
      if (cell) cell.textContent = money(amount);
      subtotal += amount;
    });
    const taxPct = Number(val("TaxPercent") || 0);
    const tax = subtotal * taxPct / 100;
    const grand = subtotal + tax;
    text("poSubtotal", money(subtotal));
    text("poTax", money(tax));
    text("poGrand", money(grand));
    return { Subtotal: Number(money(subtotal)), TaxAmount: Number(money(tax)), GrandTotal: Number(money(grand)) };
  }

  function bindPoLines() {
    const body = document.getElementById("poLineBody");
    if (!body) return;
    body.addEventListener("input", function () { updatePoTotals(); });
    body.addEventListener("change", function () { updatePoTotals(); });
    body.addEventListener("click", function (event) {
      const button = event.target.closest("[data-remove-po]");
      if (!button) return;
      const rows = body.querySelectorAll("tr");
      if (rows.length === 1) {
        button.closest("tr").querySelectorAll("input").forEach(function (input) { input.value = ""; });
        const sel = button.closest("tr").querySelector("select");
        if (sel) sel.value = "Nos";
      } else button.closest("tr").remove();
      body.querySelectorAll("tr").forEach(function (tr, index) { tr.firstElementChild.textContent = String(index + 1); });
      updatePoTotals();
    });
    const add = document.getElementById("btnAddPoLine");
    if (add) add.addEventListener("click", function () {
      body.insertAdjacentHTML("beforeend", poLineRow({}, body.querySelectorAll("tr").length));
      updatePoTotals();
    });
    const tax = document.getElementById("TaxPercent");
    if (tax) tax.addEventListener("input", function () { updatePoTotals(); });
    const sigFile = document.getElementById("SignatureFile");
    if (sigFile) sigFile.addEventListener("change", function () {
      setVal("SignatureDataUrl", "");
      applyAuthorizeSignature();
    });
    const upload = document.getElementById("signatureUpload");
    if (upload) upload.addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        setVal("SignatureDataUrl", String(reader.result || ""));
        applyAuthorizeSignature();
        dirty = true;
      };
      reader.readAsDataURL(file);
    });
  }

  function bootPo() {
    describeExisting = function () {
      return (state.purchaseOrders || []).map(function (row) {
        return { value: row.PoNo, label: row.PoNo + " — " + (row.VendorName || row.ProjectNo || "") };
      });
    };
    page.blank = function () {
      suppress = true;
      previousId = "";
      setVal("PoNo", peek("PO"));
      setVal("VendorName", "");
      setVal("VendorAddress", "");
      setVal("VendorContact", "");
      setVal("VendorPhone", "");
      setVal("VendorEmail", "");
      setVal("VendorTaxId", "");
      setVal("PaymentTerms", "Net 30");
      setVal("DeliveryPlace", (state.settings && state.settings.Address) || "");
      setVal("PreparedBy", (window.DroneAuth && DroneAuth.user() && DroneAuth.user().displayName) || "");
      setVal("Remarks", "");
      setVal("TermsText", defaultPoTerms());
      setVal("AuthorizerName", "");
      setVal("AuthorizerTitle", "Project Coordinator");
      setVal("SignatureFile", "assets/authorize-signature.svg");
      setVal("SignatureDataUrl", "");
      setVal("TaxPercent", "18");
      fillCommonLists();
      fillSelect("Status", optionsOf(listValues("PoStatus", listValues("DocStatus"))), "Draft");
      fillSelect("Currency", optionsOf(listValues("Currency")), state.settings.Currency || "INR");
      fillSelect("AuthorizeDecision", optionsOf(listValues("Decision")), "Pending");
      setVal("EnquiryNo", "");
      setVal("ProjectNo", "");
      setVal("projectTitle", "");
      setDate("PoDate", today());
      setDate("DeliveryDate", "");
      setDate("AuthorizeDate", "");
      setVal("existingDoc", "");
      renderPoLines([]);
      applyAuthorizeSignature();
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.fill = function (record, lines) {
      suppress = true;
      fillCommonLists();
      fillSelect("Status", optionsOf(listValues("PoStatus", listValues("DocStatus"))), record.Status || "Draft");
      fillSelect("Currency", optionsOf(listValues("Currency")), record.Currency || state.settings.Currency || "INR");
      fillSelect("AuthorizeDecision", optionsOf(listValues("Decision")), record.AuthorizeDecision || "Pending");
      ["PoNo", "EnquiryNo", "ProjectNo", "VendorName", "VendorAddress", "VendorContact", "VendorPhone", "VendorEmail", "VendorTaxId", "PaymentTerms", "DeliveryPlace", "PreparedBy", "Remarks", "TermsText", "AuthorizerName", "AuthorizerTitle", "SignatureFile", "TaxPercent"].forEach(function (id) {
        setVal(id, record[id] != null ? record[id] : "");
      });
      if (!norm(val("TermsText"))) setVal("TermsText", defaultPoTerms());
      if (!norm(val("SignatureFile"))) setVal("SignatureFile", "assets/authorize-signature.svg");
      setVal("SignatureDataUrl", record.SignatureDataUrl || "");
      setDate("PoDate", record.PoDate);
      setDate("DeliveryDate", record.DeliveryDate);
      setDate("AuthorizeDate", record.AuthorizeDate);
      applyEnquiryToChild(record.EnquiryNo);
      const lineSource = lines || (state.purchaseOrderLines || []).filter(function (line) { return line.PoNo === record.PoNo; });
      renderPoLines(lineSource);
      applyAuthorizeSignature();
      remember(record);
      previousId = record.PoNo || "";
      suppress = false;
      dirty = false;
      refreshChrome();
    };
    page.collect = function () {
      const totals = updatePoTotals();
      const input = {};
      ["PoNo", "EnquiryNo", "ProjectNo", "VendorName", "VendorAddress", "VendorContact", "VendorPhone", "VendorEmail", "VendorTaxId", "PaymentTerms", "DeliveryPlace", "PreparedBy", "Remarks", "TermsText", "AuthorizerName", "AuthorizerTitle", "SignatureFile", "Status", "Currency", "AuthorizeDecision", "TaxPercent"].forEach(function (id) {
        input[id] = val(id);
      });
      input.PoDate = val("PoDate");
      input.DeliveryDate = val("DeliveryDate");
      input.AuthorizeDate = val("AuthorizeDate");
      input.TaxPercent = numOrBlank(input.TaxPercent);
      input.Subtotal = totals.Subtotal;
      input.TaxAmount = totals.TaxAmount;
      input.GrandTotal = totals.GrandTotal;
      input.SignatureDataUrl = "";
      const lines = collectPoLines();
      if (!input.EnquiryNo) return { error: "Choose the enquiry number." };
      if (!input.VendorName) return { error: "Enter the vendor name." };
      if (!lines.length) return { error: "Add at least one line item." };
      return { input: input, lines: lines };
    };
    page.loadById = function (id) {
      const record = (state.purchaseOrders || []).find(function (row) { return row.PoNo === id; });
      if (record) page.fill(record);
    };
    bindPoLines();
    document.getElementById("EnquiryNo").addEventListener("change", function () {
      applyEnquiryToChild(val("EnquiryNo"));
    });
  }

  function afterMasterLoaded() {
    const params = new URLSearchParams(location.search);
    fillCommonLists();
    if (KIND === "enquiry" && params.get("enq") && findEnquiry(params.get("enq"))) page.loadById(params.get("enq"));
    else if (KIND === "requisition" && params.get("req")) page.loadById(params.get("req"));
    else if (KIND === "pass" && params.get("pass")) page.loadById(params.get("pass"));
    else if (KIND === "print3d" && params.get("print")) page.loadById(params.get("print"));
    else if (KIND === "purchase" && params.get("po")) page.loadById(params.get("po"));
    else if (KIND !== "enquiry" && KIND !== "store" && params.get("enq")) {
      page.blank(false);
      setVal("EnquiryNo", params.get("enq"));
      if (KIND === "pass") fillRequisitionSelect(params.get("enq"), params.get("req") || "");
      applyEnquiryToChild(params.get("enq"));
      if (KIND === "pass" && params.get("req")) pullLines(false);
      if (KIND === "purchase") applyAuthorizeSignature();
    } else if (!dirty) page.blank(false);
    else {
      fillCommonLists();
      if (KIND === "enquiry") renderElectronics(selectedElectronics());
      if (KIND === "store") renderStock();
      if (KIND === "purchase") {
        renderPoLines(collectPoLines());
        applyAuthorizeSignature();
      }
      refreshLineChoices();
    }
    const box = document.getElementById("webAppUrl");
    if (box && !norm(box.value) && state.settings.WebAppUrl) box.value = state.settings.WebAppUrl;
    applyLogo();
    refreshChrome();
    if (window.DroneAuth) DroneAuth.decorateChrome();
  }

  function applyLogo() {
    const img = document.getElementById("companyLogo");
    if (!img) return;
    const list = ["assets/company-logo.jpg", "assets/Amos.jpg", "assets/company-logo.png", "assets/company-logo.jpeg", "assets/company-logo.webp"];
    if (state.settings.LogoFile) list.unshift(state.settings.LogoFile);
    list.push("assets/company-logo.svg");
    (function next(index) {
      if (index >= list.length) return;
      const probe = new Image();
      probe.onload = function () { img.src = list[index]; };
      probe.onerror = function () { next(index + 1); };
      probe.src = list[index];
    }(0));
  }

  async function onSave() {
    const collected = page.collect();
    if (collected.error) {
      setStatus(collected.error, true);
      return;
    }
    const button = document.getElementById("btnSave");
    button.disabled = true;
    try {
      let result;
      if (window.DroneAuth && !DroneAuth.can(KIND, "edit")) {
        throw new Error("Your role can view this form but cannot save changes. Ask the project owner, coordinator, or store manager.");
      }
      if (mode === "cloud") {
        const action = KIND === "enquiry" ? "saveEnquiry"
          : KIND === "requisition" ? "saveRequisition"
          : KIND === "pass" ? "savePass"
          : KIND === "store" ? "saveStoreReceipt"
          : KIND === "purchase" ? "savePurchaseOrder"
          : "savePrintJob";
        const data = await cloudSave(action, {
          record: collected.input,
          lines: collected.lines,
          previousId: previousId,
          previousEnquiryNo: previousEnquiryNo
        });
        result = data;
        page.fill(data.record, data.lines || []);
      } else if (workbook) {
        if (KIND === "store" || KIND === "print3d" || KIND === "purchase") {
          throw new Error("Store stock, 3D print, and purchase order saves need the Google web app so notifications stay shared.");
        }
        if (KIND === "enquiry") result = applyEnquiry(collected.input, { previousId: previousId });
        else if (KIND === "requisition") result = applyRequisition(collected.input, collected.lines, { previousId: previousId, previousEnquiryNo: previousEnquiryNo });
        else result = applyPass(collected.input, collected.lines, { previousId: previousId, previousEnquiryNo: previousEnquiryNo });
        await persistLocal();
        page.fill(result.record, result.lines || []);
        if (mode !== "file") result.message += " A copy of the workbook was downloaded — replace the shared file with it, or use Open master Excel / Connect cloud so the original file updates.";
      } else {
        throw new Error("Open the master Excel or connect the Google web app before saving.");
      }
      dirty = false;
      fillCommonLists();
      refreshChrome();
      setStatus(result.message || "Saved.");
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      button.disabled = false;
    }
  }

  function bindCommon() {
    document.getElementById("docForm").addEventListener("submit", function (event) { event.preventDefault(); });
    document.getElementById("docForm").addEventListener("input", function () { if (!suppress) dirty = true; });
    document.getElementById("docForm").addEventListener("change", function () { if (!suppress) { dirty = true; refreshChrome(); } });
    document.getElementById("btnSave").addEventListener("click", onSave);
    const btnNew = document.getElementById("btnNew");
    if (btnNew) btnNew.addEventListener("click", function () {
      if (dirty && !confirm("Discard the changes on this form?")) return;
      page.blank(false);
    });
    const btnPrint = document.getElementById("btnPrint");
    if (btnPrint) btnPrint.addEventListener("click", function () {
      document.querySelectorAll("textarea").forEach(function (area) {
        area.style.height = "auto";
        area.style.height = area.scrollHeight + "px";
      });
      refreshChrome();
      window.print();
    });
    const existing = document.getElementById("existingDoc");
    if (existing) existing.addEventListener("change", function (event) {
      const next = event.target.value;
      if (dirty && !confirm("Discard the changes on this form?")) {
        event.target.value = previousId || "";
        return;
      }
      if (!next) page.blank(false);
      else page.loadById(next);
    });
    const btnOpen = document.getElementById("btnOpen");
    if (btnOpen) btnOpen.addEventListener("click", async function () {
      try {
        if (!window.showOpenFilePicker) {
          document.getElementById("fileFallback").click();
          return;
        }
        const handles = await window.showOpenFilePicker({
          types: [{ description: "Excel workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }]
        });
        await storeHandle(handles[0]);
        await readHandle(handles[0]);
      } catch (err) {
        if (err && err.name === "AbortError") return;
        setStatus(err.message || String(err), true);
      }
    });
    const fileFallback = document.getElementById("fileFallback");
    if (fileFallback) fileFallback.addEventListener("change", async function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        await loadBuffer(await file.arrayBuffer());
        fileHandle = null;
        mode = "download";
        afterMasterLoaded();
        showBanner("This browser can read the workbook. Save will download the updated Excel file. Chrome or Edge can write back to the same file with Open master Excel.");
        setStatus("Workbook loaded.");
      } catch (err) {
        setStatus(err.message || String(err), true);
      }
    });
    document.getElementById("btnCloud").addEventListener("click", async function () {
      try {
        const url = cloudUrl();
        if (!url) throw new Error("Cloud is not configured. Open Settings to review the connection.");
        await connectCloud(url);
      } catch (err) {
        setStatus(err.message || String(err), true);
      }
    });
    document.getElementById("btnReload").addEventListener("click", async function () {
      try {
        if (mode === "cloud") await connectCloud(cloudUrl());
        else if (fileHandle) await readHandle(fileHandle);
        else throw new Error("Nothing is connected yet.");
      } catch (err) {
        setStatus(err.message || String(err), true);
      }
    });
    ["CoordinatorDecision", "StoreDecision", "ApprovalDecision", "AuthorizeDecision"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", function () {
        if (el.value === "Approved") {
          const dateId = id === "StoreDecision" ? "StoreDate"
            : id === "ApprovalDecision" ? "ApprovalDate"
            : id === "AuthorizeDecision" ? "AuthorizeDate"
            : "CoordinatorDate";
          if (!val(dateId)) setDate(dateId, today());
          if ((id === "ApprovalDecision" || id === "AuthorizeDecision") && document.getElementById("Status")) {
            const st = val("Status");
            if (!st || st === "Pending approval" || st === "Submitted" || st === "Draft") setVal("Status", "Approved");
          }
        } else if ((id === "ApprovalDecision" || id === "AuthorizeDecision") && el.value === "Rejected" && document.getElementById("Status")) {
          setVal("Status", "Rejected");
        } else if (id === "ApprovalDecision" && el.value === "Pending" && document.getElementById("Status")) {
          if (val("Status") === "Approved") setVal("Status", "Pending approval");
        } else if (id === "AuthorizeDecision" && el.value === "Pending" && document.getElementById("Status")) {
          if (val("Status") === "Approved") setVal("Status", "Draft");
        }
        refreshChrome();
      });
    });
    window.addEventListener("beforeprint", function () {
      document.querySelectorAll("textarea").forEach(function (area) {
        area.style.height = "auto";
        area.style.height = area.scrollHeight + "px";
      });
    });
  }

  function applyTeamMode() {
    const cfg = window.DRONE_DOC_CONFIG || {};
    ["btnOpen", "fileFallback"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && cfg.teamMode) el.hidden = true;
    });
    document.querySelectorAll(".toolbar label.cloud").forEach(function (el) {
      el.hidden = true;
    });
    const cloudBtn = document.getElementById("btnCloud");
    if (cloudBtn) cloudBtn.hidden = true;
    const urlBox = document.getElementById("webAppUrl");
    if (urlBox && urlBox.type !== "hidden") urlBox.type = "hidden";
  }

  async function startup() {
    if (window.DroneAuth && !DroneAuth.requireLogin()) return;
    applyTeamMode();
    bindCommon();
    if (KIND === "enquiry") bootEnquiry();
    else if (KIND === "requisition") bootRequisition();
    else if (KIND === "pass") bootPass();
    else if (KIND === "store") bootStore();
    else if (KIND === "print3d") bootPrint3d();
    else if (KIND === "purchase") bootPo();
    else bootEnquiry();
    page.blank(false);
    if (window.DroneAuth) DroneAuth.decorateChrome();
    const cfg = window.DRONE_DOC_CONFIG || {};
    let stored = "";
    const configured = norm(cfg.webAppUrl || "");
    try {
      if (configured) localStorage.setItem("droneDoc.webAppUrl", configured);
      stored = localStorage.getItem("droneDoc.webAppUrl") || "";
    } catch (err) { stored = ""; }
    const initialUrl = configured || norm(stored);
    let cloudError = "";
    if (initialUrl) setVal("webAppUrl", initialUrl);
    if (initialUrl) {
      setStatus("Connecting to cloud…");
      try {
        await connectCloud(initialUrl);
        return;
      } catch (err) {
        cloudError = err.message || String(err);
        setStatus(cloudError, true);
      }
    }
    try {
      const response = await fetch("Drone_Project_Master.xlsx");
      if (response.ok) {
        await loadBuffer(await response.arrayBuffer());
        mode = "download";
        afterMasterLoaded();
        showBanner("Workbook loaded from this folder. Use Open master Excel to update that same file, or Connect cloud so everyone shares one Google Sheet. Otherwise Save downloads a new copy.");
        setStatus("Workbook loaded for reading.");
        return;
      }
    } catch (err) { /* opening the html as a file blocks this fetch */ }
    const handle = await storedHandle();
    if (handle && handle.queryPermission) {
      try {
        const permission = await handle.queryPermission({ mode: "readwrite" });
        if (permission === "granted") {
          await readHandle(handle);
          return;
        }
      } catch (err) { /* ask with the Open button */ }
    }
    showBanner(cloudError
      ? cloudError + " Until the Sheet connects, use Open master Excel and choose Drone_Project_Master.xlsx."
      : "Open the master Excel, or paste the Google web app URL and connect. Pick lists and the next document numbers load from that workbook. You can still fill and print before connecting.");
  }

  startup();
}());
