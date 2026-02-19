"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useAppStore } from "@/stores/app-store";
import { createDepartmentRoom } from "./DepartmentRoom";
import { createAgentAvatar } from "./AgentAvatar";
import MapControls from "./MapControls";

// Shared viewport ref for programmatic access
let sharedViewport: Viewport | null = null;
export function getViewport(): Viewport | null {
  return sharedViewport;
}

// World dimensions
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 600;
const TILE_SIZE = 32;

// Game-style ground color palette
const GRASS_COLORS = [0x4a7a3d, 0x528a45, 0x3d6b33];
const PATH_COLOR = 0xc4a882;
const PATH_EDGE = 0xb09870;
const TREE_TRUNK = 0x6b4226;
const TREE_LEAVES = 0x2d5a1e;
const TREE_LEAVES_LIGHT = 0x3d7a2e;
const BUSH_COLOR = 0x3a6e2a;
const BUSH_HIGHLIGHT = 0x4a8e3a;
const FLOWER_COLORS = [0xe85d75, 0xf0c040, 0xd0d0ff, 0xff9944];
const STONE_COLOR = 0x8a8a8a;
const STONE_SHADOW = 0x6a6a6a;

/** Simple seeded pseudo-random for deterministic placement */
function seededRand(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Draw a pixel-art tree at position */
function drawTree(g: Graphics, x: number, y: number) {
  // Trunk (4x8)
  g.rect(x + 8, y + 16, 4, 8);
  g.fill(TREE_TRUNK);
  // Canopy - triangle as stacked rects for pixel look
  g.rect(x + 4, y + 12, 12, 4);
  g.fill(TREE_LEAVES);
  g.rect(x + 2, y + 8, 16, 4);
  g.fill(TREE_LEAVES);
  g.rect(x + 4, y + 4, 12, 4);
  g.fill(TREE_LEAVES);
  g.rect(x + 6, y, 8, 4);
  g.fill(TREE_LEAVES_LIGHT);
  // Highlight
  g.rect(x + 6, y + 8, 4, 4);
  g.fill(TREE_LEAVES_LIGHT);
}

/** Draw a pixel-art bush at position */
function drawBush(g: Graphics, x: number, y: number) {
  g.rect(x, y + 4, 14, 8);
  g.fill(BUSH_COLOR);
  g.rect(x + 2, y, 10, 4);
  g.fill(BUSH_COLOR);
  // Highlight
  g.rect(x + 4, y + 2, 4, 4);
  g.fill(BUSH_HIGHLIGHT);
}

/** Draw a tiny flower at position */
function drawFlower(g: Graphics, x: number, y: number, color: number) {
  // Stem
  g.rect(x + 1, y + 3, 2, 4);
  g.fill(0x3d6b33);
  // Petals (cross pattern)
  g.rect(x, y + 1, 4, 2);
  g.fill(color);
  g.rect(x + 1, y, 2, 4);
  g.fill(color);
  // Center
  g.rect(x + 1, y + 1, 2, 2);
  g.fill(0xffee88);
}

/** Draw a small stone at position */
function drawStone(g: Graphics, x: number, y: number) {
  g.rect(x, y + 1, 6, 3);
  g.fill(STONE_COLOR);
  g.rect(x + 1, y, 4, 1);
  g.fill(STONE_COLOR);
  g.rect(x + 1, y + 4, 4, 1);
  g.fill(STONE_SHADOW);
  // Highlight
  g.rect(x + 1, y + 1, 2, 1);
  g.fill(0xa0a0a0);
}

/** Draw a 16px wide dirt path segment */
function drawPathH(g: Graphics, x: number, y: number, w: number) {
  g.rect(x, y, w, 16);
  g.fill(PATH_COLOR);
  g.rect(x, y, w, 2);
  g.fill(PATH_EDGE);
  g.rect(x, y + 14, w, 2);
  g.fill(PATH_EDGE);
}

function drawPathV(g: Graphics, x: number, y: number, h: number) {
  g.rect(x, y, 16, h);
  g.fill(PATH_COLOR);
  g.rect(x, y, 2, h);
  g.fill(PATH_EDGE);
  g.rect(x + 14, y, 2, h);
  g.fill(PATH_EDGE);
}

/** Draw a tiled grass ground layer with paths, trees, and decorations */
function createGroundLayer(): Container {
  const ground = new Container();
  ground.label = "ground-layer";

  // Tile grid pattern with 3-shade grass variation
  const tiles = new Graphics();
  const pad = TILE_SIZE * 4;
  const cols = Math.ceil((WORLD_WIDTH + pad * 2) / TILE_SIZE);
  const rows = Math.ceil((WORLD_HEIGHT + pad * 2) / TILE_SIZE);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = col * TILE_SIZE - pad;
      const ty = row * TILE_SIZE - pad;
      // Use seeded random for natural 3-shade variation
      const shade = seededRand(col, row);
      const colorIdx = shade < 0.4 ? 0 : shade < 0.75 ? 1 : 2;
      tiles.rect(tx, ty, TILE_SIZE, TILE_SIZE);
      tiles.fill(GRASS_COLORS[colorIdx]);
    }
  }
  ground.addChild(tiles);

  // Dirt paths connecting department rooms
  // Room positions from mock data:
  // Top row: (50,50,300,240), (400,50,270,220), (720,50,300,240)
  // Bottom row: (50,340,240,200), (340,340,270,200)
  const paths = new Graphics();

  // Horizontal paths between top row rooms (at ~y:160, mid-height of rooms)
  drawPathH(paths, 350, 160, 50);   // Room1 -> Room2
  drawPathH(paths, 670, 160, 50);   // Room2 -> Room3

  // Vertical paths from top row to bottom row
  drawPathV(paths, 192, 290, 50);   // Room1 down to Room4
  drawPathV(paths, 490, 270, 70);   // Room2 down to Room5

  // Horizontal path between bottom row rooms
  drawPathH(paths, 290, 430, 50);   // Room4 -> Room5

  ground.addChild(paths);

  // Ambient decorations: trees in empty spaces between/around rooms
  const decorations = new Graphics();

  // Trees placed deterministically in gaps between rooms
  const treePositions = [
    // Between top-right area and edge
    { x: 1050, y: 60 }, { x: 1080, y: 140 }, { x: 1060, y: 230 },
    // Right side open area
    { x: 1040, y: 360 }, { x: 1080, y: 420 }, { x: 1050, y: 500 },
    // Bottom open area
    { x: 650, y: 360 }, { x: 700, y: 420 }, { x: 750, y: 500 },
    { x: 820, y: 380 }, { x: 900, y: 450 }, { x: 950, y: 360 },
    // Left edge
    { x: 10, y: 300 }, { x: -20, y: 560 },
    // Bottom edge
    { x: 150, y: 560 }, { x: 450, y: 560 }, { x: 630, y: 560 },
    // Top edge gaps
    { x: 365, y: 10 }, { x: 685, y: 10 },
  ];
  for (const t of treePositions) {
    drawTree(decorations, t.x, t.y);
  }

  // Bushes scattered around
  const bushPositions = [
    { x: 1070, y: 310 }, { x: 30, y: 295 }, { x: 620, y: 305 },
    { x: 330, y: 300 }, { x: 700, y: 295 }, { x: 850, y: 520 },
    { x: 200, y: 555 }, { x: 500, y: 555 }, { x: 980, y: 530 },
    { x: 1090, y: 180 }, { x: 10, y: 550 },
  ];
  for (const b of bushPositions) {
    drawBush(decorations, b.x, b.y);
  }

  // Tiny flowers scattered across grass areas (deterministic by position)
  const flowerPositions = [
    { x: 20, y: 30 }, { x: 380, y: 28 }, { x: 695, y: 30 },
    { x: 1060, y: 50 }, { x: 1090, y: 270 }, { x: 640, y: 320 },
    { x: 330, y: 310 }, { x: 80, y: 310 }, { x: 750, y: 540 },
    { x: 900, y: 500 }, { x: 160, y: 550 }, { x: 420, y: 555 },
    { x: 1050, y: 480 }, { x: 970, y: 400 }, { x: 820, y: 310 },
  ];
  for (let i = 0; i < flowerPositions.length; i++) {
    const f = flowerPositions[i];
    drawFlower(decorations, f.x, f.y, FLOWER_COLORS[i % FLOWER_COLORS.length]);
  }

  // Small stones
  const stonePositions = [
    { x: 360, y: 300 }, { x: 680, y: 300 }, { x: 1080, y: 350 },
    { x: 30, y: 540 }, { x: 500, y: 540 }, { x: 800, y: 550 },
    { x: 950, y: 250 }, { x: 1040, y: 500 },
  ];
  for (const s of stonePositions) {
    drawStone(decorations, s.x, s.y);
  }

  ground.addChild(decorations);

  return ground;
}

