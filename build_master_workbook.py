"""Build Drone_Project_Master.xlsx — the shared register for the three HTML forms.

Run once to create the workbook. After people start saving real enquiries,
do not run it again unless you pass --force (that overwrites the file).
"""

from __future__ import annotations

import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.properties import CalcProperties
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.page import PageMargins

OUT = Path(__file__).with_name("Drone_Project_Master.xlsx")

NAVY = "0B1F33"
BLUE = "1F4E79"
PALE = "F4F7FA"
GREEN = "E5F4EA"
AMBER = "FFF6E0"
LINE = "D0D7DE"

THIN = Border(
    left=Side(style="thin", color=LINE),
    right=Side(style="thin", color=LINE),
    top=Side(style="thin", color=LINE),
    bottom=Side(style="thin", color=LINE),
)
HEADER_FILL = PatternFill("solid", fgColor=NAVY)
HEADER_FONT = Font(name="Calibri", bold=True, color="FFFFFF", size=10)
DATA_FONT = Font(name="Calibri", size=10, color="102033")
WRAP = Alignment(wrap_text=True, vertical="center")
LEFT = Alignment(vertical="center", wrap_text=True)


def style_header(ws, ncol):
    ws.row_dimensions[1].height = 22
    ws.auto_filter.ref = f"A1:{get_column_letter(ncol)}1"
    ws.freeze_panes = "A2"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.6, bottom=0.5, header=0.25, footer=0.25)
    ws.oddFooter.left.text = "Drone and electronics project register"
    ws.oddFooter.right.text = "Page &P of &N"
    ws.sheet_view.showGridLines = True
    ws.sheet_view.zoomScale = 110
    for col in range(1, ncol + 1):
        cell = ws.cell(1, col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = THIN


def write_table(ws, headers, rows, widths, text_cols=()):
    for c, header in enumerate(headers, 1):
        ws.cell(1, c, header)
    for r, row in enumerate(rows, 2):
        for c, value in enumerate(row, 1):
            cell = ws.cell(r, c, value)
            cell.font = DATA_FONT
            cell.alignment = LEFT
            cell.border = THIN
            if c in text_cols and not (isinstance(value, str) and value.startswith("=")):
                cell.number_format = "@"
            if isinstance(value, str) and value.startswith("="):
                cell.font = DATA_FONT
    style_header(ws, len(headers))
    for letter, width in widths.items():
        ws.column_dimensions[letter].width = width
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(2, len(rows) + 1)}"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}500"


def add_list(ws, cells, formula):
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.errorStyle = "warning"
    dv.errorTitle = "Pick list"
    dv.error = "Choose a value from the master list, or type one if it is not listed yet."
    dv.promptTitle = "Pick list"
    dv.prompt = "Values come from the master sheets."
    dv.showErrorMessage = True
    dv.showInputMessage = True
    ws.add_data_validation(dv)
    dv.add(cells)


def status_colors(ws, col_letter):
    green = PatternFill("solid", fgColor=GREEN)
    amber = PatternFill("solid", fgColor=AMBER)
    grey = PatternFill("solid", fgColor=PALE)
    span = f"{col_letter}2:{col_letter}500"
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Approved"'], fill=green))
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Issued"'], fill=green))
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Complete"'], fill=green))
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Pending"'], fill=amber))
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Draft"'], fill=amber))
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Not started"'], fill=grey))
    ws.conditional_formatting.add(span, CellIsRule(operator="equal", formula=['"Materials approved"'], fill=amber))


