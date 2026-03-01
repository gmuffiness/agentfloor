import { Assets, Container, Graphics, Sprite, Text, Texture, Rectangle, ColorMatrixFilter } from "pixi.js";
import type { Agent } from "@/types";
import { getVendorColor } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

/**
 * Pixel-character sprites: /assets/pixel-characters/char_0..5.png
 * Each PNG is 112x96 (7 frames × 16px wide, 3 rows × 32px tall).
 *
 * Frame layout (per character):
 *   Columns: walk1(0), standing(1), walk3(2), type1(3), type2(4), read1(5), read2(6)
 *   Rows:    down(0), up(1), right(2)  — left = flipped right
 *
 * 6 base character palettes. Beyond 6 agents: cycle + vendor hue shift.
 */

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 32;
const FRAME_COUNT = 7;
const DIR_COUNT = 3; // down=0, up=1, right=2
const PALETTE_COUNT = 6;

// Standing frame index (walk2 / neutral pose)
const STANDING_FRAME = 1;

const CHAR_ASSET_KEY_PREFIX = "pixel-char-";
let charTextures: Texture[] = []; // 6 base textures

/** Load all 6 character PNGs. Must be called before createAgentAvatar. */
export async function loadSpriteSheet(): Promise<void> {
  if (charTextures.length === PALETTE_COUNT && charTextures[0]?.source) return;
  charTextures = [];
  for (let i = 0; i < PALETTE_COUNT; i++) {
    const tex = await Assets.load<Texture>({
      alias: `${CHAR_ASSET_KEY_PREFIX}${i}`,
      src: `/assets/pixel-characters/char_${i}.png`,
    });
    charTextures.push(tex);
  }
}

/** Get loaded textures array (must call loadSpriteSheet first). */
export function getCharTextures(): Texture[] {
  return charTextures;
}

/** Reset cached textures (call on Pixi app destruction). */
export function resetSpriteSheet(): void {
  charTextures = [];
  for (let i = 0; i < PALETTE_COUNT; i++) {
    Assets.cache.remove(`${CHAR_ASSET_KEY_PREFIX}${i}`);
  }
}

/** Get a specific frame texture from a character palette */
export function getCharFrame(paletteIndex: number, frameIndex: number, dirRow: number): Texture {
  const idx = ((paletteIndex % PALETTE_COUNT) + PALETTE_COUNT) % PALETTE_COUNT;
  const tex = charTextures[idx];
  if (!tex || !tex.source) return Texture.EMPTY;

  const x = frameIndex * SPRITE_WIDTH;
  const y = dirRow * SPRITE_HEIGHT;
  return new Texture({
    source: tex.source,
    frame: new Rectangle(x, y, SPRITE_WIDTH, SPRITE_HEIGHT),
  });
}

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/**
 * Vendor hue base values (degrees):
 * - anthropic: orange-warm tones (0° base)
 * - openai:    green tones (120° shift)
 * - google:    blue tones (240° shift)
 * - other:     purple/pink (300° shift)
 *
 * Per-agent variation of ±30° is added based on name hash for individuality.
 * Sprites have roughly neutral tones (~25° hue), so we rotate relative to that.
 */
const SPRITE_BASE_HUE = 25;

const VENDOR_BASE_HUES: Record<string, number> = {
  anthropic: 0,
  openai: 120,
  google: 240,
};

/**
 * Get the hue shift (degrees) to apply to an agent sprite.
 * Exported for reuse in other components.
 */
export function getAgentHueShift(vendor: string, agentName: string): number {
  const baseHue = VENDOR_BASE_HUES[vendor] ?? 300;
  const variation = (nameHash(agentName) % 61) - 30;
  const targetHue = (baseHue + variation + 360) % 360;
  let shift = targetHue - SPRITE_BASE_HUE;
  if (shift > 180) shift -= 360;
  if (shift < -180) shift += 360;
  return shift;
}

function getVendorHueShift(vendor: string, agentName: string): number {
  return getAgentHueShift(vendor, agentName);
}

const DARK = 0x1e293b;

/**
 * Assign a diverse palette index for an agent within its department.
 * Picks the least-used palette among sibling agents for visual variety.
 */
