import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getModelFromConfig } from "@/utils";
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from "@opencanvas/shared/utils/artifacts";
import { Reflections } from "@opencanvas/shared/types";
import { ensureStoreInConfig, formatReflections } from "@/utils";
import { FOLLOWUP_ARTIFACT_PROMPT } from "../prompts";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "../utils/llm-logger";

/**
 * Generate a followup message after generating or updating an artifact.
 */
export const generateFollowup = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // Extract request info for logging
  const requestInfo = extractRequestInfo(config);

  const smallModel = await getModelFromConfig(config, {
    maxTokens: 250,
    // We say tool calling is true here because that'll cause it to use a small model
    isToolCalling: true,
  });

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections, {
      onlyContent: true,
    })
    : "No reflections found.";

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const artifactContent = currentArtifactContent
    ? isArtifactMarkdownContent(currentArtifactContent)
      ? currentArtifactContent.fullMarkdown
      : currentArtifactContent.code
    : undefined;

  const formattedPrompt = FOLLOWUP_ARTIFACT_PROMPT.replace(
    "{artifactContent}",
    artifactContent || "No artifacts generated yet."
  )
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{conversation}",
      state._messages
        .map((msg) => `<${msg.getType()}>\n${msg.content}\n</${msg.getType()}>`)
        .join("\n\n")
    );

  const messages = [
    { role: "user", content: formattedPrompt },
  ];

  let response;
  try {
    response = await smallModel.invoke(messages);

    // Log the LLM call with request info
    await SimpleLLMLogger.logLLMStep(
      "generateFollowup",
      extractSystemPrompt(messages),
      extractUserPrompt(messages),
      extractOutputContent(response),
      requestInfo
    );
  } catch (e) {
    console.error("Error in generateFollowup:", e);
    throw e;
  }

  return {
    messages: [response],
    _messages: [response],
  };
};