export default function SpatialCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const organization = useAppStore((s) => s.organization);

  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;

    let destroyed = false;
    const app = new Application();
    appRef.current = app;

    (async () => {
      await app.init({
        background: "#3D6B33",
        width: div.clientWidth,
        height: div.clientHeight,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      div.appendChild(app.canvas as HTMLCanvasElement);

      // Create viewport
      const viewport = new Viewport({
        screenWidth: div.clientWidth,
        screenHeight: div.clientHeight,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        events: app.renderer.events,
      });

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({ minScale: 0.3, maxScale: 3 });

      app.stage.addChild(viewport as unknown as Container);
      viewportRef.current = viewport;
      sharedViewport = viewport;

      // Draw ground layer BEFORE rooms and avatars
      const groundLayer = createGroundLayer();
      viewport.addChild(groundLayer);

      // Render departments and agents
      const avatarContainers: (Container & { _baseY: number; _agentStatus: string })[] = [];

      for (const dept of organization.departments) {
        const roomContainer = createDepartmentRoom(dept, (d) => {
          // Double-click: zoom to room
          const { x, y, width, height } = d.layout;
          viewport.animate({
            position: { x: x + width / 2, y: y + height / 2 },
            scale: 1.8,
            time: 400,
            ease: "easeInOutSine",
          });
        });
        viewport.addChild(roomContainer);

        for (const agent of dept.agents) {
          const avatar = createAgentAvatar(agent);
          viewport.addChild(avatar);
          avatarContainers.push(avatar as Container & { _baseY: number; _agentStatus: string });
        }
      }

      // Fit all rooms in view initially
      viewport.fit(true, WORLD_WIDTH, WORLD_HEIGHT);
      viewport.moveCenter(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

      // Animate active agents (walk cycle + floating) and error agents (pulsing)
      let elapsed = 0;
      let walkTimer = 0;
      const WALK_SPEED = 0.2; // seconds per frame
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60; // seconds
        elapsed += dt;
        walkTimer += dt;

        const shouldAdvanceFrame = walkTimer >= WALK_SPEED;
        if (shouldAdvanceFrame) walkTimer -= WALK_SPEED;

        for (const avatar of avatarContainers) {
          const ext = avatar as Container & {
            _walkFrames?: Texture[];
            _charSprite?: Sprite;
            _walkFrame?: number;
          };
          if (avatar._agentStatus === "active") {
            // Floating bob
            avatar.y = avatar._baseY + Math.sin(elapsed * 2.5 + avatar._baseY) * 3;
            // Walk frame cycling
            if (shouldAdvanceFrame && ext._walkFrames && ext._charSprite) {
              ext._walkFrame = ((ext._walkFrame ?? 0) + 1) % ext._walkFrames.length;
              ext._charSprite.texture = ext._walkFrames[ext._walkFrame];
            }
          } else if (avatar._agentStatus === "error") {
            // Pulse the error indicator
            const pulse = 0.85 + Math.sin(elapsed * 5) * 0.15;
            avatar.scale.set(pulse);
          }
        }
      });

      // Handle resize
      const onResize = () => {
        if (destroyed) return;
        app.renderer.resize(div.clientWidth, div.clientHeight);
        viewport.resize(div.clientWidth, div.clientHeight);
      };
      window.addEventListener("resize", onResize);

      // Store cleanup reference
      (app as Application & { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener("resize", onResize);
      };
    })();

    return () => {
      destroyed = true;
      sharedViewport = null;
      const currentApp = appRef.current;
      if (currentApp) {
        const cleanup = (currentApp as Application & { _cleanup?: () => void })._cleanup;
        if (cleanup) cleanup();
        try {
          // Remove canvas from DOM if it exists
          const canvas = currentApp.canvas as HTMLCanvasElement | undefined;
          if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
          currentApp.destroy(true, { children: true });
        } catch {
          // Pixi may throw if init hasn't completed yet - safe to ignore
        }
      }
      appRef.current = null;
      viewportRef.current = null;
    };
  }, [organization]);

  const handleZoomIn = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) vp.zoom(-100, true);
  }, []);

  const handleZoomOut = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) vp.zoom(100, true);
  }, []);

  const handleFitAll = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) {
      vp.fit(true, WORLD_WIDTH, WORLD_HEIGHT);
      vp.moveCenter(WORLD_WIDTH / 2 - 100, WORLD_HEIGHT / 2 - 20);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitAll={handleFitAll}
      />
    </div>
  );
}
