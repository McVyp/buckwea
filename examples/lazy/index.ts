import { greet } from "./greet.js";

console.log(greet("entry"));

import("./heavy.js").then((m) => {
  console.log(m.double(21));
});
