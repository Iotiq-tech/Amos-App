AMOS project documents
======================

Two folders
-----------
  AMOS_Team_Forms\     Share / GitHub Pages only (login + forms + assets)
  AMOS_Admin\          Keep private (Excel master, Apps Script, rebuild tools)

GitHub Pages
------------
Push ONLY the contents of AMOS_Team_Forms (not this whole parent folder).
Settings → Pages → Deploy from branch → main → / (root).
Site opens at index.html → login.

Do not upload
-------------
  AMOS_Admin\
  Drone_Project_Master.xlsx
  GoogleAppsScript.gs
  *.py rebuild scripts
  3DPrint.xlsx

User pages (login roles)
------------------------
Visible tabs are controlled by the FormAccess sheet in the master Excel / Google Sheet.
CanView = 1 → tab shows after login. CanView = 0 → tab is hidden.
CanEdit = 1 → Save enabled. CanEdit = 0 → open/view only.

Work reporting
--------------
07_Work_Assign.html   Reporting manager assigns tasks by project
08_My_Work.html       User submits completion + remarks
09_Project_Pack.html  Management only — Google Slides / PPT download (same format every project)
Dashboard views: Projects | Department | Work process | People work

When creating a user on the Users sheet, fill AllowedPages (see UserSetup sheet).
After changing FormAccess, user must log out and log in again.

After editing forms here
------------------------
  python pack_team_forms.py
  python apply_security_upgrade.py

Then copy the updated Excel into Google Sheets (or re-import), redeploy Apps Script,
and push AMOS_Team_Forms to GitHub.
