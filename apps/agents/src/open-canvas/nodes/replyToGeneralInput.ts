import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { Reflections } from "@opencanvas/shared/types";
import {
  createContextDocumentMessages,
  ensureStoreInConfig,
  formatArtifactContentWithTemplate,
  formatReflections,
  getModelFromConfig,
  isUsingO1MiniModel,
} from "@/utils";
import { CURRENT_ARTIFACT_PROMPT, NO_ARTIFACT_PROMPT } from "../prompts";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "../utils/llm-logger";

/**
 * Generate responses to questions. Does not generate artifacts.
 */
export const replyToGeneralInput = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const requestInfo = extractRequestInfo(config);
  const smallModel = await getModelFromConfig(config);

  const prompt = `You are an AI assistant tasked with responding to the users question.
  
The user has generated artifacts in the past. Use the following artifacts as context when responding to the users question.

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

{currentArtifactPrompt}`;

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const formattedPrompt = prompt
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
          CURRENT_ARTIFACT_PROMPT,
          currentArtifactContent
        )
        : NO_ARTIFACT_PROMPT
    );

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);

  const messages = [
    { role: isO1MiniModel ? "user" : "system", content: formattedPrompt },
    ...contextDocumentMessages,
    ...state._messages,
  ];

  let response;
  try {
    response = await smallModel.invoke(messages);

    // Log the LLM call with simplified format
    await SimpleLLMLogger.logLLMStep(
      "replyToGeneralInput",
      extractSystemPrompt(messages),
      extractUserPrompt(messages),
      extractOutputContent(response),
      requestInfo
    );
  } catch (e) {
    console.error("Error in replyToGeneralInput:", e);
    throw e;
  }

  return {
    messages: [response],
    _messages: [response],
  };
};
