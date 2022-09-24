declare module "net-ping" {
  class PingError {
    name: Readonly<string>;
    source: string;
    toString: () => string;
  }
  export class DestinationUnreachableError extends PingError {
    name: "DestinationUnreachableError";
  }
  export class PacketTooBigError extends PingError {
    name: "PacketTooBigError";
  }
  export class ParameterProblemError extends PingError {
    name: "ParameterProblemError";
  }
  export class RedirectReceivedError extends PingError {
    name: "RedirectReceivedError";
  }
  export class SourceQuenchError extends PingError {
    name: "SourceQuenchError";
  }
  export class TimeExceededError extends PingError {
    name: "TimeExceededError";
  }
  export class PingSession {
    pingHost(
      target: string,
      doneCallback: (
        error: PingError,
        target: string,
        sent: Date,
        rcvd: Date
      ) => void
    ): void;
    on(ev: "close", listener: () => void): void;
    on(ev: "error", listener: (error: Error) => void): void;
    close(): void;
    getSocket(): unknown;
    traceRoute(
      target: string,
      ttlOrOptions:
        | number
        | {
            ttl: number;
            maxHopTimeouts: number;
            startTtl: number;
          },
      feedCallback: (
        error: PingError,
        target: string,
        ttl: number,
        sent: Date,
        rcvd: Date
      ) => void,
      doneCallback: (error: PingError, target: string) => void
    ): void;
  }

  export function createSession(options?: {
    retries?: number;
    timeout?: number;
    packetSize?: number;
    natworkProtocol?: NetworkProtocol;
  }): PingSession;

  export const enum NetworkProtocol {
    IPv4,
    IPv6
  }
}
