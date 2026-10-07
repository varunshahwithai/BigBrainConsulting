# BBC – Big Brain Consulting

A free consulting toolkit for small business owners.

**Live tools**
- **Market Entry Simulator**: test price, demand, discounts and costs, size the market, score entry barriers, and get an Enter / Partner / Don't Enter call.
- **Operations Bottleneck Diagnoser**: a guided 8-step journey that finds the step holding a process back, explains why, prices the problem and compares fixes.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The whole website in one file. Open it in any browser. |
| `src/` | The parts `index.html` is built from (page layout, styles and each tool's code). |
| `tools/build.py` | Joins the parts in `src/` back into `index.html`. |

## Running it

Open `index.html` in a browser. No install needed.

## Editing it

Change files in `src/`, then run:

```
python3 tools/build.py
```

## Notes

- The AI explanations, shared saving and "Hire a team" requests use features that only exist when the site runs inside Claude. Everywhere else the tools still work fully; AI buttons say AI isn't available, and saves stay in the visitor's own browser.
- All calculations are done in plain code, so the same inputs always give the same answers.
