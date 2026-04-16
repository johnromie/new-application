# Attendance & Concerns Fix Plan
Current Working Directory: c:/Users/Asus/Desktop/new application

## Status: ✅ Plan Approved - Implementation Started

### 1. Fix Attendance Notifications [0/4]
- [ ] employee/app.js: Add notificationsCache, periodic /api/notifications poll
- [ ] employee/app.js: Dashboard notif badge/button, toast/sound on new
- [ ] employee/index.html: Add notif UI elements
- [ ] Test: time-in/out → immediate UI notif + persistent badge

### 2. Fix Concerns Accuracy [0/6]
- [ ] server/server.js: Rename messages→concerns, /api/messages→/api/concerns, migrate data
- [ ] server/server.js: Add validation (req fields, no dupes), status open/resolved, reply
- [ ] employee/app.js: Enhance handleConcern, recent concerns list, confirm
- [ ] admin/app.js: Integrate concerns-modal.html load/render/mark-read/reply
- [ ] admin/concerns-modal.html: Add reply/status UI
- [ ] Test: send concern → admin list → reply → employee sees

### 3. Server & Data [0/2]
- [ ] Backup data/db.json
- [ ] Restart server: `node server/server.js`

### 4. UI/Polish & Test [0/4]
- [ ] styles.css: Toast/notif styles
- [ ] Test web: localhost:5173/employee + /admin
- [ ] cap sync android/ios
- [ ] ✅ Complete: attempt_completion

**Next Step:** Start with server/server.js backup + concerns migration

