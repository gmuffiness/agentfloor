import { Container, Graphics, Sprite, Text, Texture, Rectangle } from "pixi.js";
import type { Agent } from "@/types";
import { getVendorColor } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

/**
 * Sprite sheet: /assets/characters.png (384x672)
 * 12 columns x 21 rows of 32x32 sprites
 * 20 characters: 4 per row-group, 5 row-groups
 * Each character: 3 frames (cols) x 4 directions (rows)
 *   Row 0: facing down  (frame 0=stand, 1=walk-left, 2=walk-right)
 *   Row 1: facing left
 *   Row 2: facing right
 *   Row 3: facing up
 */

const SPRITE_SIZE = 32;
const CHARS_PER_ROW = 4;
const FRAMES_PER_CHAR = 3;
const DIRECTIONS = 4;

// Character indices to use (pick visually distinct ones from the 20 available)
// We'll assign based on agent name hash
const CHARACTER_POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

let sheetTexture: Texture | null = null;

function getSheetTexture(): Texture {
  if (!sheetTexture) {
    sheetTexture = Texture.from("/assets/characters.png");
  }
  return sheetTexture;
}

/** Get a specific frame texture for a character */
function getCharFrame(charIndex: number, direction: number, frame: number): Texture {
  const base = getSheetTexture();
  const charCol = charIndex % CHARS_PER_ROW;
  const charRowGroup = Math.floor(charIndex / CHARS_PER_ROW);

  const pixelX = (charCol * FRAMES_PER_CHAR + frame) * SPRITE_SIZE;
  const pixelY = (charRowGroup * DIRECTIONS + direction) * SPRITE_SIZE;

  return new Texture({ source: base.source, frame: new Rectangle(pixelX, pixelY, SPRITE_SIZE, SPRITE_SIZE) });
}

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

const DARK = 0x1e293b;

