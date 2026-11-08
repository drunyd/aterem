/* ==========================================================================
   aTerem — prototype behaviour (vanilla JS)
   Data-driven: reads data/class-types.json + data/schedule.json
   ========================================================================== */
(function () {
  "use strict";

  var WEEKDAYS_FULL = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  var WEEKDAYS_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
  var MONTHS = ["január", "február", "március", "április", "május", "június",
    "július", "augusztus", "szeptember", "október", "november", "december"];

  var EMAIL = "info@a-terem.hu";

  var classTypes = [];
  var classTypeMap = {};
  var scheduleMeta = { isSample: false, defaultMonth: null };
  var events = [];
  var eventsByDate = {};

  var view = { year: null, month: null };      // month: 0-11
  var selectedDay = null;

  // ---- helpers ----------------------------------------------------------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toIso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }

  function parseIso(iso) {
    var parts = iso.split("-").map(Number);
    return { y: parts[0], m: parts[1] - 1, d: parts[2] };
  }

  function formatDayLong(iso) {
    var p = parseIso(iso);
    var dt = new Date(p.y, p.m, p.d);
    return MONTHS[p.m] + " " + p.d + "., " + WEEKDAYS_FULL[dt.getDay()];
  }

  function eventSort(a, b) {
    var ka = a.date + " " + a.start;
    var kb = b.date + " " + b.start;
    return ka < kb ? -1 : (ka > kb ? 1 : 0);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- data loading -----------------------------------------------------
  function loadJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
      return r.json();
    });
  }

  function showLoadError(containerId, msg) {
    var el = document.getElementById(containerId);
    if (el) el.innerHTML = '<p class="muted-note">' + escapeHtml(msg) + "</p>";
  }

  // ---- modal ------------------------------------------------------------
  var modal = document.getElementById("modal");
  var modalMedia = document.getElementById("modalMedia");
  var modalEyebrow = document.getElementById("modalEyebrow");
  var modalTitle = document.getElementById("modalTitle");
  var modalMeta = document.getElementById("modalMeta");
  var modalDesc = document.getElementById("modalDesc");
  var modalCta = document.getElementById("modalCta");

  function openModal(ct, ev) {
    var name = ct.name;
    var metaText = ct.tagline || "";
    var subject = "Érdeklődés: " + name;

    if (ev) {
      metaText = formatDayLong(ev.date) + " · " + ev.start + "–" + ev.end;
      subject = "Érdeklődés: " + name + " (" + ev.date + " " + ev.start + ")";
    }

    modalMedia.style.backgroundImage = 'url("' + ct.image + '")';
    modalEyebrow.textContent = "aTerem · " + name;
    modalTitle.textContent = name;
    modalMeta.textContent = metaText;
    modalDesc.textContent = ct.description;
    modalCta.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  // ---- render: class type cards ----------------------------------------
  function renderClassTypes() {
    var list = document.getElementById("classTypeList");
    if (!list) return;
    list.innerHTML = classTypes.map(function (ct) {
      return (
        '<article class="class-card">' +
          '<div class="class-card-media" style="background-image:url(&quot;' + ct.image + '&quot;);background-color:' + ct.color + '"></div>' +
          '<div class="class-card-body" style="--c:' + ct.color + '">' +
            '<span class="class-card-tag">' + escapeHtml(ct.name) + "</span>" +
            "<h3>" + escapeHtml(ct.tagline) + "</h3>" +
            "<p>" + escapeHtml(ct.description) + "</p>" +
            '<button type="button" class="btn btn-outline btn-sm" data-open-class="' + ct.id + '">Részletek</button>' +
          "</div>" +
        "</article>"
      );
    }).join("");

    list.querySelectorAll("[data-open-class]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ct = classTypeMap[btn.getAttribute("data-open-class")];
        if (ct) openModal(ct, null);
      });
    });
  }

  // ---- render: upcoming --------------------------------------------------
  function renderUpcoming() {
    var list = document.getElementById("upcomingList");
    if (!list) return;

    var sorted = events.slice().sort(eventSort);
    var todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    var future = sorted.filter(function (e) { return e.date >= todayIso; });
    var upcoming = (future.length ? future : sorted).slice(0, 4);

    if (!upcoming.length) {
      list.innerHTML = '<p class="muted-note">Még nincs feltöltött óra.</p>';
      return;
    }

    list.innerHTML = upcoming.map(function (ev) {
      var ct = classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316" };
      return (
        '<article class="upcoming-card" style="--c:' + ct.color + '">' +
          '<div class="upcoming-date"><span class="dot" style="background:' + ct.color + '"></span>' +
            escapeHtml(formatDayLong(ev.date)) + "</div>" +
          '<h3 class="upcoming-name">' + escapeHtml(ct.name) + "</h3>" +
          '<p class="upcoming-time">' + escapeHtml(ev.start) + "–" + escapeHtml(ev.end) + "</p>" +
          '<button type="button" class="btn btn-outline btn-sm" data-open-event="' + ev.id + '">Részletek</button>' +
        "</article>"
      );
    }).join("");

    list.querySelectorAll("[data-open-event]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ev = events.find(function (x) { return x.id === btn.getAttribute("data-open-event"); });
        if (ev) openModal(classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316", description: "", image: "" }, ev);
      });
    });

    if (scheduleMeta.isSample) {
      var note = document.getElementById("upcomingNote");
      if (note) note.hidden = false;
    }
  }

  // ---- render: calendar ---------------------------------------------------
  function eventsFor(iso) { return eventsByDate[iso] || []; }

  function buildGrid() {
    var grid = document.getElementById("calendarGrid");
    if (!grid) return;

    var first = new Date(view.year, view.month, 1);
    var offset = (first.getDay() + 6) % 7;           // Monday-first
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var cells = offset + daysInMonth;
    var total = Math.ceil(cells / 7) * 7;

    var html = '<div class="cal-weekday-row">' + WEEKDAYS_SHORT.map(function (w) {
      return '<div class="cal-weekday">' + w + "</div>";
    }).join("") + "</div>";

    var today = new Date();
    var todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

    for (var i = 0; i < total; i++) {
      if (i % 7 === 0) html += '<div class="cal-week">';
      var dayNum = i - offset + 1;
      var outside = dayNum < 1 || dayNum > daysInMonth;
      var iso = "";
      var cellCls = "cal-cell";
      if (outside) {
        cellCls += " is-outside";
      } else {
        iso = toIso(view.year, view.month, dayNum);
        if (iso === todayIso) cellCls += " is-today";
        if (iso === selectedDay) cellCls += " is-selected";
      }

      html += '<div class="' + cellCls + '"' + (iso ? ' data-day="' + iso + '"' : "") + ">";
      if (!outside) {
        html += '<span class="cal-day">' + dayNum + "</span>";
        var evs = eventsFor(iso);
        var shown = evs.slice(0, 3);
        shown.forEach(function (ev) {
          var ct = classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316" };
          html +=
            '<a class="cal-event" href="#" style="--c:' + ct.color + '" data-open-event="' + ev.id + '">' +
              '<span class="ev-time">' + escapeHtml(ev.start) + "</span>" + escapeHtml(ct.name) +
            "</a>";
        });
        if (evs.length > 3) html += '<span class="cal-more">+' + (evs.length - 3) + " további</span>";
      }
      html += "</div>";
      if (i % 7 === 6) html += "</div>";
    }

    grid.innerHTML = html;

    grid.querySelectorAll("[data-day]").forEach(function (cell) {
      cell.addEventListener("click", function () { selectDay(cell.getAttribute("data-day")); });
    });
    grid.querySelectorAll("[data-open-event]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var ev = events.find(function (x) { return x.id === el.getAttribute("data-open-event"); });
        if (ev) openModal(classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316", description: "", image: "" }, ev);
      });
    });
  }

  function buildMobile() {
    var selector = document.getElementById("daySelector");
    var listEl = document.getElementById("dayList");
    if (!selector || !listEl) return;

    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    var chips = "";
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = toIso(view.year, view.month, d);
      var dt = new Date(view.year, view.month, d);
      chips +=
        '<button type="button" class="day-chip' + (iso === selectedDay ? " is-active" : "") + '" data-day="' + iso + '">' +
          '<span class="dw">' + WEEKDAYS_SHORT[dt.getDay()] + "</span>" +
          '<span class="dn">' + d + "</span>" +
        "</button>";
    }
    selector.innerHTML = chips;

    var evs = eventsFor(selectedDay);
    if (!evs.length) {
      listEl.innerHTML = '<li class="muted-note">Ezen a napon nincs óra.</li>';
    } else {
      listEl.innerHTML = evs.slice().sort(eventSort).map(function (ev) {
        var ct = classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316" };
        return (
          '<li class="day-list-item" style="--c:' + ct.color + '" data-open-event="' + ev.id + '">' +
            '<div class="t">' + escapeHtml(ct.name) + "</div>" +
            '<div class="s">' + escapeHtml(ev.start) + "–" + escapeHtml(ev.end) + " · " + escapeHtml(formatDayLong(ev.date)) + "</div>" +
          "</li>"
        );
      }).join("");
    }

    selector.querySelectorAll("[data-day]").forEach(function (chip) {
      chip.addEventListener("click", function () { selectDay(chip.getAttribute("data-day")); });
    });
    listEl.querySelectorAll("[data-open-event]").forEach(function (el) {
      el.addEventListener("click", function () {
        var ev = events.find(function (x) { return x.id === el.getAttribute("data-open-event"); });
        if (ev) openModal(classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316", description: "", image: "" }, ev);
      });
    });
  }

  function buildDayDetail() {
    var wrap = document.getElementById("dayDetail");
    var title = document.getElementById("dayDetailTitle");
    var listEl = document.getElementById("dayDetailList");
    if (!wrap || !title || !listEl) return;

    if (!selectedDay) { wrap.hidden = true; return; }
    wrap.hidden = false;
    title.textContent = formatDayLong(selectedDay);

    var evs = eventsFor(selectedDay);
    if (!evs.length) {
      listEl.innerHTML = '<li class="muted-note">Ezen a napon nincs óra.</li>';
      return;
    }
    listEl.innerHTML = evs.slice().sort(eventSort).map(function (ev) {
      var ct = classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316" };
      return (
        '<li class="day-detail-item" style="--c:' + ct.color + '">' +
          '<span class="bar"></span>' +
          '<div class="info"><span class="t">' + escapeHtml(ct.name) + "</span>" +
          ' &nbsp;<span class="s">' + escapeHtml(ev.start) + "–" + escapeHtml(ev.end) + "</span></div>" +
          '<button type="button" class="btn btn-outline btn-sm" data-open-event="' + ev.id + '">Részletek</button>' +
        "</li>"
      );
    }).join("");

    listEl.querySelectorAll("[data-open-event]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ev = events.find(function (x) { return x.id === btn.getAttribute("data-open-event"); });
        if (ev) openModal(classTypeMap[ev.classTypeId] || { name: ev.classTypeId, color: "#F97316", description: "", image: "" }, ev);
      });
    });
  }

  function renderUncertain() {
    var box = document.getElementById("uncertainBox");
    if (!box) return;
    if (!Array.isArray(scheduleUncertain) || !scheduleUncertain.length) { box.hidden = true; return; }
    box.hidden = false;
    var items = scheduleUncertain.map(function (u) {
      return "<li><strong>" + escapeHtml(u.week) + "</strong> · " + escapeHtml(u.time) + " — " + escapeHtml(u.note) + "</li>";
    }).join("");
    box.innerHTML = "<h4>Bizonytalan időpontok a forrásban</h4><ul>" + items + "</ul>";
  }

  var scheduleUncertain = [];

  function renderCalendar() {
    var label = document.getElementById("monthLabel");
    if (label) label.textContent = view.year + ". " + MONTHS[view.month];

    // ensure a sensible selected day
    if (!selectedDay || parseIso(selectedDay).y !== view.year || parseIso(selectedDay).m !== view.month) {
      var firstWithEvents = null;
      for (var d = 1; d <= new Date(view.year, view.month + 1, 0).getDate(); d++) {
        var iso = toIso(view.year, view.month, d);
        if (eventsFor(iso).length) { firstWithEvents = iso; break; }
      }
      selectedDay = firstWithEvents || toIso(view.year, view.month, 1);
    }

    buildGrid();
    buildMobile();
    buildDayDetail();
  }

  function selectDay(iso) {
    selectedDay = iso;
    buildGrid();
    buildMobile();
    buildDayDetail();
  }

  function shiftMonth(delta) {
    var m = view.month + delta;
    var y = view.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    view.month = m;
    view.year = y;
    renderCalendar();
  }

  function goToday() {
    var t = new Date();
    view.year = t.getFullYear();
    view.month = t.getMonth();
    selectedDay = null;
    renderCalendar();
  }

  function initCalendarControls() {
    var prev = document.getElementById("prevMonth");
    var next = document.getElementById("nextMonth");
    var today = document.getElementById("todayBtn");
    if (prev) prev.addEventListener("click", function () { shiftMonth(-1); });
    if (next) next.addEventListener("click", function () { shiftMonth(1); });
    if (today) today.addEventListener("click", goToday);
  }

  // ---- nav ---------------------------------------------------------------
  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---- boot --------------------------------------------------------------
  function init() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initNav();
    initCalendarControls();

    Promise.all([
      loadJSON("data/class-types.json"),
      loadJSON("data/schedule.json")
    ]).then(function (results) {
      classTypes = results[0].classTypes || [];
      classTypes.forEach(function (ct) { classTypeMap[ct.id] = ct; });

      var sched = results[1];
      scheduleMeta = sched.meta || {};
      events = sched.events || [];
      scheduleUncertain = sched.uncertain || [];

      events.forEach(function (ev) {
        (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev);
      });

      // initial view = schedule's default month (fallback: current)
      var def = scheduleMeta.defaultMonth ? parseIso(scheduleMeta.defaultMonth + "-01") : null;
      view.year = def ? def.y : new Date().getFullYear();
      view.month = def ? def.m : new Date().getMonth();

      renderClassTypes();
      renderUpcoming();
      renderCalendar();
      renderUncertain();
    }).catch(function (err) {
      console.warn("Adatok betöltése nem sikerült:", err);
      showLoadError("classTypeList", "Az óratípusok betöltése nem sikerült. Indítsd el a weboldalt egy helyi szerverrel (pl. python3 -m http.server).");
      showLoadError("upcomingList", "Az órarend betöltése nem sikerült.");
      showLoadError("calendarGrid", "");
      showLoadError("dayList", "");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
