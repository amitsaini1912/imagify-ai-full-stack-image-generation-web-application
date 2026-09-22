// Mutable flag shared between server.js (sets it while handling SIGTERM/SIGINT) and the
// /readyz route (reads it). A plain object, not a boolean export, because ES module
// bindings for primitives are read-only from the importing side — an object's property
// can be mutated from one file and seen by another.
export const shutdownState = { isShuttingDown: false }
