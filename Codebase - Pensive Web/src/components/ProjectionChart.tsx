import { convertProjectionAmount, formatProjectionDate, formatProjectionMoney, localIsoDate, otherProjectionCurrency, projectionCurrencySymbol } from "../helpers/projections";
import type { ProjectionBank, ProjectionBankId, ProjectionChartMode, ProjectionChartPoint, ProjectionCurrency } from "../types/projections";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check } from "lucide-react";
import { useMemo } from "react";

type ChartRow = ProjectionChartPoint &
  Record<string, number | string | boolean | Record<string, number>>;

function bankDataKey(id: ProjectionBankId) {
  return `bank_${id}`;
}

function formatAxisMoney(value: number, currency: ProjectionCurrency) {
  const absolute = Math.abs(value);
  const formatted =
    absolute >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`
      : absolute >= 1_000
        ? `${Math.round(value / 1_000)}k`
        : Math.round(value).toLocaleString("en-US");
  return `${projectionCurrencySymbol(currency)}${formatted}`;
}

export function ProjectionChart({ points, banks, selectedBankIds, totalVisible, mode, displayCurrency, usdIlsRate, emptyMessage, onToggleBank, onToggleTotal }: {
  points: ProjectionChartPoint[];
  banks: ProjectionBank[];
  selectedBankIds: Set<ProjectionBankId>;
  totalVisible: boolean;
  mode: ProjectionChartMode;
  displayCurrency: ProjectionCurrency;
  usdIlsRate: number | null;
  emptyMessage?: string;
  onToggleBank: (id: ProjectionBankId) => void;
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
      <div className="projection-chart-legend" aria-label="Chart series">
        <SeriesToggle
          label="Total"
          color="#153CF8"
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

      <div className="projection-chart-canvas" data-testid="projection-chart">
        {rows.length === 0 ? (
          <div className="projection-chart-empty">
            {emptyMessage ?? "Select at least one bank to draw its projection."}
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
                {selectedBanks.map((bank) => (
                  <linearGradient
                    key={bank._id}
                    id={`projection-fill-${bank._id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={bank.color}
                      stopOpacity={0.34}
                    />
                    <stop
                      offset="100%"
                      stopColor={bank.color}
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                ))}
                <linearGradient
                  id="projection-total-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#153CF8" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#153CF8" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical
                stroke="var(--projection-grid)"
                strokeDasharray="3 4"
              />
              <XAxis
                type="number"
                dataKey="timestamp"
                domain={["dataMin", "dataMax"]}
                tickCount={9}
                tickLine={false}
                axisLine={{ stroke: "var(--projection-grid-strong)" }}
                minTickGap={34}
                tick={{ fill: "var(--projection-muted)", fontSize: 12 }}
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
                tick={{ fill: "var(--projection-muted)", fontSize: 12 }}
                tickFormatter={(value: number) =>
                  formatAxisMoney(value, displayCurrency)
                }
              />
              <ReferenceLine
                x={todayTimestamp}
                stroke="var(--projection-muted)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{
                  value: "Today",
                  position: "insideTopRight",
                  fill: "var(--projection-muted)",
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
                    <div className="projection-chart-tooltip">
                      <strong>{formatProjectionDate(row.date)}</strong>
                      <TooltipRow
                        label="Total"
                        color="#153CF8"
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
                      <span className="projection-tooltip-state">
                        {row.isProjected
                          ? "Projected balance"
                          : "Balance snapshot"}
                      </span>
                    </div>
                  );
                }}
              />

              {mode === "total" ? (
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="none"
                  fill="url(#projection-total-fill)"
                  isAnimationActive={false}
                />
              ) : null}

              {mode === "stacked"
                ? selectedBanks.map((bank) => (
                    <Area
                      key={bank._id}
                      type="monotone"
                      dataKey={bankDataKey(bank._id)}
                      stackId="projection-banks"
                      stroke={bank.color}
                      strokeWidth={1.6}
                      fill={`url(#projection-fill-${bank._id})`}
                      isAnimationActive={false}
                    />
                  ))
                : null}

              {mode === "lines"
                ? selectedBanks.map((bank) => (
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
                  ))
                : null}

              {totalVisible ? (
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#153CF8"
                  strokeWidth={2.8}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "var(--surface)" }}
                  isAnimationActive={false}
                />
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
      className={`projection-series-toggle${selected ? " selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="projection-series-check" aria-hidden="true">
        {selected ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      <span
        className="projection-series-dot"
        style={{ backgroundColor: color }}
      />
      {label}
    </button>
  );
}

function TooltipRow({ label, color, value, currency, usdIlsRate }: {
  label: string;
  color: string;
  value: number;
  currency: ProjectionCurrency;
  usdIlsRate: number | null;
}) {
  const otherCurrency = otherProjectionCurrency(currency);
  const otherValue = convertProjectionAmount(
    value,
    currency,
    otherCurrency,
    usdIlsRate,
  );
  return (
    <span className="projection-tooltip-row">
      <span className="projection-tooltip-label">
        <i style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="projection-tooltip-values">
        <b>{formatProjectionMoney(value, currency)}</b>
        {otherValue === null ? null : (
          <small>≈ {formatProjectionMoney(otherValue, otherCurrency)}</small>
        )}
      </span>
    </span>
  );
}