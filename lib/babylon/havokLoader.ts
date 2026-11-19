// Babylon.js & Havok Physics WebAssembly Loader
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";

let havokPluginPromise: Promise<HavokPlugin> | null = null;

export async function getHavokPlugin(): Promise<HavokPlugin> {
  if (typeof window === "undefined") {
    throw new Error("Havok physics can only be initialized on the client");
  }

  if (!havokPluginPromise) {
    havokPluginPromise = (async () => {
      try {
        const havokInstance = await HavokPhysics({
          locateFile: () => "/HavokPhysics.wasm"
        });
        return new HavokPlugin(true, havokInstance);
      } catch (err) {
        console.warn("Failed to load local /HavokPhysics.wasm, attempting default loader:", err);
        const fallbackInstance = await HavokPhysics();
        return new HavokPlugin(true, fallbackInstance);
      }
    })();
  }

  return havokPluginPromise;
}
