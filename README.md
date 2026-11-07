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
- **My foods and meal plans** (Meals tab) so common foods and whole meals can be added to the daily log in one tap
- **Fasting tracker** (daily time-restricted eating) with a safety check, your own target, a live timer, and a fast history
- **Weight chart** with your weigh-ins, a 7-day average line, and your planned path
- **Weekly check** that compares your weight trend with the plan and suggests a target adjustment you can apply or ignore
- **Weight tracking** with progress toward your goal
- **14-day history** of eaten vs. budget, where each date opens that day's foods and nutrients
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
2. **Daily log tab**: pick a date, then add what you ate and any exercise. Each food shows its calories, protein, carbs, and fat. The large number shows calories left in today's budget.
3. **Progress tab**: save weigh-ins (use **Edit** or **Delete** on a row to fix a mistake; the plan start weigh-in is changed on the Plan tab), see your weight chart and how far you are from your goal, read the weekly check, and review the last 14 days. Tap a date in the last 14 days to open the foods you ate that day with their calories and nutrients.

### Eat back exercise calories

This setting controls how much of your logged exercise is added to your daily budget:

| Setting                 | Effect                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| 0% (strict)             | Budget stays at your target. Every workout calorie adds to a deficit (or cuts into a surplus). |
| 50% (good for losing)   | Half of the workout burn is added to your budget.                                              |
| 100% (good for gaining) | Your full workout burn is added, so the planned deficit or surplus holds steady.               |

Changing the goal sets this to 50% for losing and 100% for maintaining or gaining. You can change it afterwards.

Because your maintenance calories do not include logged workouts, your budget goes up when you log exercise unless this is set to 0%. When gaining, the daily log shows "kcal to reach target" so you know how much more to eat.

4. **Fasting tab**: answer the safety check to unlock it, choose your fasting type and hours, then start and end fasts or log past ones.
5. **Meals tab**: save your common foods (per serving), then build meal plans such as "Monday meal" from them. In the Daily log, **Add food** lets you type a food, pick one from My foods, or pick a meal plan.

## Meals: My foods and meal plans

**My foods.** Save a food once with a serving description (for example "1 cup cooked") and its calories, protein, carbs, and fat for one serving. You can search, edit, and delete saved foods.

**Meal plans.** A plan is a named set of foods, each with a number of servings and a meal slot (Breakfast, Lunch, Dinner, or Snack). You can assign a plan to weekdays, duplicate it, edit it, and delete it. While you build a plan, the app shows its total calories and macros next to your daily target.

**In the Daily log.** The **Add food** card has a source choice:

- **Type it in**: the manual form.
- **From My foods**: pick a food, the servings, and the meal.
- **From a meal plan**: pick a plan, untick any food you did not eat, adjust servings, and add the rest.

If a plan is assigned to the weekday of the date you are viewing, a **Plan for Monday** card appears at the top with an **Add all** button.

**Copies, not links.** A plan stores its own copy of each food's nutrients, and adding foods to the log copies the values into that day. Editing or deleting a saved food or plan later never changes plans or past days.

**Generate a meal plan.** In the Meals tab, the generator builds meal plans from the foods you saved.

