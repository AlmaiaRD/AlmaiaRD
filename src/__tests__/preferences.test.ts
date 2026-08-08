import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPreferences, updatePreferences } from "@/services/preferences";

const mockUserId = "user-123";

const mockSingle = vi.fn();
const mockEqUpdate = vi.fn();
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }));
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdate }));

vi.mock("@/lib/supabase", () => {
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  }));

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

const { supabase } = await import("@/lib/supabase");

describe("getPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns preferences when user has them", async () => {
    const mockPrefs = { monthly_goal: 50000, goal_month: "2024-06" };
    mockSingle.mockResolvedValue({ data: { preferences: mockPrefs }, error: null });

    const result = await getPreferences(mockUserId);
    expect(result).toEqual(mockPrefs);
    expect(supabase.from).toHaveBeenCalledWith("users");
  });

  it("returns empty object when preferences is null", async () => {
    mockSingle.mockResolvedValue({ data: { preferences: null }, error: null });

    const result = await getPreferences(mockUserId);
    expect(result).toEqual({});
  });

  it("throws on error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error("DB error") });

    await expect(getPreferences(mockUserId)).rejects.toThrow("DB error");
  });
});

describe("updatePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges new preferences with existing ones", async () => {
    mockSingle.mockResolvedValue({
      data: { preferences: { monthly_goal: 50000 } },
      error: null,
    });
    mockEqUpdate.mockResolvedValue({ error: null });

    const result = await updatePreferences(mockUserId, { goal_month: "2024-07" });
    expect(result).toEqual({ monthly_goal: 50000, goal_month: "2024-07" });
  });

  it("throws on update error", async () => {
    mockSingle.mockResolvedValue({ data: { preferences: {} }, error: null });
    mockEqUpdate.mockResolvedValue({ error: new Error("Update failed") });

    await expect(updatePreferences(mockUserId, { monthly_goal: 100 })).rejects.toThrow("Update failed");
  });
});
