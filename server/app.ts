import express from 'express';
import Router from './controllers/Router';
import Radio from './controllers/Radio';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();

const router = new Router({url: 'http://192.168.0.1', username: "admin", password: 'parasol'})
const radio = new Radio({url: 'http://192.168.0.5', username: "immel", password: 'Immel Dutcher Five'})

const api = express.Router();
api.get('/traffic.json', (req, res): void => {
  res.status(200);
  res.json(router.getStatistics());
});

api.get('/wireless.json', (req, res): void => {
  res.status(200);
  res.json(radio.getStatus());
});

// api.get('/health.json', (req, res): void => {
//   res.status(200);
//   res.json(health.getResults());
// });

// api.get('/reset', (req, res): void => {
//   outlet.reset();
//   res.status(200);
//   res.send('Outlet reset.');
// });

api.get('/critical', (req, res): void => {
  router.enableCriticalMode();
  res.status(200);
  res.send('Critical mode activated.');
});

api.get('/cleargroups', (req, res): void => {
  router.clearGroups();
  res.status(200);
  res.send('Groups cleared.');
});

app.use('/api', api);
app.get('/', (req, res): void => {
  res.sendFile('index.html', { root: `${__dirname}/public/` });
});

app.use(express.static('public'));

app.listen(3000, (): void => {
  console.log("Server started");
});
