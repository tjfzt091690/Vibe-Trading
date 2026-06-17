"""分钟级数据分析工具。

通过 tushare/akshare 获取分钟 K 线，计算 VWAP/TWAP/成交量分布等日内指标。
仅供分析输出，不可用于回测引擎（仅支持日线）。
"""

from typing import Optional

import numpy as np
import pandas as pd


def fetch_minute_candles_akshare(
    code: str, period: str = "5", adjust: str = ""
) -> Optional[pd.DataFrame]:
    """从 akshare 获取 A 股分钟级 K 线数据。

    Args:
        code: 股票代码，如 "000001"。
        period: K 线周期（1/5/15/30/60）。
        adjust: 复权类型（""不复权/"qfq"前复权/"hfq"后复权）。

    Returns:
        OHLCV DataFrame，index 为 datetime。None 表示获取失败。
    """
    try:
        import akshare as ak
        df = ak.stock_zh_a_min_em(symbol=code, period=period, adjust=adjust)
        if df is None or df.empty:
            return None
        df = df.rename(columns={
            "时间": "ts", "开盘": "open", "最高": "high",
            "最低": "low", "收盘": "close", "成交量": "volume",
        })
        df["ts"] = pd.to_datetime(df["ts"])
        df = df.set_index("ts")
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype(float)
        return df
    except Exception as e:
        print(f"[WARN] 获取失败: {e}")
        return None


def compute_vwap(df: pd.DataFrame) -> pd.Series:
    """计算累积 VWAP（成交量加权平均价）。

    Args:
        df: 包含 high/low/close/volume 列的 DataFrame。

    Returns:
        VWAP 序列。
    """
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    cum_tp_vol = (typical_price * df["volume"]).cumsum()
    cum_vol = df["volume"].cumsum()
    return cum_tp_vol / cum_vol


def compute_twap(df: pd.DataFrame) -> pd.Series:
    """计算累积 TWAP（时间加权平均价）。

    Args:
        df: 包含 close 列的 DataFrame。

    Returns:
        TWAP 序列。
    """
    return df["close"].expanding().mean()


def volume_profile(df: pd.DataFrame, bins: int = 20) -> pd.DataFrame:
    """计算成交量分布（按价格区间）。

    Args:
        df: 包含 close/volume 列的 DataFrame。
        bins: 价格区间数量。

    Returns:
        DataFrame 含 price_range 和 volume 列。
    """
    price_bins = pd.cut(df["close"], bins=bins)
    vol_by_price = df.groupby(price_bins, observed=True)["volume"].sum()
    result = vol_by_price.reset_index()
    result.columns = ["price_range", "volume"]
    result["volume_pct"] = result["volume"] / result["volume"].sum() * 100
    return result.sort_values("volume", ascending=False)


def hourly_volume(df: pd.DataFrame) -> pd.DataFrame:
    """按小时聚合成交量。

    Args:
        df: 分钟级 DataFrame。

    Returns:
        小时级成交量汇总。
    """
    hourly = df.resample("1h")["volume"].sum()
    result = hourly.reset_index()
    result.columns = ["hour", "volume"]
    result["volume_pct"] = result["volume"] / result["volume"].sum() * 100
    return result


if __name__ == "__main__":
    inst = "BTC-USDT"
    bar = "5m"
    print(f"=== {inst} {bar} 分钟级分析 ===\n")

    df = fetch_minute_candles(inst, bar=bar, limit=300)
    if df is None or df.empty:
        print("无数据")
        exit(1)

    print(f"数据范围: {df.index[0]} ~ {df.index[-1]} ({len(df)} 根)")
    print(f"价格范围: {df['close'].min():.2f} ~ {df['close'].max():.2f}")
    print()

    # VWAP / TWAP
    vwap = compute_vwap(df)
    twap = compute_twap(df)
    last_close = df["close"].iloc[-1]
    print(f"最新价:  {last_close:.2f}")
    print(f"VWAP:    {vwap.iloc[-1]:.2f} ({'高于' if last_close > vwap.iloc[-1] else '低于'}VWAP)")
    print(f"TWAP:    {twap.iloc[-1]:.2f}")
    print()

    # 成交量分布
    print("--- 成交量分布 (Top 5 价格区间) ---")
    vp = volume_profile(df, bins=15)
    for _, row in vp.head(5).iterrows():
        print(f"  {row['price_range']}: {row['volume_pct']:.1f}%")
    print()

    # 小时成交量
    print("--- 小时成交量 ---")
    hv = hourly_volume(df)
    for _, row in hv.iterrows():
        bar_len = int(row["volume_pct"] / 2)
        print(f"  {row['hour'].strftime('%H:%M')}: {'█' * bar_len} {row['volume_pct']:.1f}%")
