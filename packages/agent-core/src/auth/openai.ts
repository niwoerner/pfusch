import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { createModels } from "@earendil-works/pi-ai/models";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { getOrCreateDeviceId } from "../settings/settings.js";
import { FileCredentialStore } from "./file-store.js";

export async function authOpenAI() {
  const credentials = new FileCredentialStore("./state/auth.json");
  const models = createModels({ credentials });
  models.setProvider(openaiProvider());

  if ((await credentials.read("openai"))?.type !== "oauth") {
    const deviceId = await getOrCreateDeviceId();
    const terminal = createInterface({ input: stdin, output: stdout });
    try {
      await models.login(
        "openai",
        "oauth",
        {
          prompt: ({ message, signal }) => terminal.question(`${message} `, { signal }),
          notify: (event) => {
            if (event.type === "auth_url") console.log(event.url);
            if (event.type === "progress") console.log(event.message);
          },
        },
        { agentName: "Pfusch", getDeviceId: () => deviceId },
      );
    } finally {
      terminal.close();
    }
  }

  return models;
}
