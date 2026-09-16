import type { PluginModule } from "../types";

/** Example plugin: a window kind that shows the time, and a command to open one. */
const clock: PluginModule = {
  name: "Clock",
  description: "A window kind showing the current time.",
  activate(api) {
    api.registerWindowKind({
      id: "clock",
      label: "Clock",
      icon: "◷",
      defaultTitle: "Clock",
      defaultSize: { w: 300, h: 180 },
      render(el, ctx) {
        el.style.cssText =
          "display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;font-variant-numeric:tabular-nums;";
        const time = document.createElement("div");
        time.style.cssText =
          "font-size:40px;font-weight:600;letter-spacing:0.02em;";
        time.dataset.testid = "clock-time";
        const date = document.createElement("div");
        date.style.cssText = "font-size:13px;opacity:0.7;margin-top:6px;";
        el.append(time, date);
        const tick = () => {
          const now = new Date();
          time.textContent = now.toLocaleTimeString();
          date.textContent = now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
        };
        tick();
        const timer = setInterval(tick, 1000);
        ctx.signal.addEventListener("abort", () => clearInterval(timer));
      },
    });
  },
};

export default clock;
