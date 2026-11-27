import { createChainGame } from "./chain-game.ts";

// Every list owns its progress, independently of how its signs are recognized.
// New libraries need only a stable ID and a sequence length.
export function createLibraryGames({ resetOnSwitch = true, initialLibrary = "number" } = {}) {
  const games = new Map<string, ReturnType<typeof createChainGame>>();
  let activeLibrary = initialLibrary;
  return {
    activate(libraryId: string) {
      const changed = libraryId !== activeLibrary;
      if (changed && resetOnSwitch) games.forEach(game => game.reset());
      activeLibrary = libraryId;
      return changed;
    },
    get(libraryId: string, itemCount: number) {
      if (!games.has(libraryId)) {
        games.set(libraryId, createChainGame({ lastNumber: Math.max(1, itemCount), mode: "block" }));
      }
      return games.get(libraryId)!;
    }
  };
}
