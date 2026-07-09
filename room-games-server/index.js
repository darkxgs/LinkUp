import { createRoomGamesServer } from './createServer.mjs';

const port = Number(process.env.PORT || 8080);
const { server } = createRoomGamesServer();

server.listen(port, () => {
  console.log(`LinkUp room games WS server on http://0.0.0.0:${port}`);
});
