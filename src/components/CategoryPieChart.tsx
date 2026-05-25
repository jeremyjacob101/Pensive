import { PieChart, Pie, Sector, Tooltip, ResponsiveContainer, type SectorProps } from "recharts";
import type { PieSlice } from "../types/pieChart";

export function CategoryPieChart({ data, width = 320, height = 320 }: {
  data: PieSlice[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="pie-chart-empty" style={{ width, height }}>
        <span>No data for this range</span>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  const chartData = data.map((entry) => ({
    ...entry,
    fill: entry.color,
  }));
  const baseRadius = Math.min(width, height);
  const outerRadius = baseRadius / 2 - 18;
  const innerRadius = baseRadius / 4 + 4;

  return (
    <>
      <div className="pie-chart-container" style={{ width, height }}>
        <div className="pie-chart-center-total">
          <span className="pie-total-label">Total</span>
          <span className="pie-total-value">
            ₪
            {total.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              dataKey="value"
              nameKey="label"
              shape={(props: SectorProps) => (
                <Sector {...props} fill={props.fill} stroke="none" />
              )}
            />

            <Tooltip
              content={({ active, payload }) => {
                const item = payload?.[0]?.payload as
                  | { label?: string; value?: number }
                  | undefined;
                if (!active || !item || typeof item.value !== "number") {
                  return null;
                }
                return (
                  <div className="pie-chart-tooltip">
                    <span className="pie-tooltip-label">
                      {item.label ?? ""}
                    </span>
                    <span className="pie-tooltip-value">
                      ₪
                      {item.value.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="pie-chart-legend">
        {data.map((entry, index) => (
          <div key={`legend-${index}`} className="pie-legend-item">
            <span
              className="pie-legend-dot"
              style={{ backgroundColor: entry.color }}
            />
            <span className="pie-legend-label">{entry.label}</span>
            <span className="pie-legend-value">
              ₪
              {entry.value.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}