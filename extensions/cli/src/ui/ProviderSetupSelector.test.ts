import { describe, expect, it } from "vitest";

import { sanitizeApiKeyPaste } from "./ProviderSetupSelector.js";

describe("ProviderSetupSelector", () => {
  it("sanitizes pasted API keys", () => {
    expect(sanitizeApiKeyPaste("  sk-or-v1-test\n")).toBe("sk-or-v1-test");
    expect(sanitizeApiKeyPaste("sk-ant-test\r\n")).toBe("sk-ant-test");
  });
});
