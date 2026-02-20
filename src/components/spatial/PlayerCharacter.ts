import { Container, Graphics, Sprite, Text, Texture, Rectangle } from "pixi.js";
import type { Agent } from "@/types";

/**
 * Player character for Gather.town-style movement.
 * Uses the same sprite sheet as agents (/assets/characters.png).
 *
 * Sprite sheet layout (384x672, 32x32 cells):
 *   12 cols x 21 rows. Each character = 3 frames (stand, walk-left, walk-right).
 *   4 characters per row. Row 0 is special, rows 1-20 are usable characters.
 *   Col 0 = front-facing, col 1 = front-variant, col 2 = back, col 3 = side.
 */

const SPRITE_SIZE = 32;
const CHARS_PER_ROW = 4;
const FRAMES_PER_CHAR = 3;
const PLAYER_SPEED = 3;
const PLAYER_SCALE = 1.6;
const INTERACTION_RADIUS = 70;
const WALK_FRAME_INTERVAL = 0.15; // seconds between walk frames
// RPG walk cycle: neutral → step-left → neutral → step-right
const WALK_CYCLE = [0, 1, 0, 2];

// Direction → character column in sprite sheet
// Col 0 = front, col 1 = front-variant, col 2 = back, col 3 = side
enum Direction {
  Down = 0,
  Up = 2,
  Side = 3,
}

export interface PlayerKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interact: boolean;
}

export interface RoomCollider {
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number; // door center X in world coords
  doorY: number; // door bottom Y in world coords
  doorW: number;
}

export interface NearbyAgent {
  agent: Agent;
  distance: number;
  container: Container;
}

export class PlayerCharacter {
  public container: Container;
  public x: number;
  public y: number;

  private sprite: Sprite;
  private shadow: Graphics;
  private nameplate: Container;
  private interactionPrompt: Container;
  private direction: Direction = Direction.Down;
  private facingRight: boolean = true;
  private frameIndex: number = 0;
  private walkTimer: number = 0;
  private isMoving: boolean = false;
  private nearestAgent: NearbyAgent | null = null;
  // Pre-cached textures: [direction][frame] to avoid creating Texture objects every tick
  private frameCache: Map<number, Texture> = new Map();

  constructor(
    spawnX: number,
    spawnY: number,
    sheetTexture: Texture,
    charRow: number = 5, // default player character row
  ) {
    this.x = spawnX;
    this.y = spawnY;

    // Pre-cache all direction+frame textures
    for (const dir of [Direction.Down, Direction.Up, Direction.Side]) {
      for (let frame = 0; frame < FRAMES_PER_CHAR; frame++) {
        const charCol = dir;
        const charIndex = charRow * CHARS_PER_ROW + charCol;
        const row = Math.floor(charIndex / CHARS_PER_ROW);
        const col = charIndex % CHARS_PER_ROW;
        const pixelX = (col * FRAMES_PER_CHAR + frame) * SPRITE_SIZE;
        const pixelY = row * SPRITE_SIZE;
        const key = dir * 10 + frame; // unique key per direction+frame
        this.frameCache.set(
          key,
          sheetTexture.source
            ? new Texture({ source: sheetTexture.source, frame: new Rectangle(pixelX, pixelY, SPRITE_SIZE, SPRITE_SIZE) })
            : Texture.EMPTY,
        );
      }
    }

    this.container = new Container();
    this.container.x = spawnX;
    this.container.y = spawnY;
    this.container.zIndex = 9999;

    // Shadow
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 18, 14, 5);
    this.shadow.fill({ color: 0x000000, alpha: 0.25 });
    this.container.addChild(this.shadow);

    // Character sprite
    this.sprite = new Sprite(this.getCachedFrame(Direction.Down, 0));
    this.sprite.anchor.set(0.5, 0.5);
    this.sprite.scale.set(PLAYER_SCALE);
    this.container.addChild(this.sprite);

    // Player glow ring (distinguish from agents)
    const glow = new Graphics();
    glow.circle(0, 0, 24);
    glow.fill({ color: 0x60a5fa, alpha: 0.15 });
    this.container.addChildAt(glow, 0);

