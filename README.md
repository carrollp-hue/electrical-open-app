# Electrical Open Golf Society MVP

This is a phone-first, installable web-app prototype populated with representative figures from the current society workbook.

Open it through a local web server rather than double-clicking `index.html`, so the offline installation support can run. From PowerShell in this folder:

```powershell
& 'C:\Users\carro\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8080
```

Then open `http://localhost:8080` in a browser. On a phone, publish the same files to a secure web host and open its address; use the browser's **Add to Home Screen** option to install it.

The hosted version includes member sign-in, an administrator area, fixtures, results, scorecards, and the society handicap engine.

For 18-hole scorecards, run `supabase/upgrade-003-scorecards.sql` in Supabase first. Administrators then work in two stages: save the course/tee rating, slope and total par; then add its 18 hole pars and stroke indexes. A fixture can use the first stage immediately to show each member’s playing handicap. The scorecard entry screen becomes available once stage two is complete.