function pickDiversePalette(agentId: string, agentName: string, siblingIds: string[]): number {
  const usageCounts = new Array<number>(PALETTE_COUNT).fill(0);

  const sortedSiblings = [...siblingIds].sort();

  for (const sid of sortedSiblings) {
    if (sid === agentId) break;
    const naturalSlot = nameHash(sid) % PALETTE_COUNT;
    let bestSlot = -1;
    let bestCount = Infinity;
    for (let i = 0; i < PALETTE_COUNT; i++) {
      const slot = (naturalSlot + i) % PALETTE_COUNT;
      if (usageCounts[slot] < bestCount) {
        bestCount = usageCounts[slot];
        bestSlot = slot;
      }
    }
    usageCounts[bestSlot]++;
  }

  const naturalSlot = nameHash(agentName) % PALETTE_COUNT;
  let bestSlot = -1;
  let bestCount = Infinity;
  for (let i = 0; i < PALETTE_COUNT; i++) {
    const slot = (naturalSlot + i) % PALETTE_COUNT;
    if (usageCounts[slot] < bestCount) {
      bestCount = usageCounts[slot];
      bestSlot = slot;
    }
  }

  return bestSlot;
}

/**
 * Create an animated speech bubble with cycling dots for active agents.
 */
function createAnimatedSpeechBubble(): { bubble: Container; cleanup: () => void } {
  const bubbleContainer = new Container();

  const bg = new Graphics();
  bg.roundRect(-14, -52, 28, 14, 4);
  bg.fill({ color: DARK, alpha: 0.85 });
  bg.moveTo(-2, -38);
  bg.lineTo(2, -38);
  bg.lineTo(0, -34);
  bg.closePath();
  bg.fill({ color: DARK, alpha: 0.85 });
  bubbleContainer.addChild(bg);

  const dotTexts = ["•", "•", "•"].map((dot, i) => {
    const t = new Text({
      text: dot,
      style: { fontFamily: "Arial", fontSize: 10, fill: "#FFFFFF" },
    });
    t.anchor.set(0.5, 0.5);
    t.x = (i - 1) * 8;
    t.y = -45;
    t.alpha = i === 0 ? 1.0 : 0.3;
    bubbleContainer.addChild(t);
    return t;
  });

  let activeIndex = 0;
  const interval = setInterval(() => {
    dotTexts.forEach((t, i) => {
      t.alpha = i === activeIndex ? 1.0 : 0.3;
    });
    activeIndex = (activeIndex + 1) % 3;
  }, 400);

  const cleanup = () => clearInterval(interval);
  return { bubble: bubbleContainer, cleanup };
}

/**
 * Create an enhanced glow ring for the agent status.
 */
function createGlowRing(statusColor: number, isActive: boolean): Graphics {
  const ring = new Graphics();

  if (isActive) {
    ring.circle(0, 0, 28);
    ring.fill({ color: statusColor, alpha: 0.08 });
    ring.circle(0, 0, 24);
    ring.fill({ color: statusColor, alpha: 0.12 });
  }

  ring.circle(0, 0, 20);
  ring.stroke({ color: statusColor, width: isActive ? 2.5 : 1.5, alpha: isActive ? 0.9 : 0.6 });

  return ring;
}

export interface AvatarCleanup {
  destroy: () => void;
}

