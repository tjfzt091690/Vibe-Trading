import { Link } from "react-router-dom";
import { ArrowRight, Bot, BarChart3, Zap, UserCircle2 } from "lucide-react";

export function Home() {
  const FEATURES = [
    { icon: Bot, title: "AI 代理", desc: "基于 ReAct 推理的自然语言策略生成" },
    { icon: BarChart3, title: "内置回测", desc: "3 大数据源：A股、港美、加密货币" },
    { icon: Zap, title: "实时流式输出", desc: "实时观看代理思考、调用工具和迭代" },
    { icon: UserCircle2, title: "策略复盘", desc: "交易日志分析 + 影子账户 — 提取规则、回测验证、归因损益差异" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">AI 驱动的量化策略研究</h1>
        <p className="text-lg text-muted-foreground">用自然语言描述交易策略，代理将自动生成代码、运行回测并优化 — 全程实时呈现。</p>
        <Link
          to="/agent"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
        >
          开始研究 <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 max-w-5xl w-full">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="border rounded-lg p-6 space-y-3">
            <Icon className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}