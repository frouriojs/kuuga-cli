declare module 'opentimestamps' {
  namespace Ops {
    class OpSHA256 {}
  }

  class DetachedTimestampFile {
    static fromBytes(op: Ops.OpSHA256, data: Buffer): DetachedTimestampFile;
    serializeToBytes(): Uint8Array;
  }

  function stamp(detached: DetachedTimestampFile): Promise<void>;
}
