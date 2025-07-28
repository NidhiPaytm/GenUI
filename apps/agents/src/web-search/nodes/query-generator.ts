import { format } from "date-fns";
import { ChatAnthropic } from "@langchain/anthropic";
import { WebSearchState } from "../state";
import { formatMessages } from "@/utils";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "@/open-canvas/utils/llm-logger";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const QUERY_GENERATOR_PROMPT = `You're a helpful AI assistant tasked with writing a query to search the web.
You're provided with a list of messages between a user and an AI assistant.
The most recent message from the user is the one you should update to be a more search engine friendly query.

Try to keep the new query as similar to the message as possible, while still being search engine friendly.

Here is the conversation between the user and the assistant, in order of oldest to newest:

<conversation>
{conversation}
</conversation>

<additional_context>
{additional_context}
</additional_context>

Respond ONLY with the search query, and nothing else.`;

export async function queryGenerator(
  state: WebSearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebSearchState>> {
  const requestInfo = extractRequestInfo(config);
  const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    temperature: 0,
  });

  const additionalContext = `The current date is ${format(new Date(), "PPpp")}`;

  const formattedMessages = formatMessages(state.messages);
  const formattedPrompt = QUERY_GENERATOR_PROMPT.replace(
    "{conversation}",
    formattedMessages
  ).replace("{additional_context}", additionalContext);


  const messages = [
    { role: "user", content: formattedPrompt },
  ];

  let response: any;
  try {
    const response = await model.invoke(messages);

    // Log the LLM call with simplified format
    await SimpleLLMLogger.logLLMStep(
      "webSearchQueryGenerator",
      extractSystemPrompt(messages),
      extractUserPrompt(messages),
      extractOutputContent(response),
      requestInfo
    );
  } catch (e) {
    console.error("Error generating or parsing Web Search Query:", e);
    return {};
  }

  if (!response) {
    return {};
  }

  return {
    query: response.content as string,
  };
}
