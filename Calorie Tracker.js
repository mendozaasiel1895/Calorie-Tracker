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
  S.fast = Object.assign(
    { ok: false, at: 0, kind: "16:8", hours: 16, active: null, log: [] },
    S.fast || {},
  );
  if (!Array.isArray(S.foods)) S.foods = [];
  if (!Array.isArray(S.plans)) S.plans = [];
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
    fh: 1,
    ww: 1,
  };
  var INT_IDS = { age: 1, mo: 1 };
  /* Fields created in the Meals tab and Daily log carry data-num="1". */
  function isNumField(t) {
    return (
      NUM_IDS[t.id] === 1 ||
      (t.getAttribute && t.getAttribute("data-num") === "1")
    );
  }
  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (isNumField(t))
      t.setAttribute("inputmode", INT_IDS[t.id] ? "numeric" : "decimal");
  });
  document.addEventListener(
    "input",
    function (e) {
      var t = e.target;
      if (!isNumField(t)) return;
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
  /* Entered weights are shown exactly as stored (float noise below 6 decimals
     removed), never rounded. */
  function trim(x, d) {
    return String(+x.toFixed(d));
  }
  function wtxt(kg, p) {
    var u = (p || S.plan || { wu: "kg" }).wu;
    return u === "lb" ? trim(kg / LB, 6) + " lb" : trim(kg, 6) + " kg";
  }
  /* Rates and trends are estimates: two decimals. */
  function wrate(kg) {
    var u = (S.plan || { wu: "kg" }).wu;
    return u === "lb" ? trim(kg / LB, 2) + " lb" : trim(kg, 2) + " kg";
  }
  /* Allowed limits never round past the limit: the lowest rounds up, the
     highest rounds down. */
  function wlim(kg, wu, lowest) {
    var v = wu === "lb" ? kg / LB : kg;
    v = lowest
      ? Math.ceil(v * 100 - 1e-9) / 100
      : Math.floor(v * 100 + 1e-9) / 100;
    return trim(v, 2) + " " + wu;
  }
  /* Nutrients of one food entry; 0 means the value was left blank. */
  function nv(x) {
    return x ? trim(x, 6) + " g" : "-";
  }
  function nutr(e) {
    return (
      "Protein " +
      nv(e.p) +
      " \u00b7 Carbs " +
      nv(e.cb) +
      " \u00b7 Fat " +
      nv(e.ft)
    );
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
    if (t !== "prog") editW = null;
    if (t !== "fast") {
      editF = null;
      stopTick();
    }
    tabs.forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.t === t);
    });
    ["plan", "today", "prog", "fast", "meals"].forEach(function (s) {
      $(s).hidden = s !== t;
    });
    if (t === "today") renderToday();
    if (t === "prog") renderProg();
    if (t === "fast") renderFast();
    if (t === "meals") renderMeals();
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
      $("h1").value = isFinite(cm) ? +cm.toFixed(4) : "";
    } else {
      var inch = a / 2.54;
      if (isFinite(inch)) {
        $("h1").value = Math.floor(inch / 12);
        $("h2").value = +(inch % 12).toFixed(4);
      }
    }
    syncH();
  });
  $("wu").addEventListener("change", function () {
    var to = $("wu").value;
    ["wt", "gw"].forEach(function (i) {
      var v = num($(i).value);
      if (isFinite(v)) $(i).value = +(to === "lb" ? v / LB : v * LB).toFixed(4);
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
      if (t === "gain" && !(g > wt)) $("gw").value = +(wt * 1.05).toFixed(2);
      else if (t === "lose" && !(g < wt))
        $("gw").value = +(wt * 0.9).toFixed(2);
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
      $("h1").value = +p.cm.toFixed(6);
    } else {
      var i = p.cm / 2.54;
      $("h1").value = Math.floor(i / 12);
      $("h2").value = +(i % 12).toFixed(6);
    }
    $("wt").value = +(p.wu === "lb" ? p.kg / LB : p.kg).toFixed(6);
    $("gw").value = +(p.wu === "lb" ? p.goal / LB : p.goal).toFixed(6);
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
              wlim(18.5 * m2, wu, true) +
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
              wlim(30 * m2, wu, false) +
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
            wrate(c.weekly) +
            " per week, which is more than " +
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
          wrate(c.weekly),
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
    var psc = planShortcut(L, d);
    if (psc) host.appendChild(psc);
    var fc = el("form", { novalidate: "novalidate" });
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
    host.appendChild(addFoodCard(fc, L));
    host.appendChild(
      listCard(
        "Food eaten",
        L.f,
        function (e) {
          return e.m + ": " + e.n;
        },
        function (e) {
          return trim(e.c, 6) + " kcal";
        },
        function (i) {
          L.f.splice(i, 1);
          save();
          renderToday();
        },
        nutr,
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
  function listCard(title, arr, lab, val, del, sub) {
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
          el(
            "td",
            {},
            lab(e),
            sub ? el("div", { cls: "mut", text: sub(e) }) : null,
          ),
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

  /* ---------- meals: My foods and meal plans ---------- */
  /* Plans keep their own copies of each food's nutrients, so editing or
     deleting a saved food never changes a plan, and adding a plan to the log
     copies values into the day so later edits never change past days. */
  var SLOTS = ["Breakfast", "Lunch", "Dinner", "Snack"],
    DNAME = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    DORDER = [1, 2, 3, 4, 5, 6, 0],
    QMIN = 0.25,
    QMAX = 20;
  var editFood = null,
    planDraft = null,
    foodQ = "",
    addMode = "manual";
  /* Food types and tags. Diet and allergen filters use the tags the user (or
     the starter list) assigned; a food that was never checked is treated as
     unknown and is left out whenever a filter is on. */
  var TYPES = [
    ["protein", "Protein"],
    ["grain", "Grain or starch"],
    ["vegetable", "Vegetable"],
    ["fruit", "Fruit"],
    ["dairy", "Dairy"],
    ["fat", "Fat, oil, or nut"],
    ["other", "Other"],
  ];
  var TAGS = [
    ["meat", "Meat"],
    ["fish", "Fish"],
    ["shellfish", "Shellfish"],
    ["egg", "Eggs"],
    ["dairy", "Dairy"],
    ["gluten", "Gluten (wheat, barley, rye, oats)"],
    ["peanut", "Peanuts"],
    ["treenut", "Tree nuts"],
    ["soy", "Soy"],
  ];
  var DIETS = [
    ["any", "Anything"],
    ["vegetarian", "Vegetarian (no meat, fish, or shellfish)"],
    ["pescatarian", "Pescatarian (no meat)"],
    ["vegan", "Vegan (no meat, fish, shellfish, eggs, or dairy)"],
  ];
  var DIETX = {
    any: [],
    vegetarian: ["meat", "fish", "shellfish"],
    pescatarian: ["meat"],
    vegan: ["meat", "fish", "shellfish", "egg", "dairy"],
  };
  function typeName(k) {
    var n = "";
    TYPES.forEach(function (t) {
      if (t[0] === k) n = t[1];
    });
    return n;
  }
  function tagNames(tags) {
    return TAGS.filter(function (t) {
      return tags.indexOf(t[0]) > -1;
    })
      .map(function (t) {
        return t[1].split(" (")[0].toLowerCase();
      })
      .join(", ");
  }
  /* Starter foods: values per 100 g from USDA FoodData Central (SR Legacy
     records). Each row is [name, type, serving label, serving grams, kcal,
     protein, carbs, fat per 100 g, tags]. Per-serving values are worked out
     from the per-100 g values when a food is added. */
  var STARTER = [
    [
      "Chicken breast, roasted, skinless",
      "protein",
      "100 g cooked",
      100,
      165,
      31,
      0,
      3.6,
      ["meat"],
    ],
    [
      "Salmon, Atlantic farmed, cooked",
      "protein",
      "100 g cooked",
      100,
      206,
      22.1,
      0,
      12.35,
      ["fish"],
    ],
    [
      "Egg, whole, raw",
      "protein",
      "1 large egg (50 g)",
      50,
      143,
      12.56,
      0.72,
      9.51,
      ["egg"],
    ],
    [
      "Tofu, firm, raw",
      "protein",
      "100 g",
      100,
      144,
      17.27,
      2.78,
      8.72,
      ["soy"],
    ],
    [
      "Lentils, cooked",
      "protein",
      "100 g cooked",
      100,
      116,
      9.02,
      20.13,
      0.38,
      [],
    ],
    [
      "Black beans, cooked",
      "protein",
      "100 g cooked",
      100,
      132,
      8.86,
      23.71,
      0.54,
      [],
    ],
    [
      "Chickpeas, cooked",
      "protein",
      "100 g cooked",
      100,
      164,
      8.86,
      27.42,
      2.59,
      [],
    ],
    [
      "Greek yogurt, plain, nonfat",
      "dairy",
      "1 container (170 g)",
      170,
      59,
      10.19,
      3.6,
      0.39,
      ["dairy"],
    ],
    [
      "Milk, whole",
      "dairy",
      "1 cup (244 g)",
      244,
      61,
      3.15,
      4.8,
      3.25,
      ["dairy"],
    ],
    [
      "White rice, cooked",
      "grain",
      "1 cup cooked (158 g)",
      158,
      130,
      2.69,
      28.17,
      0.28,
      [],
    ],
    ["Brown rice, cooked", "grain", "100 g cooked", 100, 123, 2.7, 25.6, 1, []],
    [
      "Pasta, cooked, enriched",
      "grain",
      "1 cup cooked (140 g)",
      140,
      157,
      5.8,
      30.7,
      0.9,
      ["gluten"],
    ],
    [
      "Quinoa, cooked",
      "grain",
      "1 cup cooked (185 g)",
      185,
      120,
      4.4,
      21.3,
      1.9,
      [],
    ],
    [
      "Oats, rolled, dry",
      "grain",
      "40 g dry",
      40,
      389,
      16.9,
      66.3,
      6.9,
      ["gluten"],
    ],
    [
      "Potato, boiled, no skin",
      "grain",
      "100 g",
      100,
      87,
      1.87,
      20.13,
      0.1,
      [],
    ],
    ["Sweet potato, baked", "grain", "100 g", 100, 90, 2.01, 20.71, 0.15, []],
    ["Banana, raw", "fruit", "100 g", 100, 89, 1.09, 22.84, 0.33, []],
    ["Apple, raw, with skin", "fruit", "100 g", 100, 52, 0.26, 13.81, 0.17, []],
    ["Orange, raw", "fruit", "100 g", 100, 47, 0.94, 11.75, 0.12, []],
    [
      "Broccoli, cooked",
      "vegetable",
      "100 g cooked",
      100,
      35,
      2.38,
      7.18,
      0.41,
      [],
    ],
    ["Spinach, raw", "vegetable", "100 g", 100, 23, 2.86, 3.63, 0.39, []],
    ["Carrot, raw", "vegetable", "100 g", 100, 41, 0.93, 9.58, 0.24, []],
    [
      "Almonds",
      "fat",
      "28 g (1 oz)",
      28,
      579,
      21.15,
      21.55,
      49.93,
      ["treenut"],
    ],
    ["Olive oil", "fat", "1 tbsp (13.5 g)", 13.5, 884, 0, 0, 100, []],
    ["Avocado, raw", "fat", "100 g", 100, 160, 2, 8.53, 14.66, []],
  ];
  function starterFood(r) {
    var k = r[3] / 100,
      f2 = function (x) {
        return +(x * k).toFixed(2);
      };
    return {
      id: newId(),
      n: r[0],
      s: r[2],
      c: f2(r[4]),
      p: f2(r[5]),
      cb: f2(r[6]),
      ft: f2(r[7]),
      type: r[1],
      tags: r[8].slice(),
      tagged: true,
      src: "USDA",
    };
  }
  /* Adds starter foods (by index) to My foods; skips ones already saved. */
  function addStarter(idx) {
    var added = 0,
      dup = 0,
      full = false;
    idx.forEach(function (i) {
      var f = starterFood(STARTER[i]);
      if (
        S.foods.some(function (x) {
          return (
            x.n.toLowerCase() === f.n.toLowerCase() &&
            x.s.toLowerCase() === f.s.toLowerCase()
          );
        })
      ) {
        dup++;
        return;
      }
      if (S.foods.length >= 200) {
        full = true;
        return;
      }
      S.foods.push(f);
      added++;
    });
    save();
    return (
      "Added " +
      added +
      " food" +
      (added === 1 ? "" : "s") +
      (dup ? ", skipped " + dup + " already saved" : "") +
      (full ? ". You reached the limit of 200 foods" : "") +
      "."
    );
  }
  var starterMsg = "";
  function dow(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).getDay();
  }
  function dayText(days) {
    return DORDER.filter(function (x) {
      return days.indexOf(x) > -1;
    })
      .map(function (x) {
        return DNAME[x].slice(0, 3);
      })
      .join(", ");
  }
  function qok(q) {
    return isFinite(q) && q >= QMIN && q <= QMAX;
  }
  function sumQ(list) {
    var t = { c: 0, p: 0, cb: 0, ft: 0 };
    list.forEach(function (x) {
      t.c += x.it.c * x.q;
      t.p += (x.it.p || 0) * x.q;
      t.cb += (x.it.cb || 0) * x.q;
      t.ft += (x.it.ft || 0) * x.q;
    });
    return t;
  }
  function fmtTot(t) {
    return (
      trim(t.c, 4) +
      " kcal \u00b7 Protein " +
      trim(t.p, 4) +
      " g \u00b7 Carbs " +
      trim(t.cb, 4) +
      " g \u00b7 Fat " +
      trim(t.ft, 4) +
      " g"
    );
  }
  function mkEntry(it, q, meal) {
    var nm =
      q === 1
        ? it.n + " (" + it.s + ")"
        : it.n + " (" + trim(q, 6) + " x " + it.s + ")";
    return {
      n: nm.slice(0, 60),
      m: meal,
      c: +(it.c * q).toFixed(6),
      p: +((it.p || 0) * q).toFixed(6),
      cb: +((it.cb || 0) * q).toFixed(6),
      ft: +((it.ft || 0) * q).toFixed(6),
    };
  }
  /* A scaled entry must obey the same limits as a typed one. */
  function entryErrs(e) {
    var errs = [];
    if (e.c < 1 || e.c > 5000)
      errs.push(
        e.n +
          ": calories work out to " +
          trim(e.c, 2) +
          " kcal, but one entry must be 1 to 5,000 kcal.",
      );
    [
      ["p", "Protein"],
      ["cb", "Carbs"],
      ["ft", "Fat"],
    ].forEach(function (m) {
      if (e[m[0]] > 500)
        errs.push(e.n + ": " + m[1] + " works out to more than 500 g.");
    });
    return errs;
  }
  function sortedFoods() {
    return S.foods.slice().sort(function (a, b) {
      var x = a.n.toLowerCase(),
        y = b.n.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }
  function foodOpts(sel) {
    sortedFoods().forEach(function (f) {
      sel.appendChild(
        el("option", { value: f.id, text: f.n + " (" + f.s + ")" }),
      );
    });
  }
  function slotSel() {
    var s = el("select");
    SLOTS.forEach(function (m) {
      s.appendChild(el("option", { text: m }));
    });
    return s;
  }
  function readMacros(refs, errs) {
    var out = {};
    [
      ["p", "Protein", refs.p],
      ["cb", "Carbs", refs.cb],
      ["ft", "Fat", refs.ft],
    ].forEach(function (m) {
      var raw = m[2].value.trim();
      if (raw === "") {
        out[m[0]] = 0;
        return;
      }
      var v = num(raw);
      if (!isFinite(v) || v < 0.1 || v > 500)
        errs.push(m[1] + " must be a number from 0.1 to 500 g, or left blank.");
      out[m[0]] = v;
    });
    return out;
  }

  /* Daily log: Add food with a source choice (type it in, My foods, meal plan). */
  function addFoodCard(fc, L) {
    var card = el("div", { cls: "card" }, el("h2", { text: "Add food" }));
    var src = el("select");
    [
      ["manual", "Type it in"],
      ["foods", "From My foods"],
      ["plan", "From a meal plan"],
    ].forEach(function (o) {
      src.appendChild(el("option", { value: o[0], text: o[1] }));
    });
    src.value = addMode;
    card.appendChild(el("label", { text: "Source" }, src));

    var pf = el("div");
    if (!S.foods.length)
      pf.appendChild(
        el("p", {
          cls: "mut",
          text: "No saved foods yet. Add foods in the Meals tab.",
        }),
      );
    else {
      var fsel = el("select"),
        fq = el("input", { value: "1", "data-num": "1" }),
        fmS = slotSel();
      foodOpts(fsel);
      pf.appendChild(
        el(
          "div",
          { cls: "grid" },
          el("label", { text: "Food" }, fsel),
          el("label", { text: "Servings (0.25 to 20)" }, fq),
          el("label", { text: "Meal" }, fmS),
        ),
      );
      var fv = el("p", { cls: "mut", text: "" }),
        fe2 = el("div", { cls: "err", hidden: "hidden" });
      pf.appendChild(fe2);
      pf.appendChild(fv);
      var food = function () {
        return S.foods.filter(function (f) {
          return f.id === fsel.value;
        })[0];
      };
      var updF = function () {
        var f = food(),
          q = num(fq.value);
        fv.textContent =
          f && qok(q)
            ? "Adds " + fmtTot(sumQ([{ it: f, q: q }]))
            : "Enter servings from 0.25 to 20.";
      };
      fsel.addEventListener("change", updF);
      fq.addEventListener("input", updF);
      updF();
      pf.appendChild(
        el("button", {
          cls: "btn",
          type: "button",
          text: "Add food",
          on: [
            "click",
            function () {
              var f = food(),
                q = num(fq.value);
              if (!qok(q)) {
                showErr(fe2, ["Servings must be a number from 0.25 to 20."]);
                return;
              }
              var e = mkEntry(f, q, fmS.value),
                errs = entryErrs(e);
              if (errs.length) {
                showErr(fe2, errs);
                return;
              }
              L.f.push(e);
              save();
              renderToday();
            },
          ],
        }),
      );
    }

    var pp = el("div");
    if (!S.plans.length)
      pp.appendChild(
        el("p", {
          cls: "mut",
          text: "No meal plans yet. Build one in the Meals tab.",
        }),
      );
    else {
      var psel = el("select"),
        box = el("div"),
        rows = [],
        pv = el("p", { cls: "mut", text: "" }),
        pe = el("div", { cls: "err", hidden: "hidden" });
      S.plans.forEach(function (pl) {
        psel.appendChild(
          el("option", {
            value: pl.id,
            text:
              pl.name + (pl.days.length ? " (" + dayText(pl.days) + ")" : ""),
          }),
        );
      });
      var cur = function () {
        return S.plans.filter(function (x) {
          return x.id === psel.value;
        })[0];
      };
      var chosen = function () {
        var out = [],
          bad = false;
        rows.forEach(function (r) {
          if (!r.cb.checked) return;
          var q = num(r.qI.value);
          if (!qok(q)) bad = true;
          else out.push({ it: r.it, q: q });
        });
        return { list: out, bad: bad };
      };
      var updP = function () {
        var c = chosen();
        pv.textContent = c.bad
          ? "Servings must be from 0.25 to 20."
          : c.list.length
            ? "Adds " + fmtTot(sumQ(c.list))
            : "Tick at least one food.";
      };
      var build = function () {
        clear(box);
        rows = [];
        cur().items.forEach(function (it) {
          var cb = el("input", {
            type: "checkbox",
            style: "width:auto;margin:0 8px 0 0",
          });
          cb.checked = true;
          var qI = el("input", {
            value: String(it.q),
            "data-num": "1",
            "aria-label": "Servings",
            style: "width:84px;margin:0",
          });
          box.appendChild(
            el(
              "div",
              {
                style:
                  "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--rule)",
              },
              cb,
              el(
                "div",
                { style: "flex:1" },
                el("div", { text: it.m + ": " + it.n + " (" + it.s + ")" }),
                el("div", {
                  cls: "mut",
                  text:
                    "per serving: " +
                    trim(it.c, 6) +
                    " kcal \u00b7 " +
                    nutr(it),
                }),
              ),
              qI,
            ),
          );
          rows.push({ it: it, cb: cb, qI: qI });
        });
        updP();
      };
      psel.addEventListener("change", build);
      box.addEventListener("input", updP);
      box.addEventListener("change", updP);
      pp.appendChild(el("label", { text: "Meal plan" }, psel));
      pp.appendChild(box);
      pp.appendChild(pe);
      pp.appendChild(pv);
      build();
      pp.appendChild(
        el("button", {
          cls: "btn",
          type: "button",
          text: "Add selected foods",
          on: [
            "click",
            function () {
              var c = chosen();
              if (c.bad) {
                showErr(pe, ["Servings must be a number from 0.25 to 20."]);
                return;
              }
              if (!c.list.length) {
                showErr(pe, ["Tick at least one food."]);
                return;
              }
              var ents = c.list.map(function (x) {
                  return mkEntry(x.it, x.q, x.it.m);
                }),
                errs = [];
              ents.forEach(function (e) {
                errs = errs.concat(entryErrs(e));
              });
              if (errs.length) {
                showErr(pe, errs);
                return;
              }
              ents.forEach(function (e) {
                L.f.push(e);
              });
              save();
              renderToday();
            },
          ],
        }),
      );
    }
    var sync = function () {
      addMode = src.value;
      fc.hidden = addMode !== "manual";
      pf.hidden = addMode !== "foods";
      pp.hidden = addMode !== "plan";
    };
    src.addEventListener("change", sync);
    card.appendChild(fc);
    card.appendChild(pf);
    card.appendChild(pp);
    sync();
    return card;
  }
  /* Shortcut: plans assigned to the weekday of the date being viewed. */
  function planShortcut(L, d) {
    var dw = dow(d),
      pls = S.plans.filter(function (p) {
        return p.days.indexOf(dw) > -1;
      });
    if (!pls.length) return null;
    var card = el(
      "div",
      { cls: "card" },
      el("h2", { text: "Plan for " + DNAME[dw] }),
    );
    var er = el("div", { cls: "err", hidden: "hidden" });
    pls.forEach(function (pl) {
      card.appendChild(
        el(
          "div",
          { style: "padding:6px 0" },
          el("div", { style: "font-weight:600", text: pl.name }),
          el("div", {
            cls: "mut",
            text:
              pl.items.length +
              " food" +
              (pl.items.length > 1 ? "s" : "") +
              ": " +
              fmtTot(
                sumQ(
                  pl.items.map(function (it) {
                    return { it: it, q: it.q };
                  }),
                ),
              ),
          }),
        ),
      );
      card.appendChild(
        el("button", {
          cls: "btn",
          type: "button",
          text: "Add all of " + pl.name,
          on: [
            "click",
            function () {
              var ents = pl.items.map(function (it) {
                  return mkEntry(it, it.q, it.m);
                }),
                errs = [];
              ents.forEach(function (e) {
                errs = errs.concat(entryErrs(e));
              });
              if (errs.length) {
                showErr(er, errs);
                return;
              }
              ents.forEach(function (e) {
                L.f.push(e);
              });
              save();
              renderToday();
            },
          ],
        }),
      );
    });
    card.appendChild(er);
    return card;
  }

  function newDraft() {
    return { id: null, name: "", days: [], items: [] };
  }
  function nz(x) {
    return x ? String(x) : "";
  }
  function foodFormCard() {
    var ed = null;
    S.foods.forEach(function (f) {
      if (f.id === editFood) ed = f;
    });
    if (!ed) editFood = null;
    var card = el(
      "form",
      { cls: "card", novalidate: "novalidate" },
      el("h2", { text: ed ? "Edit food" : "Save a food" }),
    );
    var nI = el("input", { id: "mn", maxlength: "60", value: ed ? ed.n : "" }),
      sI = el("input", { id: "ms", maxlength: "40", value: ed ? ed.s : "" }),
      cI = el("input", {
        id: "mc",
        "data-num": "1",
        value: ed ? String(ed.c) : "",
      }),
      pI = el("input", {
        id: "mp",
        "data-num": "1",
        value: ed ? nz(ed.p) : "",
      }),
      bI = el("input", {
        id: "mb",
        "data-num": "1",
        value: ed ? nz(ed.cb) : "",
      }),
      fI = el("input", {
        id: "mf",
        "data-num": "1",
        value: ed ? nz(ed.ft) : "",
      });
    card.appendChild(
      el(
        "div",
        { cls: "grid" },
        el("label", { text: "Food name" }, nI),
        el("label", { text: "Serving (for example 1 cup cooked)" }, sI),
        el("label", { text: "Calories per serving (kcal)" }, cI),
        el("label", { text: "Protein g per serving (optional)" }, pI),
        el("label", { text: "Carbs g per serving (optional)" }, bI),
        el("label", { text: "Fat g per serving (optional)" }, fI),
      ),
    );
    var tS = el("select", { id: "mt" });
    TYPES.forEach(function (t) {
      tS.appendChild(el("option", { value: t[0], text: t[1] }));
    });
    tS.value = ed && ed.type ? ed.type : "other";
    card.appendChild(
      el(
        "div",
        { cls: "grid", style: "margin-top:10px" },
        el("label", { text: "Food type" }, tS),
      ),
    );
    card.appendChild(
      el("div", {
        style: "font-size:14px;font-weight:600;margin-top:10px",
        text: "Contains (tick everything that applies)",
      }),
    );
    var tagBoxes = TAGS.map(function (t) {
      var cb = el("input", {
        type: "checkbox",
        style: "width:auto;margin:0 6px 0 0",
      });
      cb.checked = !!(ed && ed.tags && ed.tags.indexOf(t[0]) > -1);
      card.appendChild(
        el(
          "label",
          {
            style:
              "display:inline-flex;align-items:center;font-weight:400;margin:6px 14px 0 0",
          },
          cb,
          t[1],
        ),
      );
      return { k: t[0], cb: cb };
    });
    var chk = el("input", {
      type: "checkbox",
      style: "width:auto;margin:0 8px 0 0",
    });
    chk.checked = !!(ed && ed.tagged);
    card.appendChild(
      el(
        "label",
        { style: "display:flex;align-items:flex-start;margin-top:12px" },
        chk,
        "I have checked this food\u2019s ingredients, so diet and allergy filters can use these tags.",
      ),
    );
    var box = el("div", { cls: "err", hidden: "hidden" });
    card.appendChild(box);
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Enter the values for one serving. Changing a saved food does not change meal plans that already use it.",
      }),
    );
    card.appendChild(
      el("button", {
        cls: "btn",
        type: "submit",
        text: ed ? "Save changes" : "Save food",
      }),
    );
    if (ed)
      card.appendChild(
        el("button", {
          cls: "btn alt",
          type: "button",
          text: "Cancel edit",
          on: [
            "click",
            function () {
              editFood = null;
              renderMeals();
            },
          ],
        }),
      );
    card.addEventListener("submit", function (e) {
      e.preventDefault();
      var errs = [],
        name = nI.value.trim(),
        serv = sI.value.trim(),
        cal = num(cI.value);
      var mac = readMacros({ p: pI, cb: bI, ft: fI }, errs);
      if (name.length < 1 || name.length > 60)
        errs.push("Food name is required (up to 60 characters).");
      if (serv.length < 1 || serv.length > 40)
        errs.push("Serving is required (up to 40 characters).");
      if (!isFinite(cal) || cal < 1 || cal > 5000)
        errs.push("Calories must be between 1 and 5,000 kcal per serving.");
      if (!ed && S.foods.length >= 200)
        errs.push("You can save up to 200 foods.");
      if (
        S.foods.some(function (f) {
          return (
            (!ed || f.id !== ed.id) &&
            f.n.toLowerCase() === name.toLowerCase() &&
            f.s.toLowerCase() === serv.toLowerCase()
          );
        })
      )
        errs.push("That food with that serving is already saved.");
      if (errs.length) {
        showErr(box, errs);
        return;
      }
      var tags = chk.checked
        ? tagBoxes
            .filter(function (b) {
              return b.cb.checked;
            })
            .map(function (b) {
              return b.k;
            })
        : [];
      if (ed) {
        ed.n = name;
        ed.s = serv;
        ed.c = cal;
        ed.p = mac.p;
        ed.cb = mac.cb;
        ed.ft = mac.ft;
        ed.type = tS.value;
        ed.tags = tags;
        ed.tagged = chk.checked;
      } else
        S.foods.push({
          id: newId(),
          n: name,
          s: serv,
          c: cal,
          p: mac.p,
          cb: mac.cb,
          ft: mac.ft,
          type: tS.value,
          tags: tags,
          tagged: chk.checked,
        });
      editFood = null;
      save();
      renderMeals();
    });
    return card;
  }
  function foodListCard() {
    var card = el(
      "div",
      { cls: "card" },
      el("h2", { text: "My foods (" + S.foods.length + ")" }),
    );
    if (!S.foods.length) {
      card.appendChild(
        el("p", {
          cls: "mut",
          text: "No saved foods yet. Save the foods you eat often, such as rice or eggs, then add them to your log or to a meal plan with one tap.",
        }),
      );
      return card;
    }
    var q = el("input", {
        id: "mq",
        "aria-label": "Search foods",
        value: foodQ,
        maxlength: "40",
      }),
      holder = el("div", { cls: "scroll" });
    card.appendChild(el("label", { text: "Search" }, q));
    function fill() {
      clear(holder);
      var list = sortedFoods().filter(function (f) {
        return (
          (f.n + " " + f.s).toLowerCase().indexOf(foodQ.trim().toLowerCase()) >
          -1
        );
      });
      if (!list.length) {
        holder.appendChild(
          el("p", { cls: "mut", text: "No foods match your search." }),
        );
        return;
      }
      var t = el("table");
      list.forEach(function (f) {
        t.appendChild(
          el(
            "tr",
            {},
            el(
              "td",
              {},
              f.n + " (" + f.s + ")",
              el("div", {
                cls: "mut",
                text: trim(f.c, 6) + " kcal \u00b7 " + nutr(f),
              }),
              el("div", {
                cls: "mut",
                text:
                  (f.type && f.type !== "other"
                    ? typeName(f.type) + " \u00b7 "
                    : "") +
                  (f.tagged
                    ? f.tags.length
                      ? "Contains: " + tagNames(f.tags)
                      : "Contains none of the listed items"
                    : "Not checked for diet or allergy filters") +
                  (f.src ? " \u00b7 " + f.src + " data" : ""),
              }),
            ),
            el(
              "td",
              {},
              el(
                "span",
                { style: "display:inline-flex;gap:6px" },
                el("button", {
                  cls: "btn del",
                  type: "button",
                  "aria-label": "Edit food",
                  style: "color:var(--acc)",
                  text: "Edit",
                  on: [
                    "click",
                    function () {
                      editFood = f.id;
                      renderMeals();
                      var x = $("mn");
                      if (x) {
                        x.focus();
                        x.scrollIntoView({ block: "center" });
                      }
                    },
                  ],
                }),
                el("button", {
                  cls: "btn del",
                  type: "button",
                  "aria-label": "Delete food",
                  text: "Delete",
                  on: [
                    "click",
                    function (e) {
                      var b = e.target;
                      if (b.dataset.s) {
                        S.foods = S.foods.filter(function (x) {
                          return x.id !== f.id;
                        });
                        if (editFood === f.id) editFood = null;
                        save();
                        renderMeals();
                      } else {
                        b.dataset.s = "1";
                        b.textContent = "Confirm";
                      }
                    },
                  ],
                }),
              ),
            ),
          ),
        );
      });
      holder.appendChild(t);
    }
    q.addEventListener("input", function () {
      foodQ = q.value;
      fill();
    });
    card.appendChild(holder);
    fill();
    return card;
  }
  function starterCard() {
    var card = el("div", { cls: "card" }, el("h2", { text: "Starter foods" }));
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Common foods with values per serving worked out from USDA FoodData Central per 100 g data. Tick the ones you want and add them to My foods, where you can edit them. Packaged and cooked foods vary, so check your own labels.",
      }),
    );
    var rows = [];
    var box = el("div", {
      style:
        "max-height:240px;overflow:auto;border:1px solid var(--rule);border-radius:6px;padding:4px 8px",
    });
    TYPES.forEach(function (t) {
      var inType = STARTER.map(function (r, i) {
        return { r: r, i: i };
      }).filter(function (x) {
        return x.r[1] === t[0];
      });
      if (!inType.length) return;
      box.appendChild(
        el("div", {
          style: "font-size:13px;font-weight:600;margin-top:6px",
          text: t[1],
        }),
      );
      inType.forEach(function (x) {
        var f = starterFood(x.r),
          cb = el("input", {
            type: "checkbox",
            style: "width:auto;margin:0 8px 0 0",
          });
        rows.push({ i: x.i, cb: cb });
        box.appendChild(
          el(
            "label",
            {
              style:
                "display:flex;align-items:center;font-weight:400;padding:3px 0",
            },
            cb,
            f.n +
              " (" +
              f.s +
              ") \u00b7 " +
              trim(f.c, 6) +
              " kcal \u00b7 " +
              nutr(f),
          ),
        );
      });
    });
    card.appendChild(box);
    if (starterMsg) card.appendChild(el("p", { cls: "mut", text: starterMsg }));
    card.appendChild(
      el("button", {
        cls: "btn",
        type: "button",
        text: "Add selected",
        on: [
          "click",
          function () {
            var idx = rows
              .filter(function (r) {
                return r.cb.checked;
              })
              .map(function (r) {
                return r.i;
              });
            starterMsg = idx.length
              ? addStarter(idx)
              : "Tick at least one food.";
            renderMeals();
          },
        ],
      }),
    );
    card.appendChild(
      el("button", {
        cls: "btn alt",
        type: "button",
        text: "Add all " + STARTER.length,
        on: [
          "click",
          function () {
            starterMsg = addStarter(
              STARTER.map(function (r, i) {
                return i;
              }),
            );
            renderMeals();
          },
        ],
      }),
    );
    return card;
  }
  function planBuilderCard() {
    var D = planDraft,
      card = el(
        "div",
        { cls: "card" },
        el("h2", { text: D.id ? "Edit meal plan" : "New meal plan" }),
      );
    var nI = el("input", { id: "pn", maxlength: "40", value: D.name });
    nI.addEventListener("input", function () {
      D.name = nI.value;
    });
    card.appendChild(
      el("label", { text: "Plan name (for example Monday meal)" }, nI),
    );
    var dl = el(
      "div",
      { style: "margin-top:10px" },
      el("div", {
        style: "font-size:14px;font-weight:600",
        text: "Use on these days (optional)",
      }),
    );
    DORDER.forEach(function (x) {
      var cb = el("input", {
        type: "checkbox",
        style: "width:auto;margin:0 6px 0 0",
      });
      cb.checked = D.days.indexOf(x) > -1;
      cb.addEventListener("change", function () {
        D.days = D.days.filter(function (y) {
          return y !== x;
        });
        if (cb.checked) D.days.push(x);
      });
      dl.appendChild(
        el(
          "label",
          {
            style:
              "display:inline-flex;align-items:center;font-weight:400;margin:6px 14px 0 0",
          },
          cb,
          DNAME[x],
        ),
      );
    });
    card.appendChild(dl);
    var ae = el("div", { cls: "err", hidden: "hidden" });
    card.appendChild(
      el("h2", { style: "margin-top:16px", text: "Foods in this plan" }),
    );
    if (!S.foods.length)
      card.appendChild(
        el("p", {
          cls: "mut",
          text: "Save some foods in My foods above first. Then you can add them here.",
        }),
      );
    else {
      var fsel = el("select"),
        qI = el("input", { value: "1", "data-num": "1" }),
        ms = slotSel();
      foodOpts(fsel);
      card.appendChild(
        el(
          "div",
          { cls: "grid" },
          el("label", { text: "Food" }, fsel),
          el("label", { text: "Servings (0.25 to 20)" }, qI),
          el("label", { text: "Meal" }, ms),
        ),
      );
      card.appendChild(
        el("button", {
          cls: "btn",
          type: "button",
          text: "Add to plan",
          on: [
            "click",
            function () {
              var f = S.foods.filter(function (x) {
                  return x.id === fsel.value;
                })[0],
                q = num(qI.value);
              if (!qok(q)) {
                showErr(ae, ["Servings must be a number from 0.25 to 20."]);
                return;
              }
              if (D.items.length >= 30) {
                showErr(ae, ["A plan can hold up to 30 foods."]);
                return;
              }
              D.items.push({
                n: f.n,
                s: f.s,
                c: f.c,
                p: f.p,
                cb: f.cb,
                ft: f.ft,
                q: q,
                m: ms.value,
              });
              renderMeals();
            },
          ],
        }),
      );
    }
    card.appendChild(ae);
    if (D.items.length) {
      var t = el("table", { style: "margin-top:10px" });
      D.items.forEach(function (it, i) {
        var q = el("input", {
          value: String(it.q),
          "data-num": "1",
          "aria-label": "Servings",
          style: "width:84px;margin:0",
        });
        q.addEventListener("change", function () {
          var v = num(q.value);
          if (!qok(v)) {
            showErr(ae, ["Servings must be a number from 0.25 to 20."]);
            q.value = String(it.q);
            return;
          }
          it.q = v;
          renderMeals();
        });
        t.appendChild(
          el(
            "tr",
            {},
            el(
              "td",
              {},
              it.m + ": " + it.n + " (" + it.s + ")",
              el("div", {
                cls: "mut",
                text:
                  trim(it.c * it.q, 4) +
                  " kcal \u00b7 " +
                  nutr({
                    p: (it.p || 0) * it.q,
                    cb: (it.cb || 0) * it.q,
                    ft: (it.ft || 0) * it.q,
                  }),
              }),
            ),
            el("td", {}, q),
            el(
              "td",
              {},
              el("button", {
                cls: "btn del",
                type: "button",
                "aria-label": "Remove food",
                text: "Remove",
                on: [
                  "click",
                  function () {
                    D.items.splice(i, 1);
                    renderMeals();
                  },
                ],
              }),
            ),
          ),
        );
      });
      card.appendChild(el("div", { cls: "scroll" }, t));
      var tot = sumQ(
        D.items.map(function (it) {
          return { it: it, q: it.q };
        }),
      );
      card.appendChild(
        el("p", {
          style: "font-weight:600",
          text: "Plan total: " + fmtTot(tot),
        }),
      );
      if (S.plan) {
        var c = compute(S.plan),
          df = tot.c - c.target;
        card.appendChild(
          el("p", {
            cls: "mut",
            text:
              "Daily target: " +
              r0(c.target) +
              " kcal \u00b7 Protein " +
              r0(c.protein) +
              " g \u00b7 Carbs " +
              r0(c.carbs) +
              " g \u00b7 Fat " +
              r0(c.fat) +
              " g. This plan is " +
              Math.abs(r0(df)) +
              " kcal " +
              (df >= 0 ? "above" : "below") +
              " your target.",
          }),
        );
      }
    }
    var se = el("div", { cls: "err", hidden: "hidden" });
    card.appendChild(se);
    card.appendChild(
      el("button", {
        cls: "btn",
        type: "button",
        text: D.id ? "Save changes" : "Save plan",
        on: [
          "click",
          function () {
            var errs = [],
              name = D.name.trim();
            if (name.length < 1 || name.length > 40)
              errs.push("Plan name is required (up to 40 characters).");
            if (
              S.plans.some(function (p) {
                return (
                  p.id !== D.id && p.name.toLowerCase() === name.toLowerCase()
                );
              })
            )
              errs.push("You already have a plan with that name.");
            if (!D.items.length)
              errs.push("Add at least one food to the plan.");
            if (!D.id && S.plans.length >= 50)
              errs.push("You can save up to 50 plans.");
            if (errs.length) {
              showErr(se, errs);
              return;
            }
            var items = D.items.map(function (it) {
              return Object.assign({}, it);
            });
            items.sort(function (a, b) {
              return SLOTS.indexOf(a.m) - SLOTS.indexOf(b.m);
            });
            var rec = {
              id: D.id || newId(),
              name: name,
              days: D.days.slice(),
              items: items,
            };
            if (D.id)
              S.plans = S.plans.map(function (p) {
                return p.id === D.id ? rec : p;
              });
            else S.plans.push(rec);
            planDraft = newDraft();
            save();
            renderMeals();
          },
        ],
      }),
    );
    if (D.id || D.name || D.items.length || D.days.length)
      card.appendChild(
        el("button", {
          cls: "btn alt",
          type: "button",
          text: D.id ? "Cancel edit" : "Clear",
          on: [
            "click",
            function () {
              planDraft = newDraft();
              renderMeals();
            },
          ],
        }),
      );
    return card;
  }
  function plansListCard() {
    var card = el(
      "div",
      { cls: "card" },
      el("h2", { text: "Meal plans (" + S.plans.length + ")" }),
    );
    if (!S.plans.length) {
      card.appendChild(
        el("p", {
          cls: "mut",
          text: "No meal plans yet. Build one above, and it will appear in the Daily log.",
        }),
      );
      return card;
    }
    S.plans.forEach(function (pl) {
      var tot = sumQ(
        pl.items.map(function (it) {
          return { it: it, q: it.q };
        }),
      );
      var blk = el(
        "div",
        { style: "padding:10px 0;border-bottom:1px solid var(--rule)" },
        el("div", { style: "font-weight:600", text: pl.name }),
        el("div", {
          cls: "mut",
          text:
            (pl.days.length ? dayText(pl.days) : "Not assigned to a day") +
            " \u00b7 " +
            fmtTot(tot),
        }),
      );
      pl.items.forEach(function (it) {
        blk.appendChild(
          el("div", {
            cls: "mut",
            text:
              it.m +
              ": " +
              it.n +
              " (" +
              (it.q === 1 ? "" : trim(it.q, 6) + " x ") +
              it.s +
              ") \u00b7 " +
              trim(it.c * it.q, 4) +
              " kcal",
          }),
        );
      });
      blk.appendChild(
        el(
          "span",
          { style: "display:inline-flex;gap:6px;margin-top:8px" },
          el("button", {
            cls: "btn del",
            type: "button",
            style: "color:var(--acc)",
            text: "Edit",
            on: [
              "click",
              function () {
                planDraft = {
                  id: pl.id,
                  name: pl.name,
                  days: pl.days.slice(),
                  items: pl.items.map(function (it) {
                    return Object.assign({}, it);
                  }),
                };
                renderMeals();
                var x = $("pn");
                if (x) {
                  x.focus();
                  x.scrollIntoView({ block: "center" });
                }
              },
            ],
          }),
          el("button", {
            cls: "btn del",
            type: "button",
            style: "color:var(--acc)",
            text: "Duplicate",
            on: [
              "click",
              function () {
                if (S.plans.length >= 50) return;
                var base = pl.name.slice(0, 33) + " (copy)",
                  nm = base,
                  k = 2;
                while (
                  S.plans.some(function (p) {
                    return p.name.toLowerCase() === nm.toLowerCase();
                  })
                )
                  nm = base.slice(0, 33) + " (copy " + k++ + ")";
                S.plans.push({
                  id: newId(),
                  name: nm,
                  days: [],
                  items: pl.items.map(function (it) {
                    return Object.assign({}, it);
                  }),
                });
                save();
                renderMeals();
              },
            ],
          }),
          el("button", {
            cls: "btn del",
            type: "button",
            text: "Delete",
            on: [
              "click",
              function (e) {
                var b = e.target;
                if (b.dataset.s) {
                  S.plans = S.plans.filter(function (p) {
                    return p.id !== pl.id;
                  });
                  if (planDraft && planDraft.id === pl.id)
                    planDraft = newDraft();
                  save();
                  renderMeals();
                } else {
                  b.dataset.s = "1";
                  b.textContent = "Confirm";
                }
              },
            ],
          }),
        ),
      );
      card.appendChild(blk);
    });
    return card;
  }
  /* ---------- meal plan generator ---------- */
  /* Builds days of meals only from foods the user saved, using the nutrition
     values the user entered. Servings are chosen in steps of 0.25 (up to 4, or 2 for oils and
     low-calorie sides) so
     calories and macros land close to the daily targets. Nothing is saved
     until the user clicks Save. */
  var GMAX = 4,
    GSTEP = 0.25;
  var genOpts = {
      days: 3,
      meals: 4,
      kcal: "",
      off: {},
      seed: 1,
      diet: "any",
      avoid: {},
    },
    genRes = null;
  function macroTargets(T) {
    var P = Math.min(1.6 * S.plan.kg, (T * 0.35) / 4),
      F = (0.25 * T) / 9;
    return { c: T, p: P, ft: F, cb: Math.max(0, (T - P * 4 - F * 9) / 4) };
  }
  function foodRole(f) {
    var m = {
      protein: "protein",
      grain: "carb",
      vegetable: "light",
      fruit: "fruit",
      dairy: "dairy",
      fat: "fat",
    };
    if (f.type && m[f.type]) return m[f.type];
    var k = f.c || 1;
    if ((4 * (f.p || 0)) / k >= 0.3) return "protein";
    if (k < 80) return "light"; /* vegetables and other low-calorie sides */
    if ((9 * (f.ft || 0)) / k >= 0.55) return "fat";
    if ((4 * (f.cb || 0)) / k >= 0.55) return "carb";
    return "mixed";
  }
  /* Why a saved food cannot be used by the generator, or "" if it can. */
  function eligible(f) {
    if (!((f.p || 0) + (f.cb || 0) + (f.ft || 0))) return "no macros entered";
    if (f.c < 4) return "under 4 kcal per serving";
    if (f.c > 1250) return "over 1,250 kcal per serving";
    if (Math.max(f.p || 0, f.cb || 0, f.ft || 0) > 125)
      return "over 125 g of one macro per serving";
    return "";
  }
  /* Diet and allergen filters. A food that was never checked is unknown, so
     it is left out whenever any filter is on. */
  function blocked(f) {
    var ex = DIETX[genOpts.diet].slice();
    TAGS.forEach(function (t) {
      if (genOpts.avoid[t[0]] && ex.indexOf(t[0]) < 0) ex.push(t[0]);
    });
    if (!ex.length) return "";
    if (!f.tagged) return "not checked for diet or allergy filters";
    var hit = ex.filter(function (t) {
      return f.tags.indexOf(t) > -1;
    });
    return hit.length ? "contains " + tagNames(hit) : "";
  }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var GSLOTS = {
    3: [
      ["Breakfast", 0.3],
      ["Lunch", 0.35],
      ["Dinner", 0.35],
    ],
    4: [
      ["Breakfast", 0.25],
      ["Lunch", 0.3],
      ["Dinner", 0.3],
      ["Snack", 0.15],
    ],
  };
  var GROLES = {
    Breakfast: [
      ["carb", "fruit", "mixed"],
      ["protein", "dairy"],
    ],
    Lunch: [["protein"], ["carb"], ["light", "fat", "mixed", "fruit"]],
    Dinner: [["protein"], ["carb"], ["light", "fat", "mixed"]],
    Snack: [["fruit", "dairy", "fat", "mixed", "carb"]],
  };
  function pickFood(pool, roles, usage, rand, chosen) {
    var c = pool.filter(function (f) {
      return roles.indexOf(f.role) > -1 && chosen.indexOf(f) < 0;
    });
    if (!c.length)
      c = pool.filter(function (f) {
        return chosen.indexOf(f) < 0;
      });
    if (!c.length) return null;
    var m = Math.min.apply(
      null,
      c.map(function (f) {
        return usage[f.id] || 0;
      }),
    );
    c = c.filter(function (f) {
      return (usage[f.id] || 0) === m;
    });
    return c[Math.floor(rand() * c.length)];
  }
  function sq(x) {
    return x * x;
  }
  function genDay(pool, T, nMeals, seed, usage) {
    var rand = mulberry(seed),
      slots = GSLOTS[nMeals],
      tg = macroTargets(T),
      items = [];
    slots.forEach(function (sl, si) {
      var chosen = [];
      GROLES[sl[0]].forEach(function (roles) {
        var f = pickFood(pool, roles, usage, rand, chosen);
        if (f) {
          chosen.push(f);
          usage[f.id] = (usage[f.id] || 0) + 1;
          items.push({
            f: f,
            s: si,
            q: 1,
            mx: f.role === "fat" || f.role === "light" ? 2 : GMAX,
          });
        }
      });
    });
    function sums() {
      var t = { c: 0, p: 0, cb: 0, ft: 0 },
        sk = slots.map(function () {
          return 0;
        });
      items.forEach(function (i) {
        t.c += i.f.c * i.q;
        t.p += (i.f.p || 0) * i.q;
        t.cb += (i.f.cb || 0) * i.q;
        t.ft += (i.f.ft || 0) * i.q;
        sk[i.s] += i.f.c * i.q;
      });
      return { t: t, sk: sk };
    }
    function loss() {
      var r = sums(),
        t = r.t;
      var L =
        4 * sq((t.c - T) / T) +
        2 * sq((t.p - tg.p) / Math.max(tg.p, 1)) +
        sq((t.cb - tg.cb) / Math.max(tg.cb, 1)) +
        sq((t.ft - tg.ft) / Math.max(tg.ft, 1));
      slots.forEach(function (sl, si) {
        L += sq((r.sk[si] - T * sl[1]) / T);
      });
      items.forEach(function (i) {
        L += 0.05 * sq((i.q - 1) / GMAX);
      }); /* prefer ordinary portions */
      return L;
    }
    for (var pass = 0; pass < 400; pass++) {
      var improved = false;
      items.forEach(function (it) {
        var best = loss(),
          q0 = it.q;
        [q0 + GSTEP, q0 - GSTEP].forEach(function (nq) {
          if (nq < GSTEP - 1e-9 || nq > it.mx + 1e-9) return;
          it.q = nq;
          var l = loss();
          if (l < best - 1e-12) {
            best = l;
            q0 = nq;
            improved = true;
          }
        });
        it.q = q0;
      });
      if (!improved) break;
    }
    var r = sums();
    return {
      tg: tg,
      tot: r.t,
      savedAs: null,
      items: items.map(function (i) {
        return {
          n: i.f.n,
          s: i.f.s,
          c: i.f.c,
          p: i.f.p,
          cb: i.f.cb,
          ft: i.f.ft,
          q: i.q,
          m: slots[i.s][0],
        };
      }),
    };
  }
  function uniquePlanName(base) {
    var n = base,
      k = 2;
    while (
      S.plans.some(function (p) {
        return p.name.toLowerCase() === n.toLowerCase();
      })
    )
      n = base + " " + k++;
    return n;
  }
  function saveGenDay(i) {
    var d = genRes.days[i];
    if (d.savedAs) return true;
    if (S.plans.length >= 50) {
      genRes.err = "You can save up to 50 plans.";
      return false;
    }
    var nm = uniquePlanName("Generated meal " + (i + 1));
    S.plans.push({
      id: newId(),
      name: nm,
      days: [],
      items: d.items.map(function (it) {
        return Object.assign({}, it);
      }),
    });
    d.savedAs = nm;
    save();
    return true;
  }
  function generatorCard() {
    var card = el(
      "div",
      { cls: "card" },
      el("h2", { text: "Generate a meal plan" }),
    );
    if (!S.plan) {
      card.appendChild(
        el("p", {
          cls: "mut",
          text: "Save your plan first (Plan tab). The generator uses your calorie and macro targets.",
        }),
      );
      return card;
    }
    if (!S.foods.length) {
      card.appendChild(
        el("p", {
          cls: "mut",
          text: "Save some foods in My foods first, or add the starter foods below. The generator builds meals from the foods you saved.",
        }),
      );
      return card;
    }
    var c = compute(S.plan);
    if (genOpts.kcal === "") genOpts.kcal = String(r0(c.target));
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Builds meals from the foods you tick below so the day lands close to your calorie and macro targets. Nothing is saved until you click Save.",
      }),
    );
    var dS = el("select"),
      mS = el("select"),
      kI = el("input", { "data-num": "1", value: genOpts.kcal });
    for (var i = 1; i <= 7; i++)
      dS.appendChild(
        el("option", { value: i, text: i + (i === 1 ? " day" : " days") }),
      );
    dS.value = String(genOpts.days);
    mS.appendChild(el("option", { value: "3", text: "3 meals" }));
    mS.appendChild(el("option", { value: "4", text: "3 meals and a snack" }));
    mS.value = String(genOpts.meals);
    dS.addEventListener("change", function () {
      genOpts.days = +dS.value;
    });
    mS.addEventListener("change", function () {
      genOpts.meals = +mS.value;
    });
    kI.addEventListener("input", function () {
      genOpts.kcal = kI.value;
    });
    card.appendChild(
      el(
        "div",
        { cls: "grid" },
        el("label", { text: "Days to generate" }, dS),
        el("label", { text: "Meals per day" }, mS),
        el("label", { text: "Daily calories (" + c.floor + " to 6,000)" }, kI),
      ),
    );
    var dietS = el("select");
    DIETS.forEach(function (d) {
      dietS.appendChild(el("option", { value: d[0], text: d[1] }));
    });
    dietS.value = genOpts.diet;
    dietS.addEventListener("change", function () {
      genOpts.diet = dietS.value;
    });
    card.appendChild(
      el(
        "div",
        { cls: "grid", style: "margin-top:10px" },
        el("label", { text: "Diet" }, dietS),
      ),
    );
    card.appendChild(
      el("div", {
        style: "font-size:14px;font-weight:600;margin-top:10px",
        text: "Leave out foods that contain",
      }),
    );
    TAGS.forEach(function (t) {
      var cb = el("input", {
        type: "checkbox",
        style: "width:auto;margin:0 6px 0 0",
      });
      cb.checked = !!genOpts.avoid[t[0]];
      cb.addEventListener("change", function () {
        genOpts.avoid[t[0]] = cb.checked;
      });
      card.appendChild(
        el(
          "label",
          {
            style:
              "display:inline-flex;align-items:center;font-weight:400;margin:6px 14px 0 0",
          },
          cb,
          t[1],
        ),
      );
    });
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Filters only use the tags on your foods, so check labels yourself. Foods that were never checked are left out while a filter is on.",
      }),
    );
    card.appendChild(
      el("div", {
        style: "font-size:14px;font-weight:600;margin-top:10px",
        text: "Foods to use",
      }),
    );
    var box = el("div", {
      style:
        "max-height:200px;overflow:auto;border:1px solid var(--rule);border-radius:6px;padding:4px 8px;margin-top:4px",
    });
    sortedFoods().forEach(function (f) {
      var cb = el("input", {
        type: "checkbox",
        style: "width:auto;margin:0 8px 0 0",
      });
      cb.checked = !genOpts.off[f.id];
      cb.addEventListener("change", function () {
        genOpts.off[f.id] = !cb.checked;
      });
      box.appendChild(
        el(
          "label",
          {
            style:
              "display:flex;align-items:center;font-weight:400;padding:4px 0",
          },
          cb,
          f.n + " (" + f.s + ") \u00b7 " + trim(f.c, 6) + " kcal",
        ),
      );
    });
    card.appendChild(box);
    var ge = el("div", { cls: "err", hidden: "hidden" });
    card.appendChild(ge);
    card.appendChild(
      el("button", {
        cls: "btn",
        type: "button",
        text: "Generate",
        on: [
          "click",
          function () {
            var errs = [],
              T = num(genOpts.kcal),
              pool = [],
              skipped = [];
            if (!isFinite(T) || T < c.floor || T > 6000)
              errs.push(
                "Daily calories must be a number from " +
                  c.floor +
                  " to 6,000.",
              );
            sortedFoods().forEach(function (f) {
              if (genOpts.off[f.id]) return;
              var why = eligible(f) || blocked(f);
              if (why) skipped.push(f.n + " (" + why + ")");
              else pool.push(Object.assign({ role: foodRole(f) }, f));
            });
            if (pool.length < 2)
              errs.push(
                "Tick at least 2 foods that have calories and at least one macro filled in." +
                  (skipped.length
                    ? " Skipped: " + skipped.join(", ") + "."
                    : ""),
              );
            if (errs.length) {
              showErr(ge, errs);
              return;
            }
            var usage = {},
              days = [],
              seed = genOpts.seed++;
            for (var k = 0; k < genOpts.days; k++)
              days.push(genDay(pool, T, genOpts.meals, seed * 100 + k, usage));
            genRes = { days: days, skipped: skipped, T: T, err: "" };
            renderMeals();
          },
        ],
      }),
    );
    return card;
  }
  function genPreviewCard() {
    if (!genRes) return null;
    var card = el(
      "div",
      { cls: "card" },
      el("h2", { text: "Generated meal plans" }),
    );
    if (genRes.skipped.length)
      card.appendChild(
        el("p", {
          cls: "mut",
          text: "Skipped: " + genRes.skipped.join(", ") + ".",
        }),
      );
    genRes.days.forEach(function (d, di) {
      var blk = el(
        "div",
        { style: "padding:10px 0;border-top:1px solid var(--rule)" },
        el("div", { style: "font-weight:600", text: "Meal plan " + (di + 1) }),
      );
      var t = el("table");
      d.items.forEach(function (it) {
        t.appendChild(
          el(
            "tr",
            {},
            el(
              "td",
              {},
              it.m +
                ": " +
                it.n +
                " (" +
                (it.q === 1 ? "" : trim(it.q, 6) + " x ") +
                it.s +
                ")",
              el("div", {
                cls: "mut",
                text:
                  "Per serving: " + trim(it.c, 6) + " kcal \u00b7 " + nutr(it),
              }),
            ),
            el(
              "td",
              {},
              trim(it.c * it.q, 4) + " kcal",
              el("div", {
                cls: "mut",
                text: nutr({
                  p: (it.p || 0) * it.q,
                  cb: (it.cb || 0) * it.q,
                  ft: (it.ft || 0) * it.q,
                }),
              }),
            ),
          ),
        );
      });
      blk.appendChild(el("div", { cls: "scroll" }, t));
      var x = d.tot,
        g = d.tg,
        dc = x.c - g.c;
      blk.appendChild(
        el("p", { style: "font-weight:600", text: "Total: " + fmtTot(x) }),
      );
      blk.appendChild(
        el("p", {
          cls: "mut",
          text:
            "Target: " +
            r0(g.c) +
            " kcal \u00b7 Protein " +
            r0(g.p) +
            " g \u00b7 Carbs " +
            r0(g.cb) +
            " g \u00b7 Fat " +
            r0(g.ft) +
            " g. Calories are " +
            Math.abs(r0(dc)) +
            " kcal (" +
            (Math.abs(dc / g.c) * 100).toFixed(1) +
            "%) " +
            (dc >= 0 ? "above" : "below") +
            " the target; protein " +
            (x.p - g.p >= 0 ? "+" : "-") +
            Math.abs(r0(x.p - g.p)) +
            " g, carbs " +
            (x.cb - g.cb >= 0 ? "+" : "-") +
            Math.abs(r0(x.cb - g.cb)) +
            " g, fat " +
            (x.ft - g.ft >= 0 ? "+" : "-") +
            Math.abs(r0(x.ft - g.ft)) +
            " g.",
        }),
      );
      if (
        Math.abs(dc / g.c) > 0.05 ||
        Math.abs(x.p - g.p) / Math.max(g.p, 1) > 0.15
      )
        blk.appendChild(
          el("div", {
            cls: "note w",
            text: "This plan could not match your targets closely with the foods selected. Add a protein source and a carb source, or tick more foods, and generate again.",
          }),
        );
      if (d.savedAs)
        blk.appendChild(
          el("p", {
            cls: "mut",
            text:
              "Saved as \u201c" +
              d.savedAs +
              "\u201d. Find it in Meal plans below, where you can rename it and assign weekdays.",
          }),
        );
      else
        blk.appendChild(
          el("button", {
            cls: "btn",
            type: "button",
            text: "Save as meal plan",
            on: [
              "click",
              function () {
                genRes.err = "";
                saveGenDay(di);
                renderMeals();
              },
            ],
          }),
        );
      card.appendChild(blk);
    });
    if (genRes.err)
      card.appendChild(el("div", { cls: "err", text: genRes.err }));
    if (
      genRes.days.length > 1 &&
      genRes.days.some(function (d) {
        return !d.savedAs;
      })
    )
      card.appendChild(
        el("button", {
          cls: "btn",
          type: "button",
          text: "Save all",
          on: [
            "click",
            function () {
              genRes.err = "";
              for (var i = 0; i < genRes.days.length; i++)
                if (!saveGenDay(i)) break;
              renderMeals();
            },
          ],
        }),
      );
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Built only from the foods you saved, using the nutrition values you entered. Check allergies, dietary needs, and portion sizes yourself. This is not medical or dietitian advice.",
      }),
    );
    return card;
  }

  function renderMeals() {
    var host = $("meals");
    clear(host);
    if (!planDraft) planDraft = newDraft();
    host.appendChild(foodFormCard());
    host.appendChild(foodListCard());
    host.appendChild(starterCard());
    host.appendChild(generatorCard());
    var gp = genPreviewCard();
    if (gp) host.appendChild(gp);
    host.appendChild(planBuilderCard());
    host.appendChild(plansListCard());
  }

  /* ---------- fasting ---------- */
  /* Daily time-restricted eating: fasts of 12 to 24 hours (reviews define
     intermittent fasting as fasting for 12 hours or more). Logged fasts are
     1 to 72 hours. Durations come from exact timestamps, so overnight fasts
     and daylight saving changes are counted correctly. */
  var FPRE = [
      ["16:8", 16],
      ["12:12", 12],
      ["14:10", 14],
      ["18:6", 18],
      ["20:4", 20],
    ],
    FMIN = 12,
    FMAX = 24,
    LOGMIN = 1,
    LOGMAX = 72;
  var SCREEN = [
    "I have diabetes or take medication that lowers blood sugar (such as insulin)",
    "I am pregnant, breastfeeding, or trying to conceive",
    "I have, or have had, an eating disorder",
    "I have kidney, liver, heart, or blood pressure disease, or take regular medication that must be taken with food",
    "I am recovering from surgery or a serious illness",
    "A doctor has told me not to fast, or I am not sure fasting is safe for me",
  ];
  var fastTick = null,
    editF = null; /* id of the logged fast being edited */
  function stopTick() {
    if (fastTick) {
      clearInterval(fastTick);
      fastTick = null;
    }
  }
  function hm(h) {
    var m = Math.round(h * 60);
    return Math.floor(m / 60) + " h " + pad(m % 60) + " m";
  }
  function toInput(ms) {
    var d = new Date(ms);
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }
  function fromInput(s) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s || "")) return NaN;
    var t = new Date(s).getTime();
    return isNaN(t) || toInput(t) !== s ? NaN : t;
  }
  function fdt(ms) {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function kindName(k, t) {
    return k === "custom" ? "custom " + t + " h" : k;
  }
  /* Fasting is open only after a clean safety check and while BMI is 18.5+. */
  function fastGate() {
    var m = S.plan.cm / 100,
      bmi = weightOn(todayStr()) / (m * m);
    return { bmi: bmi, under: bmi < 18.5, open: S.fast.ok && bmi >= 18.5 };
  }
  function checkSpan(s, e, skipId) {
    var errs = [],
      now = Date.now(),
      F = S.fast;
    if (isNaN(s) || isNaN(e))
      return ["Enter a valid start and end date and time."];
    if (e <= s) errs.push("The end must be after the start.");
    else {
      var h = (e - s) / 36e5;
      if (h < LOGMIN) errs.push("A fast must be at least 1 hour long.");
      if (h > LOGMAX) errs.push("A fast can be at most 72 hours long.");
    }
    if (e > now + 6e4) errs.push("The end cannot be in the future.");
    F.log.forEach(function (o) {
      if (o.id !== skipId && s < o.e && e > o.s)
        errs.push(
          "This fast overlaps one you already logged (" +
            fdt(o.s) +
            " to " +
            fdt(o.e) +
            ").",
        );
    });
    if (F.active && e > F.active.s && s < now)
      errs.push("This fast overlaps the one that is running now.");
    return errs;
  }
  function screenCard(gate) {
    var card = el(
      "form",
      { cls: "card", novalidate: "novalidate" },
      el("h2", { text: "Fasting safety check" }),
    );
    if (gate.under) {
      card.appendChild(
        el("div", {
          cls: "note w",
          text:
            "Your current BMI is " +
            gate.bmi.toFixed(1) +
            ", which is below 18.5, so fasting stays locked. Fasting can be unsafe when underweight. Please talk to a doctor.",
        }),
      );
      return card;
    }
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "Fasting stays locked until you answer. Tick every statement that applies to you. Your answers are not saved, only the result.",
      }),
    );
    var boxes = SCREEN.map(function (t) {
      var cb = el("input", {
        type: "checkbox",
        style: "width:auto;margin:0 8px 0 0",
      });
      card.appendChild(
        el(
          "label",
          {
            style:
              "display:flex;align-items:flex-start;font-weight:400;margin-top:8px",
          },
          cb,
          t,
        ),
      );
      return cb;
    });
    var conf = el("input", {
      type: "checkbox",
      style: "width:auto;margin:0 8px 0 0",
    });
    card.appendChild(
      el(
        "label",
        { style: "display:flex;align-items:flex-start;margin-top:12px" },
        conf,
        "I confirm my answers are accurate.",
      ),
    );
    var box = el("div", { cls: "err", hidden: "hidden" });
    card.appendChild(box);
    card.appendChild(
      el("button", { cls: "btn", type: "submit", text: "Check my answers" }),
    );
    card.appendChild(
      el("p", {
        cls: "mut",
        text: "This app cannot tell whether fasting is safe for you. It is not medical advice.",
      }),
    );
    card.addEventListener("submit", function (e) {
      e.preventDefault();
      var any = boxes.some(function (b) {
        return b.checked;
      });
      if (!conf.checked) {
        showErr(box, ["Tick the confirmation box to continue."]);
        return;
      }
      if (any) {
        S.fast.ok = false;
        S.fast.active = null;
        save();
        showErr(box, [
          "Fasting stays locked. The conditions you ticked can make fasting unsafe. Please talk to a doctor before fasting. If your situation changes, check again here.",
        ]);
        return;
      }
      S.fast.ok = true;
      S.fast.at = Date.now();
      save();
      renderFast();
    });
    return card;
  }
  function renderFast() {
    var host = $("fast");
    stopTick();
    if (needPlan(host)) return;
    clear(host);
    var F = S.fast,
      gate = fastGate();
    if (!gate.open) {
      host.appendChild(screenCard(gate));
      return;
    }

    /* target */
    var tc = el(
      "form",
      { cls: "card", novalidate: "novalidate" },
      el("h2", { text: "Your fasting target" }),
    );
    var sel = el("select", { id: "fk" });
    FPRE.forEach(function (x) {
      sel.appendChild(
        el("option", {
          value: x[0],
          text:
            x[0] + " (" + x[1] + " h fasting, " + (24 - x[1]) + " h eating)",
        }),
      );
    });
    sel.appendChild(el("option", { value: "custom", text: "Custom length" }));
    sel.value = F.kind;
    var hI = el("input", { id: "fh", value: String(F.hours) }),
      lH = el("label", { text: "Fasting hours (12 to 24)" }, hI);
    function syncT() {
      lH.hidden = sel.value !== "custom";
    }
    sel.addEventListener("change", syncT);
    syncT();
    var tg = el(
      "div",
      { cls: "grid" },
      el("label", { text: "Fasting type" }, sel),
      lH,
    );
    tc.appendChild(tg);
    var te = el("div", { cls: "err", hidden: "hidden" });
    tc.appendChild(te);
    tc.appendChild(
      el("p", {
        cls: "mut",
        text:
          "Current target: " +
          kindName(F.kind, F.hours) +
          ", a " +
          F.hours +
          " hour fast with a " +
          (24 - F.hours) +
          " hour eating window. Fasts of 12 to 24 hours are supported.",
      }),
    );
    tc.appendChild(
      el("button", { cls: "btn", type: "submit", text: "Save target" }),
    );
    tc.addEventListener("submit", function (e) {
      e.preventDefault();
      var kind = sel.value,
        hours;
      if (kind === "custom") {
        hours = num(hI.value);
        if (!isFinite(hours) || hours < FMIN || hours > FMAX) {
          showErr(te, ["Fasting hours must be a number from 12 to 24."]);
          return;
        }
      } else {
        FPRE.forEach(function (x) {
          if (x[0] === kind) hours = x[1];
        });
      }
      F.kind = kind;
      F.hours = hours;
      save();
      renderFast();
    });
    host.appendChild(tc);

    /* running fast or start form */
    if (F.active) {
      var a = F.active,
        cc = el("div", { cls: "card" }, el("h2", { text: "Fast in progress" }));
      var big = el("span", { cls: "big num", text: "" }),
        st = el("span", { text: "" });
      cc.appendChild(el("div", { cls: "hero" }, big, st));
      var barI = el("i", { style: "width:0%" });
      cc.appendChild(el("div", { cls: "bar" }, barI));
      cc.appendChild(
        el("div", {
          cls: "mut",
          text:
            "Started " +
            fdt(a.s) +
            ". Target " +
            a.t +
            " h (" +
            kindName(a.k, a.t) +
            "). Eating window opens " +
            fdt(a.s + a.t * 36e5) +
            ".",
        }),
      );
      var warn = el("div", {
        cls: "note w",
        text: "You have fasted for over 24 hours. Fasts this long are outside what this app supports. Please end your fast and eat.",
        hidden: "hidden",
      });
      cc.appendChild(warn);
      var ce = el("div", { cls: "err", hidden: "hidden" });
      cc.appendChild(ce);
      var paint = function () {
        var h = (Date.now() - a.s) / 36e5;
        big.textContent = hm(h);
        st.textContent =
          h >= a.t
            ? "Target reached. You can end your fast."
            : hm(a.t - h) + " to go";
        barI.setAttribute(
          "style",
          "width:" + Math.min(100, (h / a.t) * 100) + "%",
        );
        warn.hidden = h <= 24;
      };
      paint();
      fastTick = setInterval(paint, 1000);
      cc.appendChild(
        el("button", {
          cls: "btn",
          type: "button",
          text: "End fast",
          on: [
            "click",
            function () {
              var now = Date.now(),
                h = (now - a.s) / 36e5;
              if (h < LOGMIN) {
                showErr(ce, [
                  "A fast shorter than 1 hour cannot be logged. Keep going, or discard it.",
                ]);
                return;
              }
              if (h > LOGMAX) {
                showErr(ce, [
                  "This fast is longer than 72 hours, which the app cannot log. Discard it, then use Log a past fast with the correct times.",
                ]);
                return;
              }
              F.log.push({ id: newId(), s: a.s, e: now, t: a.t, k: a.k });
              F.active = null;
              save();
              renderFast();
            },
          ],
        }),
      );
      cc.appendChild(
        el("button", {
          cls: "btn alt",
          type: "button",
          text: "Discard fast",
          on: [
            "click",
            function (e) {
              var b = e.target;
              if (b.dataset.s) {
                F.active = null;
                save();
                renderFast();
              } else {
                b.dataset.s = "1";
                b.textContent = "Click again to discard";
              }
            },
          ],
        }),
      );
      host.appendChild(cc);
    } else {
      var sc = el(
        "form",
        { cls: "card", novalidate: "novalidate" },
        el("h2", { text: "Start a fast" }),
      );
      var fsI = el("input", {
        id: "fs",
        type: "datetime-local",
        value: toInput(Date.now()),
      });
      sc.appendChild(
        el("div", { cls: "grid" }, el("label", { text: "Started at" }, fsI)),
      );
      var se = el("div", { cls: "err", hidden: "hidden" });
      sc.appendChild(se);
      sc.appendChild(
        el("p", {
          cls: "mut",
          text: "Drink water during your fast. Stop and eat if you feel dizzy, faint, or unwell.",
        }),
      );
      sc.appendChild(
        el("button", { cls: "btn", type: "submit", text: "Start fast" }),
      );
      sc.addEventListener("submit", function (e) {
        e.preventDefault();
        var s = fromInput(fsI.value),
          now = Date.now(),
          errs = [];
        if (isNaN(s)) errs.push("Enter a valid start date and time.");
        else {
          if (s > now + 6e4) errs.push("The start cannot be in the future.");
          if (now - s > LOGMAX * 36e5)
            errs.push("The start must be within the last 72 hours.");
          if (
            F.log.some(function (o) {
              return s < o.e && now > o.s;
            })
          )
            errs.push("This start overlaps a fast you already logged.");
        }
        if (errs.length) {
          showErr(se, errs);
          return;
        }
        F.active = { s: s, t: F.hours, k: F.kind };
        save();
        renderFast();
      });
      host.appendChild(sc);
    }

    /* log a past fast (also used for editing) */
    var ed = null;
    F.log.forEach(function (o) {
      if (o.id === editF) ed = o;
    });
    if (!ed) editF = null;
    var lc = el(
      "form",
      { cls: "card", novalidate: "novalidate" },
      el("h2", { text: ed ? "Edit fast" : "Log a past fast" }),
    );
    var lsI = el("input", {
        id: "ls",
        type: "datetime-local",
        value: ed ? toInput(ed.s) : "",
      }),
      leI = el("input", {
        id: "le",
        type: "datetime-local",
        value: ed ? toInput(ed.e) : "",
      });
    lc.appendChild(
      el(
        "div",
        { cls: "grid" },
        el("label", { text: "Fast started" }, lsI),
        el("label", { text: "Fast ended" }, leI),
      ),
    );
    var le = el("div", { cls: "err", hidden: "hidden" });
    lc.appendChild(le);
    lc.appendChild(
      el("button", {
        cls: "btn",
        type: "submit",
        text: ed ? "Save changes" : "Save fast",
      }),
    );
    if (ed)
      lc.appendChild(
        el("button", {
          cls: "btn alt",
          type: "button",
          text: "Cancel edit",
          on: [
            "click",
            function () {
              editF = null;
              renderFast();
            },
          ],
        }),
      );
    lc.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = fromInput(lsI.value),
        en = fromInput(leI.value),
        errs = checkSpan(s, en, ed ? ed.id : null);
      if (errs.length) {
        showErr(le, errs);
        return;
      }
      if (ed) {
        ed.s = s;
        ed.e = en;
      } else F.log.push({ id: newId(), s: s, e: en, t: F.hours, k: F.kind });
      editF = null;
      save();
      renderFast();
    });
    host.appendChild(lc);

    /* history */
    var hc = el("div", { cls: "card" }, el("h2", { text: "Last 14 fasts" })),
      list = F.log
        .slice()
        .sort(function (x, y) {
          return y.s - x.s;
        })
        .slice(0, 14);
    if (!list.length)
      hc.appendChild(el("p", { cls: "mut", text: "No fasts logged yet." }));
    else {
      var week = F.log.filter(function (o) {
          return o.e >= Date.now() - 7 * 864e5;
        }),
        hit = week.filter(function (o) {
          return (o.e - o.s) / 36e5 >= o.t - 1e-9;
        }).length,
        avg = week.length
          ? week.reduce(function (n, o) {
              return n + (o.e - o.s) / 36e5;
            }, 0) / week.length
          : 0;
      if (week.length)
        hc.appendChild(
          el("p", {
            text:
              "Last 7 days: " +
              week.length +
              " fast" +
              (week.length > 1 ? "s" : "") +
              ", " +
              hit +
              " reached the target, average " +
              hm(avg) +
              ".",
          }),
        );
      var t = el("table");
      list.forEach(function (o) {
        var h = (o.e - o.s) / 36e5,
          res = h >= o.t - 1e-9 ? "reached target" : "short by " + hm(o.t - h);
        t.appendChild(
          el(
            "tr",
            {},
            el(
              "td",
              {},
              fdt(o.s) + " to " + fdt(o.e),
              el("div", {
                cls: "mut",
                text: hm(h) + " fasted, " + kindName(o.k, o.t) + ", " + res,
              }),
            ),
            el(
              "td",
              {},
              el(
                "span",
                { style: "display:inline-flex;gap:6px" },
                el("button", {
                  cls: "btn del",
                  type: "button",
                  "aria-label": "Edit fast",
                  style: "color:var(--acc)",
                  text: "Edit",
                  on: [
                    "click",
                    function () {
                      editF = o.id;
                      renderFast();
                      var f = $("ls");
                      if (f) {
                        f.focus();
                        f.scrollIntoView({ block: "center" });
                      }
                    },
                  ],
                }),
                el("button", {
                  cls: "btn del",
                  type: "button",
                  "aria-label": "Delete fast",
                  text: "Delete",
                  on: [
                    "click",
                    function (e) {
                      var b = e.target;
                      if (b.dataset.s) {
                        F.log = F.log.filter(function (x) {
                          return x.id !== o.id;
                        });
                        if (editF === o.id) editF = null;
                        save();
                        renderFast();
                      } else {
                        b.dataset.s = "1";
                        b.textContent = "Confirm";
                      }
                    },
                  ],
                }),
              ),
            ),
          ),
        );
      });
      hc.appendChild(el("div", { cls: "scroll" }, t));
    }
    hc.appendChild(
      el("p", {
        cls: "mut",
        text: "For general information, not medical advice. Stop fasting and eat if you feel dizzy, faint, or unwell.",
      }),
    );
    hc.appendChild(
      el("button", {
        cls: "btn alt",
        type: "button",
        text: "Retake safety check",
        on: [
          "click",
          function () {
            S.fast.ok = false;
            S.fast.active = null;
            save();
            renderFast();
          },
        ],
      }),
    );
    host.appendChild(hc);
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
        wrate(Math.abs(rate)) +
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
        wrate(Math.abs(exp)) +
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
  var editW = null; /* date of the weigh-in being edited */
  /* One history row. Tapping the date opens that day's foods and nutrients. */
  function dayRows(ht, d) {
    var t2 = totals(d),
      b = budget(d),
      n = t2.c - b,
      L = S.logs[d],
      det = el("td", { colspan: "4", style: "text-align:left" }),
      dr = el("tr", { hidden: "hidden" }, det);
    if (!L.f.length)
      det.appendChild(
        el("p", { cls: "mut", text: "No food logged for this day." }),
      );
    else {
      L.f.forEach(function (e) {
        det.appendChild(
          el(
            "div",
            { style: "padding:6px 0;border-bottom:1px solid var(--rule)" },
            el("div", {
              text: e.m + ": " + e.n + " (" + trim(e.c, 6) + " kcal)",
            }),
            el("div", { cls: "mut", text: nutr(e) }),
          ),
        );
      });
      det.appendChild(
        el("div", {
          style: "padding-top:8px;font-weight:600",
          text:
            "Total: " +
            trim(t2.c, 6) +
            " kcal \u00b7 Protein " +
            trim(t2.p, 6) +
            " g \u00b7 Carbs " +
            trim(t2.cb, 6) +
            " g \u00b7 Fat " +
            trim(t2.ft, 6) +
            " g",
        }),
      );
    }
    var btn = el("button", {
      type: "button",
      "aria-expanded": "false",
      style:
        "background:none;border:0;padding:4px 0;font:inherit;color:var(--acc);text-decoration:underline;cursor:pointer;text-align:left",
      text: "\u25b8 " + fd(d),
      on: [
        "click",
        function () {
          dr.hidden = !dr.hidden;
          btn.setAttribute("aria-expanded", String(!dr.hidden));
          btn.textContent = (dr.hidden ? "\u25b8 " : "\u25be ") + fd(d);
        },
      ],
    });
    ht.appendChild(
      el(
        "tr",
        {},
        el("td", {}, btn),
        el("td", { text: r0(t2.c) }),
        el("td", { text: r0(b) }),
        el("td", { text: (n > 0 ? "+" : "") + r0(n) + " kcal" }),
      ),
    );
    ht.appendChild(dr);
  }
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
    var ed = null;
    ws.forEach(function (w) {
      if (w.d === editW && w.d !== p.start) ed = w;
    });
    if (!ed) editW = null;
    var wf = el("form", { novalidate: "novalidate" });
    var g = el("div", { cls: "grid" });
    g.appendChild(
      el(
        "label",
        { text: "Date" },
        el("input", { id: "wd", type: "date", value: ed ? ed.d : todayStr() }),
      ),
    );
    g.appendChild(
      el(
        "label",
        { text: "Weight (" + p.wu + ")" },
        el("input", {
          id: "ww",
          step: "any",
          value: ed
            ? String(+(p.wu === "lb" ? ed.kg / LB : ed.kg).toFixed(6))
            : "",
        }),
      ),
    );
    if (ed)
      wf.appendChild(
        el("p", {
          cls: "mut",
          text:
            "Editing the weigh-in from " +
            fd(ed.d) +
            ". Change the date or weight, then save.",
        }),
      );
    wf.appendChild(g);
    var we = el("div", { cls: "err", hidden: "hidden" });
    wf.appendChild(we);
    wf.appendChild(
      el("button", {
        cls: "btn",
        type: "submit",
        text: ed ? "Save changes" : "Save weigh-in",
      }),
    );
    if (ed)
      wf.appendChild(
        el("button", {
          cls: "btn alt",
          type: "button",
          text: "Cancel edit",
          on: [
            "click",
            function () {
              editW = null;
              renderProg();
            },
          ],
        }),
      );
    wf.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = $("wd").value,
        v = num($("ww").value) * (p.wu === "lb" ? LB : 1),
        errs = [];
      if (!validDate(d)) errs.push("Enter a valid date.");
      else if (d > todayStr())
        errs.push("Weigh-in date cannot be in the future.");
      else if (d === p.start)
        errs.push(
          "The weigh-in for your plan start date comes from your plan. Change it on the Plan tab.",
        );
      if (!isFinite(v) || v < 35 || v > 300)
        errs.push("Weight must be between 35 and 300 kg (77 to 661 lb).");
      if (errs.length) {
        showErr(we, errs);
        return;
      }
      S.weights = S.weights.filter(function (w) {
        return w.d !== d && w.d !== editW;
      });
      S.weights.push({ d: d, kg: v });
      editW = null;
      save();
      renderProg();
    });
    sc.appendChild(wf);
    var t = el(
      "table",
      {},
      el(
        "tr",
        {},
        el("th", { text: "Date" }),
        el("th", { text: "Weight" }),
        el("th", { text: "" }),
      ),
    );
    ws.slice()
      .reverse()
      .forEach(function (w) {
        var act;
        if (w.d === p.start)
          act = el("span", { cls: "mut", text: "Plan start" });
        else
          act = el(
            "span",
            { style: "display:inline-flex;gap:6px" },
            el("button", {
              cls: "btn del",
              type: "button",
              "aria-label": "Edit weigh-in",
              style: "color:var(--acc)",
              text: "Edit",
              on: [
                "click",
                function () {
                  editW = w.d;
                  renderProg();
                  var f = $("ww");
                  if (f) {
                    f.focus();
                    f.scrollIntoView({ block: "center" });
                  }
                },
              ],
            }),
            el("button", {
              cls: "btn del",
              type: "button",
              "aria-label": "Delete weigh-in",
              text: "Delete",
              on: [
                "click",
                function (e) {
                  var b = e.target;
                  if (b.dataset.s) {
                    if (S.weights.length <= 1) {
                      showErr(we, ["Keep at least one weigh-in."]);
                      return;
                    }
                    S.weights = S.weights.filter(function (o) {
                      return o.d !== w.d;
                    });
                    if (editW === w.d) editW = null;
                    save();
                    renderProg();
                  } else {
                    b.dataset.s = "1";
                    b.textContent = "Confirm";
                  }
                },
              ],
            }),
          );
        t.appendChild(
          el(
            "tr",
            {},
            el("td", { text: fd(w.d) }),
            el("td", { text: wtxt(w.kg) }),
            el("td", {}, act),
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
      dayRows(ht, d);
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
          text: "Net is eaten minus budget. Negative means you ate less than your budget. Tap a date to see the foods and nutrients.",
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
