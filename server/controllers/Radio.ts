import request from 'request';
import Device from './Device';

class Radio extends Device {
  private cookies: request.CookieJar;

  private status: any;

  public constructor(config: DeviceConfig) {
    super(config);
    this.cookies = request.jar();
    setInterval((): void => this.getWirelessStatus(), 1000);
  }

  public logIn(): Promise<void> {
    return new Promise((resolve): void => {
      const formData = {
        username: this.config.username,
        password: this.config.password,
      };
      request.get(
        { url: this.config.url, followAllRedirects: true, jar: this.cookies },
        (err): void => {
          if (err) {
            console.error(err);
            return;
          }
          request.post({
            url: `${this.config.url}/login.cgi`, formData, followAllRedirects: true, jar: this.cookies,
          }, (err): void => {
            if (err) return console.error(err);
            resolve();
          });
        },
      );
    });
  }

  private getWirelessStatus(): void {
    request.get({ url: `${this.config.url}/status.cgi`, jar: this.cookies }, (err, res, body): void => {
      if (err) {
        console.error(err);
        return;
      }
      if (res.request.uri.pathname !== '/status.cgi') {
        // Need to log-in again.
        this.logIn().then((): void => this.getWirelessStatus());
        return;
      }
      this.status = JSON.parse(body);
    });
  }

  public getStatus(): any {
    return this.status;
  }
}

export default Radio;