- Choose 1 to 7 days, 3 meals or 3 meals and a snack, and your daily calories (it starts at your plan's target; the minimum is your calorie floor and the maximum is 6,000). Tick the foods it may use.
- It picks foods for each meal by what they mostly provide (protein, carbs, fat, or a low-calorie side) and rotates foods across days. It then chooses servings in steps of 0.25 (up to 4, or 2 for oils and low-calorie sides) so the day lands close to your calorie and macro targets.
- The preview shows each food with its servings and the nutrition for that amount, the per-serving facts you saved, the day's total, and how far the total is from your targets. It warns when it cannot match your targets closely, which usually means you need a protein source and a carb source in your foods.
- Nothing is saved until you click **Save as meal plan** (or **Save all**). Saved plans appear in Meal plans and in the Daily log, where you can rename them and assign weekdays.
- Foods with no macros entered, under 4 kcal or over 1,250 kcal per serving, or with more than 125 g of one macro per serving are skipped, and the preview says which.

The generator uses only the nutrition values you entered and knows nothing about taste, cooking, allergies, or dietary needs, so check each plan before you follow it. It is not medical or dietitian advice.

| Meals field                     | Rule                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Food name / serving             | 1 to 60 / 1 to 40 characters; the same name and serving cannot be saved twice |
| Calories per serving            | 1 to 5,000                                                                    |
| Protein, carbs, fat per serving | Blank, or 1 to 500 g                                                          |
| Servings (plans and log)        | 0.25 to 20, decimals allowed                                                  |
| Scaled log entry                | Calories must work out to 1 to 5,000, and each macro to 500 g or less         |
| Plan name                       | 1 to 40 characters, unique                                                    |
| Limits                          | Up to 200 foods, 50 plans, and 30 foods per plan                              |

## Fasting

The Fasting tab tracks daily **time-restricted eating**: you fast for a set number of hours and eat in the remaining window. It does not change your calorie target. There is no single worldwide standard for fasting; the definitions here follow published reviews, which describe intermittent fasting as fasting for 12 hours or more and time-restricted eating as a daily eating window of roughly 8 to 12 hours.

**Safety check.** Fasting stays locked until you answer six yes-or-no statements and confirm your answers are accurate. If any statement applies (diabetes or blood-sugar medication, pregnancy or breastfeeding, an eating disorder history, kidney, liver, heart or blood pressure disease or medication that must be taken with food, recovery from surgery or serious illness, or a doctor's advice not to fast or any doubt), the feature stays locked and you are told to talk to a doctor. Your individual answers are not saved, only whether you passed. Fasting also stays locked while your current BMI is below 18.5. Using **Retake safety check** locks fasting again and discards any fast in progress.

**Your target.** Choose 16:8, 12:12, 14:10, 18:6, or 20:4, or a custom length of 12 to 24 hours.

**Timer and log.** Start a fast now or at an earlier time, watch the elapsed time and progress, and end it to save it. You can also log a past fast, and edit or delete any logged fast. The history shows the last 14 fasts and whether each reached its target, with a 7-day summary.

| Fasting field           | Rule                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| Custom fasting hours    | 12 to 24 (digits and one decimal point only)                     |
| Fast start and end      | Valid date and time, end after start, end not in the future      |
| Fast length             | 1 to 72 hours                                                    |
| Overlap                 | A fast cannot overlap another logged fast or the one running now |
| Start of a running fast | Not in the future, and within the last 72 hours                  |

Durations are calculated from exact timestamps, so overnight fasts and daylight saving changes are counted correctly. A running fast shows a warning after 24 hours.

This is for general information, not medical advice. Stop fasting and eat if you feel dizzy, faint, or unwell.

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

| Activity                              | Beginner                     | Intermediate             | Advanced                     | Expert                                    |
| ------------------------------------- | ---------------------------- | ------------------------ | ---------------------------- | ----------------------------------------- |
| Jump rope (jumps per minute)          | 30 to 60: **6.0 (estimate)** | 60 to 100: 8.8           | 100 to 130: 11.0             | 130 to 160: 12.3                          |
| Bodyweight and calisthenics           | Light 2.8                    | Moderate 3.8             | High intensity 6.5           | Vigorous 7.5                              |
| Circuit training                      | Light 3.5                    | Moderate 5.0             | Bodyweight exercises 6.0     | Vigorous, minimal rest 7.5                |
| Weight training (push, pull, or legs) | 8 to 15 reps 3.5             | Heavy compound lifts 5.0 | Supersets or short rests 5.8 | Vigorous powerlifting or bodybuilding 6.0 |

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

## Input validations

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
├── Calorie Tracker.html   # Page markup (needs the Fasting tab and section)
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

## Roadmap

**Nutrition label photo scanning (planned, not built).** Take a photo of a nutrition label and have the app read the calories, protein, carbs, and fat into the food form, so you do not have to type them.

Planned approach:

- Read the photo on the device with an open-source OCR library (Tesseract.js), so photos never leave the phone and the app stays free and offline-capable.
- Never save automatically. Show the numbers it read in editable fields for review.
- Let the user choose the per-serving or per-100 g column on labels that show both.
- Warn when calories do not roughly match 4 x protein + 4 x carbs + 9 x fat, which usually means a misread digit.
- Fall back to typing when the photo cannot be read, and ask for a clearer photo.

A simulation with real Tesseract OCR on 60 synthetic labels (four layouts, four photo qualities) suggests what to expect. On a flat, sharp, well-lit label, about 94 to 98% of labels gave usable values on the first try when a repair step fixed common digit misreads. Two-column layouts (per 100 g and per serving) were the weakest. At low resolution or with heavy blur and glare, reading mostly failed and the app would fall back to typing, with about 2% of those cases giving a large wrong value that was not flagged. The test used clean English labels on flat surfaces, so real packaging, with curves, glare, and other languages, will likely do worse. This is why the review step is required.

Other ideas considered: a built-in starter list of common foods with values taken from a national food database, so the generator works before you save any foods; barcode lookup against an online food database (needs internet, and coverage varies), cloud AI vision (needs a server and API key, and photos leave the device), and data export and import (set aside for now).

## Limitations

- Calorie and weight-loss figures are **estimates**. The 7,700 kcal per kg rule and the activity multipliers are averages, so use your weekly weigh-ins to adjust.
- The 7,700 kcal per kg figure treats all weight change as fat. Real gains include muscle and water, so expect variation.
- The tool is for adults aged 18 to 80.
- Walking, running, and cycling speed estimates assume flat or entered grade, and cycling assumes no wind. The 2024 Compendium values are for adults aged 19 to 59.
- Fasting supports daily fasts of 12 to 24 hours only. Alternate-day fasting, 5:2 low-calorie days, and longer fasts are not included.
- There is no data export, cloud sync, or multi-user support yet.

## Disclaimer

This app is for general information, not medical advice. If you have a medical condition, take medication, or plan to change your calorie intake for a long period, talk to a doctor or registered dietitian first.

## License

Add a license of your choice, for example [MIT](https://choosealicense.com/licenses/mit/), and place the `LICENSE` file in the repository root.
