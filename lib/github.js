const { App } = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { retry } = require("@octokit/plugin-retry");
const { throttling } = require("@octokit/plugin-throttling");

// Customized Octokit that meets our needs for many requests per second
const ActivtyOctokit = Octokit.plugin(throttling).plugin(retry).plugin(paginateRest);

/**
 * Read GitHub App credentials from our environment
 */
exports.getAuth = function getAuth() {
  const requiredEnvs = [
    "ADMIN_TOKEN",
    "INACTIVE_APP_ID",
    "INACTIVE_CLIENT_ID",
    "INACTIVE_CLIENT_SECRET",
    "INACTIVE_PRIVATE_KEY",
  ];

  for (const requiredEnv of requiredEnvs) {
    if (!Object.prototype.hasOwnProperty.call(process.env, requiredEnv)) {
      console.error(`${requiredEnv} is missing from environment.`);
      process.exit(1);
    }
  }

  const auth = {
    appId: process.env.INACTIVE_APP_ID,
    clientId: process.env.INACTIVE_CLIENT_ID,
    clientSecret: process.env.INACTIVE_CLIENT_SECRET,
    privateKey: process.env.INACTIVE_PRIVATE_KEY,
    token: process.env.ADMIN_TOKEN,
  };

  return auth;
};

/**
 * Get a ready-to-go instance of our GitHub App
 */
exports.getGitHubApp = function getGitHubApp(auth) {
  return new App({
    appId: auth.appId,
    privateKey: auth.privateKey,
    oauth: {
      clientId: auth.clientId,
      clientSecret: auth.clientSecret,
    },
    Octokit: ActivtyOctokit.defaults({
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
          console.warn(`Retrying after ${retryAfter} seconds! Retry Count: ${options.request.retryCount}`);
          return true;
        },
        onAbuseLimit: (retryAfter, options) => {
          console.warn(`Abuse detected for request ${options.method} ${options.url}`);
        },
      },
    }),
  });
};

/**
 * Get a ready-to-go instance of Octokit
 */
exports.getOctokit = function getOctokit(token) {
  return new ActivtyOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options) => {
        console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
        console.warn(`Retrying after ${retryAfter} seconds! Retry Count: ${options.request.retryCount}`);
        return true;
      },
      onAbuseLimit: (retryAfter, options) => {
        console.warn(`Abuse detected for request ${options.method} ${options.url}`);
      },
    },
  });
};
