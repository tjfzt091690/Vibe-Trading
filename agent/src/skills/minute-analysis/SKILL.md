---
name: minute-analysis
description: Minute-level data analysis and backtesting. Retrieves minute candlesticks through Tushare/AKShare and can be used both for analysis and as input to the backtest engine.
category: strategy
---
# Minute-Level Data Analysis and Backtesting

## Purpose

Retrieve minute-level candlestick data through data-source APIs and calculate intraday indicators (VWAP, TWAP, volume distribution, and more).
Supports minute-level backtesting: set `"interval": "5m"` in `config.json` and use the `backtest` tool to run intraday strategies.

## Backtest Configuration

For minute-level backtests, simply add the `interval` field in `config.json`:

```json
{
  "source": "tushare",
  "codes": ["000001.SZ"],
  "start_date": "2026-03-01",
  "end_date": "2026-03-15",
  "interval": "5m",
  "initial_cash": 1000000,
  "commission": 0.0005
}
```

- The annualization factor is inferred automatically from `source + interval` (Tushare 5m = 252 x 48 = 12096)
- Minute-level datasets are large. Recommended time limits: no more than 7 days for `1m`, no more than 30 days for `5m`, and no more than 1 year for `1H`

## Supported Data Sources and Intervals

| Data Source | Supported Intervals | Notes |
|--------|---------|------|
| Tushare | 1m/5m/15m/30m/1H | China A-shares, requires score >= 2000 |
| AKShare | 1m/5m/15m/30m/1H | China A-shares (free, no key required) |
| Mootdx | 1m/5m/15m/30m/1H | China A-shares (TCP direct, no IP throttle) |

## Indicator Calculation Templates

### VWAP (Volume-Weighted Average Price)

```python
typical_price = (df["high"] + df["low"] + df["close"]) / 3
df["vwap"] = (typical_price * df["vol"]).cumsum() / df["vol"].cumsum()
```

### TWAP (Time-Weighted Average Price)

```python
df["twap"] = df["close"].expanding().mean()
```

### Volume Distribution

```python
df["vol_pct"] = df["vol"] / df["vol"].sum() * 100
hourly_vol = df.set_index("ts").resample("1h")["vol"].sum()
```

## Parameters

| Parameter | Description |
|------|------|
| codes | Instrument codes, such as `"000001.SZ"` |
| bar / interval | Candlestick interval: `1m/5m/15m/30m/1H/4H` |

## Common Pitfalls

- The time range for minute-level backtests should not be too long, otherwise both data retrieval and backtesting will become slow or time out
- Tushare minute endpoints require a score >= 2000. If the score is insufficient, the API returns empty data
- Timestamps are Unix timestamps in milliseconds and should be converted with `unit="ms"`
- Transaction costs for minute strategies should be set lower (for example 0.05% instead of 0.1%) because intraday trading is frequent

## Dependencies

```bash
pip install pandas numpy requests
```
