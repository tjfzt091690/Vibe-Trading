---
name: data-routing
category: data-source
description: Data source selection decision tree. Load this skill BEFORE any backtest or data-fetching task to choose the best available data source.
---

## Data Source Overview

| Source | Markets | Auth Required | Network | Skill |
|--------|---------|---------------|---------|-------|
| tushare | A-shares, funds, futures, macro | Yes (`TUSHARE_TOKEN`) | China network | tushare |
| akshare | A-shares, futures, macro, forex | No | Unrestricted | akshare |
| mootdx | A-shares (real-time) | No | China network | mootdx |

## Decision Tree

### Backtest Scenario (writing config.json)

Use `source: "auto"` -- the runner automatically routes by symbol pattern and falls back to alternative sources if the primary one is unavailable.

You do NOT need to specify a concrete data source in config.json unless the user explicitly asks for one.

### Analysis / Research Scenario (writing Python scripts)

1. Identify the market type from the user's request
2. Pick the source by priority:

**A-shares**: tushare (if TUSHARE_TOKEN is set) > mootdx > akshare (free fallback)
**Futures**: tushare > akshare
**Macro / economics**: akshare > tushare
**Forex**: akshare

3. Load the corresponding skill for API details: `load_skill("akshare")`

### Availability Check

- **tushare**: check if `TUSHARE_TOKEN` environment variable exists
- **akshare / mootdx**: free but may have network restrictions
- If the user reports "connection timeout" or "cannot access", switch to the same-market fallback

## Symbol Format Reference

| Market | Format | Examples |
|--------|--------|---------|
| A-shares | `NNNNNN.SZ/SH/BJ` | 000001.SZ, 600000.SH |
| Futures | `XXNNNN.EXCHANGE` | CU2406.SHFE |
| Forex | `XXX/YYY` | USD/CNY, EUR/USD |

## Fallback Chain (Runner Layer)

The backtest runner implements automatic fallback at the market level:

```
User requests 000001.SZ (A-share)
  -> detect market: a_share
  -> try tushare: TUSHARE_TOKEN missing -> skip
  -> try mootdx: available -> use mootdx
  -> success (zero config required)
```

This is transparent to the user -- they just see results.