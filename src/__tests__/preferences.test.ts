import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPreferences, updatePreferences } from "@/services/preferences";

const mockUserId = "user-123";

const mockSingle = vi.fn();

vi.mock("@/lib/supabase", () => {
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía las preferencias al endpoint y devuelve lo combinado por el servidor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: { monthly_goal: 50000, goal_month: "2024-07" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updatePreferences(mockUserId, { goal_month: "2024-07" });

    expect(result).toEqual({ monthly_goal: 50000, goal_month: "2024-07" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/preferences",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("lanza error con el mensaje devuelto por el endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Update failed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(updatePreferences(mockUserId, { monthly_goal: 100 })).rejects.toThrow("Update failed");
  });
});
