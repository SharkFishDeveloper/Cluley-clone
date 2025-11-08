import { t as tokenIntercept } from "./getSSOTokenFromFile-DhGH1trc.js";
import { g as fileIntercept } from "./main-ZlvUAe55.js";
const externalDataInterceptor = {
  getFileRecord() {
    return fileIntercept;
  },
  interceptFile(path, contents) {
    fileIntercept[path] = Promise.resolve(contents);
  },
  getTokenRecord() {
    return tokenIntercept;
  },
  interceptToken(id, contents) {
    tokenIntercept[id] = contents;
  }
};
export {
  externalDataInterceptor as e
};
