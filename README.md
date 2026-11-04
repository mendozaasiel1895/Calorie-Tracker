# Calorie Tracker

A calorie tracker that runs entirely in your browser. Choose to **lose**, **maintain**, or **gain** weight, get a daily calorie target for your goal and timeline, then log food, exercise, and weigh-ins day by day.

No server, no account, no build step. Your data stays in your browser's local storage.

## Features

- **Three goals**: lose weight (calorie deficit), maintain weight, or gain weight (calorie surplus)
- **Personalized plan** from age, sex, height, weight, goal weight, duration, and activity level
- **Daily calorie target and macros** (protein, fat, carbs)
- **Daily log** with food entries (calories plus optional macros) and exercise entries
- **Live budget** showing calories left or over, with a progress bar and "Day X of Y" counter
- **Exercise calories** from the 2024 Compendium of Physical Activities: pick an activity and intensity, or enter speed (and grade) for walking, running, and cycling
- **Weight chart** with your weigh-ins, a 7-day average line, and your planned path
- **Weekly check** that compares your weight trend with the plan and suggests a target adjustment you can apply or ignore
- **Weight tracking** with progress toward your goal
- **14-day history** of eaten vs. budget
- **Unit support**: kg or lb, cm or ft + in
- **Input validation** on every field (numbers only, sensible ranges, safety limits)

## Getting started

1. Download or clone the repository.
2. Open `Calorie Tracker.html` in any modern browser.