def build():
    wb = Workbook()
    wb.calculation = CalcProperties(calcMode="auto", fullCalcOnLoad=True)
    wb.properties.title = "Drone and electronics project master"
    wb.properties.creator = "Project control"
    wb.properties.subject = "Enquiry, store requisition, and outside test pass"

    how = wb.active
    how.title = "HowToUse"

    settings_rows = [
        ("CompanyName", "Elevate Devices", "Printed on all three forms. Change this to your legal name."),
        ("Tagline", "Drones & Related Electronics", "Second line of the letterhead."),
        ("Address", "", "Optional. Printed under the company name when filled."),
        ("Phone", "", "Optional."),
        ("Email", "", "Optional."),
        ("Website", "", "Optional."),
        ("LogoFile", "assets/company-logo.svg", "Put your logo here, or add assets/company-logo.png (png is used first)."),
        ("Year", 2026, "Informational. The live year used in new numbers is on NumberSeries."),
        ("Currency", "INR", "Default currency on a new enquiry."),
        ("WebAppUrl", "", "Paste the Apps Script web app URL so the HTML forms update this workbook for everyone."),
        ("SpreadsheetId", "", "Optional. The id in the Google Sheet URL."),
        ("EnquiryTemplate", "01_Enquiry_Sheet.html", "File name of the enquiry form."),
        ("StoreTemplate", "02_Store_Requisition.html", "File name of the store form."),
        ("PassTemplate", "03_Outside_Test_Pass.html", "File name of the outside test pass."),
        ("SchemaVersion", 1, "Do not change."),
    ]

    people = [
        ("P001", "Divya Krishnan", "Project Coordinator", "Projects", "", "", "Yes"),
        ("P002", "Arvind Rao", "Project Coordinator", "Projects", "", "", "Yes"),
        ("P003", "Suresh Babu", "Store Keeper", "Store", "", "", "Yes"),
        ("P004", "Lakshmi Natarajan", "Store Keeper", "Store", "", "", "Yes"),
        ("P005", "Anil Menon", "Management", "Management", "", "", "Yes"),
        ("P006", "Meera Joseph", "Electronics Engineer", "Electronics", "", "", "Yes"),
        ("P007", "Farhan Qureshi", "Flight Test Pilot", "Flight Test", "", "", "Yes"),
        ("P008", "Client Representative", "Client", "External", "", "", "Yes"),
    ]

    drones = [
        ("DRN-TETH", "Tethered multirotor", "Drone", "Tethered hover and inspection"),
        ("DRN-QUAD", "Survey quadcopter", "Drone", "Mapping and survey"),
        ("DRN-HEX", "Inspection hexacopter", "Drone", "Close visual inspection"),
        ("DRN-VTOL", "VTOL fixed wing", "Drone", "Longer range trial"),
        ("DRN-GS", "Ground station system", "Drone", "Ground equipment with the aircraft"),
        ("DRN-OTH", "Other drone", "Drone", "Describe it on the enquiry"),
    ]

    electronics = [
        ("Flight controller set", "Electronics", "Autopilot and related board"),
        ("Power and battery module", "Electronics", "Onboard power and backup pack"),
        ("Telemetry / radio link", "Electronics", "Radio and data link"),
        ("Camera and sensor payload", "Electronics", "Camera and sensors"),
        ("Winch and tether electronics", "Electronics", "Winch interface and tether"),
        ("Ground control electronics", "Electronics", "Ground station electronics"),
        ("ESC and propulsion electronics", "Electronics", "Speed controllers and drive"),
        ("Wiring harness", "Electronics", "Power and signal loom"),
    ]

    budgets = [
        ("BDG-DRN-2026-01", "Drone flight test", "2026-27", 250000, "INR", "Projects"),
        ("BDG-ELC-2026-02", "Electronics prototype", "2026-27", 150000, "INR", "Electronics"),
        ("BDG-PRD-2026-03", "Production trial", "2026-27", 500000, "INR", "Management"),
    ]

    materials = [
        ("MAT-AIR-01", "Airframe kit", "As per enquiry", "Set", "Drone"),
        ("MAT-PROP-01", "Propeller set", "Matched set", "Set", "Drone"),
        ("MAT-FC-01", "Flight controller", "Spare", "Nos", "Electronics"),
        ("MAT-ESC-01", "ESC set", "4 in 1", "Set", "Electronics"),
        ("MAT-BAT-01", "Li-ion pack", "Test pack", "Nos", "Electronics"),
        ("MAT-TEL-01", "Telemetry module", "Radio", "Nos", "Electronics"),
        ("MAT-CAM-01", "Camera payload", "Daylight camera", "Nos", "Electronics"),
        ("MAT-GS-01", "Ground station set", "Tablet and radio", "Set", "Electronics"),
        ("MAT-CBL-01", "Harness and cables", "Power and signal", "Set", "Electronics"),
        ("MAT-WNC-01", "Winch interface kit", "Isolated link", "Set", "Electronics"),
        ("MAT-PWR-01", "Power module", "Onboard", "Nos", "Electronics"),
        ("MAT-TOOL-01", "Field tool kit", "Standard", "Set", "Store"),
    ]

    locations = [
        ("Factory yard", "Inside the premises"),
        ("Open ground — outside test", "Approved ground outside the store"),
        ("Client site", "At the client"),
        ("Airfield — approved zone", "Formal flying zone"),
    ]

    stages = [
        (1, "Enquiry", "Now", "Yes"),
        (2, "Store requisition", "Now", "Yes"),
        (3, "Outside test pass", "Now", "Yes"),
        (4, "POC", "Later", "Yes"),
        (5, "Pilot", "Later", "Yes"),
        (6, "Full production", "Later", "Yes"),
        (7, "Testing", "Later", "Yes"),
    ]

    series = [
        ("ENQ", "ENQ-DRN-", 2026, 1, 3),
        ("PRJ", "PRJ-DRN-", 2026, 1, 3),
        ("REQ", "REQ-STR-", 2026, 89, 3),
        ("GTP", "GTP-FLY-", 2026, 42, 3),
        ("POC", "POC-DRN-", 2026, 0, 3),
        ("PIL", "PIL-DRN-", 2026, 0, 3),
        ("PRD", "PRD-DRN-", 2026, 0, 3),
        ("TST", "TST-DRN-", 2026, 0, 3),
    ]

    lists = {
        "Source": ["Client", "Management"],
        "ProductFamily": ["Drone", "Electronics", "Drone + Electronics"],
        "Priority": ["High", "Medium", "Low"],
        "DocStatus": ["Draft", "Submitted", "Approved", "Issued", "Closed", "Rejected", "On hold"],
        "Decision": ["Pending", "Approved", "Rejected", "On hold"],
        "ProcessStage": ["Outside test", "POC", "Pilot", "Full production", "Testing"],
        "UOM": ["Nos", "Set", "Mtr", "Kg", "Lot"],
        "Department": ["Projects", "Store", "Flight Test", "Electronics", "Management", "External"],
        "Currency": ["INR", "USD", "EUR"],
        "Coordinator": ["Divya Krishnan", "Arvind Rao"],
        "StoreKeeper": ["Suresh Babu", "Lakshmi Natarajan"],
    }

    elec_text = "; ".join([
        "Flight controller set",
        "Power and battery module",
        "Telemetry / radio link",
        "Camera and sensor payload",
        "Ground control electronics",
    ])

    enquiry_headers = [
        "EnquiryNo", "ProjectNo", "EnquiryDate", "Source", "RaisedBy", "ClientOrg", "ContactName",
        "ContactPhone", "ContactEmail", "ProjectTitle", "ProductFamily", "DroneType", "Electronics",
        "Mission", "Quantity", "Environment", "Endurance", "Payload", "PowerSource", "CommsLink",
        "Sensors", "GroundEquipment", "TechnicalRequirements", "Constraints", "Acceptance",
        "BudgetCode", "EstimatedBudget", "Currency", "Priority", "RequiredBy", "Location",
        "Coordinator", "Status", "CurrentStage", "Remarks", "LinkedRequisitions", "LinkedPasses",
        "FileName", "Revision", "UpdatedAt",
    ]
    enquiry = [(
        "ENQ-DRN-2026-001", "PRJ-DRN-2026-001", "2026-10-27", "Management", "Anil Menon",
        "Internal — Flight Systems", "Meera Joseph", "", "",
        "Tethered inspection drone — electronics integration, outside test",
        "Drone + Electronics", "Tethered multirotor", elec_text,
        "Prove the tethered multirotor, onboard electronics, and ground equipment as one system before POC.",
        1, "Open ground, daylight", "20 min tethered hover", "Camera, about 400 g",
        "Ground tether supply with onboard backup pack", "Tether data link and telemetry radio",
        "Camera, current, temperature", "Ground station, winch controller, field tool kit",
        "One airframe, flight controller, telemetry, backup battery, and ground-station set for a tethered hover outside the store. Power and data stay on the approved tether. Record current, temperature, and link status.",
        "Daylight only. Approved ground only. No free flight outside the marked area. All material returns the same day.",
        "Stable tethered hover, live telemetry, and the issued list either fitted or returned.",
        "BDG-DRN-2026-01", 250000, "INR", "High", "2026-11-15", "Open ground — outside test",
        "Divya Krishnan", "Approved", "Outside test pass",
        "Project PRJ-DRN-2026-001 is the only project number for store, the outside pass, POC, pilot, full production, and testing.",
        "REQ-STR-2026-089", "GTP-FLY-2026-042",
        "ENQ-DRN-2026-001_PRJ-DRN-2026-001_Enquiry_Sheet", 1, "2026-10-27 16:30",
    )]

    req_headers = [
        "RequisitionID", "EnquiryNo", "ProjectNo", "ReqDate", "ProcessStage", "RequestedBy",
        "Department", "Purpose", "Coordinator", "CoordinatorDecision", "CoordinatorDate",
        "CoordinatorRemarks", "StoreKeeper", "StoreDate", "StoreRemarks", "Status",
        "FileName", "Revision", "UpdatedAt",
    ]
    requisition = [(
        "REQ-STR-2026-089", "ENQ-DRN-2026-001", "PRJ-DRN-2026-001", "2026-10-27", "Outside test",
        "Meera Joseph", "Electronics",
        "Issue the approved drone and electronics list for the outside test of this project. Quantities are for one trial only.",
        "Divya Krishnan", "Approved", "2026-10-27",
        "Approved for one outside test. Unused items return the same day.",
        "Suresh Babu", "2026-10-27", "To be issued against the outside test pass.",
        "Approved", "REQ-STR-2026-089_PRJ-DRN-2026-001_Store_Requisition", 1, "2026-10-27 16:30",
    )]

    req_line_headers = [
        "RequisitionID", "LineNo", "ItemCode", "Description", "Spec", "UOM",
        "QtyRequested", "QtyApproved", "Remarks",
    ]
    req_lines = [
        ("REQ-STR-2026-089", 1, "MAT-AIR-01", "Airframe kit", "As per enquiry", "Set", 1, 1, "Trial airframe"),
        ("REQ-STR-2026-089", 2, "MAT-FC-01", "Flight controller", "Spare", "Nos", 1, 1, ""),
        ("REQ-STR-2026-089", 3, "MAT-TEL-01", "Telemetry module", "Radio", "Nos", 1, 1, ""),
        ("REQ-STR-2026-089", 4, "MAT-BAT-01", "Li-ion pack", "Test pack", "Nos", 1, 1, "Backup only"),
        ("REQ-STR-2026-089", 5, "MAT-GS-01", "Ground station set", "Tablet and radio", "Set", 1, 1, ""),
        ("REQ-STR-2026-089", 6, "MAT-CBL-01", "Harness and cables", "Power and signal", "Set", 1, 1, ""),
        ("REQ-STR-2026-089", 7, "MAT-CAM-01", "Camera payload", "Daylight camera", "Nos", 1, 1, "About 400 g"),
        ("REQ-STR-2026-089", 8, "MAT-TOOL-01", "Field tool kit", "Standard", "Set", 1, 1, "Return same day"),
    ]

    pass_headers = [
        "PassID", "EnquiryNo", "ProjectNo", "RequisitionID", "ProcessStage", "PassDate",
        "ValidFrom", "ValidUntil", "TakenBy", "Team", "Destination", "FlightArea", "Purpose",
        "Conditions", "StoreKeeper", "StoreDecision", "StoreDate", "Coordinator",
        "CoordinatorDecision", "CoordinatorDate", "CoordinatorRemarks", "ReturnDue", "Status",
        "FileName", "Revision", "UpdatedAt",
    ]
    gate = [(
        "GTP-FLY-2026-042", "ENQ-DRN-2026-001", "PRJ-DRN-2026-001", "REQ-STR-2026-089",
        "Outside test", "2026-10-27", "2026-10-28 09:00", "2026-10-28 18:00",
        "Farhan Qureshi", "Meera Joseph", "Open ground — outside test", "Approved yard north of store",
        "Carry the approved materials from store to the outside test ground and return them the same day.",
        "Company property. Do not hand the material to a third party. Do not exceed approved quantities. Flight only inside the area named on this pass. Return every item to the store keeper by the return due time.",
        "Suresh Babu", "Approved", "2026-10-27", "Divya Krishnan", "Approved", "2026-10-27",
        "Outside run approved for this project number only.",
        "2026-10-28", "Approved",
        "GTP-FLY-2026-042_PRJ-DRN-2026-001_Outside_Test_Pass", 1, "2026-10-27 16:30",
    )]

    pass_line_headers = [
        "PassID", "LineNo", "ItemCode", "Description", "Spec", "UOM", "QtyCarried", "Remarks",
    ]
    pass_lines = [
        ("GTP-FLY-2026-042", n, code, desc, spec, uom, qty, remarks)
        for n, code, desc, spec, uom, qty, remarks in [
            (1, "MAT-AIR-01", "Airframe kit", "As per enquiry", "Set", 1, "Trial airframe"),
            (2, "MAT-FC-01", "Flight controller", "Spare", "Nos", 1, ""),
            (3, "MAT-TEL-01", "Telemetry module", "Radio", "Nos", 1, ""),
            (4, "MAT-BAT-01", "Li-ion pack", "Test pack", "Nos", 1, "Backup only"),
            (5, "MAT-GS-01", "Ground station set", "Tablet and radio", "Set", 1, ""),
            (6, "MAT-CBL-01", "Harness and cables", "Power and signal", "Set", 1, ""),
            (7, "MAT-CAM-01", "Camera payload", "Daylight camera", "Nos", 1, "About 400 g"),
            (8, "MAT-TOOL-01", "Field tool kit", "Standard", "Set", 1, "Return same day"),
        ]
    ]

    trail_headers = [
        "ProjectNo", "EnquiryNo", "Stage", "StageOrder", "Status", "Owner", "PlannedDate",
        "RequisitionID", "PassID", "Notes", "UpdatedAt",
    ]
    later = "Reserved under PRJ-DRN-2026-001. Use this same project number when this stage starts."
    trail = [
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Enquiry", 1, "Approved", "Anil Menon", "2026-10-27", "", "", "Technical enquiry recorded.", "2026-10-27 16:30"),
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Store requisition", 2, "Approved", "Divya Krishnan", "2026-10-27", "REQ-STR-2026-089", "", "Internal store issue for the outside test.", "2026-10-27 16:30"),
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Outside test pass", 3, "Approved", "Farhan Qureshi", "2026-10-28", "REQ-STR-2026-089", "GTP-FLY-2026-042", "Material leave-pass for the outside run.", "2026-10-27 16:30"),
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "POC", 4, "Not started", "", "", "", "", later, ""),
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Pilot", 5, "Not started", "", "", "", "", later, ""),
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Full production", 6, "Not started", "", "", "", "", later, ""),
        ("PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Testing", 7, "Not started", "", "", "", "", later, ""),
    ]

    doc_headers = [
        "LinkKey", "FileName", "HtmlTemplate", "DocType", "DocID", "ProjectNo", "EnquiryNo",
        "OpenLink", "Status", "UpdatedAt",
    ]
    documents = [
        ("Enquiry|ENQ-DRN-2026-001", "ENQ-DRN-2026-001_PRJ-DRN-2026-001_Enquiry_Sheet", "01_Enquiry_Sheet.html", "Enquiry", "ENQ-DRN-2026-001", "PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "01_Enquiry_Sheet.html?enq=ENQ-DRN-2026-001", "Approved", "2026-10-27 16:30"),
        ("Store requisition|REQ-STR-2026-089", "REQ-STR-2026-089_PRJ-DRN-2026-001_Store_Requisition", "02_Store_Requisition.html", "Store requisition", "REQ-STR-2026-089", "PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "02_Store_Requisition.html?enq=ENQ-DRN-2026-001&req=REQ-STR-2026-089", "Approved", "2026-10-27 16:30"),
        ("Outside test pass|GTP-FLY-2026-042", "GTP-FLY-2026-042_PRJ-DRN-2026-001_Outside_Test_Pass", "03_Outside_Test_Pass.html", "Outside test pass", "GTP-FLY-2026-042", "PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "03_Outside_Test_Pass.html?enq=ENQ-DRN-2026-001&req=REQ-STR-2026-089&pass=GTP-FLY-2026-042", "Approved", "2026-10-27 16:30"),
    ]

    # How to use
    how.sheet_view.showGridLines = False
    how.page_setup.orientation = "portrait"
    how.page_setup.paperSize = how.PAPERSIZE_A4
    how.page_setup.fitToWidth = 1
    how.page_setup.fitToHeight = 0
    how.sheet_properties.pageSetUpPr.fitToPage = True
    how.page_margins = PageMargins(left=0.6, right=0.5, top=0.6, bottom=0.5)
    how["A1"] = "Drone and electronics project documents"
    how["A1"].font = Font(name="Calibri", size=18, bold=True, color=NAVY)
    how["A2"] = "One project number, created on the technical enquiry, is used on the store requisition, the outside test pass, and later on POC, pilot, full production, and testing."
    how["A2"].font = Font(name="Calibri", size=11, color="102033")
    how["A2"].alignment = Alignment(wrap_text=True)
    how.merge_cells("A2:B2")
    how["A4"] = "Step"
    how["B4"] = "What to do"
    for col in (1, 2):
        how.cell(4, col).fill = HEADER_FILL
        how.cell(4, col).font = HEADER_FONT
    steps = [
        "Put the whole Drone_Project_Documents folder in Google Drive and share it with enquiry, store, and coordinator staff.",
        "Open Drone_Project_Master.xlsx in Google Sheets and share that Sheet with the same people. Set the Sheet time zone to your local time.",
        "On Settings, set CompanyName and the optional address, phone, and email. These print on every form.",
        "Replace assets/company-logo.svg with your logo, or add assets/company-logo.png. If the png is present, the forms use it.",
        "Maintain People, DroneTypes, Electronics, Budgets, Materials, and Locations. The forms load them as dropdowns. Do not rename the header row. You may add rows.",
        "Issued samples are ENQ-DRN-2026-001, project PRJ-DRN-2026-001, REQ-STR-2026-089, and GTP-FLY-2026-042. The next save continues the NumberSeries (enquiry 002, requisition 090, pass 043).",
        "In the Google Sheet choose Extensions, Apps Script, replace the sample with GoogleAppsScript.gs, then Deploy, New deployment, Web app. Execute as Me. Give access to your organisation, or to anyone with the link if you are not on Workspace.",
        "Paste that web app URL into assets/cloud-config.js (webAppUrl) and into Settings WebAppUrl. Everyone who opens the HTML from the shared folder then updates this workbook.",
        "Open 01_Enquiry_Sheet.html in Chrome or Edge. Fill the technical sheet and save. That writes the enquiry and creates the project number.",
        "Open 02_Store_Requisition.html, choose the enquiry number, add the material lines, and record the project coordinator's approval.",
        "Open 03_Outside_Test_Pass.html, choose the enquiry and the requisition, then record store release and coordinator approval for the outside run.",
        "Print at A4. In the browser print dialog set margins to None and turn off headers and footers. The suggested PDF name is the file name printed on the sheet.",
        "POC, Pilot, FullProduction, and Testing sheets are ready. Keep the same ProjectNo and EnquiryNo. Do not issue a new project number for those stages. NumberSeries already holds POC, PIL, PRD, and TST.",
        "Open the worked example from the dropdown on each form: ENQ-DRN-2026-001 / PRJ-DRN-2026-001 / REQ-STR-2026-089 / GTP-FLY-2026-042.",
        "Open master Excel is for one editor at a time, or for a Drive-for-desktop copy. When several people save together, use the web app so numbers cannot clash.",
        "Do not run build_master_workbook.py again after live entries exist unless you intend to replace this file. Pass --force only when you mean to overwrite.",
    ]
    for i, text in enumerate(steps, 5):
        how.cell(i, 1, i - 4).font = Font(name="Calibri", size=12, bold=True, color=NAVY)
        how.cell(i, 1).alignment = Alignment(vertical="top")
        cell = how.cell(i, 2, text)
        cell.font = DATA_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        how.row_dimensions[i].height = 32
    how.column_dimensions["A"].width = 8
    how.column_dimensions["B"].width = 140
    how.row_dimensions[1].height = 24
    how.row_dimensions[2].height = 32
    how.oddFooter.left.text = "How to use the project forms"
    link_row = 5 + len(steps) + 1
    how.cell(link_row, 1, "Chain").font = Font(name="Calibri", size=12, bold=True, color=NAVY)
    how.cell(link_row, 2, "ENQ-DRN-2026-001  →  PRJ-DRN-2026-001  →  REQ-STR-2026-089  →  GTP-FLY-2026-042  →  POC / Pilot / Full production / Testing").font = Font(name="Calibri", size=12, bold=True, color=BLUE)
    file_row = link_row + 1
    how.cell(file_row, 1, "Files").font = Font(name="Calibri", size=12, bold=True, color=NAVY)
    how.cell(file_row, 2, "ENQ-DRN-2026-001_PRJ-DRN-2026-001_Enquiry_Sheet    ·    REQ-STR-2026-089_PRJ-DRN-2026-001_Store_Requisition    ·    GTP-FLY-2026-042_PRJ-DRN-2026-001_Outside_Test_Pass").alignment = Alignment(wrap_text=True)
    how.row_dimensions[file_row].height = 32

    ws = wb.create_sheet("Settings")
    write_table(ws, ["Key", "Value", "Description"], settings_rows, {"A": 24, "B": 42, "C": 88}, text_cols=(2,))
    ws.freeze_panes = "A2"

    ws = wb.create_sheet("NumberSeries")
    series_headers = ["SeriesKey", "Prefix", "Year", "LastNumber", "Pad", "NextExample"]
    series_rows = []
    for i, (key, prefix, year, last, pad) in enumerate(series, 2):
        series_rows.append((key, prefix, year, last, pad, f'=B{i}&C{i}&"-"&TEXT(D{i}+1,REPT("0",E{i}))'))
    write_table(ws, series_headers, series_rows, {"A": 16, "B": 16, "C": 12, "D": 16, "E": 10, "F": 28}, text_cols=(1, 2))

    ws = wb.create_sheet("Lists")
    list_headers = list(lists.keys())
    height = max(len(v) for v in lists.values())
    list_rows = []
    for i in range(height):
        list_rows.append(tuple(lists[h][i] if i < len(lists[h]) else "" for h in list_headers))
    write_table(ws, list_headers, list_rows, {get_column_letter(i): 24 for i in range(1, len(list_headers) + 1)}, text_cols=tuple(range(1, len(list_headers) + 1)))

    ws = wb.create_sheet("People")
    write_table(ws, ["PersonId", "PersonName", "Role", "Department", "Phone", "Email", "Active"], people, {"A": 14, "B": 24, "C": 24, "D": 18, "E": 16, "F": 28, "G": 12}, text_cols=(1, 2, 5, 6))
    add_list(ws, "D2:D300", "=Lists!$H$2:$H$20")
    add_list(ws, "G2:G300", '"Yes,No"')

    ws = wb.create_sheet("DroneTypes")
    write_table(ws, ["TypeCode", "TypeName", "Category", "Notes"], drones, {"A": 16, "B": 28, "C": 16, "D": 42}, text_cols=(1, 2))

    ws = wb.create_sheet("Electronics")
    write_table(ws, ["ItemName", "Category", "Notes"], electronics, {"A": 36, "B": 16, "C": 42})

    ws = wb.create_sheet("Budgets")
    write_table(ws, ["BudgetCode", "BudgetName", "FinancialYear", "Amount", "Currency", "Owner"], budgets, {"A": 22, "B": 28, "C": 16, "D": 14, "E": 12, "F": 18}, text_cols=(1,))
    for row in ws.iter_rows(min_row=2, max_row=1 + len(budgets), min_col=4, max_col=4):
        for cell in row:
            cell.number_format = "#,##0"

    ws = wb.create_sheet("Materials")
    write_table(ws, ["ItemCode", "Description", "Spec", "UOM", "Category"], materials, {"A": 16, "B": 28, "C": 22, "D": 12, "E": 16}, text_cols=(1,))
    add_list(ws, "D2:D300", "=Lists!$G$2:$G$20")

    ws = wb.create_sheet("Locations")
    write_table(ws, ["LocationName", "Notes"], locations, {"A": 32, "B": 48})

    ws = wb.create_sheet("Stages")
    write_table(ws, ["StageOrder", "StageName", "AppliesTo", "Active"], stages, {"A": 14, "B": 24, "C": 14, "D": 12})

    ws = wb.create_sheet("Enquiries")
    text_idx = tuple(i for i, h in enumerate(enquiry_headers, 1) if h not in ("Quantity", "EstimatedBudget", "Revision"))
    write_table(ws, enquiry_headers, enquiry, {get_column_letter(i): 18 for i in range(1, len(enquiry_headers) + 1)}, text_cols=text_idx)
    ws.column_dimensions["J"].width = 42
    ws.column_dimensions["M"].width = 36
    ws.column_dimensions["N"].width = 36
    ws.column_dimensions["W"].width = 36
    ws.freeze_panes = "C2"
    add_list(ws, "D2:D500", "=Lists!$A$2:$A$10")
    add_list(ws, "E2:E500", "=People!$B$2:$B$300")
    add_list(ws, "K2:K500", "=Lists!$B$2:$B$10")
    add_list(ws, "L2:L500", "=DroneTypes!$B$2:$B$200")
    add_list(ws, "Z2:Z500", "=Budgets!$A$2:$A$200")
    add_list(ws, "AB2:AB500", "=Lists!$I$2:$I$10")
    add_list(ws, "AC2:AC500", "=Lists!$C$2:$C$10")
    add_list(ws, "AE2:AE500", "=Locations!$A$2:$A$200")
    add_list(ws, "AF2:AF500", "=Lists!$J$2:$J$20")
    add_list(ws, "AG2:AG500", "=Lists!$D$2:$D$20")
    status_colors(ws, "AG")
    ws["Z2"].number_format = "@"
    ws["AA2"].number_format = "#,##0"

    ws = wb.create_sheet("Requisitions")
    write_table(ws, req_headers, requisition, {get_column_letter(i): 20 for i in range(1, len(req_headers) + 1)}, text_cols=tuple(range(1, len(req_headers) + 1)))
    ws.column_dimensions["H"].width = 42
    ws.freeze_panes = "D2"
    add_list(ws, "B2:B500", "=Enquiries!$A$2:$A$500")
    add_list(ws, "C2:C500", "=Enquiries!$B$2:$B$500")
    add_list(ws, "E2:E500", "=Lists!$F$2:$F$15")
    add_list(ws, "F2:F500", "=People!$B$2:$B$300")
    add_list(ws, "G2:G500", "=Lists!$H$2:$H$20")
    add_list(ws, "I2:I500", "=Lists!$J$2:$J$20")
    add_list(ws, "J2:J500", "=Lists!$E$2:$E$10")
    add_list(ws, "M2:M500", "=Lists!$K$2:$K$20")
    add_list(ws, "P2:P500", "=Lists!$D$2:$D$20")
    status_colors(ws, "J")
    status_colors(ws, "P")

    ws = wb.create_sheet("RequisitionLines")
    write_table(ws, req_line_headers, req_lines, {"A": 22, "B": 10, "C": 16, "D": 28, "E": 20, "F": 10, "G": 16, "H": 16, "I": 24}, text_cols=(1, 3))
    add_list(ws, "A2:A500", "=Requisitions!$A$2:$A$500")
    add_list(ws, "C2:C500", "=Materials!$A$2:$A$300")
    add_list(ws, "F2:F500", "=Lists!$G$2:$G$20")

    ws = wb.create_sheet("GatePasses")
    write_table(ws, pass_headers, gate, {get_column_letter(i): 18 for i in range(1, len(pass_headers) + 1)}, text_cols=tuple(range(1, len(pass_headers) + 1)))
    ws.column_dimensions["M"].width = 36
    ws.column_dimensions["N"].width = 42
    ws.freeze_panes = "E2"
    add_list(ws, "B2:B500", "=Enquiries!$A$2:$A$500")
    add_list(ws, "C2:C500", "=Enquiries!$B$2:$B$500")
    add_list(ws, "D2:D500", "=Requisitions!$A$2:$A$500")
    add_list(ws, "E2:E500", "=Lists!$F$2:$F$15")
    add_list(ws, "I2:I500", "=People!$B$2:$B$300")
    add_list(ws, "K2:K500", "=Locations!$A$2:$A$200")
    add_list(ws, "O2:O500", "=Lists!$K$2:$K$20")
    add_list(ws, "P2:P500", "=Lists!$E$2:$E$10")
    add_list(ws, "R2:R500", "=Lists!$J$2:$J$20")
    add_list(ws, "S2:S500", "=Lists!$E$2:$E$10")
    add_list(ws, "W2:W500", "=Lists!$D$2:$D$20")
    status_colors(ws, "P")
    status_colors(ws, "S")
    status_colors(ws, "W")

    ws = wb.create_sheet("GatePassLines")
    write_table(ws, pass_line_headers, pass_lines, {"A": 22, "B": 10, "C": 16, "D": 28, "E": 20, "F": 10, "G": 14, "H": 24}, text_cols=(1, 3))
    add_list(ws, "A2:A500", "=GatePasses!$A$2:$A$500")
    add_list(ws, "C2:C500", "=Materials!$A$2:$A$300")
    add_list(ws, "F2:F500", "=Lists!$G$2:$G$20")

    ws = wb.create_sheet("ProjectTrail")
    write_table(ws, trail_headers, trail, {"A": 22, "B": 22, "C": 22, "D": 12, "E": 20, "F": 20, "G": 16, "H": 22, "I": 22, "J": 55, "K": 20}, text_cols=(1, 2, 8, 9))
    add_list(ws, "A2:A500", "=Enquiries!$B$2:$B$500")
    add_list(ws, "B2:B500", "=Enquiries!$A$2:$A$500")
    add_list(ws, "C2:C500", "=Stages!$B$2:$B$20")
    status_colors(ws, "E")

    ws = wb.create_sheet("Documents")
    write_table(ws, doc_headers, documents, {get_column_letter(i): 28 for i in range(1, 11)}, text_cols=tuple(range(1, 11)))
    ws.column_dimensions["B"].width = 62
    ws.column_dimensions["H"].width = 78
    status_colors(ws, "I")

    def later_sheet(title, headers, id_col_width=18):
        sheet = wb.create_sheet(title)
        write_table(sheet, headers, [], {get_column_letter(i): 18 for i in range(1, len(headers) + 1)})
        sheet.column_dimensions["A"].width = id_col_width
        add_list(sheet, "B2:B500", "=Enquiries!$B$2:$B$500")
        add_list(sheet, "C2:C500", "=Enquiries!$A$2:$A$500")
        return sheet

    later_sheet("POC", ["POCId", "ProjectNo", "EnquiryNo", "POCDate", "Owner", "DroneType", "Electronics", "BudgetCode", "Scope", "Result", "Status", "Remarks", "FileName", "UpdatedAt"])
    later_sheet("Pilot", ["PilotId", "ProjectNo", "EnquiryNo", "PilotDate", "Owner", "Location", "DroneType", "BudgetCode", "Scope", "Result", "Status", "Remarks", "FileName", "UpdatedAt"])
    later_sheet("FullProduction", ["ProductionId", "ProjectNo", "EnquiryNo", "BatchDate", "Owner", "Quantity", "DroneType", "Electronics", "BudgetCode", "Status", "Remarks", "FileName", "UpdatedAt"])
    later_sheet("Testing", ["TestId", "ProjectNo", "EnquiryNo", "TestDate", "Owner", "TestType", "Location", "Result", "Status", "Remarks", "PassID", "FileName", "UpdatedAt"])

    for name, color in {
        "HowToUse": "1F7A4D",
        "Settings": "6B7280",
        "NumberSeries": "1F4E79",
        "Lists": "1F4E79",
        "People": "1F4E79",
        "Enquiries": "0B1F33",
        "Requisitions": "0B1F33",
        "GatePasses": "0B1F33",
        "ProjectTrail": "7A4E12",
        "Documents": "7A4E12",
        "POC": "7A4E12",
        "Pilot": "7A4E12",
        "FullProduction": "7A4E12",
        "Testing": "7A4E12",
    }.items():
        wb[name].sheet_properties.tabColor = color

    wb.active = how
    if OUT.exists() and "--force" not in sys.argv:
        raise SystemExit(f"{OUT.name} already exists. Run with --force to overwrite it.")
    wb.save(OUT)
    _check()
    print(f"Wrote {OUT}")


def _check():
    from openpyxl import load_workbook
    book = load_workbook(OUT, data_only=False)
    assert book["Enquiries"]["A2"].value == "ENQ-DRN-2026-001"
    assert book["Enquiries"]["B2"].value == "PRJ-DRN-2026-001"
    assert book["Requisitions"]["A2"].value == "REQ-STR-2026-089"
    assert book["Requisitions"]["B2"].value == "ENQ-DRN-2026-001"
    assert book["Requisitions"]["C2"].value == "PRJ-DRN-2026-001"
    assert book["GatePasses"]["A2"].value == "GTP-FLY-2026-042"
    assert book["GatePasses"]["B2"].value == "ENQ-DRN-2026-001"
    assert book["GatePasses"]["D2"].value == "REQ-STR-2026-089"
    assert str(book["NumberSeries"]["F2"].value).startswith("=")
    assert book["ProjectTrail"].max_row == 8
    assert book["Documents"]["B2"].value == "ENQ-DRN-2026-001_PRJ-DRN-2026-001_Enquiry_Sheet"
    for name in ("POC", "Pilot", "FullProduction", "Testing"):
        assert book[name]["B1"].value == "ProjectNo"
        assert book[name]["C1"].value == "EnquiryNo"


if __name__ == "__main__":
    build()
