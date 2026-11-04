(function () {
  "use strict";
  var KEY = "deficit-tracker-v1",
    KCAL_KG = 7700,
    LB = 0.45359237;
  var S = { plan: null, logs: {}, weights: [] };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && typeof o === "object") S = Object.assign(S, o);
    }
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  }
  var $ = function (i) {
    return document.getElementById(i);
  };
  function el(t, a) {
    var n = document.createElement(t);
    a = a || {};
    for (var k in a) {
      if (k === "text") n.textContent = a[k];
      else if (k === "cls") n.className = a[k];
      else if (k === "on") n.addEventListener(a.on[0], a.on[1]);
      else n.setAttribute(k, a[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c != null)
        n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }
  function clear(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
  }
  /* Strict number parser: digits with at most one decimal point.
     Rejects "", "abc", "-5", "1e3", "0x10", "Infinity", "5,5". */
  function num(v) {
    v = String(v).trim();
    return /^(\d+\.?\d*|\.\d+)$/.test(v) ? Number(v) : NaN;
  }

  /* Numeric-only fields: block letters, symbols and minus signs as the user
     types or pastes. Whole-number fields also block the decimal point. */
  var NUM_IDS = {
    age: 1,
    h1: 1,
    h2: 1,
    wt: 1,
    gw: 1,
    mo: 1,
    fc: 1,
    fp: 1,
    fb: 1,
    ff: 1,
    xm: 1,
    ww: 1,
  };
  var INT_IDS = { age: 1, mo: 1 };
  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (NUM_IDS[t.id] === 1)
      t.setAttribute("inputmode", INT_IDS[t.id] ? "numeric" : "decimal");
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (NUM_IDS[t.id] !== 1) return;
    var v = t.value;
    if (INT_IDS[t.id]) v = v.replace(/[^0-9]/g, "");
    else {
      v = v.replace(/[^0-9.]/g, "");
      var i = v.indexOf(".");
      if (i > -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
    }
    if (v !== t.value) t.value = v;
  });
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function todayStr() {
    var d = new Date();
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }
  function validDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return false;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return (
      d.getFullYear() == +m[1] &&
      d.getMonth() == +m[2] - 1 &&
      d.getDate() == +m[3] &&
      +m[1] >= 2000 &&
      +m[1] <= 2100
    );
  }
  function utc(s) {
    var p = s.split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function diffDays(a, b) {
    return Math.round((utc(b) - utc(a)) / 864e5);
  }
  function addMonths(s, n) {
    var p = s.split("-"),
      y = +p[0],
      m = +p[1] - 1,
      d = +p[2],
      x = new Date(y, m + n, d);
    if (x.getDate() !== d) x = new Date(y, m + n + 1, 0);
    return (
      x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate())
    );
  }
  function addDays(s, n) {
    var p = s.split("-"),
      x = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return (
      x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate())
    );
  }
  function fd(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  var r0 = function (x) {
    return Math.round(x);
  };
  function wtxt(kg, p) {
    var u = (p || S.plan || { wu: "kg" }).wu;
    return u === "lb" ? (kg / LB).toFixed(1) + " lb" : kg.toFixed(1) + " kg";
  }

  var ACT = [
    [1.2, "Sedentary: desk work, little walking"],
    [1.375, "Light: on your feet part of the day"],
    [1.55, "Moderate: active job or lots of walking"],
    [1.725, "High: physically demanding work"],
  ];
  var EX = [
    ["Jump rope, moderate pace", 11.8],
    ["Jump rope, fast pace", 12.3],
    ["Bodyweight circuit, light to moderate", 3.5],
    ["Bodyweight circuit, vigorous", 8],
    ["Walking, brisk", 4.3],
    ["Running, 8 km/h", 8.3],
    ["Cycling, moderate", 7.5],
  ];
  ACT.forEach(function (a, i) {
    $("act").appendChild(el("option", { value: i, text: a[1] }));
  });

  /* ---------- calculations ---------- */
  var MAX_SURPLUS = 500; /* kcal per day, steady gain limit */
  function compute(p) {
    var type = p.type || "lose";
    var bmr = 10 * p.kg + 6.25 * p.cm - 5 * p.age + (p.sex === "m" ? 5 : -161);
    var tdee = bmr * ACT[p.act][0];
    var end = addMonths(p.start, p.months),
      days = diffDays(p.start, end);
    var change = type === "maintain" ? 0 : Math.abs(p.goal - p.kg),
      reqAdj = (change * KCAL_KG) / days;
    var floor = p.sex === "m" ? 1500 : 1200;
    var cap =
      type === "lose"
        ? Math.min(1000, tdee - floor)
        : type === "gain"
          ? MAX_SURPLUS
          : 0;
    var adj = Math.max(0, Math.min(reqAdj, cap));
    var ok = reqAdj <= cap + 1e-9;
    var target = type === "gain" ? tdee + adj : tdee - adj;
    var projDays = adj > 0 ? (change * KCAL_KG) / adj : Infinity;
    var m = p.cm / 100,
      bmi = p.kg / (m * m),
      gbmi = p.goal / (m * m);
    var protein = Math.min(1.6 * p.kg, (target * 0.35) / 4),
      fatKcal = 0.25 * target,
      fat = fatKcal / 9;
    var carbs = Math.max(0, (target - protein * 4 - fatKcal) / 4);
    return {
      type: type,
      bmr: bmr,
      tdee: tdee,
      end: end,
      days: days,
      change: change,
      reqAdj: reqAdj,
      adj: adj,
      ok: ok,
      target: target,
      floor: floor,
      weekly: (adj * 7) / KCAL_KG,
      projDays: projDays,
      bmi: bmi,
      gbmi: gbmi,
      protein: protein,
      fat: fat,
      carbs: carbs,
    };
  }
  function latestKg() {
    var w = S.weights.slice().sort(function (a, b) {
      return a.d < b.d ? -1 : 1;
    });
    return w.length ? w[w.length - 1].kg : S.plan.kg;
  }
  function exKcal(met, kg, min) {
    return (met * kg * min) / 60;
  }
  function dayLog(d) {
    return S.logs[d] || (S.logs[d] = { f: [], x: [] });
  }
  function totals(d) {
    var L = S.logs[d] || { f: [], x: [] },
      t = { c: 0, p: 0, cb: 0, ft: 0, b: 0 };
    L.f.forEach(function (e) {
      t.c += e.c;
      t.p += e.p || 0;
      t.cb += e.cb || 0;
      t.ft += e.ft || 0;
    });
    L.x.forEach(function (e) {
      t.b += e.k;
    });
    return t;
  }
  function budget(d) {
    var c = compute(S.plan);
    return c.target + (S.plan.eat / 100) * totals(d).b;
  }

  /* ---------- tabs ---------- */
  var tabs = document.querySelectorAll("nav button");
  function show(t) {
    tabs.forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.t === t);
    });
    ["plan", "today", "prog"].forEach(function (s) {
      $(s).hidden = s !== t;
    });
    if (t === "today") renderToday();
    if (t === "prog") renderProg();
    if (t === "plan") renderPlan();
  }
  tabs.forEach(function (b) {
    b.addEventListener("click", function () {
      show(b.dataset.t);
    });
  });

  /* ---------- plan form ---------- */
  $("sd").value = todayStr();
  function syncH() {
    var c = $("hu").value === "cm";
    $("h2").hidden = c;
    $("h1").setAttribute("aria-label", c ? "centimetres" : "feet");
  }
  $("hu").addEventListener("change", function () {
    var to = $("hu").value,
      a = num($("h1").value),
      b = num($("h2").value || 0);
    if (to === "cm") {
      var cm = (a * 12 + (isNaN(b) ? 0 : b)) * 2.54;
      $("h1").value = isFinite(cm) ? cm.toFixed(1) : "";
    } else {
      var inch = a / 2.54;
      if (isFinite(inch)) {
        $("h1").value = Math.floor(inch / 12);
        $("h2").value = (inch % 12).toFixed(1);
      }
    }
    syncH();
  });
  $("wu").addEventListener("change", function () {
    var to = $("wu").value;
    ["wt", "gw"].forEach(function (i) {
      var v = num($(i).value);
      if (isFinite(v)) $(i).value = (to === "lb" ? v / LB : v * LB).toFixed(1);
    });
  });
  syncH();
  function syncGoal() {
    $("gw").parentNode.hidden = $("gl").value === "maintain";
  }
  $("gl").addEventListener("change", function () {
    var t = $("gl").value,
      wt = num($("wt").value),
      g = num($("gw").value);
    $("eat").value = t === "lose" ? "50" : "100";
    if (isFinite(wt)) {
      if (t === "gain" && !(g > wt)) $("gw").value = (wt * 1.05).toFixed(1);
      else if (t === "lose" && !(g < wt)) $("gw").value = (wt * 0.9).toFixed(1);
    }
    syncGoal();
  });
  syncGoal();
  function fillForm(p) {
    $("gl").value = p.type || "lose";
    $("sex").value = p.sex;
    $("age").value = p.age;
    $("wu").value = p.wu;
    $("hu").value = p.hu;
    if (p.hu === "cm") {
      $("h1").value = +p.cm.toFixed(1);
    } else {
      var i = p.cm / 2.54;
      $("h1").value = Math.floor(i / 12);
      $("h2").value = +(i % 12).toFixed(1);
    }
    $("wt").value = +(p.wu === "lb" ? p.kg / LB : p.kg).toFixed(1);
    $("gw").value = +(p.wu === "lb" ? p.goal / LB : p.goal).toFixed(1);
    $("mo").value = p.months;
    $("sd").value = p.start;
    $("act").value = p.act;
    $("eat").value = p.eat;
    syncGoal();
    syncH();
  }
  $("pf").addEventListener("submit", function (e) {
    e.preventDefault();
    var errs = [],
      type = $("gl").value,
      wu = $("wu").value,
      hu = $("hu").value,
      k = wu === "lb" ? LB : 1;
    var age = num($("age").value),
      wt = num($("wt").value) * k,
      gw = num($("gw").value) * k,
      mo = num($("mo").value),
      sd = $("sd").value,
      cm;
    if (hu === "cm") cm = num($("h1").value);
    else {
      var ft = num($("h1").value),
        inch = num($("h2").value === "" ? "0" : $("h2").value);
      if (!isFinite(ft) || ft < 1 || !isFinite(inch) || inch < 0 || inch >= 12)
        errs.push(
          "Enter height as numbers: feet of at least 1, and inches from 0 to 11.9.",
        );
      cm = (ft * 12 + inch) * 2.54;
    }
    if (type === "maintain") gw = wt;
    if (!isFinite(age) || age % 1 !== 0 || age < 18 || age > 80)
      errs.push(
        "Age must be a whole number from 18 to 80. This tool is for adults.",
      );
    if (!isFinite(cm) || cm < 120 || cm > 230)
      errs.push(
        "Height must be between 120 and 230 cm (about 3 ft 11 in to 7 ft 7 in).",
      );
    if (!isFinite(wt) || wt < 35 || wt > 300)
      errs.push("Current weight must be between 35 and 300 kg (77 to 661 lb).");
    if (!isFinite(mo) || mo % 1 !== 0 || mo < 1 || mo > 24)
      errs.push("Duration must be a whole number of months from 1 to 24.");
    if (!validDate(sd)) errs.push("Enter a valid start date.");
    if (type !== "maintain") {
      var m2 = Math.pow(cm / 100, 2);
      if (!isFinite(gw) || gw / k < 1)
        errs.push("Goal weight must be a number of at least 1.");
      else if (type === "lose") {
        if (isFinite(wt) && gw >= wt)
          errs.push(
            "Goal weight must be lower than your current weight to lose weight.",
          );
        else if (isFinite(cm) && gw < 18.5 * m2 - 1e-9)
          errs.push(
            "Goal weight is below a BMI of 18.5 for your height. The lowest allowed is " +
              wtxt(18.5 * m2, { wu: wu }) +
              ".",
          );
      } else {
        if (isFinite(wt) && gw <= wt)
          errs.push(
            "Goal weight must be higher than your current weight to gain weight.",
          );
        else if (isFinite(cm) && gw > 30 * m2 + 1e-9)
          errs.push(
            "Goal weight is above a BMI of 30 for your height. The highest allowed is " +
              wtxt(30 * m2, { wu: wu }) +
              ".",
          );
      }
    }
    var box = $("perr");
    if (errs.length) {
      clear(box);
      var u = el("ul");
      errs.forEach(function (m) {
        u.appendChild(el("li", { text: m }));
      });
      box.appendChild(u);
      box.hidden = false;
      return;
    }
    box.hidden = true;
    var p = {
      sex: $("sex").value,
      age: age,
      wu: wu,
      hu: hu,
      cm: cm,
      kg: wt,
      goal: gw,
      months: mo,
      start: sd,
      type: type,
      act: +$("act").value,
      eat: +$("eat").value,
    };
    S.plan = p;
    S.weights = S.weights.filter(function (w) {
      return w.d !== sd;
    });
    S.weights.push({ d: sd, kg: wt });
    save();
    renderPlan();
    $("pres").scrollIntoView({ behavior: "smooth" });
  });

  function row(a, b, c) {
    return el(
      "tr",
      {},
      el("td", {}, a, c ? el("div", { cls: "mut", text: c }) : null),
      el("td", { text: b }),
    );
  }
  function renderPlan() {
    var host = $("pres");
    clear(host);
    var p = S.plan;
    if (!p) return;
    fillForm(p);
    var c = compute(p);
    var card = el("div", { cls: "card" }, el("h2", { text: "Your plan" }));
    var type = c.type,
      lose = type === "lose",
      verb = lose ? "lose" : "gain";
    if (!c.ok)
      card.appendChild(
        el("div", {
          cls: "note w",
          text: !isFinite(c.projDays)
            ? "Your maintenance calories are at the minimum safe intake of " +
              c.floor +
              " kcal, so a deficit is not available."
            : "Reaching " +
              wtxt(p.goal) +
              " by " +
              fd(c.end) +
              " would need " +
              r0(c.reqAdj) +
              " kcal " +
              (lose ? "below" : "above") +
              " maintenance each day, which is " +
              (lose
                ? "past the safe limit for you"
                : "more than the " +
                  MAX_SURPLUS +
                  " kcal per day this app allows for a steady gain") +
              ". Intake is capped at " +
              r0(c.target) +
              " kcal per day" +
              (lose ? " (never below " + c.floor + " kcal)" : "") +
              ". At that pace you would reach your goal in about " +
              Math.ceil(c.projDays) +
              " days, around " +
              fd(addDays(p.start, Math.ceil(c.projDays))) +
              ". Consider a longer duration or a closer goal weight.",
        }),
      );
    if (type !== "maintain" && c.weekly > (lose ? 0.01 : 0.005) * p.kg)
      card.appendChild(
        el("div", {
          cls: "note w",
          text:
            "This plan " +
            (lose ? "loses" : "gains") +
            " about " +
            c.weekly.toFixed(2) +
            " kg per week, which is more than " +
            (lose ? "1%" : "0.5%") +
            " of body weight. " +
            (lose
              ? "A slower pace is easier to sustain."
              : "Faster gains tend to add more fat than muscle."),
        }),
      );
    var rows = [
      row(
        "Basal metabolic rate (Mifflin-St Jeor)",
        r0(c.bmr) + " kcal",
        "10 x kg + 6.25 x cm - 5 x age " + (p.sex === "m" ? "+ 5" : "- 161"),
      ),
      row(
        "Maintenance (BMR x " + ACT[p.act][0] + ")",
        r0(c.tdee) + " kcal",
        "Calories to hold your weight, before logged workouts",
      ),
    ];
    if (type === "maintain") {
      rows.push(
        row("Goal", "Maintain " + wtxt(p.kg)),
        row("Tracking period", c.days + " days", "Ends " + fd(c.end)),
        row(
          "Daily calorie target",
          r0(c.target) + " kcal",
          "Same as maintenance",
        ),
      );
    } else {
      rows.push(
        row("Weight to " + verb, wtxt(c.change)),
        row("Plan length", c.days + " days", "Ends " + fd(c.end)),
        row(
          "Daily " + (lose ? "deficit" : "surplus") + " used",
          r0(c.adj) + " kcal",
          "Weight to " + verb + " x 7,700 kcal per kg, divided by days",
        ),
        row(
          "Daily calorie target",
          r0(c.target) + " kcal",
          "Maintenance " + (lose ? "minus deficit" : "plus surplus"),
        ),
        row(
          "Expected " + (lose ? "loss" : "gain") + " per week",
          c.weekly.toFixed(2) + " kg",
        ),
      );
    }
    rows.push(
      row("BMI now / at goal", c.bmi.toFixed(1) + " / " + c.gbmi.toFixed(1)),
      row("Protein", r0(c.protein) + " g", "1.6 g per kg of body weight"),
      row("Fat", r0(c.fat) + " g", "25% of target calories"),
      row("Carbs", r0(c.carbs) + " g", "The remaining calories"),
    );
    var t = el("table", {});
    rows.forEach(function (r) {
      t.appendChild(r);
    });
    card.appendChild(el("div", { cls: "scroll" }, t));
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Estimates only. Real results vary, so use your weekly weigh-ins to adjust. If you have a medical condition, check with a doctor before changing your calorie intake for a long period.",
      }),
    );
    card.appendChild(
      el("button", {
        cls: "btn",
        type: "button",
        text: "Open daily log",
        on: [
          "click",
          function () {
            show("today");
          },
        ],
      }),
    );
    host.appendChild(card);
  }

  /* ---------- daily log ---------- */
  var viewDate = todayStr();
  function needPlan(host) {
    if (S.plan) return false;
    clear(host);
    host.appendChild(
      el("div", {
        cls: "card",
        text: "Save your plan first. Your calorie target and day count come from it.",
      }),
    );
    return true;
  }
  function renderToday() {
    var host = $("today");
    if (needPlan(host)) return;
    clear(host);
    var p = S.plan,
      c = compute(p),
      d = viewDate,
      L = dayLog(d),
      t = totals(d),
      bud = budget(d),
      left = bud - t.c,
      dayN = diffDays(p.start, d) + 1;
    var dc = el("div", { cls: "card" });
    dc.appendChild(
      el(
        "label",
        { text: "Date" },
        el("input", {
          type: "date",
          id: "vd",
          value: d,
          on: [
            "change",
            function (e) {
              var v = e.target.value;
              if (validDate(v)) {
                viewDate = v;
                renderToday();
              } else e.target.value = viewDate;
            },
          ],
        }),
      ),
    );
    dc.appendChild(
      el("p", {
        cls: "mut",
        text:
          dayN < 1
            ? "This date is before your start date."
            : dayN > c.days
              ? "Day " + dayN + ", past your planned " + c.days + " days."
              : "Day " + dayN + " of " + c.days,
      }),
    );
    var gtype = p.type || "lose",
      over = left < 0 && gtype !== "gain";
    dc.appendChild(
      el(
        "div",
        { cls: "hero" },
        el("span", {
          cls: "big num" + (over ? " over" : ""),
          text: String(r0(Math.abs(left))),
        }),
        el("span", {
          text:
            left < 0
              ? gtype === "gain"
                ? "kcal above target"
                : "kcal over budget"
              : gtype === "gain"
                ? "kcal to reach target"
                : "kcal left",
        }),
      ),
    );
    var pct = Math.min(100, bud > 0 ? (t.c / bud) * 100 : 0);
    dc.appendChild(
      el(
        "div",
        { cls: "bar" },
        el("i", { cls: over ? "over" : "", style: "width:" + pct + "%" }),
      ),
    );
    dc.appendChild(
      el("div", {
        cls: "mut",
        text:
          "Eaten " +
          r0(t.c) +
          " of " +
          r0(bud) +
          " kcal budget (target " +
          r0(c.target) +
          (t.b ? " + " + r0((p.eat / 100) * t.b) + " from exercise" : "") +
          "). Burned in workouts: " +
          r0(t.b) +
          " kcal.",
      }),
    );
    dc.appendChild(
      el(
        "div",
        { cls: "mac" },
        el("span", {
          text: "Protein " + r0(t.p) + " / " + r0(c.protein) + " g",
        }),
        el("span", {
          text: "Carbs " + r0(t.cb) + " / " + r0(c.carbs) + " g",
        }),
        el("span", {
          text: "Fat " + r0(t.ft) + " / " + r0(c.fat) + " g",
        }),
      ),
    );
    host.appendChild(dc);

    /* food */
    var fc = el(
      "form",
      { cls: "card", novalidate: "novalidate" },
      el("h2", { text: "Add food" }),
    );
    var g = el("div", { cls: "grid" });
    g.appendChild(
      el(
        "label",
        { text: "Food name" },
        el("input", { id: "fn", maxlength: "60" }),
      ),
    );
    var ms = el("select", { id: "fm" });
    ["Breakfast", "Lunch", "Dinner", "Snack"].forEach(function (m) {
      ms.appendChild(el("option", { text: m }));
    });
    g.appendChild(el("label", { text: "Meal" }, ms));
    g.appendChild(
      el(
        "label",
        { text: "Calories (kcal)" },
        el("input", {
          id: "fc",

          inputmode: "decimal",
          step: "any",
        }),
      ),
    );
    g.appendChild(
      el(
        "label",
        { text: "Protein g (optional)" },
        el("input", { id: "fp", step: "any" }),
      ),
    );
    g.appendChild(
      el(
        "label",
        { text: "Carbs g (optional)" },
        el("input", { id: "fb", step: "any" }),
      ),
    );
    g.appendChild(
      el(
        "label",
        { text: "Fat g (optional)" },
        el("input", { id: "ff", step: "any" }),
      ),
    );
    fc.appendChild(g);
    var fe = el("div", { cls: "err", hidden: "hidden" });
    fc.appendChild(fe);
    fc.appendChild(
      el("button", { cls: "btn", type: "submit", text: "Add food" }),
    );
    fc.addEventListener("submit", function (e) {
      e.preventDefault();
      var errs = [],
        name = $("fn").value.trim(),
        cal = num($("fc").value);
      var mac = {};
      [
        ["fp", "Protein"],
        ["fb", "Carbs"],
        ["ff", "Fat"],
      ].forEach(function (m) {
        var raw = $(m[0]).value.trim();
        if (raw === "") {
          mac[m[0]] = 0;
          return;
        }
        var v = num(raw);
        if (!isFinite(v) || v < 1 || v > 500)
          errs.push(m[1] + " must be a number from 1 to 500 g, or left blank.");
        mac[m[0]] = v;
      });
      if (name.length < 1 || name.length > 60)
        errs.push("Food name is required (up to 60 characters).");
      if (!isFinite(cal) || cal < 1 || cal > 5000)
        errs.push("Calories must be between 1 and 5,000 kcal for one entry.");
      if (errs.length) {
        showErr(fe, errs);
        return;
      }
      L.f.push({
        n: name,
        m: $("fm").value,
        c: cal,
        p: mac.fp,
        cb: mac.fb,
        ft: mac.ff,
      });
      save();
      renderToday();
    });
    host.appendChild(fc);
    host.appendChild(
      listCard(
        "Food eaten",
        L.f,
        function (e) {
          return e.m + ": " + e.n;
        },
        function (e) {
          return r0(e.c) + " kcal";
        },
        function (i) {
          L.f.splice(i, 1);
          save();
          renderToday();
        },
      ),
    );

    /* exercise */
    var xc = el(
      "form",
      { cls: "card", novalidate: "novalidate" },
      el("h2", { text: "Add exercise" }),
    );
    var xg = el("div", { cls: "grid" });
    var xs = el("select", { id: "xa" });
    EX.forEach(function (x, i) {
      xs.appendChild(el("option", { value: i, text: x[0] }));
    });
    xg.appendChild(el("label", { text: "Activity" }, xs));
    xg.appendChild(
      el(
        "label",
        { text: "Minutes (1 to 600)" },
        el("input", {
          id: "xm",

          step: "any",
          value: "30",
        }),
      ),
    );
    xc.appendChild(xg);
    var xe = el("div", { cls: "err", hidden: "hidden" });
    xc.appendChild(xe);
    xc.appendChild(
      el("p", {
        cls: "mut",
        text:
          "Burn = MET x body weight (kg) x hours, using your latest weigh-in of " +
          wtxt(latestKg()) +
          ".",
      }),
    );
    xc.appendChild(
      el("button", { cls: "btn", type: "submit", text: "Add exercise" }),
    );
    xc.addEventListener("submit", function (e) {
      e.preventDefault();
      var m = num($("xm").value),
        ex = EX[+$("xa").value];
      if (!isFinite(m) || m < 1 || m > 600) {
        showErr(xe, ["Minutes must be between 1 and 600."]);
        return;
      }
      L.x.push({ n: ex[0], min: m, k: exKcal(ex[1], latestKg(), m) });
      save();
      renderToday();
    });
    host.appendChild(xc);
    host.appendChild(
      listCard(
        "Exercise done",
        L.x,
        function (e) {
          return e.n + ", " + e.min + " min";
        },
        function (e) {
          return r0(e.k) + " kcal";
        },
        function (i) {
          L.x.splice(i, 1);
          save();
          renderToday();
        },
      ),
    );
  }
  function showErr(box, errs) {
    clear(box);
    var u = el("ul");
    errs.forEach(function (m) {
      u.appendChild(el("li", { text: m }));
    });
    box.appendChild(u);
    box.hidden = false;
  }
  function listCard(title, arr, lab, val, del) {
    var c = el("div", { cls: "card" }, el("h2", { text: title }));
    if (!arr.length) {
      c.appendChild(
        el("p", { cls: "mut", text: "Nothing logged for this date." }),
      );
      return c;
    }
    var t = el("table");
    arr.forEach(function (e, i) {
      t.appendChild(
        el(
          "tr",
          {},
          el("td", { text: lab(e) }),
          el("td", { text: val(e) }),
          el(
            "td",
            {},
            el("button", {
              cls: "btn del",
              type: "button",
              "aria-label": "Delete entry",
              text: "Delete",
              on: [
                "click",
                function () {
                  del(i);
                },
              ],
            }),
          ),
        ),
      );
    });
    c.appendChild(el("div", { cls: "scroll" }, t));
    return c;
  }

  /* ---------- progress ---------- */
  function renderProg() {
    var host = $("prog");
    if (needPlan(host)) return;
    clear(host);
    var p = S.plan,
      c = compute(p),
      ws = S.weights.slice().sort(function (a, b) {
        return a.d < b.d ? -1 : 1;
      }),
      cur = ws[ws.length - 1].kg;
    var sc = el("div", { cls: "card" }, el("h2", { text: "Weight" }));
    var ptype = p.type || "lose",
      change = cur - p.kg,
      toGo = ptype === "gain" ? p.goal - cur : cur - p.goal,
      moved = ptype === "gain" ? change : -change,
      total = Math.abs(p.goal - p.kg),
      pc =
        ptype !== "maintain" && total > 0
          ? Math.max(0, Math.min(100, (moved / total) * 100))
          : 0;
    sc.appendChild(
      el("p", {
        text:
          "Now " +
          wtxt(cur) +
          ". Change since start: " +
          (change >= 0 ? "+" : "-") +
          wtxt(Math.abs(change)) +
          (ptype === "maintain"
            ? ". Target: stay near " + wtxt(p.kg) + "."
            : ". To goal: " + wtxt(Math.max(0, toGo)) + "."),
      }),
    );
    if (ptype !== "maintain")
      sc.appendChild(
        el("div", { cls: "bar" }, el("i", { style: "width:" + pc + "%" })),
      );
    var wf = el("form", { novalidate: "novalidate" });
    var g = el("div", { cls: "grid" });
    g.appendChild(
      el(
        "label",
        { text: "Date" },
        el("input", { id: "wd", type: "date", value: todayStr() }),
      ),
    );
    g.appendChild(
      el(
        "label",
        { text: "Weight (" + p.wu + ")" },
        el("input", { id: "ww", step: "any" }),
      ),
    );
    wf.appendChild(g);
    var we = el("div", { cls: "err", hidden: "hidden" });
    wf.appendChild(we);
    wf.appendChild(
      el("button", { cls: "btn", type: "submit", text: "Save weigh-in" }),
    );
    wf.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = $("wd").value,
        v = num($("ww").value) * (p.wu === "lb" ? LB : 1),
        errs = [];
      if (!validDate(d)) errs.push("Enter a valid date.");
      else if (d > todayStr())
        errs.push("Weigh-in date cannot be in the future.");
      if (!isFinite(v) || v < 35 || v > 300)
        errs.push("Weight must be between 35 and 300 kg (77 to 661 lb).");
      if (errs.length) {
        showErr(we, errs);
        return;
      }
      S.weights = S.weights.filter(function (w) {
        return w.d !== d;
      });
      S.weights.push({ d: d, kg: v });
      save();
      renderProg();
    });
    sc.appendChild(wf);
    var t = el(
      "table",
      {},
      el("tr", {}, el("th", { text: "Date" }), el("th", { text: "Weight" })),
    );
    ws.slice()
      .reverse()
      .forEach(function (w) {
        t.appendChild(
          el(
            "tr",
            {},
            el("td", { text: fd(w.d) }),
            el("td", { text: wtxt(w.kg) }),
          ),
        );
      });
    sc.appendChild(el("div", { cls: "scroll" }, t));
    host.appendChild(sc);

    var hc = el("div", { cls: "card" }, el("h2", { text: "Last 14 days" }));
    var ht = el(
      "table",
      {},
      el(
        "tr",
        {},
        el("th", { text: "Date" }),
        el("th", { text: "Eaten" }),
        el("th", { text: "Budget" }),
        el("th", { text: "Net" }),
      ),
    );
    var any = false,
      td = todayStr();
    for (var i = 0; i < 14; i++) {
      var d = addDays(td, -i);
      if (!S.logs[d] || (!S.logs[d].f.length && !S.logs[d].x.length)) continue;
      any = true;
      var t2 = totals(d),
        b = budget(d),
        n = t2.c - b;
      ht.appendChild(
        el(
          "tr",
          {},
          el("td", { text: fd(d) }),
          el("td", { text: r0(t2.c) }),
          el("td", { text: r0(b) }),
          el("td", { text: (n > 0 ? "+" : "") + r0(n) + " kcal" }),
        ),
      );
    }
    if (!any)
      hc.appendChild(
        el("p", {
          cls: "mut",
          text: "Log food in the Daily log tab to see your history.",
        }),
      );
    else {
      hc.appendChild(el("div", { cls: "scroll" }, ht));
      hc.appendChild(
        el("p", {
          cls: "mut",
          text: "Net is eaten minus budget. Negative means you ate less than your budget.",
        }),
      );
    }
    hc.appendChild(
      el("button", {
        cls: "btn alt",
        type: "button",
        text: "Reset all data",
        on: [
          "click",
          function (e) {
            var b = e.target;
            if (b.dataset.s) {
              S = { plan: null, logs: {}, weights: [] };
              save();
              location.reload();
            } else {
              b.dataset.s = "1";
              b.textContent = "Click again to erase everything";
            }
          },
        ],
      }),
    );
    host.appendChild(hc);
  }

  if (S.plan) renderPlan();
})();
