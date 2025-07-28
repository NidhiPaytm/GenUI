import { SearchResult } from "@opencanvas/shared/types";
import { WebSearchState } from "../state";
import Exa from "exa-js";
import { ExaRetriever } from "@langchain/exa";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "@/open-canvas/utils/llm-logger";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function search(
  state: WebSearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebSearchState>> {
  const requestInfo = extractRequestInfo(config);
  const exaClient = new Exa(process.env.EXA_API_KEY || "");
  const retriever = new ExaRetriever({
    client: exaClient,
    searchArgs: {
      filterEmptyResults: true,
      numResults: 5,
    },
  });

  const query = state.messages[state.messages.length - 1].content as string;

  let results: any;

  try {
    results = await retriever.invoke(query);

    // Log the LLM call with simplified format
    await SimpleLLMLogger.logLLMStep(
      "webSearch",
      "",
      query,
      extractOutputContent(results),
      requestInfo
    );
  } catch (e) {
    console.error("Error searching the web:", e);
    return {};
  }

  return {
    webSearchResults: results as SearchResult[],
  };
}
