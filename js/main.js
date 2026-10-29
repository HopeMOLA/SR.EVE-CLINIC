/*
 * Sr. Eve's Clinic: site behaviour (no framework, no dependencies).
 * Sections: helpers, dates, validation, backend client, UI widgets, forms, init.
 *
 * Patient data is only ever sent in POST bodies (never URLs) and is never logged.
 */
(function () {
  "use strict";

  var C = window.CLINIC;
  if (!C) { return; }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =====================================================================
     Helpers
     ===================================================================== */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function icon(name, cls) {
    return '<svg class="' + (cls || "icon") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function telHref(p) {
    if (!p) { return null; }
    var cleaned = String(p).replace(/[^\d+]/g, "");
    return cleaned.replace(/\D/g, "").length >= 7 ? "tel:" + cleaned : null;
  }
  function mailHref(e) {
    return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? "mailto:" + e : null;
  }
  function waHref(n, text) {
    if (!n) { return null; }
    var d = String(n).replace(/\D/g, "");
    if (d.length < 9 || d.length > 15) { return null; }
    return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function httpsUrl(u) {
    if (!u) { return null; }
    try { var x = new URL(u); return x.protocol === "https:" ? x.toString() : null; } catch (e) { return null; }
  }

  /* =====================================================================
     Dates
     ===================================================================== */
  function pad(n) { return String(n).padStart(2, "0"); }
  function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayISO() { return toISO(new Date()); }
  function addDaysISO(n) { var d = new Date(); d.setDate(d.getDate() + n); return toISO(d); }
  function parseISO(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) { return null; }
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
  }
  function mins(hhmm) { var p = hhmm.split(":"); return +p[0] * 60 + +p[1]; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function hoursFor(iso) {
    var d = parseISO(iso);
    if (!d) { return null; }
    for (var i = 0; i < C.hours.length; i++) { if (C.hours[i].days.indexOf(d.getDay()) !== -1) { return C.hours[i]; } }
    return null;
  }
  /* Preferred-time windows from opening hours only. NOT confirmed availability. */
  function openingTimes(iso) {
    var rule = hoursFor(iso);
    if (!rule) { return []; }
    var out = [];
    for (var t = mins(rule.open); t + C.slotMinutes <= mins(rule.close); t += C.slotMinutes) { out.push(hhmm(t)); }
    if (iso === todayISO()) {
      var now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
      out = out.filter(function (t2) { return mins(t2) > nm; });
    }
    return out;
  }
  function longDate(iso) {
    var d = parseISO(iso);
    return d ? d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : iso;
  }

  /* =====================================================================
     Validation
     ===================================================================== */
  var MESSAGE_MAX = 500;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var CONSENT_MSG = "Please confirm you have read the privacy notice.";

  function vName(v) {
    var t = v.trim();
    if (!t) { return "Please enter your name."; }
    if (t.length < 2) { return "Name looks too short."; }
    if (t.length > 100) { return "Name is too long."; }
  }
  function vPhone(v, required) {
    var t = v.trim();
    if (!t) { return required ? "Please enter a contact number." : undefined; }
    if (!/^[+\d][\d\s\-().]*$/.test(t)) { return "Use digits only (spaces, +, - and brackets are fine)."; }
    var n = t.replace(/\D/g, "").length;
    if (n < 9 || n > 15) { return "Enter a valid phone number (9 to 15 digits)."; }
  }
  function vEmail(v, required) {
    var t = v.trim();
    if (!t) { return required ? "Please enter your email address." : undefined; }
    if (t.length > 254 || !EMAIL_RE.test(t)) { return "Enter a valid email address."; }
  }
  function vDate(v) {
    if (!v) { return "Please choose a preferred date."; }
    if (!parseISO(v)) { return "Enter a valid date."; }
    if (v < todayISO()) { return "That date has passed. Please choose today or a later date."; }
    if (!hoursFor(v)) { return "Please choose a different date."; }
  }
  function vMessage(v, required) {
    var t = v.trim();
    if (!t) { return required ? "Please enter a message." : undefined; }
    if (t.length > MESSAGE_MAX) { return "Please keep your message under " + MESSAGE_MAX + " characters."; }
  }
  function compact(o) { Object.keys(o).forEach(function (k) { if (!o[k]) { delete o[k]; } }); return o; }

  /* =====================================================================
     Backend client (honest: no endpoint = nothing sent, and the UI says so)
     ===================================================================== */
  function isSecure(url) {
    try {
      var u = new URL(url, window.location.href);
      return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch (e) { return false; }
  }
  function postJson(endpoint, body) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: ctrl.signal
    }).finally(function () { clearTimeout(timer); });
  }
  function submitTo(endpoint, body) {
    if (!endpoint) { return Promise.resolve({ status: "unavailable" }); }
    if (!isSecure(endpoint)) {
      return Promise.resolve({ status: "error", message: "The form is misconfigured. Please contact the clinic directly." });
    }
    return postJson(endpoint, body).then(function (res) {
      if (res.ok) { return { status: "success" }; }
      if (res.status === 429) { return { status: "error", message: "Too many attempts. Please wait a moment and try again." }; }
      if (res.status >= 400 && res.status < 500) { return { status: "error", message: "We could not accept that submission. Please check your details and try again." }; }
      return { status: "error", message: "Something went wrong on our side. Please try again shortly." };
    }, function (err) {
      return {
        status: "error",
        message: err && err.name === "AbortError"
          ? "The request timed out. Please check your connection and try again."
          : "We could not reach the server. Please check your connection and try again."
      };
    });
  }
  /* POST so that date + service never appear in a URL. Resolves to string[] or null. */
  function fetchSlots(iso, serviceId) {
    var ep = C.integrations.availabilityEndpoint;
    if (!ep || !isSecure(ep)) { return Promise.resolve(null); }
    return postJson(ep, { date: iso, serviceId: serviceId }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      var s = data && data.slots;
      return Array.isArray(s) && s.every(function (x) { return typeof x === "string" && /^\d{2}:\d{2}$/.test(x); }) ? s : null;
    }).catch(function () { return null; });
  }

  /* =====================================================================
     Page widgets
     ===================================================================== */
  function initYear() {
    $$("[data-year]").forEach(function (n) { n.textContent = new Date().getFullYear(); });
  }

  function initLogo() {
    var path = C.assets && C.assets.logo;
    if (!path) { return; }
    $$("[data-logo]").forEach(function (host) {
      var fallback = host.innerHTML;
      var img = new Image();
      img.alt = C.name;
      img.decoding = "async";
      img.onerror = function () { host.innerHTML = fallback; };
      img.src = path;
      host.innerHTML = "";
      host.appendChild(img);
    });
  }

  function initImageSlots() {
    $$("[data-slot]").forEach(function (host) {
      var path = C.assets && C.assets[host.getAttribute("data-slot")];
      if (!path) { return; }
      var fallback = host.innerHTML;
      var img = new Image();
      img.alt = host.getAttribute("data-alt") || "";
      img.decoding = "async";
      img.loading = host.getAttribute("data-slot") === "hero" ? "eager" : "lazy";
      img.onerror = function () { host.innerHTML = fallback; };
      img.src = path;
      host.innerHTML = "";
      host.appendChild(img);
    });
  }

  function initContactDetails() {
    var c = C.contact;
    $$('[data-contact="address"]').forEach(function (n) { if (c.address) { n.textContent = c.address; } });
    $$('[data-contact="phone"]').forEach(function (n) {
      var h = telHref(c.phone);
      if (!h) { return; }
      n.innerHTML = "";
      var a = document.createElement("a"); a.href = h; a.textContent = c.phone; n.appendChild(a);
    });
    $$('[data-contact="email"]').forEach(function (n) {
      var h = mailHref(c.email);
      if (!h) { return; }
      n.innerHTML = "";
      var a = document.createElement("a"); a.href = h; a.textContent = c.email; a.style.wordBreak = "break-all"; n.appendChild(a);
    });
    var wa = waHref(c.whatsapp, "Hello, I would like to ask about an appointment.");
    if (wa) {
      $$('li[data-contact="whatsapp"]').forEach(function (li) {
        li.hidden = false;
        li.innerHTML = "";
        var a = document.createElement("a");
        a.href = wa; a.target = "_blank"; a.rel = "noopener noreferrer";
        if (li.closest(".contact-list")) {
          a.className = "btn btn--outline";
          a.innerHTML = icon("message-circle") + " Chat on WhatsApp";
        } else {
          li.innerHTML = icon("message-circle");
          a.textContent = "WhatsApp us";
        }
        li.appendChild(a);
      });
    }
    var map = $("#map");
    if (map) {
      var embed = httpsUrl(c.mapEmbedUrl), link = httpsUrl(c.mapLink);
      if (embed) {
        map.innerHTML = "";
        var f = document.createElement("iframe");
        f.title = "Map showing the location of " + C.name;
        f.src = embed; f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade"; f.allowFullscreen = true;
        map.appendChild(f);
      }
      if (link) {
        var p = document.createElement("p"); p.className = "map__link";
        var a2 = document.createElement("a"); a2.href = link; a2.target = "_blank"; a2.rel = "noopener noreferrer"; a2.textContent = "Get directions";
        p.appendChild(a2); map.appendChild(p);
      }
    }
    if (C.paymentInfo) {
      $$("[data-payment], [data-payment-faq]").forEach(function (n) { n.textContent = C.paymentInfo; });
      $$("[data-payment-tbc]").forEach(function (n) { n.hidden = true; });
    }
  }

  function initHeader() {
    var header = $("#site-header");
    var toggle = $(".nav-toggle");
    var menu = $("#mobile-menu");
    if (!header) { return; }

    function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    function setMenu(open) {
      if (!toggle || !menu) { return; }
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("is-open", open);
      header.classList.toggle("menu-open", open);
    }
    if (toggle) {
      toggle.addEventListener("click", function () { setMenu(toggle.getAttribute("aria-expanded") !== "true"); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
      });
      $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
      window.matchMedia("(min-width: 1024px)").addEventListener("change", function (m) { if (m.matches) { setMenu(false); } });
    }

    /* Scroll-spy on the home page: highlight the section nearest the top. */
    var spyLinks = $$("[data-spy]");
    if (spyLinks.length) {
      var ids = ["home", "about", "services", "team", "contact"];
      var update = function () {
        var probe = window.innerHeight * 0.35, current = "home";
        ids.forEach(function (id) {
          var s = document.getElementById(id);
          if (s && s.getBoundingClientRect().top <= probe) { current = id; }
        });
        spyLinks.forEach(function (a) {
          if (a.getAttribute("data-spy") === current) { a.setAttribute("aria-current", "page"); }
          else { a.removeAttribute("aria-current"); }
        });
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
    }
  }

  /* Move keyboard/screen-reader focus to the section a hash link scrolled to. */
  function initHashFocus() {
    function focusHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      var t = id && document.getElementById(id);
      if (t) {
        if (!t.hasAttribute("tabindex")) { t.setAttribute("tabindex", "-1"); }
        t.focus({ preventScroll: true });
      }
    }
    window.addEventListener("hashchange", focusHash);
    if (location.hash) { setTimeout(focusHash, 150); }
  }

  function initReveal() {
    var items = $$("[data-reveal]");
    if (!items.length) { return; }
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (n) { n.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* =====================================================================
     Service + time selects (shared by hero card and request form)
     ===================================================================== */
  function fillServiceSelect(select, placeholder) {
    var groups = {}, order = [];
    C.services.forEach(function (s) {
      if (!groups[s.group]) { groups[s.group] = []; order.push(s.group); }
      groups[s.group].push(s);
    });
    var html = '<option value="">' + esc(placeholder) + "</option>";
    order.forEach(function (g) {
      html += '<optgroup label="' + esc(g) + '">';
      groups[g].forEach(function (s) { html += '<option value="' + esc(s.id) + '">' + esc(s.title) + "</option>"; });
      html += "</optgroup>";
    });
    select.innerHTML = html;
  }
  function serviceTitle(id) {
    for (var i = 0; i < C.services.length; i++) { if (C.services[i].id === id) { return C.services[i].title; } }
    return id;
  }

  /*
   * Time choices for a date.
   *  - Scheduling system connected: ONLY the slots it reports as free.
   *  - Not connected: opening-hours windows, which are preferences, not confirmed availability.
   */
  function makeTimePicker(select, hint, placeholder, onChange) {
    var seq = 0;
    var state = { times: [], loading: false, verified: false, fellBack: false, date: "", serviceId: "" };
    var live = !!C.integrations.availabilityEndpoint;

    function hintText() {
      if (!state.date) { return "Choose a date first."; }
      if (state.loading) { return "Checking availability\u2026"; }
      if (state.verified) {
        if (!state.serviceId) { return "Choose a service first."; }
        return state.times.length ? "" : "No free slots on this date. Please try another day.";
      }
      if (state.fellBack) { return "We couldn\u2019t load live availability. Choose a preferred time and the clinic will confirm."; }
      return state.times.length ? "Within opening hours. The clinic will confirm the exact time." : "No more times today. Please choose another date.";
    }
    function render() {
      var keep = select.value;
      var label = state.loading ? "Loading\u2026" : (state.verified ? "Select available time" : placeholder);
      var html = '<option value="">' + esc(label) + "</option>";
      state.times.forEach(function (t) { html += '<option value="' + t + '">' + t + "</option>"; });
      select.innerHTML = html;
      select.value = state.times.indexOf(keep) !== -1 ? keep : "";
      select.disabled = !state.date || state.loading;
      if (hint) { hint.textContent = hintText(); hint.hidden = !hint.textContent; }
      if (onChange) { onChange(state); }
    }
    function update(date, serviceId) {
      var my = ++seq;
      state = { times: [], loading: false, verified: false, fellBack: false, date: date, serviceId: serviceId };
      if (!date) { return render(); }
      if (!live) { state.times = openingTimes(date); return render(); }
      state.verified = true;
      if (!serviceId) { return render(); }
      state.loading = true;
      render();
      fetchSlots(date, serviceId).then(function (slots) {
        if (my !== seq) { return; }
        state.loading = false;
        if (slots) { state.times = slots; }
        else { state.verified = false; state.fellBack = true; state.times = openingTimes(date); }
        render();
      });
    }
    render();
    return { update: update, state: function () { return state; } };
  }

  /* =====================================================================
     Generic form engine: validation, touched/attempted state, submit lifecycle
     ===================================================================== */
  function setError(p, msg) {
    p.innerHTML = icon("alert-circle") + "<span></span>";
    p.lastChild.textContent = msg;
    p.hidden = false;
  }
  function fieldHtml(o) {
    return '<div class="field' + (o.cls ? " " + o.cls : "") + '">' +
      '<label for="' + o.id + '">' + o.label + (o.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(optional)</span>') + "</label>" +
      o.control +
      (o.hint ? '<p class="field__hint" id="' + o.id + '-hint"></p>' : "") +
      '<p class="field__error" id="' + o.id + '-error" role="alert" hidden></p></div>';
  }
  function consentHtml(prefix, purpose) {
    return '<div><div class="consent"><input type="checkbox" id="' + prefix + '-consent" aria-required="true" aria-describedby="' + prefix + '-consent-error" />' +
      '<label for="' + prefix + '-consent">I have read the <a href="privacy.html" target="_blank" rel="noopener">privacy notice</a> and agree that the clinic may use these details to ' + purpose + '. <span class="req" aria-hidden="true">*</span><span class="sr-only">(required)</span></label></div>' +
      '<p class="field__error" id="' + prefix + '-consent-error" role="alert" hidden></p></div>';
  }
  function honeypotHtml(prefix) {
    return '<div class="hp" aria-hidden="true"><label>Leave this field empty <input type="text" id="' + prefix + '-website" tabindex="-1" autocomplete="off" /></label></div>';
  }
  function submitRowHtml(prefix, label, cancel) {
    return '<div class="notice notice--error" id="' + prefix + '-form-error" role="alert" hidden>' + icon("alert-triangle") + "<span></span></div>" +
      '<div class="form-actions"><button class="btn btn--primary btn--lg" type="submit" id="' + prefix + '-submit">' + icon("send") + " <span>" + label + "</span></button>" +
      (cancel ? '<button class="btn btn--ghost" type="button" data-close>Cancel</button>' : "") + "</div>";
  }
  function notConnectedHtml(text) {
    return '<p class="notice notice--warn">' + icon("alert-triangle") + "<span>" + text + "</span></p>";
  }

  function formEngine(form, o) {
    var touched = {}, attempted = false, busy = false, startedAt = Date.now();
    var submitBtn = $("#" + o.prefix + "-submit", form);
    var formErr = $("#" + o.prefix + "-form-error", form);

    function ctl(k) { return $("#" + o.prefix + "-" + k, form); }
    function check() {
      var errs = o.validate(o.values(form));
      o.keys.forEach(function (k) {
        var c = ctl(k), p = $("#" + o.prefix + "-" + k + "-error", form);
        if (!c || !p) { return; }
        var msg = (touched[k] || attempted) ? errs[k] : "";
        if (msg) { setError(p, msg); c.setAttribute("aria-invalid", "true"); }
        else { p.hidden = true; p.textContent = ""; c.removeAttribute("aria-invalid"); }
      });
      return errs;
    }
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    form.addEventListener("focusout", function (e) {
      var id = e.target.id || "";
      if (id.indexOf(o.prefix + "-") !== 0) { return; }
      var k = id.slice(o.prefix.length + 1);
      if (o.keys.indexOf(k) !== -1) { touched[k] = true; check(); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) { return; }
      attempted = true;
      var errs = check();
      if (Object.keys(errs).length) {
        var bad = $('[aria-invalid="true"]', form);
        if (bad) { bad.focus(); }
        return;
      }
      var trap = $("#" + o.prefix + "-website", form);
      if (trap && trap.value) { o.onResult({ status: "success" }, o.values(form)); return; } /* bot trap: stop silently */

      busy = true;
      formErr.hidden = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      var label = $("span", submitBtn), original = label.textContent;
      submitBtn.firstChild.outerHTML = '<span class="spinner" aria-hidden="true"></span>';
      label.textContent = "Sending\u2026";

      var vals = o.values(form);
      o.send(vals, Date.now() - startedAt).then(function (result) {
        busy = false;
        if (result.status === "error") {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          var sp = $(".spinner", submitBtn);
          if (sp) { sp.outerHTML = icon("send"); }
          $("span", submitBtn).textContent = original;
          $("span", formErr).textContent = result.message + " If the problem continues, please contact the clinic directly.";
          formErr.hidden = false;
        } else {
          o.onResult(result, vals);
        }
      });
    });
    return { check: check, touch: function (k) { touched[k] = true; } };
  }

  /* Direct-contact options, shown only for details the clinic has actually supplied. */
  function contactActions() {
    var wrap = document.createElement("div");
    var tel = telHref(C.contact.phone), mail = mailHref(C.contact.email), wa = waHref(C.contact.whatsapp);
    if (!tel && !mail && !wa) {
      wrap.className = "notice notice--info";
      wrap.innerHTML = icon("info") + "<span>The clinic\u2019s contact details have not been added to this website yet.</span>";
      return wrap;
    }
    wrap.className = "contact-actions";
    function add(href, iconName, text, ext) {
      var a = document.createElement("a");
      a.className = "btn btn--outline btn--sm"; a.href = href;
      if (ext) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.innerHTML = icon(iconName) + " ";
      a.appendChild(document.createTextNode(text));
      wrap.appendChild(a);
    }
    if (tel) { add(tel, "phone", "Call " + C.contact.phone); }
    if (wa) { add(wa, "message-circle", "WhatsApp", true); }
    if (mail) { add(mail, "mail", "Email us"); }
    return wrap;
  }

  /* Result panel: replaces the form and moves focus to its heading. */
  function showPanel(host, o) {
    host.innerHTML =
      '<div class="status"><span class="status__icon' + (o.tone === "info" ? " status__icon--info" : "") + '">' + icon(o.tone === "info" ? "info" : "check-circle") + "</span>" +
      '<h3 tabindex="-1">' + o.title + '</h3><div class="status__body"></div><div class="form-actions" id="status-actions"></div></div>';
    var body = $(".status__body", host), actions = $("#status-actions", host);
    o.build(body, actions);
    $("h3", host).focus();
  }
  function actionButton(label, cls, handler, closeAttr) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn " + cls; b.textContent = label;
    if (closeAttr) { b.setAttribute("data-close", ""); }
    if (handler) { b.addEventListener("click", handler); }
    return b;
  }
  function para(text, strong) {
    var p = document.createElement("p");
    if (strong) { var s = document.createElement("strong"); s.textContent = text; p.appendChild(s); } else { p.textContent = text; }
    return p;
  }

  /* =====================================================================
     Appointment request modal
     ===================================================================== */
  var modal = null, modalBody = null, lastTrigger = null;

  function bookingFormHtml() {
    var notConnected = !C.integrations.bookingEndpoint;
    return '<form id="booking-form" novalidate aria-describedby="bk-disclaimer">' +
      '<p class="notice notice--info" id="bk-disclaimer">' + icon("calendar-check") + "<span><strong>This is an appointment request, not a confirmed booking.</strong> The clinic will contact you to confirm availability.</span></p>" +
      (notConnected ? notConnectedHtml("Online submission isn\u2019t connected to the clinic yet. You can complete this form to see how it will work, but nothing will be sent until the clinic switches it on.") : "") +
      '<div class="form-grid" style="margin-top:1.25rem">' +
      fieldHtml({ id: "bk-name", label: "Full name", required: true, cls: "col-span-2", control: '<input class="control" id="bk-name" type="text" autocomplete="name" maxlength="100" aria-required="true" aria-describedby="bk-name-error" />' }) +
      fieldHtml({ id: "bk-phone", label: "Contact number", required: true, control: '<input class="control" id="bk-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" aria-required="true" aria-describedby="bk-phone-error" />' }) +
      fieldHtml({ id: "bk-email", label: "Email address", required: true, control: '<input class="control" id="bk-email" type="email" inputmode="email" autocomplete="email" maxlength="254" aria-required="true" aria-describedby="bk-email-error" />' }) +
      fieldHtml({ id: "bk-serviceId", label: "Requested service", required: true, cls: "col-span-2", control: '<select class="control" id="bk-serviceId" aria-required="true" aria-describedby="bk-serviceId-error"></select>' }) +
      fieldHtml({ id: "bk-date", label: "Preferred date", required: true, control: '<input class="control" id="bk-date" type="date" min="' + todayISO() + '" max="' + addDaysISO(365) + '" aria-required="true" aria-describedby="bk-date-error" />' }) +
      fieldHtml({ id: "bk-time", label: '<span id="bk-time-label">Preferred time</span>', required: true, hint: true, control: '<select class="control" id="bk-time" disabled aria-required="true" aria-describedby="bk-time-hint bk-time-error"></select>' }) +
      fieldHtml({ id: "bk-message", label: "Message", required: false, hint: true, cls: "col-span-2", control: '<textarea class="control" id="bk-message" rows="3" maxlength="' + (MESSAGE_MAX + 50) + '" aria-describedby="bk-message-hint bk-message-error"></textarea>' }) +
      "</div>" +
      '<div style="margin-top:1.25rem">' + consentHtml("bk", "contact you about this appointment request") + "</div>" +
      honeypotHtml("bk") +
      '<div style="margin-top:1.25rem">' + submitRowHtml("bk", "Send appointment request", true) + "</div>" +
      "</form>";
  }

  function renderBookingForm(prefill) {
    prefill = prefill || {};
    modalBody.innerHTML = bookingFormHtml();
    var form = $("#booking-form", modalBody);
    var svc = $("#bk-serviceId", form), date = $("#bk-date", form), time = $("#bk-time", form);
    var msg = $("#bk-message", form), msgHint = $("#bk-message-hint", form);
    fillServiceSelect(svc, "Select a service");

    ["name", "phone", "email", "message"].forEach(function (k) { if (prefill[k]) { $("#bk-" + k, form).value = prefill[k]; } });
    if (prefill.serviceId) { svc.value = prefill.serviceId; }
    if (prefill.date) { date.value = prefill.date; }

    var engine;
    var picker = makeTimePicker(time, $("#bk-time-hint", form), "Select a time", function (s) {
      $("#bk-time-label", form).textContent = s.verified ? "Available time" : "Preferred time";
      if (engine) { engine.check(); }
    });
    function refreshMsgHint() { msgHint.textContent = "Please don\u2019t include detailed medical information here. " + msg.value.length + "/" + MESSAGE_MAX; }
    refreshMsgHint();
    msg.addEventListener("input", refreshMsgHint);

    function refreshTimes() { picker.update(date.value, svc.value); }
    date.addEventListener("change", refreshTimes);
    date.addEventListener("input", refreshTimes);
    svc.addEventListener("change", refreshTimes);
    refreshTimes();
    if (prefill.time && picker.state().times.indexOf(prefill.time) !== -1) { time.value = prefill.time; }

    engine = formEngine(form, {
      prefix: "bk",
      keys: ["name", "phone", "email", "serviceId", "date", "time", "message", "consent"],
      values: function () {
        return {
          name: $("#bk-name", form).value, phone: $("#bk-phone", form).value, email: $("#bk-email", form).value,
          serviceId: svc.value, date: date.value, time: time.value, message: msg.value, consent: $("#bk-consent", form).checked
        };
      },
      validate: function (v) {
        var s = picker.state(), e = {};
        e.name = vName(v.name);
        e.phone = vPhone(v.phone, true);
        e.email = vEmail(v.email, true);
        e.serviceId = v.serviceId ? undefined : "Please select a service.";
        e.date = vDate(v.date);
        if (!v.time) { e.time = "Please choose a preferred time."; }
        else if (!s.loading && s.times.indexOf(v.time) === -1) { e.time = "That time is not available. Please pick another."; }
        e.message = vMessage(v.message, false);
        if (!v.consent) { e.consent = CONSENT_MSG; }
        return compact(e);
      },
      send: function (v, elapsed) {
        return submitTo(C.integrations.bookingEndpoint, {
          name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim(),
          serviceId: v.serviceId, serviceTitle: serviceTitle(v.serviceId),
          date: v.date, time: v.time, message: v.message.trim(),
          consentToPrivacyNotice: true, website: "", elapsedMs: elapsed
        });
      },
      onResult: function (result, v) {
        if (result.status === "success") {
          showPanel(modalBody, {
            title: "Request received",
            build: function (body, actions) {
              var first = v.name.trim().split(/\s+/)[0];
              body.appendChild(para("Thank you" + (first ? ", " + first : "") + ". Your appointment request has been sent to the clinic."));
              var sum = para("You asked for " + longDate(v.date) + " at " + v.time + ".");
              sum.className = "status__summary";
              body.appendChild(sum);
              body.appendChild(para("This is not a confirmed appointment yet. The clinic will contact you to confirm availability.", true));
              actions.appendChild(actionButton("Close", "btn--primary", null, true));
            }
          });
        } else {
          showPanel(modalBody, {
            tone: "info",
            title: "Online requests aren\u2019t switched on yet",
            build: function (body, actions) {
              body.appendChild(para("Nothing was sent.", true));
              body.appendChild(para("This website isn\u2019t connected to the clinic\u2019s booking system yet, so your details have not been stored or delivered. Please contact the clinic directly to request your appointment:"));
              var ca = contactActions(); ca.style.justifyContent = "center"; body.appendChild(ca);
              actions.appendChild(actionButton("Back to form", "btn--outline", function () { renderBookingForm(v); }));
              actions.appendChild(actionButton("Close", "btn--ghost", null, true));
            }
          });
        }
      }
    });
  }

  function trapKeys(e) {
    if (e.key === "Escape") { closeBooking(); return; }
    if (e.key !== "Tab") { return; }
    var dlg = $(".modal__dialog", modal);
    var items = $$('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dlg)
      .filter(function (n) { return n.offsetParent !== null; });
    if (!items.length) { return; }
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openBooking(prefill, trigger) {
    if (!modal) { return; }
    lastTrigger = trigger || document.activeElement;
    renderBookingForm(prefill);
    var sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sb) { document.body.style.paddingRight = sb + "px"; }
    modal.hidden = false;
    document.addEventListener("keydown", trapKeys);
    var first = $("#bk-name", modalBody);
    if (first) { first.focus(); }
  }
  function closeBooking() {
    if (!modal || modal.hidden) { return; }
    modal.hidden = true;
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    document.removeEventListener("keydown", trapKeys);
    if (lastTrigger && document.contains(lastTrigger) && lastTrigger.focus) { lastTrigger.focus(); }
  }

  function initBooking() {
    modal = document.createElement("div");
    modal.className = "modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal__backdrop" data-close></div>' +
      '<div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title" tabindex="-1">' +
      '<button class="modal__close" type="button" data-close aria-label="Close appointment request form">' + icon("x") + "</button>" +
      '<h2 id="booking-title">Request an <span class="accent">appointment</span></h2><div id="booking-body"></div></div>';
    document.body.appendChild(modal);
    modalBody = $("#booking-body", modal);

    modal.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) { closeBooking(); } });
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-book]");
      if (!t) { return; }
      e.preventDefault();
      openBooking({ serviceId: t.getAttribute("data-service") || "" }, t);
    });
  }

  /* =====================================================================
     Hero quick-start card: collects preferences, opens the full request form.
     It never claims a slot exists unless a real scheduling system said so.
     ===================================================================== */
  function initHeroCard() {
    var form = $("#hero-booking");
    if (!form) { return; }
    var svc = $("#hc-service"), date = $("#hc-date"), time = $("#hc-time");
    var dateErr = $("#hc-date-error"), label = $("#hc-submit-label"), intro = $("#hero-card-intro");
    fillServiceSelect(svc, "Select Service");
    date.min = todayISO();
    date.max = addDaysISO(365);

    if (C.integrations.availabilityEndpoint) {
      intro.textContent = "Select a service, date and time to find available slots.";
      label.textContent = "Find Available Slots";
    }
    var picker = makeTimePicker(time, $("#hc-time-hint"), "Select Time");
    function pastDate() { return date.value !== "" && date.value < todayISO(); }
    function refresh() {
      if (pastDate()) {
        setError(dateErr, "Please choose today or a later date.");
        date.setAttribute("aria-invalid", "true");
        picker.update("", svc.value);
      } else {
        dateErr.hidden = true; dateErr.textContent = ""; date.removeAttribute("aria-invalid");
        picker.update(date.value, svc.value);
      }
    }
    date.addEventListener("change", refresh);
    date.addEventListener("input", refresh);
    svc.addEventListener("change", refresh);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (pastDate()) { date.focus(); return; }
      var t = time.value && picker.state().times.indexOf(time.value) !== -1 ? time.value : "";
      openBooking({ serviceId: svc.value, date: date.value, time: t }, $("#hc-submit"));
    });
  }

  /* =====================================================================
     Contact form
     ===================================================================== */
  function initContactForm() {
    var host = $("#contact-form-host");
    if (!host) { return; }

    function render(prefill) {
      prefill = prefill || {};
      var notConnected = !C.integrations.contactEndpoint;
      host.innerHTML = '<form id="contact-form" novalidate aria-label="Contact form">' +
        (notConnected ? notConnectedHtml("This form isn\u2019t connected to the clinic yet, so nothing will be sent until it is switched on.") : "") +
        '<div class="form-grid"' + (notConnected ? ' style="margin-top:1.25rem"' : "") + ">" +
        fieldHtml({ id: "ct-name", label: "Full name", required: true, control: '<input class="control" id="ct-name" type="text" autocomplete="name" maxlength="100" aria-required="true" aria-describedby="ct-name-error" />' }) +
        fieldHtml({ id: "ct-email", label: "Email address", required: true, control: '<input class="control" id="ct-email" type="email" inputmode="email" autocomplete="email" maxlength="254" aria-required="true" aria-describedby="ct-email-error" />' }) +
        fieldHtml({ id: "ct-phone", label: "Phone number", required: false, cls: "col-span-2", control: '<input class="control" id="ct-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" aria-describedby="ct-phone-error" />' }) +
        fieldHtml({ id: "ct-message", label: "Message", required: true, hint: true, cls: "col-span-2", control: '<textarea class="control" id="ct-message" rows="5" maxlength="' + (MESSAGE_MAX + 50) + '" aria-required="true" aria-describedby="ct-message-hint ct-message-error"></textarea>' }) +
        "</div>" +
        '<div style="margin-top:1.25rem">' + consentHtml("ct", "respond to this message") + "</div>" +
        honeypotHtml("ct") +
        '<div style="margin-top:1.25rem">' + submitRowHtml("ct", "Send message", false) + "</div></form>";

      var form = $("#contact-form", host), msg = $("#ct-message", form), hint = $("#ct-message-hint", form);
      ["name", "email", "phone", "message"].forEach(function (k) { if (prefill[k]) { $("#ct-" + k, form).value = prefill[k]; } });
      function refreshHint() { hint.textContent = "Please don\u2019t include detailed medical information. " + msg.value.length + "/" + MESSAGE_MAX; }
      refreshHint();
      msg.addEventListener("input", refreshHint);

      formEngine(form, {
        prefix: "ct",
        keys: ["name", "email", "phone", "message", "consent"],
        values: function () {
          return { name: $("#ct-name", form).value, email: $("#ct-email", form).value, phone: $("#ct-phone", form).value, message: msg.value, consent: $("#ct-consent", form).checked };
        },
        validate: function (v) {
          var e = { name: vName(v.name), email: vEmail(v.email, true), phone: vPhone(v.phone, false), message: vMessage(v.message, true) };
          if (!v.consent) { e.consent = CONSENT_MSG; }
          return compact(e);
        },
        send: function (v, elapsed) {
          return submitTo(C.integrations.contactEndpoint, {
            name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), message: v.message.trim(),
            consentToPrivacyNotice: true, website: "", elapsedMs: elapsed
          });
        },
        onResult: function (result, v) {
          if (result.status === "success") {
            showPanel(host, {
              title: "Message sent",
              build: function (body) { body.appendChild(para("Thank you. The clinic will get back to you as soon as possible.")); }
            });
          } else {
            showPanel(host, {
              tone: "info",
              title: "Online messages aren\u2019t switched on yet",
              build: function (body, actions) {
                body.appendChild(para("Nothing was sent.", true));
                body.appendChild(para("Please contact the clinic directly:"));
                var ca = contactActions(); ca.style.justifyContent = "center"; body.appendChild(ca);
                actions.appendChild(actionButton("Back to form", "btn--ghost", function () { render(v); }));
              }
            });
          }
        }
      });
    }
    render();
  }

  /* =====================================================================
     Init
     ===================================================================== */
  function init() {
    initYear();
    initLogo();
    initImageSlots();
    initContactDetails();
    initHeader();
    initHashFocus();
    initBooking();
    initHeroCard();
    initContactForm();
    initReveal();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
