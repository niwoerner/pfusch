import { createInterface } from "node:readline";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { createRegistry, defineExtension, Harness, section, watchEvents } from "@earendil-works/pi-durable";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import { authOpenAI } from "./auth/openai.js";

const context = BACKGROUND_CONTEXT;
const agentDir = "./.pfusch/"

const models = await authOpenAI();

const registry = createRegistry();
registry.install(CodingTools);
registry.install(
  defineExtension({
    name: "coding",
    sections: [
      section("preamble", () => "You are a coding agent. Use the tools to inspect and change the project.", { tag: false }),
      section("cwd", (input) => input.env?.cwd),
    ],
  }),
);

const harness = await Harness.open(
  await openNodeSqliteStorage(agentDir + "state.sqlite"),
  { models, registry, env: ({ cwd }) => new NodeExecutionEnv({ cwd: cwd ?? process.cwd() }) },
  context,
);

const root = await harness.root(context, {
  agent: { model: { provider: "openai", modelId: "gpt-6-sol" }, cwd: process.cwd() },
});

// Text already printed per content block of the current assistant message.
let printed = new Map<number, string>();
const show = (index: number, text: string) => {
  const before = printed.get(index) ?? "";
  if (text.length > before.length && text.startsWith(before)) process.stdout.write(text.slice(before.length));
  printed.set(index, text);
};
const showMessage = (message: AssistantMessage) =>
  message.content.forEach((block, index) => block.type === "text" && show(index, block.text));

const events = await watchEvents(harness, root.id, context);
events.start(async (batch) => {
  for (const event of batch) {
    switch (event.type) {
      case "message_start":
        printed = new Map();
        if (event.message.role === "assistant") showMessage(event.message);
        break;
      case "message_update":
        for (const change of event.changes) {
          if (change.type === "text_delta") show(change.contentIndex, (printed.get(change.contentIndex) ?? "") + change.delta);
          else if ((change.type === "text_start" || change.type === "block") && change.block.type === "text") show(change.contentIndex, change.block.text);
          else if (change.type === "message") showMessage(change.message);
        }
        break;
      case "message_end": {
        const message = event.entry.model?.[0];
        if (message?.role === "assistant") showMessage(message);
        if (printed.size > 0) process.stdout.write("\n");
        break;
      }
      case "tool_execution_start":
        console.log(`[${event.toolName}] ${JSON.stringify(event.args)}`);
        break;
    }
  }
});
harness.resume();

// Ctrl+C aborts the running turn, or quits when idle. Ctrl+D quits.
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
let running = false;
rl.on("SIGINT", () => {
  if (running) void root.abort(context);
  else rl.close();
});

rl.prompt();
for await (const line of rl) {
  const input = line.trim();
  if (input !== "") {
    running = true;
    const settled = await (await root.submit({ type: "input", content: input }, context)).wait(context);
    running = false;
    if (settled.status === "unanswered") console.log(`(${settled.reason})`);
  }
  rl.prompt();
}

await events.stop();
await harness.close(context);
