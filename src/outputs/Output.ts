import ping from "net-ping";
import fetch from "node-fetch";
import { promisify } from "util";
import { Int, TypedInteger, Uint } from "@errorgamer2000/typed-integers";

const fromKeys = <T extends readonly string[]>(keys: T) =>
  Object.fromEntries(keys.map((k) => [k, k])) as {
    [key in T[number]]: key;
  };

function validateIPAddrFormat(ip: string): ip is Output.IPV4Address {
  return /(?:[0-9]+\.){3}[0-9]/.test(ip);
}

export abstract class Output {
  dirty: boolean = false;
  private _commPort: string = "";
  private _channels: Int.Int32 = new Int.Int32(0);
  private _baudRate: number = 0;
  private _universe: number = 0;
  private _enabled: boolean = true;
  private suspend: boolean = false;
  private nullNumber: number = -1; // cached ordinal of null controllers ... may change when reordered or other output are changed
  protected startChannel: Int.Int32 = new Int.Int32(-1); // cached start channel of this output ... may change when reordered or other output are changed
  private timerMs: number = 0;
  protected ok: boolean = false;
  private tempDisable: boolean = false;
  private _suppressDuplicateFrames: boolean = false;
  private lastOutputTime: bigint = 0n;
  private skippedFrames: number = 9999;
  private changed: boolean = false;
  fppProxyIP: string = "";
  forceLocalIP: string = "";
  private fppProxyOutput: Output | null = null;
  private autoSizeConvert: boolean = false;
  private _ip: Output.IPV4Address;
  private _resolvedIP: Output.IPV4Address;
  constructor(arg: string | Output.ConfigObj | Output) {
    if (typeof arg === "string") {
      if (!validateIPAddrFormat(arg)) throw new TypeError("Invalid IP Address");
      this._ip = this._resolvedIP = arg;
      this.dirty = true;
    } else if (arg instanceof Output) {
      this.ok = arg.ok;
      this.channels = arg.channels.value;
      this.startChannel = new Int.Int32(arg.startChannel.value);
      this.suppressDuplicateFrames = arg.suppressDuplicateFrames;
      this.forceLocalIP = arg.forceLocalIP;
      this.fppProxyIP = arg.fppProxyIP;
      this.enabled = arg.enabled;
      this._ip = this._resolvedIP = arg.ip;

      this.dirty = arg.dirty;
    } else {
      this.ok = true;
      this.fppProxyIP = arg.fppProxy;
      this.enabled = arg.enabled;
      this.suppressDuplicateFrames = arg.suppressDuplicateFrames;
      this.channels = arg.maxChannels;
      if (!validateIPAddrFormat(arg.ip))
        throw new TypeError("Invalid IP Adress");
      this._ip = this._resolvedIP = arg.ip;

      this.dirty = false;
    }
  }

  protected abstract maxChannels: number;

  get commPort() {
    return this._commPort;
  }
  set commPort(commPort: string) {
    this._commPort = commPort;
    this.dirty = true;
  }

  get baudRate() {
    return this._baudRate;
  }
  set baudRate(baudRate: number) {
    this._baudRate = baudRate;
    this.dirty = true;
  }

  get ip(): Output.IPV4Address {
    return this._ip;
  }
  set ip(ip: string) {
    if (!validateIPAddrFormat(ip)) throw new TypeError("Invalid IP Address");
    this._ip = this._resolvedIP = ip;
  }

  get resolvedIP() {
    return this._ip;
  }
  set resolvedIP(resolvedIP: string) {
    if (!validateIPAddrFormat(resolvedIP))
      throw new TypeError("Invalid IP Address");
    this._resolvedIP = resolvedIP;
    this.dirty = true;
  }

  get universe() {
    return this._universe;
  }
  set universe(universe: number) {
    this._universe = universe;
    this.dirty = true;
  }

