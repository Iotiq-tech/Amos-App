AMOS Team Forms (GitHub Pages pack)
===================================

This folder is what users open. Push ONLY this folder to your public GitHub repo.

Start
-----
1. Open index.html or 00_Login.html
2. Sign in with the username from your coordinator
3. Only pages allowed for your Role appear in the top bar

Default seed password (change after first login): ChangeMe@2026
Example users: admin, divya, suresh, meera, farhan, sara

Pages
-----
00_Login.html              Sign in
00_Dashboard.html          Process view
01_Enquiry_Sheet.html      Technical enquiry
02_Store_Requisition.html  Materials request
03_Outside_Test_Pass.html  Outside test leave pass
04_Store_Stock_Entry.html  Store stock (store roles)
05_3D_Print_Job.html       3D print job
06_Purchase_Order.html     Vendor purchase order
assets\                    Logo, styles, scripts, authorize signature

Who sees what
-------------
Controlled in the private Google Sheet → FormAccess (and Users!AllowedPages notes).
If a page is not selected for your role (CanView=0), it will not appear in the menu
and opening the URL redirects you away.

Cloud
-----
assets\cloud-config.js already has the web app URL.
Everyone writes to the same Google Sheet. No Excel file is needed on the PC.
