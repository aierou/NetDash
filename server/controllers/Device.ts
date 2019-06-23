abstract class Device{
  protected config: DeviceConfig;
  public constructor(config: DeviceConfig) {
    this.config = config;
  }
  abstract logIn(): Promise<void>;
}
export default Device;