  get forcesLocalIP() {
    return this.forceLocalIP !== "" && validateIPAddrFormat(this.forceLocalIP);
  }

  get channels(): Int.Int32 {
    return this._channels;
  }
  set channels(channels: TypedInteger | number) {
    if (channels instanceof TypedInteger) {
      this._channels.value = channels.value;
    } else {
      this._channels.value = channels;
    }
    this.dirty = true;
  }

  get endChannel() {
    return new Int.Int32(this.startChannel.value + this.channels.value);
  }

  temporarilyDisable(disable: boolean) {
    this.tempDisable = disable;
  }

  temporarilyDisabled() {
    return this.tempDisable;
  }

  get enabled() {
    return this._enabled;
  }
  set enabled(enabled: boolean) {
    this._enabled = enabled;
    this.dirty = true;
  }

  get suspended() {
    return this.suspend;
  }
  set suspended(suspended: boolean) {
    this.suspend = suspended;
  }

  get timer() {
    return this.timerMs;
  }

  abstract get isIP(): boolean;
  abstract get isSerial(): boolean;

  get outputtable() {
    return true;
  }

  abstract get type(): string;

  get suppressDuplicateFrames() {
    return this._suppressDuplicateFrames;
  }
  set suppressDuplicateFrames(suppressDuplicateFrames) {
    this._suppressDuplicateFrames = suppressDuplicateFrames;
    this.dirty = true;
  }

  abstract setTransientData(startChannel: Int.Int32, nullNumber: number): void;

  abstract open(): void;
  abstract close(): void;

  abstract startFrame(msec: bigint): void;
  abstract endFrame(suppressFrames: number): void;
  abstract resetFrame(): void;
  frameOutput() {
    this.lastOutputTime = BigInt(Date.now());
    this.skippedFrames = 0;
    this.changed = false;
  }
  needToOutput(suppressFrames: number) {
    return this.suppressDuplicateFrames || this.skippedFrames > suppressFrames;
  }

  abstract setOneChannel(channel: Int.Int32, data: Uint.Uint8): void;
  abstract setManyChannels(channelStart: Int.Int32, data: Uint.Uint8[]): void;
  abstract allOff(): void;

  abstract sendHeartbeat(): void;
}

export namespace Output {
  export interface ConfigObj {
    maxChannels: number;
    fppProxy: string;
    enabled: boolean;
    suppressDuplicateFrames: boolean;
    ip: string;
  }
  export const OutputTypes = fromKeys(["ArtNet"] as const);

  export type IPV4Address = `${number}.${number}.${number}.${number}`;
  export const PingState = fromKeys([
    "OK",
    "WEBOK",
    "OPEN",
    "OPENED",
    "ALLFAILED",
    "UNAVAILABLE",
    "UNKNOWN"
  ] as const);
  export type PingState = keyof typeof PingState;

  export abstract class IPOutput {
    abstract toJson(): any | Promise<any>;
    abstract fromJson(data: any): void | Promise<void>;

    static async ping(
      ip: IPV4Address,
      proxy: string = ""
    ): Promise<PingState | Error> {
      if (!validateIPAddrFormat(ip)) return new Error("InvalidIPAdress");
      const pingSession = ping.createSession();
      const pingHost = promisify(pingSession.pingHost);

      if (proxy === "") {
        try {
          await pingHost(ip);
          return PingState.OK;
        } catch {
          return PingState.ALLFAILED;
        }
      } else {
        let url = "http://";
        if (proxy != "") {
          url += proxy + "/proxy/";
        }
        url += ip + "/";

        const res = await fetch(url, {
          method: "GET"
        });

        if (res.ok) return PingState.WEBOK;
        return PingState.ALLFAILED;
      }
    }
  }

  export class Error {
    constructor(public code: string, public message: string = "\b") {}
    toFormattedString(): string {
      return `Output Error: ${this.code}. ${this.message.replace(
        /.?\x08/g,
        ""
      )}`;
    }
  }
}
