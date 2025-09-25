import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/dashboard/metric-card";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Pods" value="128" delta="5%" trend="up" />);
    expect(screen.getByText("Pods")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
  });
});
