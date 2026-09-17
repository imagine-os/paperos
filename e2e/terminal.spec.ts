import { expect, test, type Page } from "@playwright/test";
import { skipFirstRun } from "./helpers";

// page.evaluate callbacks run in the browser without this module's scope,
// so each one casts window.paperos itself.
interface ApiShape {
  terminal: {
    open(options?: { run?: string[] }): { id: string; backend: string };
    run(
      command: string,
      id?: string
    ): Promise<{ output: string; error: boolean; prompt: string }>;
    list(): { id: string; backend: string; prompt: string }[];
  };
  windows: {
    list(): { id: string; kind: string; title: string }[];
    focus(id: string): unknown;
  };
  projects: { current(): unknown };
}
type W = { paperos: ApiShape };

async function openApp(page: Page) {
  await skipFirstRun(page);
  await page.goto("/app");
  await expect(page.getByTestId("topbar")).toBeVisible();
  await page.waitForFunction(
    () => !!(window as unknown as W).paperos?.projects.current(),
    null,
    { timeout: 30000 }
  );
}

test("the Terminal window runs the project shell: ls, tab completion, open <file>", async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId("new-window-menu").click();
  await page.getByTestId("new-window-terminal").click();
  const terminal = page.getByTestId("terminal-window");
  await expect(terminal).toBeVisible();
  await expect(terminal).toHaveAttribute("data-backend", "project");
  await expect(page.getByTestId("terminal-hint")).toContainText(
    "For a real shell"
  );
  const output = page.getByTestId("terminal-output");
  await expect(output).toContainText('Project shell over "Sample site"');

  const input = page.getByTestId("terminal-input");
  await input.click();
  await input.fill("ls");
  await input.press("Enter");
  await expect(output).toContainText("index.html");
  await expect(output).toContainText("pages/");
  await expect(output.locator('[data-kind="input"]').first()).toHaveText(
    "/ $ ls"
  );

  // Tab completes a path; a second Tab on an ambiguous prefix lists candidates.
  await input.fill("cat pa");
  await input.press("Tab");
  await expect(input).toHaveValue("cat pages/");
  await input.press("Tab");
  await expect(output).toContainText("pages/admin.json  pages/home.json");
  await input.fill("");

  // `open index.html` opens an editor window on the canvas.
  await input.fill("open index.html");
  await input.press("Enter");
  await expect(output).toContainText("Opened /index.html in an editor.");
  const editors = page.locator(".pos-window[data-kind=editor]");
  await expect(editors).toHaveCount(1);
  await expect(editors.locator(".pos-window__title")).toContainText(
    "index.html"
  );

  // Errors show as such; the pipeline and redirection write project files.
  await input.fill("frobnicate");
  await input.press("Enter");
  await expect(output.locator('[data-kind="error"]').last()).toContainText(
    "command not found"
  );
  await input.fill("grep -c PaperOS index.html | wc -l > notes.txt");
  await input.press("Enter");
  await input.fill("cat notes.txt");
  await input.press("Enter");
  await expect(output.locator('[data-kind="output"]').last()).toHaveText(
    /^\s*\d+$/
  );
  await expect(page.getByTestId("file-tree")).toHaveCount(0);

  // The Bridge shell asks first, and cannot start while the bridge is off.
  // (The new editor cascaded over the terminal: bring the terminal back to front.)
  await page.evaluate(() => {
    const api = (window as unknown as W).paperos;
    api.windows.focus(api.terminal.list()[0].id);
  });
  await page.getByTestId("terminal-backend-bridge").click();
  const confirm = page.getByTestId("terminal-confirm");
  await expect(confirm).toContainText("Run a real shell on your machine?");
  await expect(page.getByTestId("terminal-confirm-start")).toBeDisabled();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(terminal).toHaveAttribute("data-backend", "project");
});

test("the Canvas API drives a terminal: terminal.run opens a window and returns output", async ({
  page,
}) => {
  await openApp(page);
  const r = await page.evaluate(() =>
    (window as unknown as W).paperos.terminal.run("tree pages")
  );
  expect(r.error).toBe(false);
  expect(r.output).toContain("home.json");
  expect(r.prompt).toBe("/ $");
  const list = await page.evaluate(() =>
    (window as unknown as W).paperos.terminal.list()
  );
  expect(list).toHaveLength(1);
  expect(list[0].backend).toBe("project");
  await expect(page.getByTestId("terminal-output")).toContainText("home.json");

  const second = await page.evaluate(() =>
    (window as unknown as W).paperos.terminal.open({ run: ["cd data", "pwd"] })
  );
  await expect(
    page.locator(`[data-shape-id="${second.id}"] [data-testid=terminal-output]`)
  ).toContainText("/data");
  const kinds = await page.evaluate(
    () =>
      (window as unknown as W).paperos.windows
        .list()
        .filter((w) => w.kind === "terminal").length
  );
  expect(kinds).toBe(2);
});
