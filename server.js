const config = require('./src/config');
const { createApp } = require('./src/app');

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`Portfolio running at http://localhost:${config.PORT}`);
  console.log(`Admin panel:        http://localhost:${config.PORT}/admin`);
});

function shutdown() {
  server.close(() => {
    app.locals.db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
