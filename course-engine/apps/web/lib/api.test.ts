import { afterEach, describe, expect, it, vi } from "vitest";
import { download } from "./api";

describe("authenticated downloads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the object URL alive until after the browser starts the download", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:semester-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      new Blob(["guide"]),
      { headers: { "Content-Disposition": 'attachment; filename="guide.pdf"' } },
    )));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await download("/study-assets/asset-1/exports/pdf");

    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:semester-export");
  });
});
