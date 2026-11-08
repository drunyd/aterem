/* ==========================================================================
   aTerem — V1.5 client area (vanilla JS, demo backend nélkül)
   Adatforrás: data/client.json + data/class-types.json + data/schedule.json
   Állapot: sessionStorage (munkameneten belül megmarad).
   ========================================================================== */
(function () {
  "use strict";

  var WEEKDAYS_FULL = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  var WEEKDAYS_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
  var MONTHS = ["január", "február", "március", "április", "május", "június",
    "július", "augusztus", "szeptember", "október", "november", "december"];
  var STORAGE_KEY = "aterem_v15_state";

  var ICONS = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z"/><path d="M13 5v2M13 11v2M13 17v2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>'
  };

  var NAV_ITEMS = [
    { page: "dashboard", href: "index.html", label: "Áttekintés", mobile: "Kezdőlap", icon: "home" },
    { page: "oraend", href: "oraend.html", label: "Órarend és foglalás", mobile: "Órarend", icon: "calendar" },
    { page: "foglalasaim", href: "foglalasaim.html", label: "Foglalásaim", mobile: "Foglalásaim", icon: "list" },
    { page: "berleteim", href: "berleteim.html", label: "Bérleteim", mobile: "Bérleteim", icon: "ticket" },
    { page: "vasarlasaim", href: "vasarlasaim.html", label: "Vásárlásaim", mobile: null, icon: null },
    { page: "adataim", href: "adataim.html", label: "Adataim", mobile: "Profil", icon: "user" }
  ];

  // ---- helpers ----------------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toIso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function parseIso(iso) { var p = iso.split("-").map(Number); return { y: p[0], m: p[1] - 1, d: p[2] }; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDayLong(iso) {
    var p = parseIso(iso); var dt = new Date(p.y, p.m, p.d);
    return MONTHS[p.m] + " " + p.d + "., " + WEEKDAYS_FULL[dt.getDay()];
  }
  function dtOf(iso, time) { return new Date(iso + "T" + (time || "00:00") + ":00"); }
  function eventsFor(iso) { return (eventsByDate[iso] || []); }

  // ---- state ------------------------------------------------------------
  var state = null;
  var classTypes = [], classTypeMap = {}, events = [], eventsByDate = {};
  var demoNow = new Date();

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function loadState(initial) {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return initial;
  }

  function upcomingBookings() {
    return state.bookings.filter(function (b) { return b.status === "upcoming"; })
      .sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? -1 : 1; });
  }
  function isBooked(eventId) {
    return state.bookings.some(function (b) { return b.status === "upcoming" && b.eventId === eventId; });
  }
  function freeSpots(ev) {
    var mine = state.bookings.filter(function (b) { return b.status === "upcoming" && b.eventId === ev.id; }).length;
    return (ev.capacity || 0) - (ev.booked || 0) - mine;
  }
  function canCancel(b) {
    if (b.status !== "upcoming") return false;
    var start = dtOf(b.date, b.start);
    var deadline = Number(state.config.cancellationDeadlineHours || 0) * 3600 * 1000;
    return (start.getTime() - demoNow.getTime()) > deadline;
  }
  function ctFor(id) { return classTypeMap[id] || { name: id, color: "#F97316", description: "", image: "" }; }

  // ---- toast / modal ----------------------------------------------------
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function openModalHTML(html) {
    var m = $("#modal");
    if (!m) return;
    var body = $("#modalBody");
    if (body) body.innerHTML = html;
    m.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    var m = $("#modal");
    if (m) { m.hidden = true; document.body.style.overflow = ""; }
  }
  function confirmDialog(title, text, okLabel, onOk) {
    openModalHTML(
      '<h3 class="modal-title">' + esc(title) + '</h3>' +
      '<p class="confirm-text">' + esc(text) + '</p>' +
      '<div class="hero-actions">' +
        '<button class="btn btn-outline" data-close>Mégse</button>' +
        '<button class="btn btn-primary" id="confirmOk">' + esc(okLabel) + '</button>' +
      "</div>"
    );
    var ok = $("#confirmOk");
    if (ok) ok.addEventListener("click", function () { closeModal(); onOk(); });
  }

  // ---- shell ------------------------------------------------------------
  function renderShell(page) {
    var header = $("#siteHeader");
    if (header) {
      var navHtml = NAV_ITEMS.map(function (n) {
        return '<a href="' + n.href + '"' + (n.page === page ? ' aria-current="page"' : "") + ">" + esc(n.label) + "</a>";
      }).join("");
      header.innerHTML =
        '<header class="site-header app-header">' +
          '<div class="container header-inner">' +
            '<a class="brand" href="index.html">aTerem<span style="color:var(--brand)">.</span></a>' +
            '<nav class="nav app-nav" aria-label="Fő navigáció">' + navHtml + "</nav>" +
            '<div class="header-actions">' +
              '<div style="position:relative">' +
                '<button class="bell" id="bellBtn" aria-label="Értesítések">' + ICONS.bell +
                  '<span class="badge" id="unreadBadge" hidden>0</span></button>' +
              "</div>" +
              '<div class="user-chip"><span class="avatar" id="avatar">A</span>' +
                '<span class="user-name" id="headerUserName">Anna</span></div>' +
              '<button class="btn btn-outline btn-sm" id="logoutBtn">Kijelentkezés</button>' +
            "</div>" +
          "</div>" +
          '<div class="notif-panel" id="notifPanel" hidden></div>' +
        "</header>";
    }

    var footer = $("#siteFooter");
    if (footer) {
      footer.innerHTML =
        '<footer class="site-footer"><div class="container footer-inner">' +
          '<a class="brand" href="index.html">aTerem<span style="color:var(--brand)">.</span></a>' +
          '<p class="copyright">Demó ügyfélfelület &middot; &copy; <span id="year"></span> aTerem</p>' +
        "</div></footer>";
      var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    }

    var bottom = $("#bottomNav");
    if (bottom) {
      bottom.innerHTML = '<nav class="bottom-nav" aria-label="Mobil navigáció">' +
        NAV_ITEMS.filter(function (n) { return n.mobile; }).map(function (n) {
          return '<a href="' + n.href + '"' + (n.page === page ? ' aria-current="page"' : "") + ">" +
            ICONS[n.icon] + "<span>" + esc(n.mobile) + "</span></a>";
        }).join("") + "</nav>";
    }

    // modal + toast containers (appended once)
    if (!$("#modal")) {
      var modal = document.createElement("div");
      modal.id = "modal"; modal.className = "modal"; modal.hidden = true;
      modal.innerHTML =
        '<div class="modal-backdrop" data-close></div>' +
        '<div class="modal-card" role="dialog" aria-modal="true">' +
          '<button class="modal-close" data-close aria-label="Bezárás">&times;</button>' +
          '<div class="modal-body" id="modalBody"></div>' +
        "</div>";
      document.body.appendChild(modal);
    }
    if (!$("#toast")) {
      var t = document.createElement("div");
      t.id = "toast"; t.className = "toast"; t.hidden = true;
      document.body.appendChild(t);
    }

    // wire common
    var bell = $("#bellBtn");
    if (bell) bell.addEventListener("click", function (e) { e.stopPropagation(); toggleNotifPanel(); });
    document.addEventListener("click", function (e) {
      var panel = $("#notifPanel");
      if (panel && !panel.hidden && !e.target.closest("#notifPanel") && !e.target.closest("#bellBtn")) panel.hidden = true;
      if (e.target.closest("[data-close]")) closeModal();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    var logout = $("#logoutBtn");
    if (logout) logout.addEventListener("click", function () {
      confirmDialog("Kijelentkezés", "Ez egy demó felület — itt lépnél ki a fiókodból.", "Kijelentkezés", function () {
        toast("Demó: sikeresen kijelentkeztél.");
      });
    });

    refreshUserBadge();
    renderNotifPanel();
  }

  function refreshUserBadge() {
    var av = $("#avatar"), un = $("#headerUserName");
    if (av) av.textContent = (state.user.firstName || "A").charAt(0).toUpperCase();
    if (un) un.textContent = state.user.firstName;
  }

  // ---- notifications ----------------------------------------------------
  function renderNotifPanel() {
    var panel = $("#notifPanel");
    if (!panel) return;
    var unread = state.notifications.filter(function (n) { return !n.read; }).length;
    var badge = $("#unreadBadge");
    if (badge) { badge.textContent = unread; badge.hidden = unread === 0; }

    var items = state.notifications.map(function (n) {
      return '<div class="notif-item ' + (n.read ? "read" : "unread") + '" data-notif="' + n.id + '">' +
        '<span class="dot"></span>' +
        '<span class="t">' + esc(n.text) + '<br><span class="d">' + esc(n.date) + "</span></span>" +
      "</div>";
    }).join("");

    panel.innerHTML =
      '<div class="notif-head"><strong>Értesítések</strong><button id="markAllRead">Mind olvasott</button></div>' +
      '<div class="notif-list">' + (items || '<div class="notif-empty">Nincs értesítés.</div>') + "</div>";

    $$("[data-notif]", panel).forEach(function (el) {
      el.addEventListener("click", function () {
        var n = state.notifications.find(function (x) { return x.id === el.getAttribute("data-notif"); });
        if (n) { n.read = !n.read; saveState(); renderNotifPanel(); refreshUserBadge(); }
      });
    });
    var mark = $("#markAllRead");
    if (mark) mark.addEventListener("click", function () {
      state.notifications.forEach(function (n) { n.read = true; });
      saveState(); renderNotifPanel();
    });
  }
  function toggleNotifPanel() {
    var panel = $("#notifPanel");
    if (panel) panel.hidden = !panel.hidden;
  }

  // ================= PAGES ===============================================

  // ---- dashboard --------------------------------------------------------
  function renderDashboard() {
    var u = state.user;
    var hello = $("#greeting");
    if (hello) hello.textContent = "Szia, " + u.firstName + "! Örülünk, hogy újra itt vagy!";

    var up = upcomingBookings();
    var next = up[0];

    // Next training
    var nextEl = $("#nextTraining");
    if (nextEl) {
      if (next) {
        var ct = ctFor(next.classTypeId);
        nextEl.innerHTML =
          '<p class="kicker">Következő edzés</p>' +
          '<h3>' + esc(ct.name) + '</h3>' +
          '<p class="next-meta">' + esc(fmtDayLong(next.date)) + " · " + esc(next.start) + "–" + esc(next.end) + "</p>" +
          '<span class="chip chip-green">' + esc(statusLabel(next.status)) + "</span>" +
          '<div style="margin-top:16px">' +
            (canCancel(next)
              ? '<button class="btn btn-outline btn-sm" data-cancel="' + next.id + '">Lemondás</button>'
              : '<span class="chip chip-gray">A lemondási határidő lejárt</span>') +
          "</div>";
      } else {
        nextEl.innerHTML =
          '<p class="kicker">Következő edzés</p>' +
          '<div class="next-empty"><p class="big">Még nincs lefoglalt edzésed.</p>' +
          '<a class="btn btn-primary" href="oraend.html">Mutasd az órarendet</a></div>';
      }
    }

    // Pass overview
    var passEl = $("#passOverview");
    if (passEl) {
      if (state.pass) {
        var p = state.pass;
        var used = p.used, left = p.total - p.used;
        var pct = Math.round((used / p.total) * 100);
        passEl.innerHTML =
          '<p class="eyebrow">Bérletem</p>' +
          '<p class="pass-name">' + esc(p.name) + "</p>" +
          '<p class="pass-left">' + left + " <small>alkalom maradt</small></p>" +
          '<div class="progress"><div class="fill" style="width:' + pct + '%"></div></div>' +
          '<div class="progress-labels"><span>' + used + " felhasználva</span><span>Érvényes: " + esc(p.validUntil) + "</span></div>" +
          '<span class="chip chip-orange" style="margin-top:12px">' + esc(p.status) + "</span>" +
          '<div style="margin-top:14px"><a class="btn btn-outline btn-sm" href="berleteim.html">Bérletek megtekintése</a></div>';
      } else {
        passEl.innerHTML =
          '<p class="eyebrow">Bérletem</p>' +
          '<p>Jelenleg nincs aktív bérleted.</p>' +
          '<a class="btn btn-primary" href="berleteim.html">Bérletek megtekintése</a>';
      }
    }

    // Upcoming (next 7 days)
    var listEl = $("#upcomingList");
    if (listEl) {
      var end = demoNow.getTime() + 7 * 86400000;
      var week = up.filter(function (b) { var t = dtOf(b.date, b.start).getTime(); return t >= demoNow.getTime() && t <= end; });
      if (!week.length) {
        listEl.innerHTML = '<li class="muted-note">A következő 7 napban nincs foglalásod.</li>';
      } else {
        listEl.innerHTML = week.map(function (b) {
          var ct = ctFor(b.classTypeId);
          return '<li class="mini-item"><span class="dot" style="background:' + ct.color + '"></span>' +
            '<span class="info"><span class="t">' + esc(ct.name) + "</span><br>" +
            '<span class="s">' + esc(fmtDayLong(b.date)) + " · " + esc(b.start) + "–" + esc(b.end) + "</span></span>" +
            '<span class="chip chip-green">' + esc(statusLabel(b.status)) + "</span></li>";
        }).join("");
      }
    }

    // wire cancel buttons
    $$("[data-cancel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var b = state.bookings.find(function (x) { return x.id === btn.getAttribute("data-cancel"); });
        if (b) askCancel(b);
      });
    });
  }

  function statusLabel(s) {
    return { upcoming: "Foglalva", past: "Lezárult", cancelled: "Lemondva" }[s] || s;
  }

  // ---- calendar + booking (oraend) --------------------------------------
  var view = { year: null, month: null }, selectedDay = null, filterType = null;

  function visibleEvents(evs) {
    if (!filterType) return evs;
    return evs.filter(function (e) { return e.classTypeId === filterType; });
  }

  function buildFilter() {
    var box = $("#filterChips");
    if (!box) return;
    var chips = '<button class="chip ' + (!filterType ? "chip-orange" : "chip-gray") + '" data-filter="">Mind</button>' +
      classTypes.map(function (ct) {
        return '<button class="chip ' + (filterType === ct.id ? "chip-orange" : "chip-gray") + '" style="cursor:pointer" data-filter="' + ct.id + '">' + esc(ct.name) + "</button>";
      }).join("");
    box.innerHTML = chips;
    $$("[data-filter]", box).forEach(function (b) {
      b.addEventListener("click", function () { filterType = b.getAttribute("data-filter") || null; buildFilter(); renderCalendar(); });
    });
  }

  function buildGrid() {
    var grid = $("#calendarGrid");
    if (!grid) return;
    var first = new Date(view.year, view.month, 1);
    var offset = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var total = Math.ceil((offset + daysInMonth) / 7) * 7;

    var html = '<div class="cal-weekday-row">' + WEEKDAYS_SHORT.map(function (w) {
      return '<div class="cal-weekday">' + w + "</div>";
    }).join("") + "</div>";

    var todayIso = state.config.demoToday;

    for (var i = 0; i < total; i++) {
      if (i % 7 === 0) html += '<div class="cal-week">';
      var dayNum = i - offset + 1;
      var outside = dayNum < 1 || dayNum > daysInMonth;
      var iso = "", cellCls = "cal-cell";
      if (!outside) {
        iso = toIso(view.year, view.month, dayNum);
        if (iso === todayIso) cellCls += " is-today";
        if (iso === selectedDay) cellCls += " is-selected";
      } else cellCls += " is-outside";

      html += '<div class="' + cellCls + '"' + (iso ? ' data-day="' + iso + '"' : "") + ">";
      if (!outside) {
        html += '<span class="cal-day">' + dayNum + "</span>";
        var evs = visibleEvents(eventsFor(iso));
        evs.slice(0, 3).forEach(function (ev) {
          var ct = ctFor(ev.classTypeId);
          var booked = isBooked(ev.id);
          html += '<a class="cal-event" href="#" style="--c:' + ct.color + '" data-open-event="' + ev.id + '">' +
            '<span class="ev-time">' + esc(ev.start) + (booked ? " ✓" : "") + "</span>" + esc(ct.name) + "</a>";
        });
        if (evs.length > 3) html += '<span class="cal-more">+' + (evs.length - 3) + " további</span>";
      }
      html += "</div>";
      if (i % 7 === 6) html += "</div>";
    }
    grid.innerHTML = html;

    $$("[data-day]", grid).forEach(function (cell) {
      cell.addEventListener("click", function () { selectedDay = cell.getAttribute("data-day"); buildGrid(); buildDayDetail(); buildMobile(); });
    });
    $$("[data-open-event]", grid).forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var ev = events.find(function (x) { return x.id === el.getAttribute("data-open-event"); });
        if (ev) openEventModal(ev);
      });
    });
  }

  function buildMobile() {
    var selector = $("#daySelector"), listEl = $("#dayList");
    if (!selector || !listEl) return;
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var chips = "";
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = toIso(view.year, view.month, d);
      var dt = new Date(view.year, view.month, d);
      chips += '<button type="button" class="day-chip' + (iso === selectedDay ? " is-active" : "") + '" data-day="' + iso + '">' +
        '<span class="dw">' + WEEKDAYS_SHORT[dt.getDay()] + "</span><span class=\"dn\">" + d + "</span></button>";
    }
    selector.innerHTML = chips;

    var evs = visibleEvents(eventsFor(selectedDay));
    listEl.innerHTML = !evs.length ? '<li class="muted-note">Ezen a napon nincs óra.</li>' :
      evs.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; }).map(function (ev) {
        var ct = ctFor(ev.classTypeId);
        return '<li class="day-list-item" style="--c:' + ct.color + '" data-open-event="' + ev.id + '">' +
          '<div class="t">' + esc(ct.name) + "</div>" +
          '<div class="s">' + esc(ev.start) + "–" + esc(ev.end) + " · " + spotsText(ev) + "</div></li>";
      }).join("");

    $$("[data-day]", selector).forEach(function (chip) {
      chip.addEventListener("click", function () { selectedDay = chip.getAttribute("data-day"); buildGrid(); buildDayDetail(); buildMobile(); });
    });
    $$("[data-open-event]", listEl).forEach(function (el) {
      el.addEventListener("click", function () {
        var ev = events.find(function (x) { return x.id === el.getAttribute("data-open-event"); });
        if (ev) openEventModal(ev);
      });
    });
  }

  function buildDayDetail() {
    var wrap = $("#dayDetail"), title = $("#dayDetailTitle"), listEl = $("#dayDetailList");
    if (!wrap || !title || !listEl) return;
    if (!selectedDay) { wrap.hidden = true; return; }
    wrap.hidden = false;
    title.textContent = fmtDayLong(selectedDay);
    var evs = visibleEvents(eventsFor(selectedDay));
    listEl.innerHTML = !evs.length ? '<li class="muted-note">Ezen a napon nincs óra.</li>' :
      evs.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; }).map(function (ev) {
        var ct = ctFor(ev.classTypeId);
        return '<li class="day-detail-item" style="--c:' + ct.color + '">' +
          '<span class="bar"></span>' +
          '<div class="info"><span class="t">' + esc(ct.name) + "</span>" +
          ' &nbsp;<span class="s">' + esc(ev.start) + "–" + esc(ev.end) + " · " + spotsText(ev) + "</span></div>" +
          '<button type="button" class="btn btn-outline btn-sm" data-open-event="' + ev.id + '">Részletek</button></li>';
      }).join("");
    $$("[data-open-event]", listEl).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ev = events.find(function (x) { return x.id === btn.getAttribute("data-open-event"); });
        if (ev) openEventModal(ev);
      });
    });
  }

  function spotsText(ev) {
    var free = freeSpots(ev);
    return free > 0 ? free + " szabad hely" : "Betelt";
  }

  function renderCalendar() {
    var label = $("#monthLabel");
    if (label) label.textContent = view.year + ". " + MONTHS[view.month];
    if (!selectedDay || parseIso(selectedDay).y !== view.year || parseIso(selectedDay).m !== view.month) {
      var firstWithEvents = null;
      for (var d = 1; d <= new Date(view.year, view.month + 1, 0).getDate(); d++) {
        var iso = toIso(view.year, view.month, d);
        if (visibleEvents(eventsFor(iso)).length) { firstWithEvents = iso; break; }
      }
      selectedDay = firstWithEvents || toIso(view.year, view.month, 1);
    }
    buildGrid(); buildDayDetail(); buildMobile();
  }

  function shiftMonth(delta) {
    var m = view.month + delta, y = view.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    view.month = m; view.year = y; selectedDay = null;
    renderCalendar();
  }
  function goToday() {
    var t = parseIso(state.config.demoToday);
    view.year = t.y; view.month = t.m; selectedDay = state.config.demoToday;
    renderCalendar();
  }
  function initCalendarControls() {
    var prev = $("#prevMonth"), next = $("#nextMonth"), today = $("#todayBtn");
    if (prev) prev.addEventListener("click", function () { shiftMonth(-1); });
    if (next) next.addEventListener("click", function () { shiftMonth(1); });
    if (today) today.addEventListener("click", goToday);
  }

  function openEventModal(ev) {
    var ct = ctFor(ev.classTypeId);
    var free = freeSpots(ev);
    var mine = isBooked(ev.id);
    var action;
    if (mine) {
      action = '<span class="chip chip-green" style="margin-bottom:6px">Már lefoglaltad</span>' +
        '<button class="btn btn-outline btn-block" data-close>Bezárás</button>';
    } else if (free <= 0) {
      action = '<span class="chip chip-red" style="margin-bottom:6px">Betelt — nincs szabad hely</span>' +
        '<button class="btn btn-outline btn-block" data-close>Bezárás</button>';
    } else {
      action = '<p class="spots">Szabad helyek: <b>' + free + "</b></p>" +
        '<button class="btn btn-primary btn-block" id="bookBtn">Foglalás</button>';
    }

    openModalHTML(
      '<div class="class-card-media" style="background-image:url(&quot;' + ct.image + '&quot;);background-color:' + ct.color + ';height:160px;border-radius:12px;margin-bottom:16px"></div>' +
      '<p class="eyebrow">' + esc(ct.name) + "</p>" +
      '<h3 class="modal-title">' + esc(ct.name) + "</h3>" +
      '<p class="confirm-text">' + esc(fmtDayLong(ev.date)) + " · " + esc(ev.start) + "–" + esc(ev.end) + "</p>" +
      "<p class=\"confirm-text\">" + esc(ct.description) + "</p>" +
      '<div class="modal-meta-row"><span class="spots">Kapacitás: ' + (ev.capacity || "?") + "</span></div>" +
      action
    );

    var book = $("#bookBtn");
    if (book) book.addEventListener("click", function () { askBook(ev); });
  }

  function askBook(ev) {
    var ct = ctFor(ev.classTypeId);
    confirmDialog("Foglalás megerősítése",
      ct.name + " · " + fmtDayLong(ev.date) + " " + ev.start + "–" + ev.end + "\n\nBiztosan lefoglalod ezt az órát?",
      "Foglalás", function () {
        if (isBooked(ev.id)) { toast("Erre az órára már van foglalásod."); return; }
        if (freeSpots(ev) <= 0) { toast("Nincs szabad hely."); return; }
        state.bookings.push({
          id: "b" + Date.now(), eventId: ev.id, classTypeId: ev.classTypeId,
          date: ev.date, start: ev.start, end: ev.end, status: "upcoming",
          bookedAt: new Date().toISOString().slice(0, 10) + " (demó)"
        });
        saveState();
        toast("Sikeres foglalás: " + ct.name + " ✓");
        renderCalendar();
      });
  }

  function askCancel(b) {
    var ct = ctFor(b.classTypeId);
    if (!canCancel(b)) { toast("A lemondási határidő már lejárt."); return; }
    confirmDialog("Lemondás megerősítése",
      ct.name + " · " + fmtDayLong(b.date) + " " + b.start + "–" + b.end + "\n\nBiztosan lemondod ezt a foglalást?",
      "Lemondom", function () {
        b.status = "cancelled";
        saveState();
        toast("A foglalást lemondtad.");
        renderPage(document.body.getAttribute("data-page"));
      });
  }

  // ---- bookings page ----------------------------------------------------
  function renderBookingsPage() {
    var up = upcomingBookings();
    var past = state.bookings.filter(function (b) { return b.status === "past"; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var cancelled = state.bookings.filter(function (b) { return b.status === "cancelled"; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    fillBookingList($("#upcomingSection"), up, true);
    fillBookingList($("#pastSection"), past, false);
    fillBookingList($("#cancelledSection"), cancelled, false);
  }

  function fillBookingList(container, list, cancellable) {
    if (!container) return;
    if (!list.length) { container.innerHTML = '<li class="muted-note">Nincs megjeleníthető foglalás.</li>'; return; }
    container.innerHTML = list.map(function (b) {
      var ct = ctFor(b.classTypeId);
      var cancelBtn = (cancellable && b.status === "upcoming")
        ? (canCancel(b)
            ? '<button class="btn btn-outline btn-sm" data-cancel="' + b.id + '">Lemondás</button>'
            : '<span class="chip chip-gray">Lemondási határidő lejárt</span>')
        : "";
      return '<li class="booking-item' + (b.status === "cancelled" ? " cancelled" : "") + '">' +
        '<span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + ct.color + '"></span>' +
        '<div class="b-info"><div class="b-t">' + esc(ct.name) + "</div>" +
        '<div class="b-s">' + esc(fmtDayLong(b.date)) + " · " + esc(b.start) + "–" + esc(b.end) +
        " · foglalva: " + esc(b.bookedAt) + "</div></div>" +
        '<span class="chip chip-green">' + esc(statusLabel(b.status)) + "</span>" + cancelBtn + "</li>";
    }).join("");
    $$("[data-cancel]", container).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var b = state.bookings.find(function (x) { return x.id === btn.getAttribute("data-cancel"); });
        if (b) askCancel(b);
      });
    });
  }

  // ---- passes page ------------------------------------------------------
  function renderPassesPage() {
    var card = $("#passCard");
    if (card) {
      var p = state.pass;
      if (p) {
        var used = p.used, left = p.total - p.used;
        var pct = Math.round(used / p.total * 100);
        card.innerHTML =
          '<p class="pass-name">' + esc(p.name) + '</p>' +
          '<span class="chip chip-orange">' + esc(p.status) + "</span>" +
          '<p class="pass-left">' + left + " <small>alkalom maradt</small></p>" +
          '<div class="progress"><div class="fill" style="width:' + pct + '%"></div></div>' +
          '<div class="progress-labels"><span>' + used + " felhasználva</span><span>" + p.total + " összesen</span></div>" +
          '<p class="pass-sub" style="margin-top:10px">Érvényes: ' + esc(p.validUntil) + "</p>" +
          '<div class="pass-history"><h3>Felhasználási előzmények</h3><ul>' +
            (p.history || []).map(function (h) {
              return "<li><span>" + esc(h.label) + "</span><span>" + esc(h.date) + "</span></li>";
            }).join("") + "</ul></div>";
      } else {
        card.innerHTML = '<p class="pass-name">Jelenleg nincs aktív bérleted.</p>' +
          '<p class="pass-sub">Válassz egy bérletet az alábbi lehetőségek közül.</p>';
      }
    }

    var buy = $("#buyGrid");
    if (buy) {
      var pr = state.config.prices;
      var options = [
        { name: "10 alkalmas bérlet", price: pr.tenPass, desc: "10 alkalom, csoportos órákra." },
        { name: "Napijegy", price: pr.dailyTicket, desc: "Egynapi belépés egy csoportos órára." },
        { name: "Havi bérlet", price: pr.monthlyPass, desc: "Korlátlan óra egy hónapon át." }
      ];
      buy.innerHTML = options.map(function (o) {
        return '<div class="card buy-card">' +
          "<h3>" + esc(o.name) + "</h3>" +
          '<p class="price">' + o.price.toLocaleString("hu-HU") + ' <small>Ft</small></p>' +
          "<p>" + esc(o.desc) + "</p>" +
          '<button class="btn btn-primary" data-buy="' + esc(o.name) + '|' + o.price + '">Vásárlás</button></div>';
      }).join("");
      $$("[data-buy]", buy).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var parts = btn.getAttribute("data-buy").split("|");
          var name = parts[0], price = parseInt(parts[1], 10);
          confirmDialog("Demó vásárlás", name + " — " + price.toLocaleString("hu-HU") + " Ft.\n\nEz egy szimulált vásárlás, valódi fizetés nem történik.", "Vásárlás", function () {
            state.purchases.unshift({ id: "pur" + Date.now(), date: state.config.demoToday, product: name, amount: price, currency: "Ft", paymentStatus: "fizetve", invoiceId: "inv" + Date.now() });
            state.invoices.unshift({ id: "inv" + Date.now(), number: "AT-2026-" + String(100 + Math.floor(Math.random() * 899)), date: state.config.demoToday, amount: price, product: name });
            saveState();
            toast("Demó: vásárlás rögzítve ✓");
            renderPassesPage();
          });
        });
      });
    }
  }

  // ---- purchases page ---------------------------------------------------
  function renderPurchasesPage() {
    var list = $("#purchasesList");
    if (!list) return;
    if (!state.purchases.length) { list.innerHTML = '<p class="muted-note">Nincs vásárlási előzmény.</p>'; return; }
    list.innerHTML = state.purchases.map(function (p) {
      return '<li class="purchase-row">' +
        '<div class="p-info"><div class="p-t">' + esc(p.product) + "</div>" +
        '<div class="p-s">' + esc(p.date) + " · " + esc(p.paymentStatus) + "</div></div>" +
        '<span class="p-amount">' + p.amount.toLocaleString("hu-HU") + " " + esc(p.currency) + "</span>" +
        '<button class="btn btn-outline btn-sm" data-invoice="' + p.invoiceId + '">Számla</button></li>';
    }).join("");
    $$("[data-invoice]", list).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var inv = state.invoices.find(function (x) { return x.id === btn.getAttribute("data-invoice"); });
        if (inv) openInvoice(inv);
      });
    });
  }

  function openInvoice(inv) {
    openModalHTML(
      '<div class="invoice">' +
        '<div class="inv-head"><div><p class="eyebrow">Számla</p><h3>' + esc(inv.number) + "</h3></div>" +
        '<div style="text-align:right"><span class="chip chip-gray">' + esc(inv.date) + "</span></div></div>" +
        '<div class="inv-rows">' +
          '<div class="inv-row"><span>' + esc(inv.product) + "</span><span>1 db</span></div>" +
          '<div class="inv-row"><span>Áfa</span><span>—</span></div>' +
        "</div>" +
        '<div class="inv-total"><span>Összesen</span><span>' + inv.amount.toLocaleString("hu-HU") + " Ft</span></div>" +
        '<div class="demo-stamp">Demó számla — nincs valódi bizonylat.</div>' +
      "</div>"
    );
  }

  // ---- profile page -----------------------------------------------------
  function renderProfilePage() {
    var form = $("#profileForm");
    if (form) {
      var u = state.user;
      form.innerHTML =
        '<div class="form-grid">' +
          field("Vezetéknév", "lastName", u.lastName) +
          field("Keresztnév", "firstName", u.firstName) +
          fieldFull("E-mail", "email", u.email) +
          fieldFull("Telefonszám", "phone", u.phone) +
          fieldFull("Számlázási név", "billingName", u.billingName) +
          fieldFull("Számlázási cím", "billingAddress", u.billingAddress) +
        "</div>" +
        '<div style="margin-top:16px"><button class="btn btn-primary" id="saveProfile">Mentés</button></div>';
      $("#saveProfile").addEventListener("click", function () {
        ["lastName", "firstName", "email", "phone", "billingName", "billingAddress"].forEach(function (k) {
          var inp = $("#f_" + k); if (inp) state.user[k] = inp.value;
        });
        saveState(); refreshUserBadge();
        var hello = $("#greeting");
        if (hello) hello.textContent = "Szia, " + state.user.firstName + "! Örülünk, hogy újra itt vagy!";
        toast("Adatok mentve ✓");
      });
    }

    var pw = $("#passwordForm");
    if (pw) {
      pw.innerHTML =
        '<div class="form-grid">' +
          fieldFull("Jelenlegi jelszó", "pw", "", "password") +
          fieldFull("Új jelszó", "pw2", "", "password") +
          fieldFull("Új jelszó ismét", "pw3", "", "password") +
        "</div>" +
        '<div style="margin-top:16px"><button class="btn btn-primary" id="savePassword">Jelszó módosítása</button></div>';
      $("#savePassword").addEventListener("click", function () {
        toast("Demó: a jelszóváltoztatás itt nem történik meg.");
      });
    }
  }

  function field(label, key, val, type) {
    return '<div class="form-field"><label for="f_' + key + '">' + esc(label) + "</label>" +
      '<input id="f_' + key + '" type="' + (type || "text") + '" value="' + esc(val) + '"></div>';
  }
  function fieldFull(label, key, val, type) {
    return '<div class="form-field form-full"><label for="f_' + key + '">' + esc(label) + "</label>" +
      '<input id="f_' + key + '" type="' + (type || "text") + '" value="' + esc(val) + '"></div>';
  }

  // ---- dispatch ---------------------------------------------------------
  function renderPage(page) {
    if (page === "dashboard") renderDashboard();
    else if (page === "oraend") { buildFilter(); initCalendarControls(); renderCalendar(); }
    else if (page === "foglalasaim") renderBookingsPage();
    else if (page === "berleteim") renderPassesPage();
    else if (page === "vasarlasaim") renderPurchasesPage();
    else if (page === "adataim") renderProfilePage();
  }

  // ---- boot --------------------------------------------------------------
  function init() {
    var page = document.body.getAttribute("data-page") || "dashboard";

    Promise.all([
      loadJSON("data/class-types.json"),
      loadJSON("data/schedule.json"),
      loadJSON("data/client.json")
    ]).then(function (res) {
      classTypes = res[0].classTypes || [];
      classTypes.forEach(function (ct) { classTypeMap[ct.id] = ct; });
      events = res[1].events || [];
      events.forEach(function (ev) { (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev); });

      var initial = res[2];
      state = loadState(initial);
      demoNow = dtOf(state.config.demoNow.slice(0, 10), state.config.demoNow.slice(11, 16));

      var def = parseIso((res[1].meta && res[1].meta.defaultMonth ? res[1].meta.defaultMonth : state.config.demoToday.slice(0, 7)) + "-01");
      view.year = def.y; view.month = def.m;
      selectedDay = state.config.demoToday;

      renderShell(page);
      renderPage(page);
    }).catch(function (err) {
      console.warn("Adatok betöltése nem sikerült:", err);
      ["main"].forEach(function () {});
    });
  }

  function loadJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
