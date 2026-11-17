import { createApp } from "./app";
import { createSeededStore } from "./store";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "localhost";

createApp(createSeededStore(new Date())).listen(port, () => {
  console.log(`http://localhost:${port} で起動しました`);
});
