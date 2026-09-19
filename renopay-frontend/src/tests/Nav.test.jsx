import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Nav } from "../components/Nav";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    profile: {
      full_name: "Test User",
      avatar_url: null,
    },
  }),
}));

describe("Nav Component with Raised Notch and Radial Action Menu", () => {
  it("renders all navigation items correctly", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Accounting")).toBeInTheDocument();
    expect(screen.getByText("Pay")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("navigates to standard tabs when clicked", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    fireEvent.click(screen.getByText("Accounting"));
    expect(mockNavigate).toHaveBeenCalledWith("accounting");

    fireEvent.click(screen.getByText("History"));
    expect(mockNavigate).toHaveBeenCalledWith("history");

    fireEvent.click(screen.getByText("Account"));
    expect(mockNavigate).toHaveBeenCalledWith("profile");
  });

  it("opens radial action menu when center action button is tapped", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    // Initially radial buttons are not open
    expect(screen.queryByLabelText("Camera Scan")).not.toBeInTheDocument();

    // Click center action button
    const payBtn = screen.getByLabelText("Pay Actions");
    fireEvent.click(payBtn);

    // Now its 3 radial action buttons appear
    expect(screen.getByLabelText("Camera Scan")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload QR Photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Enter UPI ID")).toBeInTheDocument();
  });

  it("triggers camera scan when + Camera is clicked", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    // Open menu
    fireEvent.click(screen.getByLabelText("Pay Actions"));

    // Click Camera Scan
    fireEvent.click(screen.getByLabelText("Camera Scan"));
    expect(mockNavigate).toHaveBeenCalledWith("scan", { mode: "camera" });
    expect(screen.queryByLabelText("Camera Scan")).not.toBeInTheDocument();
  });

  it("triggers gallery upload when Gallery is clicked", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    // Open menu
    fireEvent.click(screen.getByLabelText("Pay Actions"));

    // Click Gallery
    fireEvent.click(screen.getByLabelText("Upload QR Photo"));
    expect(mockNavigate).toHaveBeenCalledWith("scan", { mode: "upload" });
    expect(screen.queryByLabelText("Camera Scan")).not.toBeInTheDocument();
  });

  it("triggers manual UPI ID entry when UPI ID is clicked", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    // Open menu
    fireEvent.click(screen.getByLabelText("Pay Actions"));

    // Click UPI ID
    fireEvent.click(screen.getByLabelText("Enter UPI ID"));
    expect(mockNavigate).toHaveBeenCalledWith("pay");
    expect(screen.queryByLabelText("Camera Scan")).not.toBeInTheDocument();
  });

  it("closes radial menu when close cross button is clicked", () => {
    const mockNavigate = vi.fn();
    render(<Nav active="home" onNavigate={mockNavigate} />);

    // Open menu
    fireEvent.click(screen.getByLabelText("Pay Actions"));
    expect(screen.getByLabelText("Camera Scan")).toBeInTheDocument();

    // The center button morphs to close cross
    const closeBtn = screen.getByLabelText("Close Action Menu");
    fireEvent.click(closeBtn);

    expect(screen.queryByLabelText("Camera Scan")).not.toBeInTheDocument();
  });
});
