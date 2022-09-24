import DataGram from "node:dgram";
import Output from "../Output";

class ArtNet {
  private _data: Uint8Array = new Uint8Array([0]);
  private _sequenceNum: number = 0;
  private _remoteAddr: `${number}.${number}.${number}.${number}`;
  private _datagram: DataGram.Socket;
  private _forceSourcePort: boolean = false;

  // Used for artnet sync
  static __ip1: number;
  static __ip2: number;
  static __ip3: number;
  static __initialized: boolean;

  getArtNetNet(u: number) {
    return (u & 0x7f00) >> 8;
  }
  getArtNetSubnet(u: number) {
    return (u & 0x00f0) >> 4;
  }
  getArtNetUniverse(u: number) {
    return u & 0x000f;
  }
  getArtNetCombinedUniverse(net: number, subnet: number, universe: number) {
    return (
      ((net & 0x007f) << 8) + ((subnet & 0x000f) << 4) + (universe & 0x000f)
    );
  }

  get outputType() {
    return Output.OutputTypes.ArtNet;
  }
}

namespace ArtNet {
  export const ARTNET_PACKET_HEADERLEN = 18;
  export const ARTNET_PACKET_LEN = ARTNET_PACKET_HEADERLEN + 512;
  export const ARTNET_PORT = 0x1936;
  export const ARTNET_MAXCHANNEL = 32768;
  export const ARTNET_SYNCPACKET_LEN = 14;
}

export default ArtNet;
