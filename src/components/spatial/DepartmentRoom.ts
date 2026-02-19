import { Container, Graphics, Text } from "pixi.js";
import type { Department } from "@/types";
import { getVendorColor, getVendorLabel, formatCurrency } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export function createDepartmentRoom(
  department: Department,
  onDoubleClick?: (dept: Department) => void,
): Container {
  const container = new Container();
  const { x, y, width, height } = department.layout;
  container.x = x;
  container.y = y;

  const overBudget = department.monthlySpend > department.budget;
  const vendorColor = getVendorColor(department.primaryVendor);
  const vendorHex = hexToNum(vendorColor);
  const wallColor = overBudget ? 0xB85450 : 0x8B7355;
  const wallDark = darken(wallColor, 0.7);
  const roofColor = overBudget ? 0xC44040 : vendorHex;

  const g = new Graphics();

  // === Building shadow ===
  g.roundRect(5, 5, width, height, 4);
  g.fill({ color: 0x000000, alpha: 0.15 });

  // === Stone/wood wall base ===
  g.roundRect(0, 0, width, height, 4);
  g.fill({ color: wallColor });
  // Inner lighter floor
  g.roundRect(4, 4, width - 8, height - 8, 2);
  g.fill({ color: 0xF5E6D0 });

  // === Floor tile pattern (warm wooden planks style) ===
  const floorX = 4;
  const floorY = 4;
  const floorW = width - 8;
  const floorH = height - 8;

  const plankH = 12;
  const floorTiles = new Graphics();
  for (let py = floorY; py < floorY + floorH; py += plankH) {
    const ph = Math.min(plankH, floorY + floorH - py);
    const isAlt = Math.floor((py - floorY) / plankH) % 2 === 0;
    floorTiles.rect(floorX, py, floorW, ph);
    floorTiles.fill({ color: isAlt ? 0xEBD9BF : 0xF5E6D0 });
    // Plank line
    floorTiles.rect(floorX, py + ph - 1, floorW, 1);
    floorTiles.fill({ color: 0xD4C4A8, alpha: 0.4 });
  }
  container.addChild(floorTiles);

  // === Wall border (stone/brick pattern) ===
  const wallBorder = new Graphics();
  // Top wall
  wallBorder.rect(0, 0, width, 4);
  wallBorder.fill({ color: wallColor });
  // Bottom wall
  wallBorder.rect(0, height - 4, width, 4);
  wallBorder.fill({ color: wallColor });
  // Left wall
  wallBorder.rect(0, 0, 4, height);
  wallBorder.fill({ color: wallColor });
  // Right wall
  wallBorder.rect(width - 4, 0, 4, height);
  wallBorder.fill({ color: wallColor });

  // Wall highlights (top-left lighter, bottom-right darker)
  wallBorder.rect(0, 0, width, 1);
  wallBorder.fill({ color: 0xFFFFFF, alpha: 0.15 });
  wallBorder.rect(0, 0, 1, height);
  wallBorder.fill({ color: 0xFFFFFF, alpha: 0.15 });
  wallBorder.rect(0, height - 1, width, 1);
  wallBorder.fill({ color: 0x000000, alpha: 0.15 });
  wallBorder.rect(width - 1, 0, 1, height);
  wallBorder.fill({ color: 0x000000, alpha: 0.15 });
  container.addChild(wallBorder);

  // === Roof (triangular / sloped look at top) ===
  const roofH = 14;
  const roof = new Graphics();
  // Main roof body
  roof.roundRect(-3, -roofH, width + 6, roofH + 2, 2);
  roof.fill({ color: roofColor });
  // Roof ridge (top highlight)
  roof.rect(-1, -roofH, width + 2, 2);
  roof.fill({ color: darken(roofColor, 1.2) > 0xffffff ? roofColor : darken(roofColor, 1.2) });
  // Roof shadow at bottom
  roof.rect(0, -2, width, 3);
  roof.fill({ color: 0x000000, alpha: 0.12 });
  // Roof shingle lines
  for (let ry = -roofH + 4; ry < -1; ry += 4) {
    roof.rect(-2, ry, width + 4, 1);
    roof.fill({ color: 0x000000, alpha: 0.08 });
  }
  container.addChild(roof);

  // === Building sign (hanging from roof) ===
  const signW = Math.min(width * 0.7, 180);
  const signH = 22;
  const signX = (width - signW) / 2;
  const signY = 8;

  const sign = new Graphics();
  // Sign background (wood plank)
  sign.roundRect(signX, signY, signW, signH, 3);
  sign.fill({ color: 0x5C4033 });
  // Sign border
  sign.roundRect(signX, signY, signW, signH, 3);
  sign.stroke({ color: 0x3B2716, width: 1.5 });
  // Sign hanging hooks
  sign.circle(signX + 10, signY - 2, 2);
  sign.fill({ color: 0x8B6914 });
  sign.circle(signX + signW - 10, signY - 2, 2);
  sign.fill({ color: 0x8B6914 });
  container.addChild(sign);

  // Department name on sign
  const nameText = new Text({
    text: department.name,
    style: {
      fontFamily: "monospace",
      fontSize: 11,
      fontWeight: "700",
      fill: "#F5E6D0",
      letterSpacing: 0.5,
    },
  });
  nameText.anchor.set(0.5, 0.5);
  nameText.x = width / 2;
  nameText.y = signY + signH / 2;
  container.addChild(nameText);

  // === Door entrance (bottom center) ===
  const doorW = 18;
  const doorH = 20;
  const doorX = Math.floor(width / 2) - Math.floor(doorW / 2);
  const doorY = height - 4 - doorH;

  const door = new Graphics();
  // Door frame
  door.roundRect(doorX - 2, doorY - 2, doorW + 4, doorH + 6, 2);
  door.fill({ color: wallDark });
  // Door
  door.roundRect(doorX, doorY, doorW, doorH + 2, 1);
  door.fill({ color: 0x6B4226 });
  // Door arch
  door.ellipse(doorX + doorW / 2, doorY, doorW / 2, 5);
  door.fill({ color: wallDark });
  // Door handle
  door.circle(doorX + doorW - 4, doorY + doorH / 2, 1.5);
  door.fill({ color: 0xDAA520 });
  // Welcome mat
  door.roundRect(doorX - 3, height - 4, doorW + 6, 3, 1);
  door.fill({ color: 0xCD853F, alpha: 0.6 });
  container.addChild(door);

  // === Window decorations ===
  const windowG = new Graphics();
  const winSize = 10;
  const winY1 = signY + signH + 12;
  const winY2 = winY1 + winSize + 16;

  // Draw a window with shutters
  const drawWindow = (wx: number, wy: number) => {
    // Window frame
    windowG.roundRect(wx - 1, wy - 1, winSize + 2, winSize + 2, 1);
    windowG.fill({ color: wallDark });
    // Glass
    windowG.rect(wx, wy, winSize, winSize);
    windowG.fill({ color: 0x87CEEB, alpha: 0.7 });
    // Cross frame
    windowG.rect(wx + winSize / 2 - 0.5, wy, 1, winSize);
    windowG.fill({ color: wallDark, alpha: 0.6 });
    windowG.rect(wx, wy + winSize / 2 - 0.5, winSize, 1);
    windowG.fill({ color: wallDark, alpha: 0.6 });
    // Light reflection
    windowG.rect(wx + 1, wy + 1, 3, 3);
    windowG.fill({ color: 0xFFFFFF, alpha: 0.3 });
  };

  if (width > 150) {
    drawWindow(floorX + 14, winY1);
    drawWindow(floorX + floorW - winSize - 14, winY1);
    if (floorH > 140) {
      drawWindow(floorX + 14, winY2);
      drawWindow(floorX + floorW - winSize - 14, winY2);
    }
  } else {
    drawWindow(floorX + 10, winY1);
    drawWindow(floorX + floorW - winSize - 10, winY1);
  }
  container.addChild(windowG);

  // === Bottom HUD panel ===
  const hudH = 36;
  const hudY = floorY + floorH - hudH;
  const hud = new Graphics();
  hud.roundRect(floorX + 2, hudY, floorW - 4, hudH, 3);
  hud.fill({ color: 0x1A1A2E, alpha: 0.7 });
  // HUD top accent line
  hud.rect(floorX + 6, hudY, floorW - 12, 2);
  hud.fill({ color: vendorHex, alpha: 0.6 });
  container.addChild(hud);

  // Agent count
  const agentCount = department.agents.length;
  const countText = new Text({
    text: `${agentCount} agent${agentCount !== 1 ? "s" : ""}`,
    style: { fontFamily: "monospace", fontSize: 8, fill: "#94A3B8" },
  });
  countText.x = floorX + 10;
  countText.y = hudY + 6;
  container.addChild(countText);

  // Vendor label
  const vendorLabel = new Text({
    text: getVendorLabel(department.primaryVendor),
    style: { fontFamily: "monospace", fontSize: 8, fontWeight: "700", fill: vendorColor },
  });
  vendorLabel.anchor.set(1, 0);
  vendorLabel.x = floorX + floorW - 10;
  vendorLabel.y = hudY + 6;
  container.addChild(vendorLabel);

  // Cost display
  const costText = new Text({
    text: `${formatCurrency(department.monthlySpend)} / ${formatCurrency(department.budget)}`,
    style: {
      fontFamily: "monospace",
      fontSize: 10,
      fontWeight: "700",
      fill: overBudget ? "#EF4444" : "#E2E8F0",
    },
  });
  costText.x = floorX + 10;
  costText.y = hudY + 18;
  container.addChild(costText);

  // Budget bar
  const barW = floorW - 24;
  const barH = 3;
  const barY2 = hudY - 6;
  const barBg = new Graphics();
  barBg.roundRect(floorX + 12, barY2, barW, barH, 1);
  barBg.fill({ color: 0x000000, alpha: 0.2 });

  const ratio = Math.min(1, department.monthlySpend / department.budget);
  barBg.roundRect(floorX + 12, barY2, barW * ratio, barH, 1);
  barBg.fill({ color: overBudget ? 0xEF4444 : vendorHex });
  container.addChild(barBg);

  // Vendor agent dots
  const vendorCounts: Record<string, number> = { anthropic: 0, openai: 0, google: 0 };
  for (const agent of department.agents) vendorCounts[agent.vendor]++;
  let dotX = floorX + floorW - 10;
  const dotY = hudY + 22;
  for (const [vendor, count] of Object.entries(vendorCounts).reverse()) {
    if (count === 0) continue;
    for (let i = 0; i < count; i++) {
      dotX -= 9;
      const dot = new Graphics();
      dot.circle(dotX, dotY, 3);
      dot.fill({ color: getVendorColor(vendor as "anthropic" | "openai" | "google") });
      dot.circle(dotX, dotY, 3);
      dot.stroke({ color: 0xFFFFFF, width: 1 });
      container.addChild(dot);
    }
  }

  // === Interaction ===
  const hitArea = new Graphics();
  hitArea.rect(0, -roofH, width, height + roofH);
  hitArea.fill({ color: 0x000000, alpha: 0 });
  hitArea.eventMode = "static";
  hitArea.cursor = "pointer";
  container.addChild(hitArea);

  let lastTap = 0;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  hitArea.on("pointerdown", () => {
    const now = Date.now();
    if (onDoubleClick && now - lastTap < 350) {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      onDoubleClick(department);
    } else {
      clickTimer = setTimeout(() => {
        useAppStore.getState().selectDepartment(department.id);
        clickTimer = null;
      }, 300);
    }
    lastTap = now;
  });

  return container;
}
