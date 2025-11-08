import { C as CredentialsProviderError, j as setCredentialFeature, n as chain, m as getProfileName } from "./main-vnQy2iDr.js";
import { p as parseKnownFiles } from "./parseKnownFiles-Er1BH5qs.js";
const resolveCredentialSource = (credentialSource, profileName, logger) => {
  const sourceProvidersMap = {
    EcsContainer: async (options) => {
      const { fromHttp } = await import("./index-3yIpur8K.js");
      const { fromContainerMetadata } = await import("./index-CSFOEkOR.js");
      logger == null ? void 0 : logger.debug("@aws-sdk/credential-provider-ini - credential_source is EcsContainer");
      return async () => chain(fromHttp(options ?? {}), fromContainerMetadata(options))().then(setNamedProvider);
    },
    Ec2InstanceMetadata: async (options) => {
      logger == null ? void 0 : logger.debug("@aws-sdk/credential-provider-ini - credential_source is Ec2InstanceMetadata");
      const { fromInstanceMetadata } = await import("./index-CSFOEkOR.js");
      return async () => fromInstanceMetadata(options)().then(setNamedProvider);
    },
    Environment: async (options) => {
      logger == null ? void 0 : logger.debug("@aws-sdk/credential-provider-ini - credential_source is Environment");
      const { fromEnv } = await import("./index-CE9ly5Zm.js");
      return async () => fromEnv(options)().then(setNamedProvider);
    }
  };
  if (credentialSource in sourceProvidersMap) {
    return sourceProvidersMap[credentialSource];
  } else {
    throw new CredentialsProviderError(`Unsupported credential source in profile ${profileName}. Got ${credentialSource}, expected EcsContainer or Ec2InstanceMetadata or Environment.`, { logger });
  }
};
const setNamedProvider = (creds) => setCredentialFeature(creds, "CREDENTIALS_PROFILE_NAMED_PROVIDER", "p");
const isAssumeRoleProfile = (arg, { profile = "default", logger } = {}) => {
  return Boolean(arg) && typeof arg === "object" && typeof arg.role_arn === "string" && ["undefined", "string"].indexOf(typeof arg.role_session_name) > -1 && ["undefined", "string"].indexOf(typeof arg.external_id) > -1 && ["undefined", "string"].indexOf(typeof arg.mfa_serial) > -1 && (isAssumeRoleWithSourceProfile(arg, { profile, logger }) || isCredentialSourceProfile(arg, { profile, logger }));
};
const isAssumeRoleWithSourceProfile = (arg, { profile, logger }) => {
  var _a;
  const withSourceProfile = typeof arg.source_profile === "string" && typeof arg.credential_source === "undefined";
  if (withSourceProfile) {
    (_a = logger == null ? void 0 : logger.debug) == null ? void 0 : _a.call(logger, `    ${profile} isAssumeRoleWithSourceProfile source_profile=${arg.source_profile}`);
  }
  return withSourceProfile;
};
const isCredentialSourceProfile = (arg, { profile, logger }) => {
  var _a;
  const withProviderProfile = typeof arg.credential_source === "string" && typeof arg.source_profile === "undefined";
  if (withProviderProfile) {
    (_a = logger == null ? void 0 : logger.debug) == null ? void 0 : _a.call(logger, `    ${profile} isCredentialSourceProfile credential_source=${arg.credential_source}`);
  }
  return withProviderProfile;
};
const resolveAssumeRoleCredentials = async (profileName, profiles, options, visitedProfiles = {}, resolveProfileData2) => {
  var _a, _b, _c;
  (_a = options.logger) == null ? void 0 : _a.debug("@aws-sdk/credential-provider-ini - resolveAssumeRoleCredentials (STS)");
  const profileData = profiles[profileName];
  const { source_profile, region } = profileData;
  if (!options.roleAssumer) {
    const { getDefaultRoleAssumer } = await import("./index-DX2LdtQy.js");
    options.roleAssumer = getDefaultRoleAssumer({
      ...options.clientConfig,
      credentialProviderLogger: options.logger,
      parentClientConfig: {
        ...options == null ? void 0 : options.parentClientConfig,
        region: region ?? ((_b = options == null ? void 0 : options.parentClientConfig) == null ? void 0 : _b.region)
      }
    }, options.clientPlugins);
  }
  if (source_profile && source_profile in visitedProfiles) {
    throw new CredentialsProviderError(`Detected a cycle attempting to resolve credentials for profile ${getProfileName(options)}. Profiles visited: ` + Object.keys(visitedProfiles).join(", "), { logger: options.logger });
  }
  (_c = options.logger) == null ? void 0 : _c.debug(`@aws-sdk/credential-provider-ini - finding credential resolver using ${source_profile ? `source_profile=[${source_profile}]` : `profile=[${profileName}]`}`);
  const sourceCredsProvider = source_profile ? resolveProfileData2(source_profile, profiles, options, {
    ...visitedProfiles,
    [source_profile]: true
  }, isCredentialSourceWithoutRoleArn(profiles[source_profile] ?? {})) : (await resolveCredentialSource(profileData.credential_source, profileName, options.logger)(options))();
  if (isCredentialSourceWithoutRoleArn(profileData)) {
    return sourceCredsProvider.then((creds) => setCredentialFeature(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
  } else {
    const params = {
      RoleArn: profileData.role_arn,
      RoleSessionName: profileData.role_session_name || `aws-sdk-js-${Date.now()}`,
      ExternalId: profileData.external_id,
      DurationSeconds: parseInt(profileData.duration_seconds || "3600", 10)
    };
    const { mfa_serial } = profileData;
    if (mfa_serial) {
      if (!options.mfaCodeProvider) {
        throw new CredentialsProviderError(`Profile ${profileName} requires multi-factor authentication, but no MFA code callback was provided.`, { logger: options.logger, tryNextLink: false });
      }
      params.SerialNumber = mfa_serial;
      params.TokenCode = await options.mfaCodeProvider(mfa_serial);
    }
    const sourceCreds = await sourceCredsProvider;
    return options.roleAssumer(sourceCreds, params).then((creds) => setCredentialFeature(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
  }
};
const isCredentialSourceWithoutRoleArn = (section) => {
  return !section.role_arn && !!section.credential_source;
};
const isProcessProfile = (arg) => Boolean(arg) && typeof arg === "object" && typeof arg.credential_process === "string";
const resolveProcessCredentials = async (options, profile) => import("./index-o_YHuR0E.js").then(({ fromProcess }) => fromProcess({
  ...options,
  profile
})().then((creds) => setCredentialFeature(creds, "CREDENTIALS_PROFILE_PROCESS", "v")));
const resolveSsoCredentials = async (profile, profileData, options = {}) => {
  const { fromSSO } = await import("./index-s9-luBhV.js");
  return fromSSO({
    profile,
    logger: options.logger,
    parentClientConfig: options.parentClientConfig,
    clientConfig: options.clientConfig
  })().then((creds) => {
    if (profileData.sso_session) {
      return setCredentialFeature(creds, "CREDENTIALS_PROFILE_SSO", "r");
    } else {
      return setCredentialFeature(creds, "CREDENTIALS_PROFILE_SSO_LEGACY", "t");
    }
  });
};
const isSsoProfile = (arg) => arg && (typeof arg.sso_start_url === "string" || typeof arg.sso_account_id === "string" || typeof arg.sso_session === "string" || typeof arg.sso_region === "string" || typeof arg.sso_role_name === "string");
const isStaticCredsProfile = (arg) => Boolean(arg) && typeof arg === "object" && typeof arg.aws_access_key_id === "string" && typeof arg.aws_secret_access_key === "string" && ["undefined", "string"].indexOf(typeof arg.aws_session_token) > -1 && ["undefined", "string"].indexOf(typeof arg.aws_account_id) > -1;
const resolveStaticCredentials = async (profile, options) => {
  var _a;
  (_a = options == null ? void 0 : options.logger) == null ? void 0 : _a.debug("@aws-sdk/credential-provider-ini - resolveStaticCredentials");
  const credentials = {
    accessKeyId: profile.aws_access_key_id,
    secretAccessKey: profile.aws_secret_access_key,
    sessionToken: profile.aws_session_token,
    ...profile.aws_credential_scope && { credentialScope: profile.aws_credential_scope },
    ...profile.aws_account_id && { accountId: profile.aws_account_id }
  };
  return setCredentialFeature(credentials, "CREDENTIALS_PROFILE", "n");
};
const isWebIdentityProfile = (arg) => Boolean(arg) && typeof arg === "object" && typeof arg.web_identity_token_file === "string" && typeof arg.role_arn === "string" && ["undefined", "string"].indexOf(typeof arg.role_session_name) > -1;
const resolveWebIdentityCredentials = async (profile, options) => import("./index-B5CwQ-Di.js").then(({ fromTokenFile }) => fromTokenFile({
  webIdentityTokenFile: profile.web_identity_token_file,
  roleArn: profile.role_arn,
  roleSessionName: profile.role_session_name,
  roleAssumerWithWebIdentity: options.roleAssumerWithWebIdentity,
  logger: options.logger,
  parentClientConfig: options.parentClientConfig
})().then((creds) => setCredentialFeature(creds, "CREDENTIALS_PROFILE_STS_WEB_ID_TOKEN", "q")));
const resolveProfileData = async (profileName, profiles, options, visitedProfiles = {}, isAssumeRoleRecursiveCall = false) => {
  const data = profiles[profileName];
  if (Object.keys(visitedProfiles).length > 0 && isStaticCredsProfile(data)) {
    return resolveStaticCredentials(data, options);
  }
  if (isAssumeRoleRecursiveCall || isAssumeRoleProfile(data, { profile: profileName, logger: options.logger })) {
    return resolveAssumeRoleCredentials(profileName, profiles, options, visitedProfiles, resolveProfileData);
  }
  if (isStaticCredsProfile(data)) {
    return resolveStaticCredentials(data, options);
  }
  if (isWebIdentityProfile(data)) {
    return resolveWebIdentityCredentials(data, options);
  }
  if (isProcessProfile(data)) {
    return resolveProcessCredentials(options, profileName);
  }
  if (isSsoProfile(data)) {
    return await resolveSsoCredentials(profileName, data, options);
  }
  throw new CredentialsProviderError(`Could not resolve credentials using profile: [${profileName}] in configuration/credentials file(s).`, { logger: options.logger });
};
const fromIni = (_init = {}) => async ({ callerClientConfig } = {}) => {
  var _a;
  const init = {
    ..._init,
    parentClientConfig: {
      ...callerClientConfig,
      ..._init.parentClientConfig
    }
  };
  (_a = init.logger) == null ? void 0 : _a.debug("@aws-sdk/credential-provider-ini - fromIni");
  const profiles = await parseKnownFiles(init);
  return resolveProfileData(getProfileName({
    profile: _init.profile ?? (callerClientConfig == null ? void 0 : callerClientConfig.profile)
  }), profiles, init);
};
export {
  fromIni
};
