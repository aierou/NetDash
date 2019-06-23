import request from 'request';
import crypto from 'crypto';
import Device from './Device';

const LIST_THROTTLE_UP = -1;
const LIST_THROTTLE_DOWN = -2;
const LIST_THROTTLE_BOTH = -3;
const LIST_CRITICAL = -4;
const CRITICAL_MODE_DURATION = 300 * 1000;

class Router extends Device {
  private criticalMode: boolean = false;
  private criticalTimer: any;
  private cookies: request.CookieJar;
  private hostnames: string[] = [];
  private trafficStats: string[] = [];

  public constructor(config: DeviceConfig) {
    super(config);
    this.cookies = request.jar();
    this.logIn().then((): void => {
      // Reset throttling groups
      this.clearGroups();

      this.getDHCPClients();
      
      setInterval((): void => this.update(), 2000);
      setInterval((): void => this.lazyUpdate(), 60000);
    });
  }

  public get headers(): any{
    return {
      Referer: `${this.config.url}/logon/logon.htm`, // just need some "valid" referer
    }; 
  }

  private update(): void {
    this.getTraffic();
  }

  private lazyUpdate(): void {
    this.getDHCPClients();
  }

  public enableCriticalMode(): void {
    this.criticalMode = true;
    this.clearGroups(true);
    this.criticalTimer = setTimeout((): void => {
      this.criticalMode = false;
      this.setGroup(LIST_CRITICAL, []);
    }, CRITICAL_MODE_DURATION);
    const list = [...(Array(47) as any).keys()].map((x): number => x += 1);
    // TODO: Handle this with priority list
    list.splice(0, 1); // me
    this.setGroup(LIST_CRITICAL, list);
  };

  public clearGroups(critical = false): void {
    this.setGroup(LIST_THROTTLE_UP, []);
    this.setGroup(LIST_THROTTLE_DOWN, []);
    this.setGroup(LIST_THROTTLE_BOTH, []);
    if (!critical) this.setGroup(LIST_CRITICAL, []); // Ideal solution here would be a request queue
    clearTimeout(this.criticalTimer);
  };
  
  public setGroup(groupId: number, list: number[]): void {
    let listString = 'NULL';
    if(list.length > 0) listString = list.join(',');

    /* eslint-disable */
    const formData = {
      rd_view: 1,
      slt_user: 0,
      slt_group: groupId,
      selectgroup2: '',
      selectuser2: listString,
      slt_user2: '',
      slt_group2: groupId,
    };
    /* eslint-enable */

    request.post({
      url: `${this.config.url}/userRpm/Ugm_View.htm`, form: formData, followAllRedirects: true, jar: this.cookies, headers: this.headers,
    }, (err, res): void => {
      if (err) console.log(err);
      // This seems to be the only variable (outside of parsing html) that identifies a logout
      if (res.headers['set-cookie']) {
        this.logIn().then((): void => {
          this.setGroup(groupId, list);
        });
      }
    });
  }
  
  public logIn(): Promise<void> {
    return new Promise((resolve): void => {
      request.get({ url: this.config.url, followAllRedirects: true, jar: this.cookies }, (): void => {
        // Lol what the hell is this (how the client sends the password)
        const cs = this.cookies.getCookieString(this.config.url).split('=')[1];
        const tmpPass = crypto.createHash('md5').update(this.config.password).digest('hex');
        const hash = crypto.createHash('md5').update(`${tmpPass.toUpperCase()}:${cs}`).digest('hex');
        const encoded = `${this.config.username}:${hash.toUpperCase()}`;
        const formData = {
          encoded,
          nonce: cs,
          URL: '../logon/loginJump.htm',
        };
        request.post({
          url: `${this.config.url}/logon/loginJump.htm`, form: formData, followAllRedirects: true, jar: this.cookies, headers: this.headers,
        }, (): void => {
          // This request is necessary to kick out someone who is already logged-in to the router. Always sending it is harmless.
          request.get({
            url: `${this.config.url}/logon/loginConfirm.htm`, followAllRedirects: true, jar: this.cookies, headers: this.headers,
          }, (): void => {
            resolve();
          });
        });
      });
    });
  }
  
  private getDHCPClients(): void {
    request.get({
      url: `${this.config.url}/userRpm/DhcpServer_ClientList.htm?slt_interface=0`, followAllRedirects: true, jar: this.cookies, headers: this.headers,
    }, (err, res, body): void => {
      if (err) {
        console.log(err);
        return;
      }
      // This seems to be the only variable (outside of parsing html) that identifies a logout
      if (res.headers['set-cookie']) {
        this.logIn().then((): void => this.getDHCPClients());
        return;
      }
  
      var i = body.indexOf('var dhcpList = new Array(');
      i += 'var dhcpList = new Array('.length;
      const j = body.indexOf('0,0 );\n</script>\n<script language=JavaScript>\nvar dhcpPara = new Array(');
      let nums = body.substring(i, j);
      nums = nums.split('"').join('').split('\n').join(''); // replace all the extra formatting nonsense
  
      const values = nums.split(',');
      const clients: any[] = [];
      const len = Math.floor(values.length / 4) * 4;
      for (let i = 0; i < len; i += 4) {
        const index = i / 4;
        clients[index] = {};
        clients[index].hostname = values[i];
        // clients[index].mac = values[i+2]; // Don't really care about mac address
        clients[index].ip = values[i + 2];
      }
      this.hostnames = clients;
    });
  }
  
  private getTraffic(): void {
    request.get({
      url: `${this.config.url}/userRpm/System_Statics.htm?btn_refresh=btn_refresh&comindex=9&direct=1&interface=1`, followAllRedirects: true, jar: this.cookies, headers: this.headers,
    }, (err, res, body): void => {
      if (err) {
        return console.log(err);
      }
      // This seems to be the only variable (outside of parsing html) that identifies a logout
      if (res.headers['set-cookie']) {
        this.logIn().then((): void => this.getTraffic());
      }

      // Now we get to parse html. Yaaaay
      var i = body.indexOf('var staEntryInf = new Array(');
      i += 'var staEntryInf = new Array('.length;
      const j = body.indexOf(');\n</script>\n</HEAD>');
      let nums = body.substring(i, j);
      nums = nums.split('"').join('').split('\n').join(''); // replace all the extra formatting nonsense
      // Now we need to parse the data into something useful
      const values = nums.split(',');
      const statistics: any[] = [];
      const len = Math.floor(values.length / 10) * 10;
      for (let i = 0; i < len; i += 10) {
        const index = i / 10;
        statistics[index] = [];
        statistics[index][0] = values[i]; // IP
        // Don't care about i+1
        statistics[index][8] = values[i + 2]; // total pkts up
        statistics[index][7] = values[i + 3]; // total pkts down
        statistics[index][6] = values[i + 4]; // total bytes up
        statistics[index][5] = values[i + 5]; // total bytes down
        statistics[index][4] = values[i + 6]; // current pkts up
        statistics[index][3] = values[i + 7]; // current pkts down
        statistics[index][2] = values[i + 8]; // current up
        statistics[index][1] = values[i + 9]; // current down
      }
      this.trafficStats = statistics;
    });
  }
  
  public getStatistics(): any {
    return { traffic: this.trafficStats, clients: this.hostnames };
  };
}
export default Router;
