import { t as tokenIntercept } from "./getSSOTokenFromFile-Q_lKf8wv.js";
import { g as fileIntercept } from "./main-vnQy2iDr.js";
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
