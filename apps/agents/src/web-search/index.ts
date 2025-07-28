import { StateGraph, START, END } from "@langchain/langgraph";
import { WebSearchGraphAnnotation, WebSearchState } from "./state";
import { search } from "./nodes/search";
import { queryGenerator } from "./nodes/query-generator";
import { classifyMessage } from "./nodes/classify-message";

function searchOrEndConditional(
  state: WebSearchState
): "queryGenerator" | typeof END {
  if (state.shouldSearch) {
    return "queryGenerator";
  }
  return END;
}

const builder = new StateGraph(WebSearchGraphAnnotation)
  .addNode("classifyMessage", classifyMessage)
  .addNode("queryGenerator", queryGenerator)
  .addNode("search", search)
  .addEdge(START, "classifyMessage")
  .addConditionalEdges("classifyMessage", searchOrEndConditional, [
    "queryGenerator",
    END,
  ])
  .addEdge("queryGenerator", "search")
  .addEdge("search", END);

export const graph = builder.compile();

graph.name = "Web Search Graph";
