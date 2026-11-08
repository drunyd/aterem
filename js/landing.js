/* ==========================================================================
   aTerem — variants landing page behaviour
   Loads variants.json and renders the list. Keep it tiny.
   ========================================================================== */
(function () {
  "use strict";

  var list = document.getElementById("variantList");

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render(variants) {
    if (!list) return;
    if (!variants.length) {
      list.innerHTML = '<p class="empty">Még nincs változat.</p>';
      return;
    }
    list.innerHTML = variants.map(function (v, i) {
      var badge = v.status ? '<span class="variant-status">' + escapeHtml(v.status) + "</span>" : "";
      return (
        '<a class="variant-card" href="' + escapeHtml(v.path) + '">' +
          '<span class="variant-num">' + (i + 1) + "</span>" +
          '<span class="variant-text">' +
            "<strong>" + escapeHtml(v.name) + "</strong>" +
            (v.description ? '<span class="variant-desc">' + escapeHtml(v.description) + "</span>" : "") +
          "</span>" +
          badge +
          '<span class="variant-arrow">&rarr;</span>' +
        "</a>"
      );
    }).join("");
  }

  fetch("variants.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) { render(data.variants || []); })
    .catch(function () {
      if (list) {
        list.innerHTML = '<p class="empty">A változatok betöltése nem sikerült.<br>Indítsd el helyi szerverrel: <code>python3 -m http.server</code></p>';
      }
    });
})();