export function createAgentAvatar(agent: Agent, siblingAgentIds?: string[]): Container & { _cleanup?: AvatarCleanup } {
  const container = new Container() as Container & { _cleanup?: AvatarCleanup };
  container.x = agent.position.x;
  container.y = agent.position.y;

  const vendorHex = getVendorColor(agent.vendor);
  const vendorNum = hexToNum(vendorHex);
  const isActive = agent.status === "active";
  const isError = agent.status === "error";
  const isIdle = agent.status === "idle";

  // === Pick diverse palette index ===
  let paletteIndex: number;
  if (siblingAgentIds && siblingAgentIds.length > 1) {
    paletteIndex = pickDiversePalette(agent.id, agent.name, siblingAgentIds);
  } else {
    paletteIndex = nameHash(agent.name) % PALETTE_COUNT;
  }

  // === Ground shadow ===
  const shadow = new Graphics();
  shadow.ellipse(0, 20, 14, 5);
  shadow.fill({ color: 0x000000, alpha: 0.2 });
  container.addChild(shadow);

  // === Enhanced glow ring ===
  const statusColor = isActive ? 0x22c55e : isIdle ? 0xeab308 : 0xef4444;
  const glowRing = createGlowRing(statusColor, isActive);
  container.addChild(glowRing);

  // === Character sprite (16x32) with vendor hue shift ===
  const charTexture = getCharFrame(paletteIndex, STANDING_FRAME, 0); // standing, facing down
  const charSprite = new Sprite(charTexture);
  charSprite.anchor.set(0.5, 0.5);
  charSprite.x = 0;
  charSprite.y = 0;
  // 16px sprites need larger scale for visibility
  charSprite.scale.set(2.5);

  // Apply vendor-based hue shift via ColorMatrixFilter
  const hueShiftDeg = getVendorHueShift(agent.vendor, agent.name);
  if (Math.abs(hueShiftDeg) > 5) {
    const hueFilter = new ColorMatrixFilter();
    hueFilter.hue(hueShiftDeg, false);
    charSprite.filters = [hueFilter];
  }

  container.addChild(charSprite);

  // === Error speech bubble ===
  if (isError) {
    const bubble = new Graphics();
    bubble.roundRect(-12, -52, 24, 16, 4);
    bubble.fill({ color: 0xef4444 });
    bubble.moveTo(-2, -36);
    bubble.lineTo(2, -36);
    bubble.lineTo(0, -32);
    bubble.closePath();
    bubble.fill({ color: 0xef4444 });
    container.addChild(bubble);

    const excl = new Text({
      text: "!",
      style: { fontFamily: '"Press Start 2P", monospace', fontSize: 12, fontWeight: "900", fill: "#FFFFFF" },
    });
    excl.anchor.set(0.5, 0.5);
    excl.x = 0;
    excl.y = -44;
    container.addChild(excl);
  }

  // === Active working bubble — animated dots ===
  let bubbleCleanup: (() => void) | null = null;
  if (isActive) {
    const { bubble: animBubble, cleanup } = createAnimatedSpeechBubble();
    container.addChild(animBubble);
    bubbleCleanup = cleanup;
  }

  // === Name plate ===
  const shortName = agent.name.length > 10 ? agent.name.slice(0, 9) + "\u2026" : agent.name;
  const nameWidth = Math.max(shortName.length * 6.5 + 14, 48);

  const nameBg = new Graphics();
  nameBg.roundRect(-nameWidth / 2, 28, nameWidth, 14, 3);
  nameBg.fill({ color: DARK, alpha: 0.8 });
  nameBg.roundRect(-nameWidth / 2 + 2, 28, nameWidth - 4, 2, 1);
  nameBg.fill({ color: vendorNum, alpha: 0.8 });
  container.addChild(nameBg);

  const nameLabel = new Text({
    text: shortName,
    style: {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 6,
      fontWeight: "400",
      fill: "#FFFFFF",
    },
  });
  nameLabel.anchor.set(0.5, 0);
  nameLabel.x = 0;
  nameLabel.y = 30;
  container.addChild(nameLabel);

  // === Tooltip ===
  const tooltipWidth = 150;
  const tooltipContainer = new Container();
  tooltipContainer.visible = false;

  const tooltipBg = new Graphics();
  tooltipBg.roundRect(-tooltipWidth / 2, -80, tooltipWidth, 50, 6);
  tooltipBg.fill({ color: DARK, alpha: 0.95 });
  tooltipBg.roundRect(-tooltipWidth / 2, -80, tooltipWidth, 3, 6);
  tooltipBg.fill({ color: vendorNum, alpha: 0.9 });
  tooltipContainer.addChild(tooltipBg);

  const tooltipName = new Text({
    text: agent.name,
    style: { fontFamily: '"Press Start 2P", monospace', fontSize: 8, fontWeight: "400", fill: "#FFFFFF" },
  });
  tooltipName.anchor.set(0.5, 0);
  tooltipName.x = 0;
  tooltipName.y = -74;
  tooltipContainer.addChild(tooltipName);

  const tooltipMeta = new Text({
    text: `${agent.model}  |  $${agent.monthlyCost}/mo`,
    style: { fontFamily: '"Press Start 2P", monospace', fontSize: 6, fill: "#94A3B8" },
  });
  tooltipMeta.anchor.set(0.5, 0);
  tooltipMeta.x = 0;
  tooltipMeta.y = -60;
  tooltipContainer.addChild(tooltipMeta);

  const skillIcons = agent.skills.map((s) => s.icon).join(" ");
  const tooltipSkills = new Text({
    text: skillIcons,
    style: { fontFamily: "Arial", fontSize: 10 },
  });
  tooltipSkills.anchor.set(0.5, 0);
  tooltipSkills.x = 0;
  tooltipSkills.y = -46;
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
    contains: (hx: number, hy: number) => hx >= -22 && hx <= 22 && hy >= -40 && hy <= 30,
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

  container._cleanup = {
    destroy: () => {
      if (bubbleCleanup) bubbleCleanup();
    },
  };

  return container;
}
