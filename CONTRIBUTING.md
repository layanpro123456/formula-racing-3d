# Contributing to Formula Racing 3D

Thank you for your interest in contributing to **Formula Racing 3D**! We welcome improvements to graphics, physics, track modeling, audio, and UI.

---

## 1. Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **Package Manager**: `npm` (included with Node.js)
- **Browser**: Modern Chromium (Chrome, Edge) or Firefox with hardware WebGL 2.0 acceleration enabled

### Installation
```bash
git clone <repo-url>
cd formula-racing-nextjs
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Development Guidelines

### Code Quality & TypeScript
- All code must be strictly typed in TypeScript (`strict: true`).
- No implicit or explicit `any` types unless interfacing with low-level untyped WebGL extensions.
- Run `npm run build` and `npm run lint` before committing to ensure there are no compilation or lint errors.

### Babylon.js Best Practices
- **Never allocate new objects inside the render loop**:
  ```ts
  // Bad: Triggers garbage collection pauses every few seconds
  engine.runRenderLoop(() => {
    const forward = new Vector3(0, 0, 1);
  });

  // Good: Reuse pre-allocated scratch vector
  const forward = new Vector3(0, 0, 1);
  engine.runRenderLoop(() => {
    forward.set(0, 0, 1);
  });
  ```
- Keep procedural ribbons and meshes cached rather than rebuilding on every frame.
- Keep high-frequency state updates inside mutable handles rather than triggering React re-renders every 16ms.

### Intellectual Property & Asset Licensing
- Do not commit copyrighted Formula 1 (F1), FIA, or team logos, commercial liveries, or proprietary track survey data.
- 3D models and sound files must be either custom-created or distributed under open-source licenses (CC0, MIT, or CC-BY with appropriate attribution).

---

## 3. Pull Request Process

1. Create a feature branch: `git checkout -b feature/checkpoint-system`
2. Implement your changes following [AGENTS.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/AGENTS.md) and [SKILL.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/skills/racing-sim-gameplay/SKILL.md).
3. Test in the browser across multiple tracks.
4. Verify build: `npm run build`
