import { Container, Graphics, Sprite, Text, Texture, Rectangle } from "pixi.js";
import type { Agent } from "@/types";

/**
 * Player character for Gather.town-style movement.
 * Uses pixel-character sprites: /assets/pixel-characters/char_N.png
 *
 * Each character PNG is 112x96 (7 frames × 16px, 3 rows × 32px).
 *   Frame layout: walk1(0), standing(1), walk3(2), type1(3), type2(4), read1(5), read2(6)
 *   Row layout:   down(0), up(1), right(2)  — left = flipped right
 */

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 32;
const PLAYER_SPEED = 200; // pixels per second
const PLAYER_SCALE = 3.0;
const INTERACTION_RADIUS = 70;
const WALK_FRAME_INTERVAL = 0.15; // seconds between walk frames

// Walk frames: walk1(0), standing(1), walk3(2)
// RPG walk cycle: standing → walk1 → standing → walk3
const WALK_FRAMES = [0, 1, 2]; // frame indices in sprite sheet
const WALK_CYCLE = [1, 0, 1, 2]; // standing → left-step → standing → right-step

// Direction → row in the sprite sheet
enum DirRow {
  Down = 0,
  Up = 1,
  Right = 2,
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
  doorX: number;
  doorY: number;
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
  private direction: DirRow = DirRow.Down;
  private facingRight: boolean = true;
  private frameIndex: number = 0;
  private walkTimer: number = 0;
  private isMoving: boolean = false;
  private nearestAgent: NearbyAgent | null = null;
  private frameCache: Map<number, Texture> = new Map();
  private _lastTextureKey: number = -1;
  private _lastScaleX: number = 0;

