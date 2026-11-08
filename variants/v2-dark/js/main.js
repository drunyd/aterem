/* ==========================================================================
   aTerem — V2 dark behaviour (vanilla JS, multi-page)
   Reads data/class-types.json + data/schedule.json (relative to each page).
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
  var scheduleUncertain = [];

  var view = { year: null, month: null };
  var selectedDay = null;

  // ---- helpers ----------------------------------------------------------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toIso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function parseIso(iso) { var p = iso.split("-").map(Number); return { y: p[0], m: p[1] - 1, d: p[2] }; }

  function formatDayLong(iso) {
    var p = parseIso(iso);
    var dt = new Date(p.y, p.m, p.d);
    return MONTHS[p.m] + " " + p.d + "., " + WEEKDAYS_FULL[dt.getDay()];
  }
  function eventSort(a, b) {
    var ka = a.date + " " + a.start, kb = b.date + " " + b.start;
    return ka < kb ? -1 : (ka > kb ? 1 : 0);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function eventsFor(iso) { return eventsByDate[iso] || []; }
  function ctFor(id) { return classTypeMap[id] || { name: id, color: "#F97316", description: "", image: "" }; }

  // ---- data -------------------------------------------------------------
  function loadJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
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
    if (!modal) return;
    var metaText = ct.tagline || "";
    var subject = "Érdeklődés: " + ct.name;
    if (ev) {
      metaText = formatDayLong(ev.date) + " · " + ev.start + "–" + ev.end;
      subject = "Érdeklődés: " + ct.name + " (" + ev.date + " " + ev.start + ")";
    }
    modalMedia.style.backgroundImage = 'url("' + ct.image + '")';
    modalEyebrow.textContent = "aTerem · " + ct.name;
    modalTitle.textContent = ct.name;
    modalMeta.textContent = metaText;
    modalDesc.textContent = ct.description;
    modalCta.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() { if (modal) { modal.hidden = true; document.body.style.overflow = ""; } }

  function wireModal() {
    if (!modal) return;
    modal.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  }

  function wireOpeners(root) {
    if (!root) return;
    root.querySelectorAll("[data-open-event]").forEach(function (el) {
      el.addEventListener("click", function () {
        var ev = events.find(function (x) { return x.id === el.getAttribute("data-open-event"); });
        if (ev) openModal(ctFor(ev.classTypeId), ev);
      });
    });
    root.querySelectorAll("[data-open-class]").forEach(function (el) {
      el.addEventListener("click", function () { openModal(ctFor(el.getAttribute("data-open-class")), null); });
    });
  }

  // ---- class type cards -------------------------------------------------
  function renderClassTypes() {
    var list = document.getElementById("classTypeList");
    if (!list) return;
    list.innerHTML = classTypes.map(function (ct) {
      return (
        '<article class="class-card" data-reveal>' +
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
    wireOpeners(list);
    observeReveals();
  }

  // ---- upcoming ----------------------------------------------------------
  function renderUpcoming() {
    var list = document.getElementById("upcomingList");
    if (!list) return;
    var sorted = events.slice().sort(eventSort);
    var t = new Date();
    var todayIso = toIso(t.getFullYear(), t.getMonth(), t.getDate());
    var future = sorted.filter(function (e) { return e.date >= todayIso; });
    var upcoming = (future.length ? future : sorted).slice(0, 4);

    if (!upcoming.length) { list.innerHTML = '<p class="muted-note">Még nincs feltöltött óra.</p>'; return; }

    list.innerHTML = upcoming.map(function (ev) {
      var ct = ctFor(ev.classTypeId);
      return (
        '<article class="upcoming-card" data-reveal style="--c:' + ct.color + '">' +
          '<div class="upcoming-date"><span class="dot" style="background:' + ct.color + '"></span>' + escapeHtml(formatDayLong(ev.date)) + "</div>" +
          '<h3 class="upcoming-name">' + escapeHtml(ct.name) + "</h3>" +
          '<p class="upcoming-time">' + escapeHtml(ev.start) + "–" + escapeHtml(ev.end) + "</p>" +
          '<button type="button" class="btn btn-outline btn-sm" data-open-event="' + ev.id + '">Részletek</button>' +
        "</article>"
      );
    }).join("");

    wireOpeners(list);
    observeReveals();
    if (scheduleMeta.isSample) { var note = document.getElementById("upcomingNote"); if (note) note.hidden = false; }
  }

  // ---- calendar ----------------------------------------------------------
  function buildGrid() {
    var grid = document.getElementById("calendarGrid");
    if (!grid) return;

    var first = new Date(view.year, view.month, 1);
    var offset = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var total = Math.ceil((offset + daysInMonth) / 7) * 7;

    var html = '<div class="cal-weekday-row">' + WEEKDAYS_SHORT.map(function (w) {
      return '<div class="cal-weekday">' + w + "</div>";
    }).join("") + "</div>";

    var t = new Date();
    var todayIso = toIso(t.getFullYear(), t.getMonth(), t.getDate());

    for (var i = 0; i < total; i++) {
      if (i % 7 === 0) html += '<div class="cal-week">';
      var dayNum = i - offset + 1;
      var outside = dayNum < 1 || dayNum > daysInMonth;
      var iso = "";
      var cellCls = "cal-cell";
      if (!outside) {
        iso = toIso(view.year, view.month, dayNum);
        var dow = new Date(view.year, view.month, dayNum).getDay();
        if (dow === 0 || dow === 6) cellCls += " is-weekend";
        if (iso === todayIso) cellCls += " is-today";
        if (iso === selectedDay) cellCls += " is-selected";
      } else {
        cellCls += " is-outside";
      }

      html += '<div class="' + cellCls + '"' + (iso ? ' data-day="' + iso + '"' : "") + ">";
      if (!outside) {
        html += '<span class="cal-day">' + dayNum + "</span>";
        var evs = eventsFor(iso);
        evs.slice(0, 3).forEach(function (ev) {
          var ct = ctFor(ev.classTypeId);
          html +=
            '<a class="cal-event" href="#" style="--c:' + ct.color + '" data-open-event="' + ev.id + '">' +
              '<span class="ev-dot"></span>' +
              '<span class="ev-time">' + escapeHtml(ev.start) + "</span>" +
              '<span class="ev-name">' + escapeHtml(ct.name) + "</span>" +
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
        e.preventDefault(); e.stopPropagation();
        var ev = events.find(function (x) { return x.id === el.getAttribute("data-open-event"); });
        if (ev) openModal(ctFor(ev.classTypeId), ev);
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
        var ct = ctFor(ev.classTypeId);
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
    wireOpeners(listEl);
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
    if (!evs.length) { listEl.innerHTML = '<li class="muted-note">Ezen a napon nincs óra.</li>'; return; }
    listEl.innerHTML = evs.slice().sort(eventSort).map(function (ev) {
      var ct = ctFor(ev.classTypeId);
      return (
        '<li class="day-detail-item" style="--c:' + ct.color + '">' +
          '<span class="bar"></span>' +
          '<div class="info"><span class="t">' + escapeHtml(ct.name) + "</span>" +
          ' &nbsp;<span class="s">' + escapeHtml(ev.start) + "–" + escapeHtml(ev.end) + "</span></div>" +
          '<button type="button" class="btn btn-outline btn-sm" data-open-event="' + ev.id + '">Részletek</button>' +
        "</li>"
      );
    }).join("");
    wireOpeners(listEl);
  }

  function renderUncertain() {
    var box = document.getElementById("uncertainBox");
    if (!box) return;
    if (!scheduleUncertain.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = "<h4>Bizonytalan időpontok a forrásban</h4><ul>" + scheduleUncertain.map(function (u) {
      return "<li><strong>" + escapeHtml(u.week) + "</strong> · " + escapeHtml(u.time) + " — " + escapeHtml(u.note) + "</li>";
    }).join("") + "</ul>";
  }

  function renderCalendar() {
    var label = document.getElementById("monthLabel");
    if (label) label.textContent = view.year + ". " + MONTHS[view.month];

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

  function selectDay(iso) { selectedDay = iso; buildGrid(); buildMobile(); buildDayDetail(); }

  function shiftMonth(delta) {
    var m = view.month + delta, y = view.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    view.month = m; view.year = y;
    renderCalendar();
  }
  function goToday() {
    var t = new Date();
    view.year = t.getFullYear(); view.month = t.getMonth(); selectedDay = null;
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

  // ---- nav / reveal / footer -------------------------------------------
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

  var revealObserver = null;
  function observeReveals() {
    var els = document.querySelectorAll("[data-reveal]:not(.is-visible)");
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-visible"); }); return; }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-visible"); revealObserver.unobserve(en.target); }
        });
      }, { threshold: 0.12 });
    }
    els.forEach(function (el) { revealObserver.observe(el); });
  }

  // ---- boot --------------------------------------------------------------
  function init() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initNav();
    initCalendarControls();
    wireModal();

    Promise.all([loadJSON("data/class-types.json"), loadJSON("data/schedule.json")])
      .then(function (results) {
        classTypes = results[0].classTypes || [];
        classTypes.forEach(function (ct) { classTypeMap[ct.id] = ct; });
        var sched = results[1];
        scheduleMeta = sched.meta || {};
        events = sched.events || [];
        scheduleUncertain = sched.uncertain || [];
        events.forEach(function (ev) { (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev); });

        var def = scheduleMeta.defaultMonth ? parseIso(scheduleMeta.defaultMonth + "-01") : null;
        view.year = def ? def.y : new Date().getFullYear();
        view.month = def ? def.m : new Date().getMonth();

        renderClassTypes();
        renderUpcoming();
        renderCalendar();
        renderUncertain();
        observeReveals();
      })
      .catch(function (err) {
        console.warn("Adatok betöltése nem sikerült:", err);
        var m = "Az adatok betöltése nem sikerült. Indítsd el helyi szerverrel (python3 -m http.server).";
        ["classTypeList", "upcomingList", "dayList"].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.innerHTML = '<p class="muted-note">' + m + "</p>";
        });
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