    // Player indicator arrow above head
    const arrow = new Graphics();
    arrow.moveTo(-5, -32);
    arrow.lineTo(5, -32);
    arrow.lineTo(0, -38);
    arrow.closePath();
    arrow.fill({ color: 0x60a5fa, alpha: 0.8 });
    this.container.addChild(arrow);

    // Nameplate
    this.nameplate = this.createNameplate("You");
    this.container.addChild(this.nameplate);

    // Interaction prompt (hidden by default)
    this.interactionPrompt = this.createInteractionPrompt();
    this.interactionPrompt.visible = false;
    this.container.addChild(this.interactionPrompt);
  }

  private getCachedFrame(direction: Direction, frame: number): Texture {
    return this.frameCache.get(direction * 10 + frame) ?? Texture.EMPTY;
  }

  private createNameplate(name: string): Container {
    const c = new Container();
    const w = 36;
    const bg = new Graphics();
    bg.roundRect(-w / 2, 24, w, 14, 3);
    bg.fill({ color: 0x1e40af, alpha: 0.85 });
    bg.roundRect(-w / 2 + 2, 24, w - 4, 2, 1);
    bg.fill({ color: 0x60a5fa, alpha: 0.9 });
    c.addChild(bg);

    const label = new Text({
      text: name,
      style: {
        fontFamily: "monospace",
        fontSize: 8,
        fontWeight: "700",
        fill: "#FFFFFF",
      },
    });
    label.anchor.set(0.5, 0);
    label.y = 26;
    c.addChild(label);
    return c;
  }

  private createInteractionPrompt(): Container {
    const c = new Container();

    const bg = new Graphics();
    bg.roundRect(-50, -60, 100, 22, 6);
    bg.fill({ color: 0x1e293b, alpha: 0.92 });
    bg.roundRect(-50, -60, 100, 2, 6);
    bg.fill({ color: 0x60a5fa, alpha: 0.8 });
    // Speech bubble tail
    bg.moveTo(-4, -38);
    bg.lineTo(4, -38);
    bg.lineTo(0, -34);
    bg.closePath();
    bg.fill({ color: 0x1e293b, alpha: 0.92 });
    c.addChild(bg);

    // Key hint: [E]
    const keyBg = new Graphics();
    keyBg.roundRect(-46, -56, 16, 14, 2);
    keyBg.fill({ color: 0x374151 });
    keyBg.roundRect(-46, -56, 16, 14, 2);
    keyBg.stroke({ color: 0x60a5fa, width: 1 });
    c.addChild(keyBg);

    const keyText = new Text({
      text: "E",
      style: { fontFamily: "monospace", fontSize: 9, fontWeight: "900", fill: "#60A5FA" },
    });
    keyText.anchor.set(0.5, 0.5);
    keyText.x = -38;
    keyText.y = -49;
    c.addChild(keyText);

    const promptText = new Text({
      text: "Talk",
      style: { fontFamily: "monospace", fontSize: 9, fontWeight: "600", fill: "#E2E8F0" },
    });
    promptText.anchor.set(0, 0.5);
    promptText.x = -26;
    promptText.y = -49;
    c.addChild(promptText);

    return c;
  }

  /** Update interaction prompt text with agent name */
  private updatePromptText(agentName: string): void {
    const promptText = this.interactionPrompt.children[3] as Text;
    if (promptText) {
      const short = agentName.length > 8 ? agentName.slice(0, 7) + "\u2026" : agentName;
      promptText.text = short;
    }
  }

  /**
   * Main update loop — call from ticker.
   * Returns nearby agent info and whether an interaction was triggered.
   */
  update(
    keys: PlayerKeys,
    dt: number,
    rooms: RoomCollider[],
    agentPositions: { agent: Agent; x: number; y: number; container: Container }[],
  ): { nearby: NearbyAgent | null; interacted: NearbyAgent | null } {
    // --- Movement ---
    let dx = 0;
    let dy = 0;

    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    this.isMoving = dx !== 0 || dy !== 0;

    if (this.isMoving) {
      // Update direction for sprite — horizontal takes priority over vertical
      if (dx < 0) {
        this.direction = Direction.Side;
        this.facingRight = false;
      } else if (dx > 0) {
        this.direction = Direction.Side;
        this.facingRight = true;
      } else if (dy < 0) {
        this.direction = Direction.Up;
      } else if (dy > 0) {
        this.direction = Direction.Down;
      }

      const newX = this.x + dx * PLAYER_SPEED;
      const newY = this.y + dy * PLAYER_SPEED;

      // Collision check — try X and Y independently for wall sliding
      const canMoveX = !this.collidesWithRooms(newX, this.y, rooms);
      const canMoveY = !this.collidesWithRooms(this.x, newY, rooms);

      if (canMoveX) this.x = newX;
      if (canMoveY) this.y = newY;

      // Walk animation (4-step RPG cycle: neutral → step-left → neutral → step-right)
      this.walkTimer += dt;
      if (this.walkTimer >= WALK_FRAME_INTERVAL) {
        this.walkTimer = 0;
        this.frameIndex = (this.frameIndex + 1) % WALK_CYCLE.length;
      }
    } else {
      this.frameIndex = 0;
      this.walkTimer = 0;
    }

    // Update sprite texture and flip for left/right
    this.sprite.texture = this.getCachedFrame(this.direction, WALK_CYCLE[this.frameIndex]);
    this.sprite.scale.x = (this.direction === Direction.Side && !this.facingRight ? -1 : 1) * PLAYER_SCALE;

    // Update container position
    this.container.x = this.x;
    this.container.y = this.y;

    // --- Proximity detection ---
    this.nearestAgent = null;
    let minDist = INTERACTION_RADIUS;

    for (const ap of agentPositions) {
      const distX = this.x - ap.x;
      const distY = this.y - ap.y;
      const dist = Math.sqrt(distX * distX + distY * distY);
      if (dist < minDist) {
        minDist = dist;
        this.nearestAgent = { agent: ap.agent, distance: dist, container: ap.container };
      }
    }

    // Show/hide interaction prompt
    if (this.nearestAgent) {
      this.interactionPrompt.visible = true;
      this.updatePromptText(this.nearestAgent.agent.name);
    } else {
      this.interactionPrompt.visible = false;
    }

    // --- Handle interaction ---
    let interacted: NearbyAgent | null = null;
    if (keys.interact && this.nearestAgent) {
      interacted = this.nearestAgent;
      keys.interact = false; // consume the key press
    }

    return { nearby: this.nearestAgent, interacted };
  }

  /**
   * Wall-edge collision detection.
   * Instead of treating rooms as solid blocks, we only block when the player
   * crosses a wall edge. Once inside, the player can move freely.
   * The door opening at the bottom-center allows entry/exit.
   */
  private collidesWithRooms(px: number, py: number, rooms: RoomCollider[]): boolean {
    const hw = 6; // half-width of player hitbox
    const hh = 8; // half-height

    const WALL = 4; // wall thickness

    for (const room of rooms) {
      const rL = room.x;
      const rR = room.x + room.w;
      const rT = room.y;
      const rB = room.y + room.h;

      // Check if player hitbox overlaps the room's outer bounds
      const overlapX = px + hw > rL && px - hw < rR;
      const overlapY = py + hh > rT && py - hh < rB;

      if (!overlapX || !overlapY) continue;

      // Player is within the room's bounding box.
      // Check if they're inside the interior (past the walls) — if so, allow movement
      const insideInterior =
        px - hw >= rL + WALL &&
        px + hw <= rR - WALL &&
        py - hh >= rT + WALL &&
        py + hh <= rB - WALL;

      if (insideInterior) continue; // freely move inside

      // Player is in the wall zone — check if they're at the door opening
      const doorHalfW = room.doorW / 2 + 6; // slightly wider than visual door for easy entry
      const inDoorX = px > room.doorX - doorHalfW && px < room.doorX + doorHalfW;
      const inBottomWall = py + hh > rB - WALL && py - hh < rB + 2;

      if (inDoorX && inBottomWall) {
        continue; // allow passage through the door
      }

      // Block: player is overlapping a wall (not the door)
      return true;
    }

    return false;
  }

  /** Get the nearest agent info (for external UI) */
  getNearestAgent(): NearbyAgent | null {
    return this.nearestAgent;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
