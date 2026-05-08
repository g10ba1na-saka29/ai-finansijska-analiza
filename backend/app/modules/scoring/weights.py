"""
Ponderi kategorija u kompozitnom score-u (suma = 100).
Mogu se pregaziti po industrijskom sektoru.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryWeights:
    liquidity: float      # 0–1
    profitability: float
    leverage: float
    growth: float
    cashflow: float

    def validate(self) -> None:
        total = self.liquidity + self.profitability + self.leverage + self.growth + self.cashflow
        assert abs(total - 1.0) < 0.001, f"Ponderi moraju biti = 1.0, dobijeno: {total}"


# Standardni ponderi
DEFAULT_WEIGHTS = CategoryWeights(
    liquidity=0.20,
    profitability=0.25,
    leverage=0.20,
    growth=0.20,
    cashflow=0.15,
)

# Ponderi za kapital-intenzivne industrije (manufacturing, construction)
CAPITAL_INTENSIVE_WEIGHTS = CategoryWeights(
    liquidity=0.15,
    profitability=0.20,
    leverage=0.25,
    growth=0.15,
    cashflow=0.25,
)

# Ponderi za rastuće kompanije (tech, startups)
GROWTH_FOCUSED_WEIGHTS = CategoryWeights(
    liquidity=0.20,
    profitability=0.15,
    leverage=0.15,
    growth=0.35,
    cashflow=0.15,
)

INDUSTRY_WEIGHTS: dict[str, CategoryWeights] = {
    "manufacturing": CAPITAL_INTENSIVE_WEIGHTS,
    "construction": CAPITAL_INTENSIVE_WEIGHTS,
    "technology": GROWTH_FOCUSED_WEIGHTS,
    "retail": DEFAULT_WEIGHTS,
    "services": DEFAULT_WEIGHTS,
}


def get_weights(industry: str | None = None) -> CategoryWeights:
    if industry:
        return INDUSTRY_WEIGHTS.get(industry.lower(), DEFAULT_WEIGHTS)
    return DEFAULT_WEIGHTS
