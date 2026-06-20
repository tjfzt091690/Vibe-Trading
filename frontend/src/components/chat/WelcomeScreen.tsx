import { Bot, TrendingUp, Globe, Sparkles, Users, UserCircle2, NotebookPen } from "lucide-react";

interface Example {
  title: string;
  desc: string;
  prompt: string;
}

interface Category {
  label: string;
  icon: React.ReactNode;
  color: string;
  examples: Example[];
}

const CATEGORIES: Category[] = [
  {
    label: "多市场回测",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-red-400 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5",
    examples: [
      {
        title: "A股组合",
        desc: "A股风险平价优化器",
        prompt: "回测 000001.SZ、600036.SH、601318.SH 的风险平价组合，2024全年，与等权基准对比",
      },
      {
        title: "A股双均线策略",
        desc: "分钟级 A 股回测，使用 akshare 数据",
        prompt: "回测 000001.SZ 5分钟双均线策略，快线=5 慢线=20，近30天",
      },
      {
        title: "低 PE 轮动",
        desc: "沪深 300 基本面因子轮动",
        prompt: "回测沪深300成分股低PE轮动策略，月度调仓，2024全年",
      },
    ],
  },
  {
    label: "研究与分析",
    icon: <Sparkles className="h-4 w-4" />,
    color: "text-amber-400 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
    examples: [
      {
        title: "多因子 Alpha 模型",
        desc: "300 只股票的 IC 加权因子合成",
        prompt: "在沪深300成分股上构建多因子Alpha模型，使用动量、反转、波动率和换手率因子，IC加权合成，回测2023-2024",
      },
      {
        title: "期权希腊字母分析",
        desc: "Black-Scholes 定价与 Delta/Gamma/Theta/Vega",
        prompt: "使用Black-Scholes模型计算期权希腊字母：标的=100，行权=105，无风险利率=3%，波动率=25%，期限=90天，分析Delta/Gamma/Theta/Vega",
      },
    ],
  },
  {
    label: "群体团队",
    icon: <Users className="h-4 w-4" />,
    color: "text-violet-400 border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5",
    examples: [
      {
        title: "投资委员会评审",
        desc: "多代理辩论：多空对决、风控审查、PM 决策",
        prompt: "[群体团队模式] 使用投资委员会预设，评估当前市场条件下NVDA应做多还是做空",
      },
      {
        title: "量化策略台",
        desc: "筛选 → 因子研究 → 回测 → 风控审计流水线",
        prompt: "[群体团队模式] 使用量化策略台预设，在沪深300成分股上寻找并回测最佳动量策略",
      },
    ],
  },
  {
    label: "文档与网络研究",
    icon: <Globe className="h-4 w-4" />,
    color: "text-blue-400 border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5",
    examples: [
      {
        title: "分析财报 PDF",
        desc: "上传 PDF 并提问财务相关问题",
        prompt: "总结上传财报中的关键财务指标、风险和展望",
      },
      {
        title: "网络研究：宏观展望",
        desc: "阅读实时网络来源进行宏观分析",
        prompt: "阅读最新的美联储会议纪要，总结对股票和加密货币市场的关键启示",
      },
    ],
  },
  {
    label: "交易日志",
    icon: <NotebookPen className="h-4 w-4" />,
    color: "text-orange-400 border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/5",
    examples: [
      {
        title: "分析我的券商导出",
        desc: "解析同花顺/东财/富途/通用 CSV — 持仓天数、胜率、盈亏比、时段分布",
        prompt: "分析我刚上传的交易日志 — 完整画像，包括持仓统计、胜率、热门标的和时段分布",
      },
      {
        title: "诊断我的行为偏差",
        desc: "处置效应、过度交易、追涨、锚定 — 严重程度 + 数值证据",
        prompt: "对我的交易日志运行4项行为诊断（处置效应、过度交易、追涨、锚定），告诉我哪种偏差对盈亏影响最大",
      },
    ],
  },
  {
    label: "影子账户",
    icon: <UserCircle2 className="h-4 w-4" />,
    color: "text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
    examples: [
      {
        title: "从日志训练我的影子",
        desc: "从券商 CSV 提取策略规则并持久化影子画像",
        prompt: "从我刚上传的交易日志训练影子账户 — 展示提取的规则并确认是否符合我的行为特征",
      },
      {
        title: "我少赚了多少？",
        desc: "回测影子策略，归因实际盈亏差异",
        prompt: "在美国市场运行90天影子回测，分析我的实际盈亏与影子的差异来源（规则违反、提前退出、遗漏信号）",
      },
      {
        title: "生成影子报告",
        desc: "8 节 HTML/PDF — 权益曲线、分市场夏普、归因瀑布图",
        prompt: "生成影子报告并提供URL — 首先展示你与影子的差异",
      },
    ],
  },
];

const CAPABILITY_CHIPS = [
  "70 个金融技能",
  "29 个群体预设",
  "32 个代理工具",
  "3 大市场：A 股 · 加密货币 · 港美",
  "分钟到日级别时间框架",
  "4 种组合优化器",
  "15+ 风险指标",
  "期权与衍生品",
  "PDF 与网络研究",
  "因子分析与机器学习",
  "交易日志分析器",
  "影子账户回测",
  "持久化记忆",
  "会话搜索",
];

interface Props {
  onExample: (s: string) => void;
}

export function WelcomeScreen({ onExample }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
      {/* Header */}
      <div className="space-y-3">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/80 to-info/80 flex items-center justify-center shadow-lg">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vibe-Trading</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            与专业金融代理团队一起感受交易
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed mx-auto">
            描述一个交易策略即可开始。
          </p>
        </div>
      </div>

      {/* Capability chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {CAPABILITY_CHIPS.map((chip) => (
          <span
            key={chip}
            className="px-2.5 py-1 text-xs rounded-full border border-border/60 text-muted-foreground bg-muted/30"
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Example categories grid */}
      <div className="w-full max-w-2xl text-left space-y-4">
        <p className="text-xs text-muted-foreground px-1">试试示例：</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.label} className="space-y-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-1 ${cat.color.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                {cat.icon}
                <span>{cat.label}</span>
              </div>
              <div className="space-y-1.5">
                {cat.examples.map((ex) => (
                  <button
                    key={ex.title}
                    onClick={() => onExample(ex.prompt)}
                    className={`block w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${cat.color}`}
                  >
                    <span className="text-sm font-medium text-foreground leading-snug">
                      {ex.title}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                      {ex.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}