That's it. No installation or dependencies. The page loads one web font (Barlow Semi Condensed) from Google Fonts and falls back to system fonts if offline.

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
# then open "Calorie Tracker.html" in your browser
```

## How to use

1. **Plan tab**: pick your goal, fill in your details, and click **Calculate and save plan**. The app shows your BMR, maintenance calories, daily deficit or surplus, calorie target, expected weekly loss, BMI, and macro targets.
2. **Daily log tab**: pick a date, then add what you ate and any exercise. The large number shows calories left in today's budget.
3. **Progress tab**: save weigh-ins, see your weight chart and how far you are from your goal, read the weekly check, and review the last 14 days.

### Eat back exercise calories

This setting controls how much of your logged exercise is added to your daily budget:

| Setting                 | Effect                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| 0% (strict)             | Budget stays at your target. Every workout calorie adds to a deficit (or cuts into a surplus). |
| 50% (good for losing)   | Half of the workout burn is added to your budget.                                              |
| 100% (good for gaining) | Your full workout burn is added, so the planned deficit or surplus holds steady.               |

Changing the goal sets this to 50% for losing and 100% for maintaining or gaining. You can change it afterwards.

Because your maintenance calories do not include logged workouts, your budget goes up when you log exercise unless this is set to 0%. When gaining, the daily log shows "kcal to reach target" so you know how much more to eat.

## How the numbers are calculated

| Value                    | Formula                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| BMR (Mifflin-St Jeor)    | `10 × kg + 6.25 × cm − 5 × age + 5` (male) or `− 161` (female)              |
| Maintenance (TDEE)       | `BMR × activity multiplier`                                                 |
| Activity multipliers     | Sedentary 1.2, Light 1.375, Moderate 1.55, High 1.725                       |
| Plan length              | Days from the start date to the start date plus the chosen number of months |
| Required daily change    | `kg to lose or gain × 7,700 ÷ plan days`                                    |
| Allowed deficit (lose)   | Capped at the smaller of 1,000 kcal and `TDEE − calorie floor`              |
| Allowed surplus (gain)   | Capped at 500 kcal                                                          |
| Calorie floor            | 1,500 kcal (male), 1,200 kcal (female)                                      |
| Daily target             | Lose: `TDEE − deficit`. Gain: `TDEE + surplus`. Maintain: `TDEE`            |
| Expected change per week | `daily deficit or surplus × 7 ÷ 7,700` kg                                   |
| BMI                      | `kg ÷ (height in m)²`                                                       |
| Protein                  | The smaller of `1.6 g × kg` and 35% of target calories ÷ 4                  |
| Fat                      | 25% of target calories ÷ 9                                                  |
| Carbs                    | Remaining calories ÷ 4                                                      |
| Exercise burn            | `(MET − 1) × kg × minutes ÷ 60`, using your weigh-in on or before that date |
| Daily budget             | `target + eat-back % × exercise burn`                                       |

If the goal can't be reached safely in the chosen time, the app caps the deficit or surplus and shows a realistic finish date instead. It also warns when a plan loses more than 1% of body weight per week or gains more than 0.5% per week.

**Example** (31-year-old male, 180.34 cm, 90 kg, 6 months starting 4 Nov 2026, sedentary): BMR 1,877 kcal, maintenance 2,253 kcal, 181 days.

| Goal          | Deficit or surplus     | Daily target     |
| ------------- | ---------------------- | ---------------- |
| Lose to 80 kg | about 425 kcal deficit | about 1,827 kcal |
| Gain to 95 kg | about 213 kcal surplus | about 2,465 kcal |
| Maintain      | none                   | about 2,253 kcal |

### Exercise calories

Burn is **net**: `(MET − 1) × kg × hours`. Your maintenance calories already include resting energy, so the 1 MET of rest is removed to avoid counting it twice. Enter total session time, rest breaks included. Estimates can be off by a wide margin for any one person, which is why the eat-back setting defaults to 50%.

Every activity has levels from beginner to expert. Values are gross METs from the 2024 Adult Compendium of Physical Activities unless marked.

| Activity                                                  | Beginner                     | Intermediate             | Advanced                     | Expert                                    |
| --------------------------------------------------------- | ---------------------------- | ------------------------ | ---------------------------- | ----------------------------------------- |
| Jump rope (jumps per minute, or type your own: 30 to 160) | 30 to 60: **6.0 (estimate)** | 60 to 100: 8.8           | 100 to 130: 11.0             | 130 to 160: 12.3                          |
| Bodyweight and calisthenics                               | Light 2.8                    | Moderate 3.8             | High intensity 6.5           | Vigorous 7.5                              |
| Circuit training                                          | Light 3.5                    | Moderate 5.0             | Bodyweight exercises 6.0     | Vigorous, minimal rest 7.5                |
| Weight training (push, pull, or legs)                     | 8 to 15 reps 3.5             | Heavy compound lifts 5.0 | Supersets or short rests 5.8 | Vigorous powerlifting or bodybuilding 6.0 |

HIIT, by type (beginner is always moderate-effort intervals at 7.0, the lowest published HIIT value):

| HIIT type                 | Intermediate                        | Expert                                       |
| ------------------------- | ----------------------------------- | -------------------------------------------- |
| Cardio                    | Spin-class intensity 9.0            | Vigorous, Tabata-style 11.0                  |
| Bodyweight (calisthenics) | Vigorous calisthenics pace 7.5      | Burpees, mountain climbers, squat jumps 11.0 |
| With free weights         | Kettlebell circuit 7.5              | Kettlebell swings 9.8                        |
| Machine-based             | Elliptical or spin bike 9.0         | Rowing machine, 150 to 199 W 11.0            |
| Plyometric                | Jumping at about 120 per minute 9.0 | Squat jumps, burpees, Tabata 11.0            |
| Swimming or hybrid        | Fast freestyle laps 9.8             | Vigorous intervals 11.0                      |

Where the numbers come from:

- **Published 2024 values:** most rows above. Jump rope 100 to 130 uses "rope skipping, general" (11.0).
- **Older 2011 values:** jump rope 60 to 100 (8.8) and 130 to 160 (12.3). I could not confirm them in the 2024 list.
- **Estimate:** jump rope 30 to 60 is not published anywhere, so 6.0 is an estimate. It is shown as "(estimate)" in the app.
- **Mapped by judgment:** the Compendium does not split weight training by push or pull (the field is saved with the entry for your records), and it has no HIIT entries by type. HIIT types use the nearest published activity (spin class, elliptical, rowing, kettlebell circuits and swings, fast freestyle swimming). The swimming value comes from a third-party chart of the Compendium.
- **Speed-based activities** (below) already cover beginner to expert pace, so they have no level menu.

**Speed-based activities**

| Activity           | Method                                                                         | Speed range  |
| ------------------ | ------------------------------------------------------------------------------ | ------------ |
| Walking            | ACSM walking equation, optional grade                                          | 3 to 6 km/h  |
| Running or jogging | ACSM running equation, optional grade                                          | 6 to 25 km/h |
| Cycling outdoors   | 2024 Compendium METs by speed, interpolated between bands (flat road, no wind) | 8 to 50 km/h |

ACSM equations, with speed `S` in metres per minute and grade `G` as a fraction: walking uses `0.1 × S + 1.8 × S × G` and running uses `0.2 × S + 0.9 × S × G`. Both give the oxygen cost above rest in ml/kg/min, and dividing by 3.5 gives net METs.

### Weekly check

On the Progress tab, the app fits a line through your weigh-ins from the last 21 days (at least 3 weigh-ins, at least 14 days apart) and compares the weight trend with what your plan and logged workouts predict. It needs food logged on at least 7 of those days.

- **Within 200 kcal per day of the plan:** you are on track.
- **Average intake more than 150 kcal from your budget:** the gap is probably eating, so no change is suggested.
- **Otherwise:** it suggests a change of up to 250 kcal per day, kept within the safe limits (calorie floor, 500 kcal surplus cap). Nothing changes unless you click **Apply suggested change**, and you can remove it later. After applying, the check restarts from that date. Saving your plan details again clears the adjustment.

## Input validation

| Field                             | Rule                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age                               | Whole number, 18 to 80                                                                                                                                          |
| Height                            | 120 to 230 cm. In ft + in mode, feet at least 1 and inches 0 to 11.9                                                                                            |
| Current weight                    | 35 to 300 kg (77 to 661 lb)                                                                                                                                     |
| Goal weight                       | At least 1. Lose: lower than current weight and not below a BMI of 18.5. Gain: higher than current weight and not above a BMI of 30. Not asked when maintaining |
| Duration                          | Whole number, 1 to 24 months                                                                                                                                    |
| Start date                        | A valid date                                                                                                                                                    |
| Food name                         | 1 to 60 characters                                                                                                                                              |
| Food calories                     | 1 to 5,000 per entry                                                                                                                                            |
| Protein, carbs, fat               | Blank, or 1 to 500 g                                                                                                                                            |
| Exercise minutes                  | 1 to 600                                                                                                                                                        |
| Speed (walking, running, cycling) | Within the range for the activity, in km/h or mph                                                                                                               |
| Grade (walking, running)          | Blank for flat, or 1 to 15%                                                                                                                                     |
| Weigh-in                          | Valid date, not in the future, 35 to 300 kg                                                                                                                     |

Number fields only accept digits and one decimal point. Letters, minus signs, exponents (`1e3`), and hex values (`0x10`) are blocked while typing and rejected on submit.

## Project structure

```
.
├── Calorie Tracker.html   # Page markup
├── Calorie Tracker.css    # Styles
├── Calorie Tracker.js     # Logic, calculations, validation, storage
└── README.md
```

Plain HTML, CSS, and vanilla JavaScript. No frameworks or build tools.

## Data and privacy

- All data is saved in your browser's `localStorage` under the key `deficit-tracker-v1`.
- Nothing is sent to any server.
- Data is tied to one browser on one device. Clearing site data erases it.
- Plans saved by earlier versions (deficit only) keep working and load as a "lose weight" plan.
- **Reset all data** on the Progress tab erases everything after a second click to confirm.

## Limitations

- Calorie and weight-loss figures are **estimates**. The 7,700 kcal per kg rule and the activity multipliers are averages, so use your weekly weigh-ins to adjust.
- The 7,700 kcal per kg figure treats all weight change as fat. Real gains include muscle and water, so expect variation.
- The tool is for adults aged 18 to 80.
- Walking, running, and cycling speed estimates assume flat or entered grade, and cycling assumes no wind. The 2024 Compendium values are for adults aged 19 to 59.
- There is no data export, cloud sync, or multi-user support yet.

## Disclaimer

This app is for general information, not medical advice. If you have a medical condition, take medication, or plan to change your calorie intake for a long period, talk to a doctor or registered dietitian first.

## License

Add a license of your choice, for example [MIT](https://choosealicense.com/licenses/mit/), and place the `LICENSE` file in the repository root.
