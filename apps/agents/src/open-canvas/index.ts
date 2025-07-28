import { Command, END, Send, START, StateGraph } from "@langchain/langgraph";
import { DEFAULT_INPUTS } from "@opencanvas/shared/constants";
import { customAction } from "./nodes/customAction";
import { generateFollowup } from "./nodes/generateFollowup";
import { generatePath } from "./nodes/generate-path/index";
import { reflectNode } from "./nodes/reflect";
import { rewriteArtifact } from "./nodes/rewrite-artifact/index";
import { rewriteArtifactTheme } from "./nodes/rewriteArtifactTheme";
import { updateArtifact } from "./nodes/updateArtifact";
import { replyToGeneralInput } from "./nodes/replyToGeneralInput";
import { rewriteCodeArtifactTheme } from "./nodes/rewriteCodeArtifactTheme";
import { generateTitleNode } from "./nodes/generateTitle";
import { updateHighlightedText } from "./nodes/updateHighlightedText";
import { OpenCanvasGraphAnnotation } from "./state";
import { summarizer } from "./nodes/summarizer";
import { graph as webSearchGraph } from "@/web-search/index";
import { createAIMessageFromWebResults } from "@/utils";
import { analyzeRequirements } from "./nodes/analyze-requirements";
import { generateWebDSL } from "./nodes/generate-web-dsl/index";

const routeNode = (state: typeof OpenCanvasGraphAnnotation.State) => {
  if (!state.next) {
    throw new Error("'next' state field not set.");
  }

  return new Send(state.next, {
    ...state,
  });
};

const cleanState = (_: typeof OpenCanvasGraphAnnotation.State) => {
  return {
    ...DEFAULT_INPUTS,
  };
};

// ~ 4 chars per token, max tokens of 75000. 75000 * 4 = 300000
const CHARACTER_MAX = 300000;

function simpleTokenCalculator(
  state: typeof OpenCanvasGraphAnnotation.State
): "summarizer" | typeof END {
  const totalChars = state._messages.reduce((acc, msg) => {
    if (typeof msg.content !== "string") {
      const allContent = msg.content.flatMap((c) =>
        "text" in c ? (c.text as string) : []
      );
      const totalChars = allContent.reduce((acc, c) => acc + c.length, 0);
      return acc + totalChars;
    }
    return acc + msg.content.length;
  }, 0);

  if (totalChars > CHARACTER_MAX) {
    return "summarizer";
  }
  return END;
}

/**
 * Conditionally route to the "generateTitle" node if there are only
 * two messages in the conversation. This node generates a concise title
 * for the conversation which is displayed in the thread history.
 */
const conditionallyGenerateTitle = (
  state: typeof OpenCanvasGraphAnnotation.State
): "generateTitle" | "summarizer" | typeof END => {
  if (state.messages.length > 2) {
    // Do not generate if there are more than two messages (meaning it's not the first human-AI conversation)
    return simpleTokenCalculator(state);
  }
  return "generateTitle";
};

/**
 * Updates state & routes the graph based on whether or not the web search
 * graph returned any results.
 */
function routePostWebSearch(
  state: typeof OpenCanvasGraphAnnotation.State
): Send | Command {
  // If there is more than one artifact, then route to the "rewriteArtifact" node. Otherwise, generate the artifact.
  const includesArtifacts = state.artifact?.contents?.length > 1;
  if (!state.webSearchResults?.length) {
    return new Send(
      // includesArtifacts ? "rewriteArtifact" : "generateArtifact",
      "rewriteArtifact",
      {
        ...state,
        webSearchEnabled: false,
      }
    );
  }

  // This message is used as a way to reference the web search results in future chats.
  const webSearchResultsMessage = createAIMessageFromWebResults(
    state.webSearchResults
  );

  return new Command({
    // goto: includesArtifacts ? "rewriteArtifact" : "generateArtifact",
    goto: "rewriteArtifact",
    update: {
      webSearchEnabled: false,
      messages: [webSearchResultsMessage],
      _messages: [webSearchResultsMessage],
    },
  });
}

const builder = new StateGraph(OpenCanvasGraphAnnotation)
  // Start node & edge
  .addNode("generatePath", generatePath)
  .addEdge(START, "generatePath")
  // Nodes
  .addNode("analyzeRequirements", analyzeRequirements)
  .addNode("generateWebDSL", generateWebDSL)
  .addNode("replyToGeneralInput", replyToGeneralInput)
  .addNode("rewriteArtifact", rewriteArtifact)
  .addNode("rewriteArtifactTheme", rewriteArtifactTheme)
  .addNode("rewriteCodeArtifactTheme", rewriteCodeArtifactTheme)
  .addNode("updateArtifact", updateArtifact)
  .addNode("updateHighlightedText", updateHighlightedText)
  // .addNode("generateArtifact", generateArtifact)
  .addNode("customAction", customAction)
  .addNode("generateFollowup", generateFollowup)
  .addNode("cleanState", cleanState)
  .addNode("reflect", reflectNode)
  .addNode("generateTitle", generateTitleNode)
  .addNode("summarizer", summarizer)
  .addNode("webSearch", webSearchGraph)
  .addNode("routePostWebSearch", routePostWebSearch)
  // Initial router
  .addConditionalEdges("generatePath", routeNode, [
    "analyzeRequirements",
    "generateWebDSL",
    "updateArtifact",
    "rewriteArtifactTheme",
    "rewriteCodeArtifactTheme",
    "replyToGeneralInput",
    // "generateArtifact",
    "rewriteArtifact",
    "customAction",
    "updateHighlightedText",
    "webSearch",
  ])
  // Edges
  .addEdge("analyzeRequirements", "generateWebDSL")
  .addEdge("generateWebDSL", "generatePath")
  // .addEdge("generateArtifact", "generateFollowup")
  .addEdge("updateArtifact", "generateFollowup")
  .addEdge("updateHighlightedText", "generateFollowup")
  .addEdge("rewriteArtifact", "generateFollowup")
  .addEdge("rewriteArtifactTheme", "generateFollowup")
  .addEdge("rewriteCodeArtifactTheme", "generateFollowup")
  .addEdge("customAction", "generateFollowup")
  .addEdge("webSearch", "routePostWebSearch")
  // End edges
  .addEdge("replyToGeneralInput", "cleanState")
  // Only reflect if an artifact was generated/updated.
  .addEdge("generateFollowup", "reflect")
  .addEdge("reflect", "cleanState")
  .addConditionalEdges("cleanState", conditionallyGenerateTitle, [
    END,
    "generateTitle",
    "summarizer",
  ])
  .addEdge("generateTitle", END)
  .addEdge("summarizer", END);

export const graph = builder.compile().withConfig({ runName: "open_canvas" });