  constructor(
    spawnX: number,
    spawnY: number,
    charTexture: Texture, // one of the 6 char_N.png textures
    _charRow: number = 0, // unused, kept for API compat
    displayName: string = "Guest",
  ) {
    this.x = spawnX;
    this.y = spawnY;

    // Pre-cache all direction+frame textures
    // 3 directions × 3 walk frames = 9 textures
    for (const dir of [DirRow.Down, DirRow.Up, DirRow.Right]) {
      for (const frame of WALK_FRAMES) {
        const x = frame * SPRITE_WIDTH;
        const y = dir * SPRITE_HEIGHT;
        const key = dir * 10 + frame;
        this.frameCache.set(
          key,
          charTexture.source
            ? new Texture({ source: charTexture.source, frame: new Rectangle(x, y, SPRITE_WIDTH, SPRITE_HEIGHT) })
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
    this.shadow.ellipse(0, 22, 16, 6);
    this.shadow.fill({ color: 0x000000, alpha: 0.25 });
    this.container.addChild(this.shadow);

    // Character sprite
    this.sprite = new Sprite(this.getCachedFrame(DirRow.Down, 1)); // standing frame
    this.sprite.anchor.set(0.5, 0.5);
    this.sprite.scale.set(PLAYER_SCALE);
    this.container.addChild(this.sprite);

    // Player glow ring
    const glow = new Graphics();
    glow.circle(0, 0, 28);
    glow.fill({ color: 0x60a5fa, alpha: 0.15 });
    this.container.addChildAt(glow, 0);

    // Player indicator arrow above head
    const arrow = new Graphics();
    arrow.moveTo(-5, -52);
    arrow.lineTo(5, -52);
    arrow.lineTo(0, -58);
    arrow.closePath();
    arrow.fill({ color: 0x60a5fa, alpha: 0.8 });
    this.container.addChild(arrow);

    // Nameplate
    this.nameplate = this.createNameplate(displayName);
    this.container.addChild(this.nameplate);

    // Interaction prompt (hidden by default)
    this.interactionPrompt = this.createInteractionPrompt();
    this.interactionPrompt.visible = false;
    this.container.addChild(this.interactionPrompt);
  }

  private getCachedFrame(direction: DirRow, frame: number): Texture {
    return this.frameCache.get(direction * 10 + frame) ?? Texture.EMPTY;
  }

  private createNameplate(name: string): Container {
    const c = new Container();
    const shortName = name.length > 10 ? name.slice(0, 9) + "\u2026" : name;
    const w = Math.max(shortName.length * 6.5 + 14, 48);
    const bg = new Graphics();
    bg.roundRect(-w / 2, 30, w, 14, 3);
    bg.fill({ color: 0x1e40af, alpha: 0.85 });
    bg.roundRect(-w / 2 + 2, 30, w - 4, 2, 1);
    bg.fill({ color: 0x60a5fa, alpha: 0.9 });
    c.addChild(bg);

    const label = new Text({
      text: shortName,
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 6,
        fontWeight: "400",
        fill: "#FFFFFF",
      },
    });
    label.anchor.set(0.5, 0);
    label.y = 32;
    c.addChild(label);
    return c;
  }

  private createInteractionPrompt(): Container {
    const c = new Container();

    const bg = new Graphics();
    bg.roundRect(-50, -72, 100, 22, 6);
    bg.fill({ color: 0x1e293b, alpha: 0.92 });
    bg.roundRect(-50, -72, 100, 2, 6);
    bg.fill({ color: 0x60a5fa, alpha: 0.8 });
    // Speech bubble tail
    bg.moveTo(-4, -50);
    bg.lineTo(4, -50);
    bg.lineTo(0, -46);
    bg.closePath();
    bg.fill({ color: 0x1e293b, alpha: 0.92 });
    c.addChild(bg);

    // Key hint: [E]
    const keyBg = new Graphics();
    keyBg.roundRect(-46, -68, 16, 14, 2);
    keyBg.fill({ color: 0x374151 });
    keyBg.roundRect(-46, -68, 16, 14, 2);
    keyBg.stroke({ color: 0x60a5fa, width: 1 });
    c.addChild(keyBg);

    const keyText = new Text({
      text: "E",
      style: { fontFamily: '"Press Start 2P", monospace', fontSize: 7, fontWeight: "400", fill: "#60A5FA" },
    });
    keyText.anchor.set(0.5, 0.5);
    keyText.x = -38;
    keyText.y = -61;
    c.addChild(keyText);

    const promptText = new Text({
      text: "Talk",
      style: { fontFamily: '"Press Start 2P", monospace', fontSize: 7, fontWeight: "400", fill: "#E2E8F0" },
    });
    promptText.anchor.set(0, 0.5);
    promptText.x = -26;
    promptText.y = -61;
    c.addChild(promptText);

    return c;
  }

  private updatePromptText(agentName: string): void {
    const promptText = this.interactionPrompt.children[3] as Text;
    if (promptText) {
      const short = agentName.length > 8 ? agentName.slice(0, 7) + "\u2026" : agentName;
      promptText.text = short;
    }
  }

  update(
    keys: PlayerKeys,
    dt: number,
    rooms: RoomCollider[],
    agentPositions: { agent: Agent; x: number; y: number; container: Container }[],
  ): { nearby: NearbyAgent | null; interacted: NearbyAgent | null } {
    let dx = 0;
    let dy = 0;

    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    this.isMoving = dx !== 0 || dy !== 0;

    if (this.isMoving) {
      if (dx < 0) {
        this.direction = DirRow.Right; // use right row, flip for left
        this.facingRight = false;
      } else if (dx > 0) {
        this.direction = DirRow.Right;
        this.facingRight = true;
      } else if (dy < 0) {
        this.direction = DirRow.Up;
      } else if (dy > 0) {
        this.direction = DirRow.Down;
      }

      const newX = this.x + dx * PLAYER_SPEED * dt;
      const newY = this.y + dy * PLAYER_SPEED * dt;

      const canMoveX = !this.collidesWithRooms(newX, this.y, rooms);
      const canMoveY = !this.collidesWithRooms(this.x, newY, rooms);

      if (canMoveX) this.x = newX;
      if (canMoveY) this.y = newY;

      this.walkTimer += dt;
      if (this.walkTimer >= WALK_FRAME_INTERVAL) {
        this.walkTimer = 0;
        this.frameIndex = (this.frameIndex + 1) % WALK_CYCLE.length;
      }
    } else {
      this.frameIndex = 0;
      this.walkTimer = 0;
    }

    // Walk cycle uses all 3 frames for all directions
    const walkFrame = WALK_CYCLE[this.frameIndex];
    const textureKey = this.direction * 10 + walkFrame;
    if (this._lastTextureKey !== textureKey) {
      this._lastTextureKey = textureKey;
      this.sprite.texture = this.getCachedFrame(this.direction, walkFrame);
    }

    // Flip sprite for left movement
    const scaleX = (this.direction === DirRow.Right && !this.facingRight ? -1 : 1) * PLAYER_SCALE;
    if (this._lastScaleX !== scaleX) {
      this._lastScaleX = scaleX;
      this.sprite.scale.x = scaleX;
    }

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

    if (this.nearestAgent) {
      this.interactionPrompt.visible = true;
      this.updatePromptText(this.nearestAgent.agent.name);
    } else {
      this.interactionPrompt.visible = false;
    }

    let interacted: NearbyAgent | null = null;
    if (keys.interact && this.nearestAgent) {
      interacted = this.nearestAgent;
      keys.interact = false;
    }

    return { nearby: this.nearestAgent, interacted };
  }

  private collidesWithRooms(px: number, py: number, rooms: RoomCollider[]): boolean {
    const hw = 6;
    const hh = 8;
    const WALL = 4;

    for (const room of rooms) {
      const rL = room.x;
      const rR = room.x + room.w;
      const rT = room.y;
      const rB = room.y + room.h;

      const overlapX = px + hw > rL && px - hw < rR;
      const overlapY = py + hh > rT && py - hh < rB;

      if (!overlapX || !overlapY) continue;

      const insideInterior =
        px - hw >= rL + WALL &&
        px + hw <= rR - WALL &&
        py - hh >= rT + WALL &&
        py + hh <= rB - WALL;

      if (insideInterior) continue;

      const doorHalfW = room.doorW / 2 + 6;
      const inDoorX = px > room.doorX - doorHalfW && px < room.doorX + doorHalfW;
      const inBottomWall = py + hh > rB - WALL && py - hh < rB + 2;

      if (inDoorX && inBottomWall) continue;

      return true;
    }

    return false;
  }

  getNearestAgent(): NearbyAgent | null {
    return this.nearestAgent;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
