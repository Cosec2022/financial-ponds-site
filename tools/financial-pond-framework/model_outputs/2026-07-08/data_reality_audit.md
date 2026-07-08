# Data Reality Audit 2026-07-08

当前页面含 6 个非真实或来源未验证层。模型结构可看，市场结论不可直接用。

| Layer | Reality | Market-use confidence | Reading |
| --- | --- | --- | --- |
| AKShare环境预检 | provider_doctor_ok | medium | AKShare provider environment preflight passed. |
| AKShare真实数据探测 | provider_run_ok | medium | AKShare real provider completed with 11 rows. Flow review still needs observed-source coverage checks. |
| 资金量价 | mock | low | 模型组件可运行，但当前资金量价节点来自 mock/fixture 来源，不能当作真实市场信号。 |
| 新闻层 | unknown | low | 新闻层来源不明。 |
| 估值/基本面/资金量价三模块 | manual_seed | low | 估值和基本面是 manual_seed，可解释结构，但不是实时估值或财报数据。 |
| ETF行动准备度 | decision_gate_blocked | low | 暂不能指导买入 ETF：行业资金量价仍来自 mock、fixture 或未验证来源。 |
| 行业轮动 | derived_from_non_real | low | 该层是解释层，上游仍含非真实输入，因此只能看结构，不能当真实市场结论。 |
| 通用池模型 | contract_output_source_unverified | low | 通用池模型契约可用，但当前发布 JSON 没有携带可验证 provider source，不能视为实时真实行情判断。 |
| 轮动历史 | derived_from_non_real | low | 该层是解释层，上游仍含非真实输入，因此只能看结构，不能当真实市场结论。 |

## Boundary

- This audit labels data origin and freshness. It does not change model scores.
- mock, fixture, manual_seed, and derived_from_non_real layers are not live market evidence.
- A layer can have a valid model contract while still using non-real inputs.
- Use this audit before reading any ranking or decision label as market evidence.
