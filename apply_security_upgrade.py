"""Add login, store stock, 3D print, and notification sheets to the master workbook."""

from __future__ import annotations

import hashlib
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "Drone_Project_Master.xlsx"
PWD = hashlib.sha256(b"ChangeMe@2026").hexdigest()

NAVY = "0B1F33"
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
LEFT = Alignment(vertical="center", wrap_text=True)


def style_header(ws, ncol):
    ws.row_dimensions[1].height = 22
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(ncol)}500"
    for col in range(1, ncol + 1):
        cell = ws.cell(1, col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = THIN


def write_table(ws, headers, rows, widths):
    for c, header in enumerate(headers, 1):
        ws.cell(1, c, header)
    for r, row in enumerate(rows, 2):
        for c, value in enumerate(row, 1):
            cell = ws.cell(r, c, value)
            cell.font = DATA_FONT
            cell.alignment = LEFT
            cell.border = THIN
    style_header(ws, len(headers))
    for letter, width in widths.items():
        ws.column_dimensions[letter].width = width


def set_setting(ws, key, value, desc=""):
    for r in range(2, ws.max_row + 1):
        if str(ws.cell(r, 1).value or "") == key:
            ws.cell(r, 2, value)
            if desc:
                ws.cell(r, 3, desc)
            return
    r = ws.max_row + 1
    ws.cell(r, 1, key).font = DATA_FONT
    ws.cell(r, 2, value).font = DATA_FONT
    ws.cell(r, 3, desc).font = DATA_FONT


def ensure_columns(ws, extra_headers):
    existing = []
    for c in range(1, ws.max_column + 1):
        h = str(ws.cell(1, c).value or "").strip()
        if not h:
            break
        existing.append(h)
    for header in extra_headers:
        if header in existing:
            continue
        col = len(existing) + 1
        cell = ws.cell(1, col, header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        existing.append(header)
    return existing


def replace_or_create(wb, name):
    if name in wb.sheetnames:
        del wb[name]
    return wb.create_sheet(name)


def main():
    wb = load_workbook(OUT)

    settings = wb["Settings"]
    set_setting(settings, "LogoFile", "assets/company-logo.jpg", "Company logo used on forms and login.")
    set_setting(settings, "CompanyName", "AMOS", "Printed on all forms.")
    set_setting(settings, "Tagline", "Drones & Related Electronics", "Second line of the letterhead.")
    set_setting(settings, "NotifyEnabled", "Yes", "Send email when a form is saved.")
    set_setting(settings, "MailFromNote", "Mails are sent from the Google account that deployed the Apps Script web app.", "The desire mail id is that Google account.")
    set_setting(settings, "PasswordSalt", "amos-drone-docs-2026", "Do not change after users are created.")
    set_setting(settings, "SessionHours", 10, "Login session length in hours.")
    set_setting(settings, "SchemaVersion", 2, "Do not change.")

    series = wb["NumberSeries"]
    keys = {str(series.cell(r, 1).value or "") for r in range(2, series.max_row + 1)}
    extras = [
        ("RCPT", "RCPT-STR-", 2026, 0, 3),
        ("PRN", "PRN-3D-", 2026, 0, 3),
        ("PO", "PO-AMOS-", 2026, 0, 3),
        ("WRK", "WRK-", 2026, 0, 3),
        ("NTF", "NTF-", 2026, 0, 3),
    ]
    for key, prefix, year, last, pad in extras:
        if key in keys:
            continue
        r = series.max_row + 1
        series.cell(r, 1, key)
        series.cell(r, 2, prefix)
        series.cell(r, 3, year)
        series.cell(r, 4, last)
        series.cell(r, 5, pad)
        series.cell(r, 6, f'=B{r}&C{r}&"-"&TEXT(D{r}+1,REPT("0",E{r}))')

    enq = wb["Enquiries"]
    headers = ensure_columns(enq, ["OwnerUserId", "OwnerEmail", "AssignedTo", "AssignedEmail"])
    # seed owner on sample enquiry
    owner_col = headers.index("OwnerUserId") + 1
    email_col = headers.index("OwnerEmail") + 1
    assigned_col = headers.index("AssignedTo") + 1
    assigned_email_col = headers.index("AssignedEmail") + 1
    if enq.cell(2, 1).value == "ENQ-DRN-2026-001":
        enq.cell(2, owner_col, "U012")
        enq.cell(2, email_col, "gowtham@example.com")
        enq.cell(2, assigned_col, "Siddharth")
        enq.cell(2, assigned_email_col, "siddharth@example.com")

    mats = wb["Materials"]
    existing_codes = {str(mats.cell(r, 1).value or "") for r in range(2, mats.max_row + 1)}
    filament = [
        ("MAT-FIL-PLA", "PLA filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-PETG", "PETG filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-TPU", "TPU filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-ABS", "ABS filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-ASA", "ASA filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-PC", "PC filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-PACF", "PA-CF filament", "1 kg spool", "Kg", "3D Print"),
        ("MAT-FIL-PETCF", "PET-CF filament", "1 kg spool", "Kg", "3D Print"),
    ]
    for row in filament:
        if row[0] in existing_codes:
            continue
        r = mats.max_row + 1
        for c, value in enumerate(row, 1):
            mats.cell(r, c, value).font = DATA_FONT

    # AllowedPages is documentation for admins creating users.
    # Live menu visibility comes from FormAccess (CanView=1 shows the tab; 0 hides it).
    pages = {
        "CEO": "Full dashboard, all projects, project packs, team structure.",
        "CTO": "Full dashboard, assign projects and team ownership, project packs.",
        "HR": "HR supervision: all assignments and weekly people completion. No assign-work edit.",
        "Operations": "HR & Operation. Assign operations tasks. Team structure.",
        "Production Head": "Production + General Store. Assign and authorize team work. Store forms.",
        "Store Incharge": "General Store. Assign store tasks. Stock and requisition.",
        "Testing Incharge": "Production floor. Assign technicians and tester pilot.",
        "Technician": "My work only, plus view of production forms.",
        "Tester Pilot": "My work and outside test pass.",
        "R&D Lead UAV": "R&D-UAV. Assign team, enquiry, 3D, PO.",
        "UAV Lead": "R&D-UAV & electronics. Assign UAV tasks.",
        "Electronics & Pilot": "R&D-UAV. My work, 3D, test pass.",
        "Design Lead": "DESIGN. Assign CAD and product design work.",
        "CAD Engineer": "DESIGN. My work and 3D.",
        "Product Designer": "DESIGN. My work.",
        "R&D Lead IOT": "R&D-IOT. Assign embedded hardware work.",
        "Embedded Hardware": "R&D-IOT. My work and 3D.",
    }
    # UserId, Username, DisplayName, Email, Role, hash, Active, CanOwn, Notify, pages, Department, ReportsTo, Level
    users = [
        ("U001", "ceo", "CEO", "ceo@example.com", "CEO", PWD, "Yes", "Yes", "Yes", pages["CEO"], "Executive", "—", "L0"),
        ("U002", "cto", "CTO", "cto@example.com", "CTO", PWD, "Yes", "Yes", "Yes", pages["CTO"], "Executive", "CEO", "L1"),
        ("U003", "usha", "Usha", "usha@example.com", "HR", PWD, "Yes", "No", "Yes", pages["HR"], "HR & Operation", "CTO", "L2"),
        ("U004", "vijay", "Vijay Baskar", "vijay.baskar@example.com", "Operations", PWD, "Yes", "No", "Yes", pages["Operations"], "HR & Operation", "CTO", "L2"),
        ("U005", "benny", "Benny", "benny@example.com", "Production Head", PWD, "Yes", "Yes", "Yes", pages["Production Head"], "Production", "CTO", "L2"),
        ("U006", "afsal", "Afsal", "afsal@example.com", "Store Incharge", PWD, "Yes", "No", "Yes", pages["Store Incharge"], "General Store", "Benny", "L3"),
        ("U011", "jinu", "Jinu", "jinu@example.com", "Testing Incharge", PWD, "Yes", "No", "Yes", pages["Testing Incharge"], "Production", "Benny", "L3"),
        ("U007", "vishakh", "Vishakh", "vishakh@example.com", "Technician", PWD, "Yes", "No", "Yes", pages["Technician"], "Production", "Jinu", "L4"),
        ("U008", "mirshan", "Mirshan", "mirshan@example.com", "Technician", PWD, "Yes", "No", "Yes", pages["Technician"], "Production", "Jinu", "L4"),
        ("U009", "joyal", "Joyal", "joyal@example.com", "Technician", PWD, "Yes", "No", "Yes", pages["Technician"], "Production", "Jinu", "L4"),
        ("U010", "eldho", "Eldho", "eldho@example.com", "Tester Pilot", PWD, "Yes", "No", "Yes", pages["Tester Pilot"], "Production", "Jinu", "L4"),
        ("U012", "gowtham", "Gowtham", "gowtham@example.com", "R&D Lead UAV", PWD, "Yes", "Yes", "Yes", pages["R&D Lead UAV"], "R&D-UAV", "CTO", "L2"),
        ("U013", "siddharth", "Siddharth", "siddharth@example.com", "UAV Lead", PWD, "Yes", "Yes", "Yes", pages["UAV Lead"], "R&D-UAV", "Gowtham", "L3"),
        ("U014", "ashwat", "Ashwat", "ashwat@example.com", "Electronics & Pilot", PWD, "Yes", "No", "Yes", pages["Electronics & Pilot"], "R&D-UAV", "Gowtham", "L3"),
        ("U015", "alfi", "Alfi", "alfi@example.com", "Design Lead", PWD, "Yes", "Yes", "Yes", pages["Design Lead"], "DESIGN", "CTO", "L2"),
        ("U016", "sinju", "Sinju", "sinju@example.com", "CAD Engineer", PWD, "Yes", "No", "Yes", pages["CAD Engineer"], "DESIGN", "Alfi", "L3"),
        ("U017", "yashasvi", "Yashasvi", "yashasvi@example.com", "Product Designer", PWD, "Yes", "No", "Yes", pages["Product Designer"], "DESIGN", "Alfi", "L3"),
        ("U018", "saravana", "Saravana", "saravana@example.com", "R&D Lead IOT", PWD, "Yes", "Yes", "Yes", pages["R&D Lead IOT"], "R&D-IOT", "CTO", "L2"),
        ("U019", "sunder", "Sunder", "sunder@example.com", "Embedded Hardware", PWD, "Yes", "No", "Yes", pages["Embedded Hardware"], "R&D-IOT", "Saravana", "L3"),
    ]
    write_table(
        replace_or_create(wb, "Users"),
        ["UserId", "Username", "DisplayName", "Email", "Role", "PasswordHash", "Active", "CanOwnProjects", "Notify", "AllowedPages", "Department", "ReportsTo", "OrgLevel"],
        users,
        {"A": 10, "B": 14, "C": 22, "D": 34, "E": 22, "F": 70, "G": 10, "H": 16, "I": 10, "J": 72, "K": 16, "L": 18, "M": 10},
    )

    # view/edit: 1 = yes, 0 = no. CanView=0 hides that page from the user’s top menu after login.
    forms = ["dashboard", "enquiry", "requisition", "pass", "store", "print3d", "purchase",
             "workassign", "workreport", "projectpack", "hrview", "orgchart"]

    def grant(role, **flags):
        """flags: form='ve' view+edit, 'v' view, omitted = no access. Everyone gets org chart + my work."""
        if "pass_" in flags:
            flags["pass"] = flags.pop("pass_")
        flags.setdefault("dashboard", "v")
        flags.setdefault("orgchart", "v")
        flags.setdefault("workreport", "ve")
        rows = []
        for form in forms:
            flag = flags.get(form, "")
            rows.append((role, form, 1 if flag else 0, 1 if "e" in flag else 0))
        return rows

    access = []
    access += grant("CEO", enquiry="v", requisition="v", pass_="v", store="v", print3d="v", purchase="v",
                    workassign="ve", projectpack="ve", hrview="v")
    access += grant("CTO", enquiry="ve", requisition="v", pass_="v", store="v", print3d="v", purchase="ve",
                    workassign="ve", projectpack="ve", hrview="v")
    access += grant("HR", enquiry="v", requisition="v", pass_="v", store="v", print3d="v", purchase="v",
                    hrview="v")
    access += grant("Operations", enquiry="v", requisition="v", workassign="ve")
    access += grant("Production Head", enquiry="v", requisition="ve", pass_="ve", store="ve", workassign="ve")
    access += grant("Store Incharge", enquiry="v", requisition="ve", pass_="ve", store="ve", workassign="ve")
    access += grant("Testing Incharge", enquiry="v", pass_="ve", workassign="ve")
    access += grant("Technician", enquiry="v", requisition="v", pass_="v")
    access += grant("Tester Pilot", enquiry="v", pass_="ve")
    access += grant("R&D Lead UAV", enquiry="ve", print3d="ve", purchase="ve", pass_="v", workassign="ve")
    access += grant("UAV Lead", enquiry="ve", print3d="ve", purchase="v", pass_="v", workassign="ve")
    access += grant("Electronics & Pilot", enquiry="v", print3d="ve", pass_="ve")
    access += grant("Design Lead", enquiry="v", print3d="ve", workassign="ve")
    access += grant("CAD Engineer", enquiry="v", print3d="ve")
    access += grant("Product Designer", enquiry="v", print3d="v")
    access += grant("R&D Lead IOT", enquiry="ve", print3d="ve", purchase="v", workassign="ve")
    access += grant("Embedded Hardware", enquiry="v", print3d="ve")
    write_table(
        replace_or_create(wb, "FormAccess"),
        ["Role", "Form", "CanView", "CanEdit"],
        access,
        {"A": 22, "B": 16, "C": 12, "D": 12},
    )

    write_table(
        replace_or_create(wb, "UserSetup"),
        ["Step", "Instruction"],
        [
            (1, "Add a row on Users: Username, DisplayName, Email, Role, Active=Yes."),
            (2, "Set PasswordHash to the SHA-256 hex of the password (seed users use ChangeMe@2026). Or let the user change password after first login."),
            (3, "Copy AllowedPages text from another user with the same Role so you know which tabs they will see."),
            (4, "Pages shown/hidden are controlled on FormAccess: CanView=1 shows the tab, CanView=0 hides it. CanEdit=1 allows Save."),
            (5, "Form codes: dashboard, enquiry, requisition, pass, store, print3d, purchase, workassign, workreport, projectpack, hrview, orgchart."),
            (6, "Org chart: CEO, CTO, then HR & Operation, Production, R&D-UAV, DESIGN, R&D-IOT. Usha is HR. Leads assign only inside their department."),
            (7, "Cross-dept: set RequestingDepartment + OwningDepartment on WorkAssignments; owning manager must assign."),
            (8, "Work sync writes Google Slides (PPT export) per project — same slide format for every project."),
            (9, "After editing Users or FormAccess, users must log out and log in again."),
            (10, "GitHub Pages hosts only AMOS_Team_Forms. Keep Excel + Apps Script in AMOS_Admin."),
        ],
        {"A": 8, "B": 100},
    )

    write_table(
        replace_or_create(wb, "Sessions"),
        ["Token", "UserId", "Username", "Role", "CreatedAt", "ExpiresAt", "Active"],
        [],
        {"A": 42, "B": 12, "C": 14, "D": 22, "E": 20, "F": 20, "G": 10},
    )

    store_locations = [
        ("STR-MAIN", "Main store", "Primary bonded store"),
        ("STR-ELEC", "Electronics rack", "Controllers, radios, batteries"),
        ("STR-AIR", "Airframe bay", "Frames and propellers"),
        ("STR-3D", "3D print store", "Filament and printed parts"),
        ("STR-FIELD", "Field kit cage", "Tools issued for outside test"),
    ]
    write_table(
        replace_or_create(wb, "StoreLocations"),
        ["LocationCode", "LocationName", "Notes"],
        store_locations,
        {"A": 14, "B": 22, "C": 40},
    )

    stock = [
        ("MAT-AIR-01", "STR-AIR", 2, 1, "Set", "Suresh Babu", "2026-10-27"),
        ("MAT-FC-01", "STR-ELEC", 4, 1, "Nos", "Suresh Babu", "2026-10-27"),
        ("MAT-TEL-01", "STR-ELEC", 3, 1, "Nos", "Suresh Babu", "2026-10-27"),
        ("MAT-BAT-01", "STR-ELEC", 6, 2, "Nos", "Suresh Babu", "2026-10-27"),
        ("MAT-GS-01", "STR-MAIN", 2, 1, "Set", "Suresh Babu", "2026-10-27"),
        ("MAT-CBL-01", "STR-MAIN", 5, 1, "Set", "Suresh Babu", "2026-10-27"),
        ("MAT-CAM-01", "STR-ELEC", 2, 1, "Nos", "Suresh Babu", "2026-10-27"),
        ("MAT-TOOL-01", "STR-FIELD", 3, 1, "Set", "Suresh Babu", "2026-10-27"),
        ("MAT-FIL-PLA", "STR-3D", 8, 2, "Kg", "Suresh Babu", "2026-10-27"),
        ("MAT-FIL-PETG", "STR-3D", 4, 1, "Kg", "Suresh Babu", "2026-10-27"),
        ("MAT-FIL-TPU", "STR-3D", 2, 1, "Kg", "Suresh Babu", "2026-10-27"),
        ("MAT-FIL-ABS", "STR-3D", 3, 1, "Kg", "Suresh Babu", "2026-10-27"),
    ]
    write_table(
        replace_or_create(wb, "StoreStock"),
        ["ItemCode", "LocationCode", "QtyOnHand", "MinQty", "UOM", "UpdatedBy", "UpdatedAt"],
        stock,
        {"A": 16, "B": 14, "C": 12, "D": 10, "E": 10, "F": 18, "G": 18},
    )

    write_table(
        replace_or_create(wb, "StoreReceipts"),
        ["ReceiptId", "ReceiptDate", "ItemCode", "Description", "LocationCode", "Qty", "UOM",
         "ProjectNo", "EnquiryNo", "EnteredBy", "Remarks", "UpdatedAt"],
        [],
        {"A": 18, "B": 14, "C": 16, "D": 28, "E": 14, "F": 10, "G": 10, "H": 18, "I": 18, "J": 18, "K": 28, "L": 18},
    )

    print_jobs = [
        ("PRN-3D-2026-001", "PRJ-DRN-2026-001", "ENQ-DRN-2026-001", "Tether bracket", "Functional", "PETG",
         42, 14.2, "Bambu X1C", "Ashwat", "U014", "01:20", "Pending approval",
         "Divya Krishnan", "", "Pending", "MAT-FIL-PETG", "STR-3D",
         "PRN-3D-2026-001_PRJ-DRN-2026-001_3D_Print", 1, "2026-10-27 16:30"),
    ]
    write_table(
        replace_or_create(wb, "PrintJobs"),
        ["PrintId", "ProjectNo", "EnquiryNo", "PartName", "PrintType", "FilamentType",
         "FilamentG", "FilamentM", "PrinterUsed", "ProjectOwner", "OwnerUserId", "Duration", "Status",
         "Approver", "ApprovalDate", "ApprovalDecision", "MaterialCode", "StoreLocation",
         "FileName", "Revision", "UpdatedAt"],
        print_jobs,
        {get_column_letter(i): 16 for i in range(1, 22)},
    )

    write_table(
        replace_or_create(wb, "Notifications"),
        ["NotifyId", "CreatedAt", "Event", "ProjectNo", "EnquiryNo", "DocType", "DocID",
         "ToUserId", "ToName", "ToEmail", "Subject", "Body", "MailStatus"],
        [],
        {"A": 16, "B": 18, "C": 22, "D": 18, "E": 18, "F": 18, "G": 18, "H": 12, "I": 18, "J": 28, "K": 36, "L": 48, "M": 14},
    )

    write_table(
        replace_or_create(wb, "PurchaseOrders"),
        ["PoNo", "ProjectNo", "EnquiryNo", "VendorName", "VendorAddress", "VendorContact", "VendorPhone",
         "VendorEmail", "VendorTaxId", "PoDate", "DeliveryDate", "Currency", "PaymentTerms", "DeliveryPlace",
         "PreparedBy", "Remarks", "TermsText", "TaxPercent", "Subtotal", "TaxAmount", "GrandTotal", "Status",
         "AuthorizerName", "AuthorizerTitle", "AuthorizeDate", "AuthorizeDecision", "SignatureFile",
         "OwnerUserId", "FileName", "Revision", "UpdatedAt"],
        [],
        {get_column_letter(i): 16 for i in range(1, 32)},
    )
    write_table(
        replace_or_create(wb, "PurchaseOrderLines"),
        ["PoNo", "LineNo", "ItemCode", "Description", "UOM", "Qty", "Rate", "Amount"],
        [],
        {"A": 18, "B": 10, "C": 16, "D": 36, "E": 10, "F": 10, "G": 12, "H": 12},
    )

    write_table(
        replace_or_create(wb, "WorkAssignments"),
        ["WorkId", "ProjectNo", "EnquiryNo", "ProjectTitle", "Department", "RequestingDepartment", "OwningDepartment",
         "CrossDeptRequest", "ProcessStage", "TaskTitle", "TaskDetail", "AssignedToUserId", "AssignedToName",
         "AssignedByUserId", "AssignedByName", "DueDate", "Status", "AssigneeRemarks", "ManagerDecision",
         "ManagerRemarks", "CompletedAt", "AuthorizedAt", "FileName", "Revision", "UpdatedAt"],
        [],
        {get_column_letter(i): 16 for i in range(1, 26)},
    )
    write_table(
        replace_or_create(wb, "ProjectTeams"),
        ["ProjectNo", "EnquiryNo", "Department", "OwnerUserId", "OwnerName", "AssignedByCTO", "Status", "UpdatedAt"],
        [],
        {"A": 18, "B": 18, "C": 18, "D": 14, "E": 22, "F": 14, "G": 12, "H": 18},
    )
    write_table(
        replace_or_create(wb, "TeamStructure"),
        ["NodeId", "Title", "Role", "Department", "ReportsTo", "SortOrder", "Notes"],
        [
            ("N-CEO", "CEO", "CEO", "Executive", "—", 1, "Full project dashboard"),
            ("N-CTO", "CTO", "CTO", "Executive", "CEO", 2, "Assigns projects to departments"),
            ("N-HR", "Usha — HR", "HR", "HR & Operation", "CTO", 3, "Weekly people report"),
            ("N-OPS", "Vijay Baskar — Operations", "Operations", "HR & Operation", "CTO", 4, ""),
            ("N-BEN", "Benny — Head", "Production Head", "Production", "CTO", 5, "Also covers General Store"),
            ("N-AFS", "Afsal — Incharge", "Store Incharge", "General Store", "Benny", 6, ""),
            ("N-JIN", "Jinu — Testing Incharge", "Testing Incharge", "Production", "Benny", 7, ""),
            ("N-GOW", "Gowtham — R&D Lead", "R&D Lead UAV", "R&D-UAV", "CTO", 8, ""),
            ("N-SID", "Siddharth — UAV Lead", "UAV Lead", "R&D-UAV", "Gowtham", 9, ""),
            ("N-ALF", "Alfi — CAD Design Engineer", "Design Lead", "DESIGN", "CTO", 10, ""),
            ("N-SAR", "Saravana — R&D Lead", "R&D Lead IOT", "R&D-IOT", "CTO", 11, ""),
        ],
        {"A": 12, "B": 22, "C": 22, "D": 16, "E": 14, "F": 10, "G": 40},
    )
    write_table(
        replace_or_create(wb, "ProjectPacks"),
        ["ProjectNo", "EnquiryNo", "ProjectTitle", "SlidesId", "SlidesUrl", "PptxUrl", "UpdatedAt", "UpdatedBy"],
        [],
        {"A": 18, "B": 18, "C": 36, "D": 36, "E": 48, "F": 48, "G": 18, "H": 18},
    )

    lists = wb["Lists"]
    # add FilamentType / PrintType / PrintStatus columns if free space at end
    headers = []
    for c in range(1, lists.max_column + 1):
        h = str(lists.cell(1, c).value or "").strip()
        if h:
            headers.append(h)
    dept_values = ["HR & Operation", "General Store", "Production", "R&D-UAV", "DESIGN", "R&D-IOT"]
    if "Department" in headers:
        col = headers.index("Department") + 1
        for r in range(2, 30):
            lists.cell(r, col, None)
        for i, value in enumerate(dept_values, 2):
            lists.cell(i, col, value).font = DATA_FONT
    else:
        extras_lists_dept = dept_values
        col = len(headers) + 1
        lists.cell(1, col, "Department").fill = HEADER_FILL
        lists.cell(1, col).font = HEADER_FONT
        for i, value in enumerate(extras_lists_dept, 2):
            lists.cell(i, col, value).font = DATA_FONT
        headers.append("Department")

    extras_lists = {
        "FilamentType": ["PLA", "PETG", "TPU", "ABS", "ASA", "PC", "PA-CF", "PET-CF"],
        "PrintType": ["Prototype", "Functional", "Fixture", "Enclosure", "Jig"],
        "PrintStatus": ["Draft", "Submitted", "Pending approval", "Approved", "Printing", "Complete", "Rejected"],
        "StoreEvent": ["Receipt", "Issue", "Return", "Adjust"],
    }
    for name, values in extras_lists.items():
        if name in headers:
            continue
        col = len(headers) + 1
        lists.cell(1, col, name).fill = HEADER_FILL
        lists.cell(1, col).font = HEADER_FONT
        for i, value in enumerate(values, 2):
            lists.cell(i, col, value).font = DATA_FONT
        headers.append(name)

    how = wb["HowToUse"]
    start = how.max_row + 2
    how.cell(start, 1, "Security").font = Font(name="Calibri", size=12, bold=True, color=NAVY)
    notes = [
        "Open 00_Login.html first. Default password for seed users is ChangeMe@2026. See Users!AllowedPages for which tabs each role sees.",
        "Create users on the Users sheet. Set Role, then keep AllowedPages filled as a reminder. Actual menu hide/show uses FormAccess CanView (0 = page not visible).",
        "FormAccess Form codes: dashboard, enquiry, requisition, pass, store, print3d, purchase. CanEdit=0 means the user can open the page but cannot Save.",
        "Purchase order is 06_Purchase_Order.html. Store stock is hidden for Electronics and Flight Test when FormAccess store CanView=0.",
        "Host only AMOS_Team_Forms on GitHub Pages. Keep Drone_Project_Master.xlsx and GoogleAppsScript.gs in AMOS_Admin (private).",
    ]
    for i, text in enumerate(notes):
        how.cell(start + 1 + i, 2, text).alignment = Alignment(wrap_text=True)
        how.row_dimensions[start + 1 + i].height = 34

    for name, color in {
        "Users": "8C1D1D",
        "FormAccess": "8C1D1D",
        "UserSetup": "8C1D1D",
        "Sessions": "8C1D1D",
        "StoreLocations": "1F7A4D",
        "StoreStock": "1F7A4D",
        "StoreReceipts": "1F7A4D",
        "PrintJobs": "7A4E12",
        "Notifications": "7A4E12",
        "PurchaseOrders": "0B4F6C",
        "PurchaseOrderLines": "0B4F6C",
        "WorkAssignments": "3D5A80",
        "ProjectPacks": "3D5A80",
    }.items():
        if name in wb.sheetnames:
            wb[name].sheet_properties.tabColor = color

    try:
        wb.save(OUT)
        saved = OUT
    except PermissionError:
        saved = ROOT / "Drone_Project_Master_UPDATED.xlsx"
        wb.save(saved)
        print(f"Could not overwrite {OUT.name} (file open). Wrote {saved.name} instead.")
    print(f"Upgraded {saved}")
    print(f"Default password hash for ChangeMe@2026: {PWD}")


if __name__ == "__main__":
    main()
