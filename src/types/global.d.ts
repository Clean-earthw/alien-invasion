declare global {
  interface Window {
    __IWSDK_WORLD__: any;
  }
  
  // XR Input Manager types
  interface XRInputManager {
    update(xrManager: any, delta: number, time: number): void;
    gamepads: {
      left: XRGamepad | undefined;
      right: XRGamepad | undefined;
    };
  }
  
  interface XRGamepad {
    getAxis(name: string): number;
    getButton(name: string): { pressed: boolean; down: boolean } | undefined;
    getSelectStart(): boolean;
    getSelectEnd(): boolean;
    getButtonDown(name: string): boolean;
    getButtonUp(name: string): boolean;
  }
}

export {};