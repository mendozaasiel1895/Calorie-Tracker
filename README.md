# Deficit Tracker

A calorie deficit tracker that runs entirely in your browser. Enter your details, get a daily calorie target for your goal weight and timeline, then log food, exercise, and weigh-ins day by day.

No server, no account, no build step. Your data stays in your browser's local storage.

## Features

- **Personalized plan** from age, sex, height, weight, goal weight, duration, and activity level
- **Daily calorie target and macros** (protein, fat, carbs)
- **Daily log** with food entries (calories plus optional macros) and exercise entries
- **Live budget** showing calories left or over, with a progress bar and "Day X of Y" counter
- **Exercise calories** estimated from MET values and your latest weight
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

1. **Plan tab**: fill in your details and click **Calculate and save plan**. The app shows your BMR, maintenance calories, daily deficit, calorie target, expected weekly loss, BMI, and macro targets.
2. **Daily log tab**: pick a date, then add what you ate and any exercise. The large number shows calories left in today's budget.
3. **Progress tab**: save weigh-ins, see how far you are from your goal, and review the last 14 days.

### Eat back exercise calories

This setting controls how much of your logged exercise is added to your daily budget:

| Setting           | Effect                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| 0% (strict)       | Budget stays at your target. Every workout calorie adds to your deficit. |
| 50% (recommended) | Half of the workout burn is added to your budget.                        |
| 100%              | Your full workout burn is added, so the planned deficit holds steady.    |

Because your maintenance calories do not include logged workouts, your budget goes up when you log exercise unless this is set to 0%.

## How the numbers are calculated

| Value                  | Formula                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| BMR (Mifflin-St Jeor)  | `10 × kg + 6.25 × cm − 5 × age + 5` (male) or `− 161` (female)              |
| Maintenance (TDEE)     | `BMR × activity multiplier`                                                 |
| Activity multipliers   | Sedentary 1.2, Light 1.375, Moderate 1.55, High 1.725                       |
| Plan length            | Days from the start date to the start date plus the chosen number of months |
| Required daily deficit | `(current kg − goal kg) × 7,700 ÷ plan days`                                |
| Allowed deficit        | Capped at the smaller of 1,000 kcal and `TDEE − calorie floor`              |
| Calorie floor          | 1,500 kcal (male), 1,200 kcal (female)                                      |
| Daily target           | `TDEE − deficit`                                                            |
| Expected loss per week | `deficit × 7 ÷ 7,700` kg                                                    |
| BMI                    | `kg ÷ (height in m)²`                                                       |
| Protein                | The smaller of `1.6 g × kg` and 35% of target calories ÷ 4                  |
| Fat                    | 25% of target calories ÷ 9                                                  |
| Carbs                  | Remaining calories ÷ 4                                                      |
| Exercise burn          | `MET × kg × minutes ÷ 60`, using your latest weigh-in                       |
| Daily budget           | `target + eat-back % × exercise burn`                                       |

If the goal can't be reached safely in the chosen time, the app caps the deficit and shows a realistic finish date instead. It also warns when the plan loses more than 1% of body weight per week.

**Example** (31-year-old male, 180.34 cm, 90 kg, goal 80 kg, 6 months, sedentary): BMR 1,877 kcal, maintenance 2,253 kcal, 181 days, deficit about 425 kcal, daily target about 1,827 kcal.

### Exercise MET values

| Activity                              | MET  |
| ------------------------------------- | ---- |
| Jump rope, moderate                   | 11.8 |
| Jump rope, fast                       | 12.3 |
| Bodyweight circuit, light to moderate | 3.5  |
| Bodyweight circuit, vigorous          | 8.0  |
| Walking, brisk                        | 4.3  |
| Running, 8 km/h                       | 8.3  |
| Cycling, moderate                     | 7.5  |

## Input validation

| Field               | Rule                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Age                 | Whole number, 18 to 80                                               |
| Height              | 120 to 230 cm. In ft + in mode, feet at least 1 and inches 0 to 11.9 |
| Current weight      | 35 to 300 kg (77 to 661 lb)                                          |
| Goal weight         | At least 1, lower than current weight, and not below a BMI of 18.5   |
| Duration            | Whole number, 1 to 24 months                                         |
| Start date          | A valid date                                                         |
| Food name           | 1 to 60 characters                                                   |
| Food calories       | 1 to 5,000 per entry                                                 |
| Protein, carbs, fat | Blank, or 1 to 500 g                                                 |
| Exercise minutes    | 1 to 600                                                             |
| Weigh-in            | Valid date, not in the future, 35 to 300 kg                          |

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
- **Reset all data** on the Progress tab erases everything after a second click to confirm.

## Limitations

- Calorie and weight-loss figures are **estimates**. The 7,700 kcal per kg rule and the activity multipliers are averages, so use your weekly weigh-ins to adjust.
- The tool is for adults aged 18 to 80.
- There is no data export, cloud sync, or multi-user support yet.

## Disclaimer

This app is for general information, not medical advice. If you have a medical condition, take medication, or plan a long or aggressive deficit, talk to a doctor or registered dietitian first.

## License

Add a license of your choice, for example [MIT](https://choosealicense.com/licenses/mit/), and place the `LICENSE` file in the repository root.
