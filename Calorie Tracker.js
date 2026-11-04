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
    xv: 1,
    xr: 1,
    ww: 1,
  };
  var INT_IDS = { age: 1, mo: 1 };
  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (NUM_IDS[t.id] === 1)
      t.setAttribute("inputmode", INT_IDS[t.id] ? "numeric" : "decimal");
  });
  document.addEventListener(
    "input",
    function (e) {
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
    },
    true,
  );
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
  /* Exercise catalog: 2024 Adult Compendium of Physical Activities (gross METs).
     Net burn = (MET - 1) x kg x hours, because maintenance calories already
     count resting energy. Entries with k are speed based. */
  var MPH = 1.609344; /* km/h per mph */
  var HB = ["Beginner: moderate-effort intervals", 7.0];
  var EXG = [
    {
      n: "Jump rope",
      lv: [
        ["Beginner: 30 to 60 jumps per minute (estimate)", 6.0],
        ["Intermediate: 60 to 100 jumps per minute", 8.8],
        ["Advanced: 100 to 130 jumps per minute", 11.0],
        ["Expert: 130 to 160 jumps per minute", 12.3],
      ],
    },
    {
      n: "Bodyweight and calisthenics (squats, push-ups, crunches, lunges)",
      lv: [
        ["Beginner: light effort (crunches, planks)", 2.8],
        ["Intermediate: moderate effort (push-ups, sit-ups, lunges)", 3.8],
        ["Advanced: high intensity", 6.5],
        ["Expert: vigorous (burpees, jumping jacks, pull-ups)", 7.5],
      ],
    },
    {
      n: "Circuit training",
      lv: [
        ["Beginner: light effort", 3.5],
        ["Intermediate: moderate effort", 5.0],
        ["Advanced: bodyweight exercises", 6.0],
        ["Expert: vigorous, minimal rest", 7.5],
      ],
    },
    {
      n: "Weight training",
      subLabel: "Movement",
      sub: ["Push", "Pull", "Legs"],
      lv: [
        ["Beginner: light to moderate, 8 to 15 reps", 3.5],
        ["Intermediate: heavy compound lifts, slow or explosive", 5.0],
        ["Advanced: supersets or short rests", 5.8],
        ["Expert: vigorous powerlifting or bodybuilding", 6.0],
      ],
    },
    {
      n: "High intensity interval training (HIIT)",
      subLabel: "HIIT type",
      sub: [
        "Cardio",
        "Bodyweight (calisthenics)",
        "With free weights",
        "Machine-based",
        "Plyometric",
        "Swimming or hybrid",
      ],
      lvBy: [
        [
          HB,
          ["Intermediate: spin-class intensity", 9.0],
          ["Expert: vigorous intervals, Tabata-style", 11.0],
        ],
        [
          HB,
          ["Intermediate: vigorous calisthenics pace", 7.5],
          ["Expert: burpees, mountain climbers, squat jumps", 11.0],
        ],
        [
          HB,
          ["Intermediate: kettlebell circuit, minimal rest", 7.5],
          ["Expert: kettlebell swings, vigorous", 9.8],
        ],
        [
          HB,
          ["Intermediate: elliptical or spin bike, vigorous", 9.0],
          ["Expert: rowing machine, 150 to 199 W", 11.0],
        ],
        [
          HB,
          ["Intermediate: jumping at about 120 per minute", 9.0],
          ["Expert: squat jumps, burpees, Tabata", 11.0],
        ],
        [
          HB,
          ["Intermediate: fast freestyle laps", 9.8],
          ["Expert: vigorous hybrid intervals", 11.0],
        ],
      ],
    },
    { n: "Walking (by speed)", k: "walk", lo: 3, hi: 6 },
    { n: "Running or jogging (by speed)", k: "run", lo: 6, hi: 25 },
    { n: "Cycling outdoors (by speed)", k: "cyc", lo: 8, hi: 50 },
  ];
  /* Cycling: Compendium 2024 values placed at the middle of each speed band
     (mph, gross MET); values between points are linearly interpolated. */
  var CYC = [
    [5.5, 3.5],
    [9.4, 5.8],
    [10.95, 6.8],
    [12.95, 8.0],
    [14.95, 10.0],
    [17.5, 12.0],
    [20, 16.8],
  ];
  function cycMet(mph) {
    if (mph <= CYC[0][0]) return CYC[0][1];
    for (var i = 1; i < CYC.length; i++) {
      if (mph <= CYC[i][0]) {
        var a = CYC[i - 1],
          b = CYC[i];
        return a[1] + ((b[1] - a[1]) * (mph - a[0])) / (b[0] - a[0]);
      }
    }
    return CYC[CYC.length - 1][1];
  }
  /* x = { a: activity, t: type index, i: level index,
     sp: km/h, gr: grade %}. Walking and running use the ACSM metabolic
     equations; the net oxygen cost is the part above the resting 3.5 ml/kg/min,
     divided by 3.5 to give METs. */
  function exCalc(x) {
    var X = EXG[x.a],
      S_ = ((x.sp || 0) * 1000) / 60,
      G = (x.gr || 0) / 100,
      net,
      label;
    if (!X.k) {
      var lv = X.lv || X.lvBy[x.t],
        i = Math.min(Math.max(x.i || 0, 0), lv.length - 1);
      label = X.n + (X.sub ? " (" + X.sub[x.t] + ")" : "") + ", " + lv[i][0];
      net = lv[i][1] - 1;
    } else if (X.k === "cyc") {
      net = cycMet(x.sp / MPH) - 1;
      label = "Cycling at " + +x.sp.toFixed(1) + " km/h";
    } else {
      net =
        (X.k === "walk" ? 0.1 * S_ + 1.8 * S_ * G : 0.2 * S_ + 0.9 * S_ * G) /
        3.5;
      label =
        (X.k === "walk" ? "Walking" : "Running") +
        " at " +
        +x.sp.toFixed(1) +
        " km/h" +
        (x.gr ? ", " + x.gr + "% grade" : "");
    }
    return { net: net, gross: net + 1, label: label };
  }
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
    var baseTarget = type === "gain" ? tdee + adj : tdee - adj,
      target = baseTarget;
    if (p.tweak) {
      var lo = type === "gain" ? tdee : floor,
        hi = type === "lose" ? tdee : tdee + MAX_SURPLUS;
      target = Math.min(hi, Math.max(lo, baseTarget + p.tweak));
    }
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
      tweak: target - baseTarget,
      weekly: type === "maintain" ? 0 : (Math.abs(target - tdee) * 7) / KCAL_KG,
      projDays: projDays,
      bmi: bmi,
      gbmi: gbmi,
      protein: protein,
      fat: fat,
      carbs: carbs,
    };
  }
  /* Weigh-in on or before the date; before the first weigh-in, the first one. */
  function weightOn(d) {
    var best = null,
      first = null;
    S.weights.forEach(function (w) {
      if (w.d <= d && (!best || w.d > best.d)) best = w;
      if (!first || w.d < first.d) first = w;
    });
    return best ? best.kg : first ? first.kg : S.plan.kg;
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
    if (Math.abs(c.tweak) >= 0.5)
      rows.push(
        row(
          "Weekly-check adjustment",
          (c.tweak > 0 ? "+" : "-") + Math.abs(r0(c.tweak)) + " kcal",
          "Already included in the daily calorie target",
        ),
      );
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
    var exKg = weightOn(d),
      xs = el("select", { id: "xa" }),
      xt = el("select", { id: "xt" }),
      xi = el("select", { id: "xi" }),
      xu = el("select", { id: "xu" }),
      xvI = el("input", { id: "xv" }),
      xrI = el("input", { id: "xr" }),
      xmI = el("input", { id: "xm", value: "30" });
    EXG.forEach(function (x, i) {
      xs.appendChild(el("option", { value: i, text: x.n }));
    });
    xu.appendChild(el("option", { value: "kmh", text: "km/h" }));
    xu.appendChild(el("option", { value: "mph", text: "mph" }));
    var lTt = el("span", { text: "Type" }),
      lT = el("label", {}, lTt, xt),
      lI = el("label", { text: "Level" }, xi),
      lV = el("label", { text: "Speed" }, xvI),
      lU = el("label", { text: "Speed unit" }, xu),
      lR = el("label", { text: "Grade % (optional, 1 to 15)" }, xrI);
    xg.appendChild(el("label", { text: "Activity" }, xs));
    [lT, lI, lV, lU, lR].forEach(function (n) {
      xg.appendChild(n);
    });
    xg.appendChild(el("label", { text: "Minutes (1 to 600)" }, xmI));
    xc.appendChild(xg);
    var xe = el("div", { cls: "err", hidden: "hidden" });
    xc.appendChild(xe);
    var xp = el("p", { text: "" });
    xc.appendChild(xp);
    xc.appendChild(
      el("p", {
        cls: "mut",
        text:
          "Burn = (MET - 1) x weight (kg) x hours, using your weigh-in of " +
          wtxt(exKg) +
          ". Levels use the 2024 Compendium of Physical Activities; values marked estimate are not published. Enter the total session time, rest breaks included. Estimates can be off by a wide margin for one person.",
      }),
    );
    xc.appendChild(
      el("button", { cls: "btn", type: "submit", text: "Add exercise" }),
    );
    function syncEx() {
      var X = EXG[+xs.value];
      if (X.sub && xt.getAttribute("data-a") !== xs.value) {
        clear(xt);
        X.sub.forEach(function (s, i) {
          xt.appendChild(el("option", { value: i, text: s }));
        });
        xt.setAttribute("data-a", xs.value);
        lTt.textContent = X.subLabel;
      }
      lT.hidden = !X.sub;
      if (!X.k) {
        var key = xs.value + "/" + (X.lvBy ? xt.value : ""),
          keep = +xi.value || 0;
        if (xi.getAttribute("data-k") !== key) {
          var lv = X.lv || X.lvBy[+xt.value || 0];
          clear(xi);
          lv.forEach(function (m, i) {
            xi.appendChild(
              el("option", { value: i, text: m[0] + " (" + m[1] + " MET)" }),
            );
          });
          xi.value = String(Math.min(keep, lv.length - 1));
          xi.setAttribute("data-k", key);
        }
      }
      lI.hidden = !!X.k;
      lV.hidden = !X.k;
      lU.hidden = !X.k;
      lR.hidden = !(X.k === "walk" || X.k === "run");
    }
    function readEx() {
      var errs = [],
        X = EXG[+xs.value],
        m = num(xmI.value),
        x = {
          a: +xs.value,
          t: +xt.value || 0,
          i: +xi.value || 0,
          sp: 0,
          gr: 0,
        };
      if (!isFinite(m) || m < 1 || m > 600)
        errs.push("Minutes must be between 1 and 600.");
      if (X.k) {
        var sp = num(xvI.value),
          kmh = xu.value === "mph" ? sp * MPH : sp;
        if (!isFinite(sp) || kmh < X.lo - 1e-9 || kmh > X.hi + 1e-9)
          errs.push(
            "Speed must be a number from " +
              X.lo +
              " to " +
              X.hi +
              " km/h (" +
              (X.lo / MPH).toFixed(1) +
              " to " +
              (X.hi / MPH).toFixed(1) +
              " mph) for this activity.",
          );
        x.sp = kmh;
        if (X.k !== "cyc" && xrI.value.trim() !== "") {
          var gv = num(xrI.value);
          if (!isFinite(gv) || gv < 1 || gv > 15)
            errs.push(
              "Grade must be a number from 1 to 15, or left blank for flat ground.",
            );
          x.gr = gv;
        }
      }
      var out = { errs: errs, min: m };
      if (!errs.length) {
        out.calc = exCalc(x);
        out.kcal = (out.calc.net * exKg * m) / 60;
      }
      return out;
    }
    function upd() {
      var r = readEx();
      xp.textContent = r.errs.length
        ? "Estimated burn: enter valid values to see it."
        : "Estimated burn: " +
          r0(r.kcal) +
          " kcal (net " +
          r.calc.net.toFixed(1) +
          " MET).";
    }
    xc.addEventListener("input", upd);
    xc.addEventListener("change", function () {
      syncEx();
      upd();
    });
    xc.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = readEx();
      if (r.errs.length) {
        showErr(xe, r.errs);
        return;
      }
      L.x.push({
        n: r.calc.label,
        min: r.min,
        k: r.kcal,
        met: r.calc.gross,
        net: r.calc.net,
        w: exKg,
      });
      save();
      renderToday();
    });
    syncEx();
    upd();
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

  /* ---------- weight chart ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function sv(t, a) {
    var n = document.createElementNS(NS, t);
    a = a || {};
    for (var k in a) {
      if (k === "text") n.textContent = a[k];
      else n.setAttribute(k, a[k]);
    }
    for (var i = 2; i < arguments.length; i++)
      if (arguments[i]) n.appendChild(arguments[i]);
    return n;
  }
  /* Dots: weigh-ins. Solid line: average of the weigh-ins in the 7 days up to
     each one. Dashed line: straight path from start weight to goal. */
  function weightChart(p, c, ws) {
    var W = 640,
      H = 260,
      L = 52,
      R = 14,
      T = 14,
      B = 30,
      pw = W - L - R,
      ph = H - T - B;
    var d0 = ws[0].d < p.start ? ws[0].d : p.start,
      last = ws[ws.length - 1].d,
      d1 = last > c.end ? last : c.end,
      span = Math.max(1, diffDays(d0, d1)),
      goalKg = p.type === "maintain" ? p.kg : p.goal;
    var ys = ws
        .map(function (w) {
          return w.kg;
        })
        .concat([p.kg, goalKg]),
      lo = Math.min.apply(null, ys),
      hi = Math.max.apply(null, ys),
      pad = Math.max(0.5, (hi - lo) * 0.15);
    lo -= pad;
    hi += pad;
    function X(d) {
      return L + (pw * diffDays(d0, d)) / span;
    }
    function Y(kg) {
      return T + ph * (1 - (kg - lo) / (hi - lo));
    }
    function disp(kg) {
      return (p.wu === "lb" ? kg / LB : kg).toFixed(1);
    }
    var txt = "fill:var(--mut);font:11px system-ui,sans-serif";
    var svg = sv("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      style: "width:100%;height:auto",
      "aria-label":
        "Weight chart with " +
        ws.length +
        " weigh-ins, from " +
        wtxt(ws[0].kg) +
        " to " +
        wtxt(ws[ws.length - 1].kg) +
        ".",
    });
    for (var i = 0; i < 4; i++) {
      var v = lo + ((hi - lo) * i) / 3,
        y = Y(v);
      svg.appendChild(
        sv("line", {
          x1: L,
          x2: W - R,
          y1: y,
          y2: y,
          style: "stroke:var(--rule);stroke-width:1",
        }),
      );
      svg.appendChild(
        sv("text", {
          x: L - 6,
          y: y + 4,
          "text-anchor": "end",
          style: txt,
          text: disp(v),
        }),
      );
    }
    svg.appendChild(
      sv("text", {
        x: L,
        y: H - 8,
        "text-anchor": "start",
        style: txt,
        text: fd(d0),
      }),
    );
    svg.appendChild(
      sv("text", {
        x: W - R,
        y: H - 8,
        "text-anchor": "end",
        style: txt,
        text: fd(d1),
      }),
    );
    svg.appendChild(
      sv("line", {
        x1: X(p.start),
        y1: Y(p.kg),
        x2: X(c.end),
        y2: Y(goalKg),
        style: "stroke:var(--mut);stroke-width:2;stroke-dasharray:6 5",
      }),
    );
    var pts = ws.map(function (w) {
      var s = 0,
        n = 0;
      ws.forEach(function (o) {
        var dd = diffDays(o.d, w.d);
        if (dd >= 0 && dd <= 6) {
          s += o.kg;
          n++;
        }
      });
      return X(w.d).toFixed(1) + "," + Y(s / n).toFixed(1);
    });
    svg.appendChild(
      sv("polyline", {
        points: pts.join(" "),
        style:
          "fill:none;stroke:var(--acc);stroke-width:3;stroke-linejoin:round",
      }),
    );
    ws.forEach(function (w) {
      svg.appendChild(
        sv("circle", {
          cx: X(w.d),
          cy: Y(w.kg),
          r: 3.5,
          style: "fill:var(--card);stroke:var(--acc);stroke-width:2",
        }),
      );
    });
    return svg;
  }

  /* ---------- weekly check ---------- */
  function sgn(v) {
    return (v >= 0 ? "+" : "-") + Math.abs(r0(v));
  }
  function weeklyCheck(p, c, ws) {
    var card = el("div", { cls: "card" }, el("h2", { text: "Weekly check" }));
    var note = function (t) {
      card.appendChild(el("p", { cls: "mut", text: t }));
    };
    var td = todayStr(),
      from = addDays(td, -20);
    if (from < p.start) from = p.start;
    if (p.tweakDate && p.tweakDate > from) from = p.tweakDate;
    if (p.tweak)
      note(
        "Current adjustment: " +
          sgn(p.tweak) +
          " kcal per day, applied on " +
          fd(p.tweakDate || p.start) +
          ". The check below only uses data from that date.",
      );
    var win = ws.filter(function (w) {
        return w.d >= from && w.d <= td;
      }),
      span = win.length ? diffDays(win[0].d, win[win.length - 1].d) : 0;
    function undo() {
      if (!p.tweak) return;
      card.appendChild(
        el("button", {
          cls: "btn alt",
          type: "button",
          text: "Remove adjustment",
          on: [
            "click",
            function () {
              delete p.tweak;
              delete p.tweakDate;
              save();
              renderProg();
            },
          ],
        }),
      );
    }
    if (win.length < 3 || span < 14) {
      note(
        "Not enough data yet. The check needs at least 3 weigh-ins in the last 21 days, with the first and last at least 14 days apart. Weighing in 2 to 3 times a week works best.",
      );
      undo();
      return card;
    }
    var n = win.length,
      sx = 0,
      sy = 0,
      sxy = 0,
      sxx = 0;
    win.forEach(function (w) {
      var x = diffDays(win[0].d, w.d);
      sx += x;
      sy += w.kg;
      sxy += x * w.kg;
      sxx += x * x;
    });
    var rate =
        ((n * sxy - sx * sy) / (n * sxx - sx * sx)) * 7 /* kg per week */,
      obs = (rate * KCAL_KG) / 7; /* kcal per day */
    var days = [],
      k = diffDays(from, td);
    for (var i = 0; i < k; i++) {
      var d = addDays(from, i);
      if (S.logs[d] && S.logs[d].f.length) days.push(d);
    }
    note(
      "Weight trend over the last " +
        (span + 1) +
        " days: " +
        (rate >= 0 ? "+" : "-") +
        wtxt(Math.abs(rate)) +
        " per week.",
    );
    if (days.length < 7) {
      note(
        "Log food on at least 7 of these days so the check can tell whether the gap comes from eating or from the plan. You have " +
          days.length +
          ".",
      );
      undo();
      return card;
    }
    var eaten = 0,
      burn = 0,
      bud = 0;
    days.forEach(function (d) {
      var t = totals(d);
      eaten += t.c;
      burn += t.b;
      bud += budget(d);
    });
    eaten /= days.length;
    burn /= days.length;
    bud /= days.length;
    var want =
        c.target -
        c.tdee -
        (1 - p.eat / 100) * burn /* planned kcal balance per day */,
      exp = (want * 7) / KCAL_KG;
    note(
      "Expected from your plan and workouts: " +
        (exp >= 0 ? "+" : "-") +
        wtxt(Math.abs(exp)) +
        " per week. Average eaten " +
        r0(eaten) +
        " kcal against a budget of " +
        r0(bud) +
        " kcal, over " +
        days.length +
        " logged days.",
    );
    var diff = obs - want;
    if (Math.abs(diff) < 200) {
      card.appendChild(
        el("div", {
          cls: "note",
          text: "On track. Your weight trend matches the plan, so no change is needed.",
        }),
      );
    } else if (Math.abs(eaten - bud) > 150) {
      card.appendChild(
        el("div", {
          cls: "note w",
          text:
            "You ate about " +
            Math.abs(r0(eaten - bud)) +
            " kcal per day " +
            (eaten > bud ? "more" : "less") +
            " than your budget, which likely explains the gap. Stay close to the budget for another week or two before changing the plan.",
        }),
      );
    } else {
      var step = Math.max(-250, Math.min(250, Math.round(-diff / 25) * 25)),
        nc = compute(Object.assign({}, p, { tweak: (p.tweak || 0) + step })),
        eff = nc.target - c.target;
      card.appendChild(
        el("div", {
          cls: "note w",
          text:
            "Your weight is trending about " +
            Math.abs(r0(diff)) +
            " kcal per day " +
            (diff > 0 ? "higher" : "lower") +
            " than the plan expects, even though you stayed on budget.",
        }),
      );
      if (Math.abs(eff) < 1) {
        note(
          "Your target is already at its limit, so no further change is possible. Consider a longer duration or a different goal weight.",
        );
      } else {
        note(
          "Suggested change: " +
            sgn(eff) +
            " kcal per day, for a new target of " +
            r0(nc.target) +
            " kcal. Daily weight swings of 1 to 2 kg from water are normal, so treat this as a guide.",
        );
        card.appendChild(
          el("button", {
            cls: "btn",
            type: "button",
            text: "Apply suggested change",
            on: [
              "click",
              function () {
                p.tweak = (p.tweak || 0) + step;
                p.tweakDate = td;
                save();
                renderProg();
              },
            ],
          }),
        );
      }
    }
    undo();
    note("Changing your plan details resets this adjustment.");
    return card;
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
    if (ws.length >= 2) {
      sc.appendChild(weightChart(p, c, ws));
      sc.appendChild(
        el("p", {
          cls: "mut",
          text: "Dots are weigh-ins, the solid line is the 7-day average, and the dashed line is your plan.",
        }),
      );
    } else {
      sc.appendChild(
        el("p", {
          cls: "mut",
          text: "Add a second weigh-in to see your weight chart.",
        }),
      );
    }
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
    host.appendChild(weeklyCheck(p, c, ws));

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
