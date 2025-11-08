import { exec } from "child_process";
import { promisify } from "util";
import { j as setCredentialFeature, C as CredentialsProviderError, m as getProfileName } from "./main-ZlvUAe55.js";
import { e as externalDataInterceptor } from "./externalDataInterceptor-D1FJAi7A.js";
import { p as parseKnownFiles } from "./parseKnownFiles-DIBA-HzF.js";
const getValidatedProcessCredentials = (profileName, data, profiles) => {
  var _a;
  if (data.Version !== 1) {
    throw Error(`Profile ${profileName} credential_process did not return Version 1.`);
  }
  if (data.AccessKeyId === void 0 || data.SecretAccessKey === void 0) {
    throw Error(`Profile ${profileName} credential_process returned invalid credentials.`);
  }
  if (data.Expiration) {
    const currentTime = /* @__PURE__ */ new Date();
    const expireTime = new Date(data.Expiration);
    if (expireTime < currentTime) {
      throw Error(`Profile ${profileName} credential_process returned expired credentials.`);
    }
  }
  let accountId = data.AccountId;
  if (!accountId && ((_a = profiles == null ? void 0 : profiles[profileName]) == null ? void 0 : _a.aws_account_id)) {
    accountId = profiles[profileName].aws_account_id;
  }
  const credentials = {
    accessKeyId: data.AccessKeyId,
    secretAccessKey: data.SecretAccessKey,
    ...data.SessionToken && { sessionToken: data.SessionToken },
    ...data.Expiration && { expiration: new Date(data.Expiration) },
    ...data.CredentialScope && { credentialScope: data.CredentialScope },
    ...accountId && { accountId }
  };
  setCredentialFeature(credentials, "CREDENTIALS_PROCESS", "w");
  return credentials;
};
const resolveProcessCredentials = async (profileName, profiles, logger) => {
  var _a, _b;
  const profile = profiles[profileName];
  if (profiles[profileName]) {
    const credentialProcess = profile["credential_process"];
    if (credentialProcess !== void 0) {
      const execPromise = promisify(((_b = (_a = externalDataInterceptor) == null ? void 0 : _a.getTokenRecord) == null ? void 0 : _b.call(_a).exec) ?? exec);
      try {
        const { stdout } = await execPromise(credentialProcess);
        let data;
        try {
          data = JSON.parse(stdout.trim());
        } catch {
          throw Error(`Profile ${profileName} credential_process returned invalid JSON.`);
        }
        return getValidatedProcessCredentials(profileName, data, profiles);
      } catch (error) {
        throw new CredentialsProviderError(error.message, { logger });
      }
    } else {
      throw new CredentialsProviderError(`Profile ${profileName} did not contain credential_process.`, { logger });
    }
  } else {
    throw new CredentialsProviderError(`Profile ${profileName} could not be found in shared credentials file.`, {
      logger
    });
  }
};
const fromProcess = (init = {}) => async ({ callerClientConfig } = {}) => {
  var _a;
  (_a = init.logger) == null ? void 0 : _a.debug("@aws-sdk/credential-provider-process - fromProcess");
  const profiles = await parseKnownFiles(init);
  return resolveProcessCredentials(getProfileName({
    profile: init.profile ?? (callerClientConfig == null ? void 0 : callerClientConfig.profile)
  }), profiles, init.logger);
};
export {
  fromProcess
};
