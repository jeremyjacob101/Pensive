import { convertSavingsAmount, formatSavingsDate, formatSavingsMoney, localIsoDate, otherSavingsCurrency, savingsCurrencySymbol } from "../helpers/savings";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SavingsBank, SavingsBankId, SavingsChartPoint, SavingsCurrency } from "../types/savings";
import { Check } from "lucide-react";
import { useMemo } from "react";

const TOTAL_SERIES_COLOR = "#A855F7";
const TOTAL_SERIES_GRADIENT_ID = "savings-total-stroke";

type ChartRow = SavingsChartPoint &
  Record<string, number | string | boolean | Record<string, number>>;

function bankDataKey(id: SavingsBankId) {
  return `bank_${id}`;
}

function formatAxisMoney(value: number, currency: SavingsCurrency) {
  const absolute = Math.abs(value);
  const formatted =
    absolute >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`
      : absolute >= 1_000
        ? `${Math.round(value / 1_000)}k`
        : Math.round(value).toLocaleString("en-US");
  return `${savingsCurrencySymbol(currency)}${formatted}`;
}

export function SavingsChart({ points, banks, selectedBankIds, totalVisible, displayCurrency, usdIlsRate, emptyMessage, onToggleBank, onToggleTotal }: {
  points: SavingsChartPoint[];
  banks: SavingsBank[];
  selectedBankIds: Set<SavingsBankId>;
  totalVisible: boolean;
  displayCurrency: SavingsCurrency;
  usdIlsRate: number | null;
  emptyMessage?: string;
  onToggleBank: (id: SavingsBankId) => void;
  onToggleTotal: () => void;
}) {
  const selectedBanks = useMemo(
    () => banks.filter((bank) => selectedBankIds.has(bank._id)),
    [banks, selectedBankIds],
  );
  const rows = useMemo<ChartRow[]>(
    () =>
      points.map((point) => {
        const row: ChartRow = { ...point };
        for (const bank of selectedBanks) {
          row[bankDataKey(bank._id)] = point.values[bank._id] ?? 0;
        }
        return row;
      }),
    [points, selectedBanks],
  );
  const rangeMs = (points.at(-1)?.timestamp ?? 0) - (points[0]?.timestamp ?? 0);
  const todayTimestamp = new Date(`${localIsoDate()}T00:00:00`).getTime();

  return (
    <>
      <div className="savings-chart-legend" aria-label="Chart series">
        <SeriesToggle
          label="Total"
          color={TOTAL_SERIES_COLOR}
          selected={totalVisible}
          onClick={onToggleTotal}
        />
        {banks.map((bank) => (
          <SeriesToggle
            key={bank._id}
            label={bank.name}
            color={bank.color}
            selected={selectedBankIds.has(bank._id)}
            onClick={() => onToggleBank(bank._id)}
          />
        ))}
      </div>

      <div className="savings-chart-canvas" data-testid="savings-chart">
        {rows.length === 0 ? (
          <div className="savings-chart-empty">
            {emptyMessage ?? "Select at least one bank to draw its savings."}
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={360}
            initialDimension={{ width: 1180, height: 460 }}
          >
            <ComposedChart
              data={rows}
              margin={{ top: 20, right: 14, bottom: 8, left: 4 }}
            >
              <defs>
                <linearGradient
                  id={TOTAL_SERIES_GRADIENT_ID}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#6D28D9" />
                  <stop offset="20%" stopColor="#A855F7" />
                  <stop offset="38%" stopColor="#D8B4FE" />
                  <stop offset="54%" stopColor="#9333EA" />
                  <stop offset="72%" stopColor="#E9D5FF" />
                  <stop offset="86%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical
                stroke="var(--savings-grid)"
                strokeDasharray="3 4"
              />
              <XAxis
                type="number"
                dataKey="timestamp"
                domain={["dataMin", "dataMax"]}
                tickCount={9}
                tickLine={false}
                axisLine={{ stroke: "var(--savings-grid-strong)" }}
                minTickGap={34}
                tick={{ fill: "var(--savings-muted)", fontSize: 12 }}
                tickFormatter={(value: number) =>
                  new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: rangeMs < 2 * 365 * 86_400_000 ? "short" : undefined,
                  }).format(new Date(value))
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={70}
                tick={{ fill: "var(--savings-muted)", fontSize: 12 }}
                tickFormatter={(value: number) =>
                  formatAxisMoney(value, displayCurrency)
                }
              />
              <ReferenceLine
                x={todayTimestamp}
                stroke="var(--savings-muted)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{
                  value: "Today",
                  position: "insideTopRight",
                  fill: "var(--savings-muted)",
                  fontSize: 11,
                }}
              />
              <Tooltip
                cursor={{
                  stroke: "#74829A",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
                content={(props) => {
                  const row = props.payload?.[0]?.payload as
                    | ChartRow
                    | undefined;
                  if (!props.active || !row) return null;
                  return (
                    <div className="savings-chart-tooltip">
                      <strong>{formatSavingsDate(row.date)}</strong>
                      <TooltipRow
                        label="Total"
                        color={TOTAL_SERIES_COLOR}
                        value={row.total}
                        currency={displayCurrency}
                        usdIlsRate={usdIlsRate}
                      />
                      {selectedBanks.toReversed().map((bank) => (
                        <TooltipRow
                          key={bank._id}
                          label={bank.name}
                          color={bank.color}
                          value={Number(row[bankDataKey(bank._id)] ?? 0)}
                          currency={displayCurrency}
                          usdIlsRate={usdIlsRate}
                        />
                      ))}
                      <span className="savings-tooltip-state">
                        {row.isForecast
                          ? "Forecast balance"
                          : "Balance snapshot"}
                      </span>
                    </div>
                  );
                }}
              />

              {selectedBanks.map((bank) => (
                <Line
                  key={bank._id}
                  type="monotone"
                  dataKey={bankDataKey(bank._id)}
                  stroke={bank.color}
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: "var(--surface)",
                  }}
                  isAnimationActive={false}
                />
              ))}

              {totalVisible ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--savings-total-outline)"
                    strokeWidth={5.35}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={`url(#${TOTAL_SERIES_GRADIENT_ID})`}
                    strokeWidth={4.1}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      fill: "var(--surface)",
                    }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#F3E8FF"
                    strokeOpacity={0.82}
                    strokeWidth={1.35}
                    strokeDasharray="2 7"
                    strokeLinecap="round"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </>
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

function SeriesToggle({ label, color, selected, onClick }: {
  label: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`savings-series-toggle${selected ? " selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="savings-series-check" aria-hidden="true">
        {selected ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      <span className="savings-series-dot" style={{ backgroundColor: color }} />
      {label}
    </button>
  );
}

function TooltipRow({ label, color, value, currency, usdIlsRate }: {
  label: string;
  color: string;
  value: number;
  currency: SavingsCurrency;
  usdIlsRate: number | null;
}) {
  const otherCurrency = otherSavingsCurrency(currency);
  const otherValue = convertSavingsAmount(
    value,
    currency,
    otherCurrency,
    usdIlsRate,
  );
  return (
    <span className="savings-tooltip-row">
      <span className="savings-tooltip-label">
        <i style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="savings-tooltip-values">
        <b>{formatSavingsMoney(value, currency)}</b>
        {otherValue === null ? null : (
          <small>≈ {formatSavingsMoney(otherValue, otherCurrency)}</small>
        )}
      </span>
    </span>
  );
}