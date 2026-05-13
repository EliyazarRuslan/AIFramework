import { expect, test } from "@playwright/test";

test("hero navigation and starter steps respond", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /AI field notes for real work/i })).toBeVisible();
  await page.getByRole("link", { name: /Start Learning AI/i }).click();
  await expect(page.getByRole("heading", { name: /Your 5-step AI starter guide/i })).toBeVisible();

  const stepsList = page.locator("#steps-list");
  const secondStep = stepsList.locator(".step-item").nth(1);
  await secondStep.click();
  await expect(secondStep).toHaveAttribute("data-status", "active");
  await expect(secondStep).toHaveAttribute("aria-current", "step");
  await expect(page.locator("#step-detail")).toContainText(/tasks involving language/i);
});

test("prompt library filters and opens generated prompt cards", async ({ page }) => {
  await page.goto("/#prompt-master");

  // Prompt Master body lives inside a <details class="section-collapse">
  // and is collapsed by default. Force it open so the search input and
  // prompt cards become interactive.
  const promptMasterDetails = page.locator("#prompt-master details.section-collapse").first();
  if (await promptMasterDetails.count()) {
    await promptMasterDetails.evaluate((el: HTMLDetailsElement) => {
      el.open = true;
    });
  }

  const search = page.getByRole("searchbox", { name: /Search prompts/i });
  await search.fill("email");
  await expect(page.locator("#pm-count")).not.toHaveText("0");

  const firstCardButton = page.locator(".pm-expand-btn").first();
  await firstCardButton.click();
  await expect(firstCardButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".pm-prompt-box").first()).toBeVisible();
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /Toggle dark mode/i })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Try-It-in-30s widget: pick a goal, copy the prompt, see the example answer", async ({
  page,
  context,
}) => {
  // Grant clipboard permission so navigator.clipboard.writeText resolves.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/#try-it-now");

  const widget = page.locator("#try-it-now");
  await expect(widget.getByRole("heading", { name: /See what AI can do/i })).toBeVisible();

  // Step 1: chips visible, none selected yet.
  const replyChip = widget.locator('[data-tryit-goal="reply"]');
  await expect(replyChip).toHaveAttribute("aria-checked", "false");

  // Click the "Write a polite reply" chip — Step 2 reveals the populated prompt.
  await replyChip.click();
  await expect(replyChip).toHaveAttribute("aria-checked", "true");

  const promptArea = widget.locator("#tryit-prompt");
  await expect(promptArea).toBeVisible();
  await expect(promptArea).toHaveValue(/thoughtful, professional colleague/i);

  // Copy the prompt and confirm the button flips to the success state.
  const copyBtn = widget.locator('[data-tryit-action="copy"]').first();
  await copyBtn.click();
  await expect(copyBtn).toHaveClass(/is-copied/);
  await expect(copyBtn).toContainText(/Copied/);
  await expect(widget.locator("#tryit-copy-status")).toContainText(/paste it into/i);

  // Reveal the fake AI output (Step 3) and verify the example body is present.
  await widget.locator('[data-tryit-action="show-output"]').click();
  await expect(widget.locator("[data-tryit-output]")).toContainText(/Subject: Quick update/i);
  await expect(widget.getByRole("link", { name: /ChatGPT/i })).toHaveAttribute(
    "href",
    /chatgpt\.com/,
  );

  // Reset returns the user to Step 1 with the chip un-selected.
  await widget.locator('[data-tryit-step="3"] [data-tryit-action="reset"]').click();
  await expect(replyChip).toHaveAttribute("aria-pressed", "false");
  await expect(widget.locator('[data-tryit-step="1"]')).toBeVisible();

  // Keyboard navigation: focus first chip, ArrowRight moves focus, Enter selects.
  const firstChip = widget.locator("[data-tryit-goal]").first();
  await firstChip.focus();
  await page.keyboard.press("ArrowRight");
  const secondChip = widget.locator("[data-tryit-goal]").nth(1);
  await expect(secondChip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(secondChip).toHaveAttribute("aria-pressed", "true");
  await expect(promptArea).toHaveValue(/business analyst/i);
});
