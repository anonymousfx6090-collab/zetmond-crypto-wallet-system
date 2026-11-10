import { loadConfig, ConfigurationError } from "./config";
import { smileIdCallbackSettings } from "./providers/smile-id.settings";
// Owner terminal only. This credential URL must never be returned by a public API.
if (require.main === module) {
  try {
    const settings = smileIdCallbackSettings(loadConfig());
    console.log(
      JSON.stringify({ mode: settings.mode, callbackUrl: settings.privateUrl }),
    );
  } catch (error) {
    console.error(
      error instanceof ConfigurationError
        ? error.message
        : "Callback settings unavailable.",
    );
    process.exitCode = 1;
  }
}