export function createAgentAvatar(agent: Agent): Container {
  const container = new Container();
  container.x = agent.position.x;
  container.y = agent.position.y;

  const vendorHex = getVendorColor(agent.vendor);
  const vendorNum = hexToNum(vendorHex);
  const isActive = agent.status === "active";
  const isError = agent.status === "error";
  const isIdle = agent.status === "idle";

  // Pick a character from the sprite sheet based on agent name
  const hash = nameHash(agent.name);
  const charIndex = CHARACTER_POOL[hash % CHARACTER_POOL.length];

  // Direction: 0=down (front-facing default)
  const direction = 0;
  // Frame: 0=standing, 1/2=walking
  const frame = 0;

  // === Ground shadow ===
  const shadow = new Graphics();
  shadow.ellipse(0, 16, 12, 4);
  shadow.fill({ color: 0x000000, alpha: 0.2 });
  container.addChild(shadow);

  // === Character sprite (32x32) ===
  const charTexture = getCharFrame(charIndex, direction, frame);
  const charSprite = new Sprite(charTexture);
  charSprite.anchor.set(0.5, 0.5);
  charSprite.x = 0;
  charSprite.y = 0;
  // Scale up slightly for visibility (32px is quite small on a 1200x600 world)
  charSprite.scale.set(1.4);
  container.addChild(charSprite);

  // Store walk frames for animation
  const walkFrames = [
    getCharFrame(charIndex, direction, 0),
    getCharFrame(charIndex, direction, 1),
    getCharFrame(charIndex, direction, 2),
    getCharFrame(charIndex, direction, 1),
  ];
  (container as Container & { _walkFrames: Texture[] })._walkFrames = walkFrames;
  (container as Container & { _charSprite: Sprite })._charSprite = charSprite;
  (container as Container & { _walkFrame: number })._walkFrame = 0;

  // === Active glow ===
  if (isActive) {
    const glow = new Graphics();
    glow.circle(0, 0, 22);
    glow.fill({ color: 0x22c55e, alpha: 0.1 });
    container.addChildAt(glow, 0);
  }

  // === Status indicator (colored dot) ===
  const statusColor = isActive ? 0x22c55e : isIdle ? 0xeab308 : 0xef4444;
  const badge = new Graphics();
  badge.circle(14, -16, 4);
  badge.fill({ color: statusColor });
  badge.circle(14, -16, 4);
  badge.stroke({ color: 0xffffff, width: 1.5 });
  container.addChild(badge);

  // === Error speech bubble ===
  if (isError) {
    const bubble = new Graphics();
    bubble.roundRect(-12, -40, 24, 16, 4);
    bubble.fill({ color: 0xef4444 });
    bubble.moveTo(-2, -24);
    bubble.lineTo(2, -24);
    bubble.lineTo(0, -20);
    bubble.closePath();
    bubble.fill({ color: 0xef4444 });
    container.addChild(bubble);

    const excl = new Text({
      text: "!",
      style: { fontFamily: "monospace", fontSize: 12, fontWeight: "900", fill: "#FFFFFF" },
    });
    excl.anchor.set(0.5, 0.5);
    excl.x = 0;
    excl.y = -32;
    container.addChild(excl);
  }

  // === Active working bubble ===
  if (isActive) {
    const bubble = new Graphics();
    bubble.roundRect(-14, -40, 28, 14, 4);
    bubble.fill({ color: DARK, alpha: 0.85 });
    bubble.moveTo(-2, -26);
    bubble.lineTo(2, -26);
    bubble.lineTo(0, -22);
    bubble.closePath();
    bubble.fill({ color: DARK, alpha: 0.85 });
    container.addChild(bubble);

    const dots = new Text({
      text: "•••",
      style: { fontFamily: "Arial", fontSize: 10, fill: "#FFFFFF" },
    });
    dots.anchor.set(0.5, 0.5);
    dots.x = 0;
    dots.y = -33;
    container.addChild(dots);
  }

  // === Name plate ===
  const shortName = agent.name.length > 12 ? agent.name.slice(0, 11) + "\u2026" : agent.name;
  const nameWidth = Math.max(shortName.length * 5.5 + 14, 48);

  const nameBg = new Graphics();
  nameBg.roundRect(-nameWidth / 2, 22, nameWidth, 14, 3);
  nameBg.fill({ color: DARK, alpha: 0.8 });
  // Vendor-colored top accent
  nameBg.roundRect(-nameWidth / 2 + 2, 22, nameWidth - 4, 2, 1);
  nameBg.fill({ color: vendorNum, alpha: 0.8 });
  container.addChild(nameBg);

  const nameLabel = new Text({
    text: shortName,
    style: {
      fontFamily: "monospace",
      fontSize: 8,
      fontWeight: "600",
      fill: "#FFFFFF",
    },
  });
  nameLabel.anchor.set(0.5, 0);
  nameLabel.x = 0;
  nameLabel.y = 24;
  container.addChild(nameLabel);

  // === Tooltip ===
  const tooltipWidth = 150;
  const tooltipContainer = new Container();
  tooltipContainer.visible = false;

  const tooltipBg = new Graphics();
  tooltipBg.roundRect(-tooltipWidth / 2, -68, tooltipWidth, 50, 6);
  tooltipBg.fill({ color: DARK, alpha: 0.95 });
  tooltipBg.roundRect(-tooltipWidth / 2, -68, tooltipWidth, 3, 6);
  tooltipBg.fill({ color: vendorNum, alpha: 0.9 });
  tooltipContainer.addChild(tooltipBg);

  const tooltipName = new Text({
    text: agent.name,
    style: { fontFamily: "monospace", fontSize: 10, fontWeight: "700", fill: "#FFFFFF" },
  });
  tooltipName.anchor.set(0.5, 0);
  tooltipName.x = 0;
  tooltipName.y = -62;
  tooltipContainer.addChild(tooltipName);

  const tooltipMeta = new Text({
    text: `${agent.model}  |  $${agent.monthlyCost}/mo`,
    style: { fontFamily: "monospace", fontSize: 8, fill: "#94A3B8" },
  });
  tooltipMeta.anchor.set(0.5, 0);
  tooltipMeta.x = 0;
  tooltipMeta.y = -48;
  tooltipContainer.addChild(tooltipMeta);

  const skillIcons = agent.skills.map((s) => s.icon).join(" ");
  const tooltipSkills = new Text({
    text: skillIcons,
    style: { fontFamily: "Arial", fontSize: 10 },
  });
  tooltipSkills.anchor.set(0.5, 0);
  tooltipSkills.x = 0;
  tooltipSkills.y = -34;
  tooltipContainer.addChild(tooltipSkills);

  container.addChild(tooltipContainer);

  // === Idle dimming ===
  if (isIdle) {
    container.alpha = 0.6;
  }

  // === Interaction ===
  container.eventMode = "static";
  container.cursor = "pointer";
  container.hitArea = {
    contains: (hx: number, hy: number) => hx >= -20 && hx <= 20 && hy >= -24 && hy <= 24,
  };

  container.on("pointerover", () => {
    tooltipContainer.visible = true;
    if (!isIdle) container.scale.set(1.1);
  });
  container.on("pointerout", () => {
    tooltipContainer.visible = false;
    container.scale.set(1.0);
    if (isIdle) container.alpha = 0.6;
  });
  container.on("pointerdown", () => {
    useAppStore.getState().selectAgent(agent.id);
  });

  (container as Container & { _baseY: number })._baseY = container.y;
  (container as Container & { _agentStatus: string })._agentStatus = agent.status;

  return container;
}
